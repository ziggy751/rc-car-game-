import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { vehicleSpec } from './catalogue';
import { defaults, type Tune } from './dynamics/tuning';
import { v, q, point, clamp, approach, exponential, ackermann } from './dynamics/math';
import { surfaces, type Surface, type SurfaceQuery } from './dynamics/surfaces';
export { defaults, type Tune };
const VEHICLE = (2 << 16) | 1;
const ZERO = { x: 0, y: 0, z: 0 };
export type Input = { throttle: number; steer: number; brake: boolean; precision?: boolean };
export type Transform = { position: Vector3; rotation: Quaternion };
export type VehiclePose = {
  body: Transform;
  wheels: Transform[];
  carriers: Transform[];
  axles: Transform[];
};
export type Link = {
  body: RAPIER.RigidBody;
  axle: RAPIER.RigidBody;
  top: Vector3;
  bottom: Vector3;
  length: number;
};
export type TyrePatch = { point: Vector3; normal: Vector3; depth: number; load: number };
export type ContactRib = {
  collider: RAPIER.Collider;
  load: number;
  compression: number;
  x: number;
};
export type WheelState = {
  ribs: ContactRib[];
  patches: TyrePatch[];
  sideFlex: number;
  lateralForce: number;
  body: RAPIER.RigidBody;
  carrier: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  contact: boolean;
  normal: Vector3;
  point: Vector3;
  load: number;
  compression: number;
  omega: number;
  slip: number;
  lateralSlip: number;
  steering: number;
  surface: Surface;
  torque: number;
};
/** Multi-body RC crawler. All drive and servo actuation uses equal/opposite physical impulses. */
export class Simulation {
  steeringJoints: RAPIER.RevoluteImpulseJoint[] = [];
  body: RAPIER.RigidBody;
  axles: RAPIER.RigidBody[] = [];
  wheels: WheelState[] = [];
  links: Link[] = [];
  parts: RAPIER.RigidBody[] = [];
  bodyColliders: RAPIER.Collider[] = [];
  springs: {
    axle: RAPIER.RigidBody;
    top: Vector3;
    bottom: Vector3;
    length: number;
    force: number;
  }[] = [];
  steeringInput = 0;
  throttle = 0;
  steer = 0;
  elapsed = 0;
  distance = 0;
  contacts = 0;
  paused = false;
  surface = 'Test concrete';
  motorTorque = 0;
  motorRPM = 0;
  motorCurrent = 0;
  usedAh = 0;
  physicsMs = 0;
  servoTargets = [0, 0];
  driveshaftAngles = [0, 0];
  previous!: VehiclePose;
  current!: VehiclePose;
  last = new Vector3();
  axleColliders: RAPIER.Collider[] = [];
  events = new RAPIER.EventQueue(true);
  private surfaceQuery: SurfaceQuery;
  private height: (x: number, z: number) => number;
  constructor(
    public world: RAPIER.World,
    public tune: Tune,
    options: { surfaceAt?: SurfaceQuery; heightAt?: (x: number, z: number) => number } = {},
  ) {
    this.surfaceQuery = options.surfaceAt ?? (() => surfaces['Test concrete']);
    this.height = options.heightAt ?? (() => 0);
    world.integrationParameters.numSolverIterations = 32;
    world.integrationParameters.numInternalPgsIterations = 2;
    world.integrationParameters.lengthUnit = 1;
    world.integrationParameters.normalizedAllowedLinearError = 0.0002;
    world.integrationParameters.normalizedPredictionDistance = 0.001;
    this.body = this.rigid(new Vector3(0, 0.09, 0));
    const chassis = RAPIER.ColliderDesc.cuboid(0.064, 0.014, 0.15)
      .setTranslation(0, 0.027, 0)
      .setMass(1.05);
    const shell = RAPIER.ColliderDesc.cuboid(0.094, 0.05, 0.112)
      .setTranslation(0, 0.19, -0.035)
      .setMass(0.32);
    const motor = RAPIER.ColliderDesc.ball(0.021).setTranslation(0, 0.055, 0.018).setMass(0.17);
    const battery = RAPIER.ColliderDesc.cuboid(0.028, 0.014, 0.047)
      .setTranslation(0, tune.batteryHeight, tune.batteryPosition)
      .setMass(0.34);
    const esc = RAPIER.ColliderDesc.cuboid(0.025, 0.01, 0.025)
      .setTranslation(0, 0.055, 0.075)
      .setMass(0.08);
    for (const desc of [chassis, shell, motor, battery, esc])
      this.bodyColliders.push(
        this.world.createCollider(
          desc.setCollisionGroups(VEHICLE).setFriction(0.45).setRestitution(0),
          this.body,
        ),
      );
    for (let a = 0; a < 2; a++) {
      const sign = a === 0 ? 1 : -1,
        z = sign * 0.162;
      const axle = this.rigid(new Vector3(0, 0.059, z));
      this.axles.push(axle);
      this.axleColliders.push(
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(0.105, 0.009, 0.011)
            .setMass(0.19)
            .setCollisionGroups(VEHICLE)
            .setFriction(0.35),
          axle,
        ),
      );
      this.axleColliders.push(
        this.world.createCollider(
          RAPIER.ColliderDesc.ball(0.021)
            .setMass(0.06)
            .setCollisionGroups(VEHICLE)
            .setFriction(0.35),
          axle,
        ),
      );
      for (let j = 0; j < 4; j++) {
        const side = j % 2 === 0 ? -1 : 1,
          upper = j >= 2;
        const top = new Vector3(
          side * (upper ? 0.064 : 0.058),
          upper ? 0.045 : 0.004,
          sign * (upper ? 0.04 : 0.047),
        );
        const bottom = new Vector3(
          side * (upper ? 0.025 : 0.102),
          upper ? 0.017 : -0.007,
          upper ? -sign * 0.008 : 0,
        );
        const start = point(this.body, top),
          end = point(axle, bottom),
          direction = end.clone().sub(start);
        const length = direction.length();
        const link = this.rigid(start.clone().add(end).multiplyScalar(0.5));
        link.enableCcd(false);
        link.setRotation(
          new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()),
          true,
        );
        this.world.createCollider(
          RAPIER.ColliderDesc.capsule(Math.max(0, length / 2 - 0.0025), 0.0025)
            .setMass(0.018)
            .setCollisionGroups(0),
          link,
        );
        this.joint(
          RAPIER.JointData.spherical(top, { x: 0, y: -length / 2, z: 0 }),
          this.body,
          link,
        );
        this.joint(RAPIER.JointData.spherical(bottom, { x: 0, y: length / 2, z: 0 }), axle, link);
        this.links.push({ body: link, axle, top, bottom, length });
      }
      for (const side of [-1, 1]) {
        const top = new Vector3(side * 0.084, 0.065, z * 0.92),
          bottom = new Vector3(side * 0.105, 0.005, 0);
        this.springs.push({ axle, top, bottom, length: 0.1, force: 0 });
        this.joint(RAPIER.JointData.rope(0.125, top, bottom), this.body, axle);
        let carrier = axle;
        if (a === 0) {
          carrier = this.rigid(new Vector3(side * 0.105, 0.059, z));
          carrier.enableCcd(false);
          this.world.createCollider(
            RAPIER.ColliderDesc.ball(0.009).setMass(0.018).setCollisionGroups(0),
            carrier,
          );
          const joint = this.joint(
            RAPIER.JointData.revolute({ x: side * 0.105, y: 0, z: 0 }, ZERO, { x: 0, y: 1, z: 0 }),
            axle,
            carrier,
          ) as RAPIER.RevoluteImpulseJoint;
          joint.setLimits(-0.82, 0.82);
          joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
          this.steeringJoints.push(joint);
        }
        const wheel = this.rigid(new Vector3(side * 0.128, 0.059, z));
        const collider = this.world.createCollider(
          RAPIER.ColliderDesc.cylinder(tune.tyreWidth / 2, tune.radius - 0.012)
            .setRotation(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2))
            .setMass(0.13 + tune.wheelWeight)
            .setCollisionGroups(VEHICLE)
            .setFriction(1)
            .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply)
            .setRestitution(0)
            .setContactSkin(0.0003),
          wheel,
        );
        const ribs: ContactRib[] = [];
        for (let rib = 0; rib < 3; rib++) {
          const x = ((rib - 1) * tune.tyreWidth) / 3;
          const shape = this.world.createCollider(
            RAPIER.ColliderDesc.cylinder(tune.tyreWidth / 6, tune.radius)
              .setRotation(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2))
              .setTranslation(x, 0, 0)
              .setMass(0)
              .setCollisionGroups(VEHICLE)
              .setFriction(1)
              .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Multiply)
              .setRestitution(0)
              .setContactSkin(0.0002)
              .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
              .setContactForceEventThreshold(0),
            wheel,
          );
          ribs.push({ collider: shape, x, load: 0, compression: 0 });
        }
        this.joint(
          RAPIER.JointData.revolute({ x: side * (a === 0 ? 0.023 : 0.128), y: 0, z: 0 }, ZERO, {
            x: 1,
            y: 0,
            z: 0,
          }),
          carrier,
          wheel,
        );
        this.wheels.push({
          body: wheel,
          carrier,
          collider,
          ribs,
          patches: [],
          sideFlex: 0,
          lateralForce: 0,
          contact: false,
          normal: new Vector3(0, 1, 0),
          point: new Vector3(),
          load: 0,
          compression: 0,
          omega: 0,
          slip: 0,
          lateralSlip: 0,
          steering: 0,
          surface: surfaces['Test concrete'],
          torque: 0,
        });
      }
    }
    this.applyTune();
    this.reset();
  }
  private rigid(position: Vector3) {
    const b = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setLinearDamping(0.015)
        .setAngularDamping(0.015)
        .setCcdEnabled(true)
        .setCanSleep(false)
        .setAdditionalSolverIterations(8),
    );
    this.parts.push(b);
    return b;
  }
  private joint(data: RAPIER.JointData, a: RAPIER.RigidBody, b: RAPIER.RigidBody) {
    const j = this.world.createImpulseJoint(data, a, b, true);
    j.setContactsEnabled(false);
    return j;
  }
  get mass() {
    return this.parts.reduce((n, b) => n + b.mass(), 0);
  }
  get speed() {
    return Math.hypot(this.body.linvel().x, this.body.linvel().z);
  }
  get ratio() {
    return (
      (this.tune.motor === 'trail' ? this.tune.gearRatio * 0.6 : this.tune.gearRatio) *
      this.tune.axleRatio *
      (this.tune.axleType === 'portal' ? 1.4 : 1)
    );
  }
  get com() {
    let total = 0;
    const centre = new Vector3();
    for (const b of this.parts) {
      centre.addScaledVector(v(b.worldCom()), b.mass());
      total += b.mass();
    }
    return centre.divideScalar(total);
  }
  get roll() {
    const up = new Vector3(0, 1, 0).applyQuaternion(q(this.body.rotation()));
    const right = new Vector3(1, 0, 0).applyQuaternion(q(this.body.rotation()));
    return (Math.atan2(right.y, up.y) * 180) / Math.PI;
  }
  get pitch() {
    const forward = new Vector3(0, 0, 1).applyQuaternion(q(this.body.rotation()));
    return (Math.asin(clamp(forward.y, -1, 1)) * 180) / Math.PI;
  }
  applyTune() {
    if (!this.wheels.length) return;
    const spec = vehicleSpec(this.tune.vehicle);
    this.bodyColliders[0].setMass(spec.chassisMass);
    this.bodyColliders[1].setMass(spec.bodyMass);
    this.bodyColliders[1].setTranslationWrtParent({ x: 0, y: spec.bodyHeight, z: -0.035 });
    this.bodyColliders[1].setShape(
      new RAPIER.Cuboid(
        this.tune.vehicle === 'c2' ? 0.065 : 0.094,
        this.tune.vehicle === 'c2' ? 0.035 : 0.04,
        0.1,
      ),
    );
    this.bodyColliders[3].setTranslationWrtParent({
      x: 0,
      y: this.tune.batteryHeight,
      z: this.tune.batteryPosition,
    });
    this.bodyColliders[3].setMass(((0.34 * this.tune.capacity) / 2.2) * (this.tune.voltage / 7.4));
    this.body.recomputeMassPropertiesFromColliders();
    for (const collider of this.axleColliders)
      collider.setTranslationWrtParent({
        x: 0,
        y: this.tune.axleType === 'portal' ? 0.016 : 0,
        z: 0,
      });
    this.axles.forEach((a) => a.recomputeMassPropertiesFromColliders());
    for (const w of this.wheels) {
      w.collider.setShape(new RAPIER.Cylinder(this.tune.tyreWidth / 2, this.tune.radius - 0.012));
      const m = 0.13 + this.tune.wheelWeight,
        R = this.tune.radius,
        width = this.tune.tyreWidth,
        spin = 0.5 * m * R * R,
        transverse = (m * (3 * R * R + width * width)) / 12;
      w.collider.setMassProperties(
        m,
        ZERO,
        { x: transverse, y: spin, z: transverse },
        { x: 0, y: 0, z: 0, w: 1 },
      );
      w.ribs.forEach((rib, index) => {
        rib.x = ((index - 1) * this.tune.tyreWidth) / 3;
        rib.collider.setTranslationWrtParent({ x: rib.x + w.sideFlex, y: 0, z: 0 });
        rib.collider.setShape(
          new RAPIER.Cylinder(this.tune.tyreWidth / 6, this.tune.radius - rib.compression),
        );
        rib.collider.setMass(0);
      });
      w.body.recomputeMassPropertiesFromColliders();
    }
  }
  /** Recovery moves the entire constrained assembly; normal driving never writes body poses or velocities. */
  reset(x = 0, z = 0, support = this.height(x, z)) {
    const origin = new Vector3(x, support + 0.09, z);
    this.body.setTranslation(origin, true);
    this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    for (let a = 0; a < 2; a++) {
      const sign = a === 0 ? 1 : -1;
      this.axles[a].setTranslation(new Vector3(x, origin.y - 0.031, z + sign * 0.162), true);
      this.axles[a].setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    }
    for (const link of this.links) {
      const start = point(this.body, link.top),
        end = point(link.axle, link.bottom),
        d = end.clone().sub(start);
      link.body.setTranslation(start.clone().add(end).multiplyScalar(0.5), true);
      link.body.setRotation(
        new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize()),
        true,
      );
    }
    this.wheels.forEach((w, i) => {
      const side = i % 2 === 0 ? -1 : 1,
        a = i < 2 ? 0 : 1,
        ap = this.axles[a].translation();
      w.body.setTranslation({ x: x + side * 0.128, y: ap.y, z: ap.z }, true);
      w.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      if (i < 2) {
        w.carrier.setTranslation({ x: x + side * 0.105, y: ap.y, z: ap.z }, true);
        w.carrier.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      }
      w.compression = 0;
      w.sideFlex = 0;
      w.patches = [];
      w.ribs.forEach((r) => {
        r.compression = 0;
        r.load = 0;
      });
      w.load = 0;
      w.contact = false;
      w.omega = 0;
      w.slip = 0;
      w.steering = 0;
    });
    for (const b of this.parts) {
      b.setLinvel(ZERO, true);
      b.setAngvel(ZERO, true);
      b.resetForces(true);
      b.resetTorques(true);
    }
    this.steeringInput = this.throttle = this.steer = 0;
    this.servoTargets = [0, 0];
    this.contacts = 0;
    this.last.copy(origin);
    this.current = this.snapshot();
    this.previous = this.snapshot();
    this.applyTune();
  }
  private invInertia(body: RAPIER.RigidBody, axis: Vector3) {
    const m = body.effectiveWorldInvInertia();
    return (
      axis.x * (m.m11 * axis.x + m.m12 * axis.y + m.m13 * axis.z) +
      axis.y * (m.m21 * axis.x + m.m22 * axis.y + m.m23 * axis.z) +
      axis.z * (m.m31 * axis.x + m.m32 * axis.y + m.m33 * axis.z)
    );
  }
  private torque(
    body: RAPIER.RigidBody,
    carrier: RAPIER.RigidBody,
    axis: Vector3,
    value: number,
    dt: number,
  ) {
    const impulse = axis.clone().multiplyScalar(value * dt);
    body.applyTorqueImpulse(impulse, true);
    carrier.applyTorqueImpulse(impulse.negate(), true);
  }
  private springForces(dt: number) {
    const rest = this.tune.ride + 0.035 + this.tune.preload;
    for (const [index, s] of this.springs.entries()) {
      const k = (index < 2 ? this.tune.spring : this.tune.rearSpring) * 8,
        travel = index < 2 ? this.tune.travel : this.tune.rearTravel;
      const top = point(this.body, s.top),
        bottom = point(s.axle, s.bottom),
        delta = top.clone().sub(bottom),
        length = delta.length(),
        axis = delta.divideScalar(Math.max(0.001, length));
      const rate = v(this.body.velocityAtPoint(top))
        .sub(v(s.axle.velocityAtPoint(bottom)))
        .dot(axis);
      const bump = Math.max(0, 0.125 - travel - length) * 5000;
      const droop = Math.max(0, length - 0.119) * 4000;
      const damping =
        rate > 0
          ? this.tune.rebound
          : (index < 2 ? this.tune.damping : this.tune.rearDamping) * 2.7;
      const force = clamp(
        Math.max(0, (rest - length) * k) - damping * rate + bump - droop,
        -90,
        130,
      );
      this.body.applyImpulseAtPoint(axis.clone().multiplyScalar(force * dt), top, true);
      s.axle.applyImpulseAtPoint(axis.multiplyScalar(-force * dt), bottom, true);
      s.length = length;
      s.force = force;
    }
  }
  private steering(dt: number, input: number) {
    this.steeringInput = approach(this.steeringInput, clamp(input, -1, 1), 4, dt);
    const command = exponential(this.steeringInput, this.tune.steeringExpo) * this.tune.endpoint;
    this.steer = approach(this.steer, command, this.tune.servoRate, dt);
    this.servoTargets = ackermann(this.steer);
    for (let i = 0; i < 2; i++) {
      const w = this.wheels[i],
        axle = this.axles[0],
        relative = q(axle.rotation()).invert().multiply(q(w.carrier.rotation()));
      const angle = Math.atan2(
        2 * (relative.w * relative.y + relative.x * relative.z),
        1 - 2 * (relative.y ** 2 + relative.z ** 2),
      );
      // Implicit force-based joint servo. Limit the elastic demand by available torque; damping is solver implicit.
      const stiffness = 12 * (this.tune.servoRate / 6) ** 2,
        limited =
          angle +
          clamp(
            this.servoTargets[i] - angle,
            -this.tune.servoTorque / stiffness,
            this.tune.servoTorque / stiffness,
          );
      this.steeringJoints[i].configureMotorPosition(
        limited,
        stiffness,
        (0.18 * this.tune.servoRate) / 6,
      );
      w.steering = angle;
    }
  }
  private driveline(dt: number, input: Input) {
    const raw =
      exponential(clamp(input.throttle, -1, 1), this.tune.throttleExpo) *
      this.tune.sensitivity *
      (input.precision || this.tune.precision ? 0.3 : 1);
    this.throttle = approach(this.throttle, input.brake ? 0 : raw, raw === 0 ? 2.6 : 1.25, dt);
    const axes = this.wheels.map((w) =>
      new Vector3(1, 0, 0).applyQuaternion(q(w.carrier.rotation())),
    );
    this.wheels.forEach((w, i) => {
      w.omega = v(w.body.angvel()).sub(v(w.carrier.angvel())).dot(axes[i]);
    });
    const mean = this.wheels.reduce((n, w) => n + w.omega, 0) / 4;
    const kv = this.tune.motorKind === 'brushed' ? 29700 / this.tune.turns : this.tune.kv;
    const kt = 60 / (2 * Math.PI * kv),
      ratio = this.ratio;
    const motorSpeed = mean * ratio,
      voltage = Math.max(this.tune.voltage * 0.75, this.tune.voltage - this.motorCurrent * 0.065);
    const chargeScale = clamp(1 - this.usedAh / this.tune.capacity, 0.1, 1),
      resistance = this.tune.motorKind === 'brushed' ? 1.2 : 0.8;
    const emf = motorSpeed * kt,
      commandVoltage = this.throttle * voltage * chargeScale;
    let current = clamp((commandVoltage - emf) / resistance, -16, 16);
    if (Math.abs(this.throttle) < 0.001 || input.brake) current = 0;
    this.motorCurrent = Math.abs(current);
    this.motorTorque = current * kt;
    this.motorRPM = (motorSpeed * 60) / (2 * Math.PI);
    this.usedAh += (this.motorCurrent * dt) / 3600;
    const totalTorque = this.motorTorque * ratio * 0.74;
    for (let a = 0; a < 2; a++)
      this.driveshaftAngles[a] +=
        (this.wheels[a * 2].omega + this.wheels[a * 2 + 1].omega) * 0.5 * this.tune.axleRatio * dt;
    const brake = input.brake ? 0.35 : this.throttle === 0 ? this.tune.dragBrake * 0.17 : 0;
    if (this.tune.differential === 'locked') {
      // A bilateral angular impulse enforces equal driven speed. Reaction impulses conserve momentum.
      for (const [a, b] of [
        [0, 1],
        [2, 3],
        [0, 2],
        [1, 3],
      ]) {
        const left = this.wheels[a],
          right = this.wheels[b],
          wa = v(left.body.angvel()).sub(v(left.carrier.angvel())).dot(axes[a]),
          wb = v(right.body.angvel()).sub(v(right.carrier.angvel())).dot(axes[b]);
        const correction = axes[b].clone().sub(axes[a]);
        const inverse =
          this.invInertia(left.body, axes[a]) +
          this.invInertia(right.body, axes[b]) +
          this.invInertia(this.body, correction);
        const impulse = (wb - wa) / Math.max(1, inverse);
        left.body.applyTorqueImpulse(axes[a].clone().multiplyScalar(impulse), true);
        right.body.applyTorqueImpulse(axes[b].clone().multiplyScalar(-impulse), true);
        this.body.applyTorqueImpulse(correction.multiplyScalar(impulse), true);
      }
    }
    this.wheels.forEach((w, i) => {
      // Smooth static braking and rolling drag are torques, never target chassis velocities.
      const rolling = w.contact ? w.surface.rolling * w.load * this.tune.radius : 0;
      const resistanceTorque =
        -Math.tanh(w.omega * 0.5) * (brake + rolling + 0.0004 * Math.abs(w.omega));
      const inverse = this.invInertia(w.body, axes[i]) + this.invInertia(this.body, axes[i]);
      const effectiveInertia =
        1 / this.invInertia(w.body, axes[i]) +
        (w.contact ? this.mass * 0.25 * this.tune.radius ** 2 : 0);
      const stopTorque = (Math.abs(w.omega) * effectiveInertia) / dt;
      const drag = clamp(resistanceTorque, -stopTorque, stopTorque);
      const electricalDamping = (kt * kt * ratio * ratio * 0.74) / (4 * resistance);
      w.torque =
        totalTorque / 4 / (1 + electricalDamping * dt * this.invInertia(w.body, axes[i])) + drag;
      this.torque(w.body, this.body, axes[i], w.torque, dt);
    });
  }
  private readContacts(dt: number) {
    for (const [index, w] of this.wheels.entries()) {
      if (index < 2) {
        const relative = q(this.axles[0].rotation()).invert().multiply(q(w.carrier.rotation()));
        w.steering = Math.atan2(
          2 * (relative.w * relative.y + relative.x * relative.z),
          1 - 2 * (relative.y ** 2 + relative.z ** 2),
        );
      }
      w.contact = false;
      w.patches = [];
      let load = 0,
        best = -1;
      const centre = v(w.body.translation());
      const softness =
        this.tune.compound === 'soft' ? 1 : this.tune.compound === 'trail' ? 1.25 : 1.6;
      for (const rib of w.ribs) {
        let ribLoad = 0;
        const found: TyrePatch[] = [];
        this.world.contactPairsWith(rib.collider, (other) => {
          if (other.parent() && this.parts.some((p) => p.handle === other.parent()!.handle)) return;
          this.world.contactPair(rib.collider, other, (m) => {
            for (let i = 0; i < m.numContacts(); i++) ribLoad += m.contactImpulse(i) / dt;
            for (let i = 0; i < Math.min(2, m.numSolverContacts()); i++)
              if (m.solverContactDist(i) < 0.002) {
                const p = v(m.solverContactPoint(i)),
                  n = v(m.normal());
                if (centre.clone().sub(p).dot(n) < 0) n.negate();
                found.push({ point: p, normal: n, depth: rib.compression, load: ribLoad });
                w.contact = true;
                if (n.y > best) {
                  best = n.y;
                  w.point.copy(p);
                  w.normal.copy(n);
                  w.surface = this.surfaceQuery(p, other);
                }
              }
          });
        });
        rib.load = approach(rib.load, Math.min(100, ribLoad), 500, dt);
        load += rib.load;
        const target = found.length
          ? clamp(rib.load / ((this.tune.foam * softness) / 3), 0, 0.012)
          : 0;
        const compression = rib.compression + (target - rib.compression) * (1 - Math.exp(-dt * 14));
        if (Math.abs(compression - rib.compression) > 0.00004) {
          rib.compression = compression;
          rib.collider.setShape(
            new RAPIER.Cylinder(this.tune.tyreWidth / 6, this.tune.radius - compression),
          );
          rib.collider.setMass(0);
        }
        for (const patch of found) {
          patch.depth = rib.compression;
          w.patches.push(patch);
        }
      }
      w.load = load;
      w.compression = Math.max(...w.ribs.map((r) => r.compression));
      w.patches = w.patches.slice(0, 6);
      const compound =
          this.tune.compound === 'soft' ? 1.08 : this.tune.compound === 'trail' ? 0.93 : 0.76,
        sensitivity = clamp(Math.max(1, w.load) / 8, 0.1, 12) ** -0.065;
      const mu = w.surface.mu * compound * sensitivity;
      w.collider.setFriction(mu);
      w.ribs.forEach((r) => r.collider.setFriction(mu));
      const axis = new Vector3(1, 0, 0).applyQuaternion(q(w.carrier.rotation())),
        forward = axis.clone().cross(w.normal).normalize(),
        speed = v(w.body.linvel()).dot(forward),
        contactVelocity = v(w.body.velocityAtPoint(w.point));
      w.omega = v(w.body.angvel()).sub(v(w.carrier.angvel())).dot(axis);
      w.slip = w.contact
        ? (w.omega * (this.tune.radius - w.compression) - speed) /
          Math.max(0.06, Math.abs(speed), Math.abs(w.omega * this.tune.radius))
        : 0;
      w.lateralSlip = w.contact ? contactVelocity.dot(axis) : 0;
      const targetFlex = clamp(w.lateralForce / this.tune.sidewall, -0.006, 0.006);
      w.sideFlex += (targetFlex - w.sideFlex) * (1 - Math.exp(-dt * 10));
      w.ribs.forEach((r) =>
        r.collider.setTranslationWrtParent({ x: r.x + w.sideFlex, y: 0, z: 0 }),
      );
    }
    this.contacts = this.wheels.filter((w) => w.contact).length;
    this.surface = this.wheels.find((w) => w.contact)?.surface.name ?? 'Airborne';
  }
  step(dt: number, input: Input) {
    if (this.paused) return;
    const start = performance.now();
    this.previous = this.current;
    this.steering(dt, input.steer);
    this.driveline(dt, input);
    this.springForces(dt);
    this.world.timestep = dt;
    this.world.step(this.events);
    this.wheels.forEach((w) => (w.lateralForce = 0));
    this.events.drainContactForceEvents((event) => {
      for (const w of this.wheels) {
        if (
          !w.ribs.some(
            (r) =>
              r.collider.handle === event.collider1() || r.collider.handle === event.collider2(),
          )
        )
          continue;
        const force = v(event.totalForce());
        if (force.dot(w.normal) < 0) force.negate();
        const axis = new Vector3(1, 0, 0).applyQuaternion(q(w.carrier.rotation()));
        w.lateralForce += force.dot(axis);
      }
    });
    this.readContacts(dt);
    this.current = this.snapshot();
    this.elapsed += dt;
    const now = v(this.body.translation());
    this.distance += Math.hypot(now.x - this.last.x, now.z - this.last.z);
    this.last.copy(now);
    if (now.y < -8 || Math.abs(now.x) > 19 || Math.abs(now.z) > 19) this.reset();
    this.physicsMs = performance.now() - start;
  }
  snapshot(): VehiclePose {
    const transform = (b: RAPIER.RigidBody): Transform => ({
      position: v(b.translation()),
      rotation: q(b.rotation()),
    });
    return {
      body: transform(this.body),
      carriers: this.wheels.map((w) => transform(w.carrier)),
      wheels: this.wheels.map((w) => transform(w.body)),
      axles: this.axles.map(transform),
    };
  }
  pose(alpha: number): VehiclePose {
    const mix = (a: Transform, b: Transform) => ({
      position: a.position.clone().lerp(b.position, alpha),
      rotation: a.rotation.clone().slerp(b.rotation, alpha),
    });
    return {
      body: mix(this.previous.body, this.current.body),
      carriers: this.current.carriers.map((b, i) => mix(this.previous.carriers[i], b)),
      wheels: this.current.wheels.map((b, i) => mix(this.previous.wheels[i], b)),
      axles: this.current.axles.map((b, i) => mix(this.previous.axles[i], b)),
    };
  }
  dispose() {
    this.events.free();
    for (const body of this.parts) if (body.isValid()) this.world.removeRigidBody(body);
  }
  debug() {
    return {
      mass: this.mass,
      speed: this.speed,
      roll: this.roll,
      pitch: this.pitch,
      com: this.com.toArray(),
      motorTorque: this.motorTorque,
      motorRPM: this.motorRPM,
      current: this.motorCurrent,
      ratio: this.ratio,
      physicsMs: this.physicsMs,
      wheels: this.wheels.map((w, i) => ({
        wheel: i,
        contact: w.contact,
        load: w.load,
        steering: (w.steering * 180) / Math.PI,
        rpm: (w.omega * 60) / (2 * Math.PI),
        slip: w.slip,
        lateralSlip: w.lateralSlip,
        compression: w.compression * 1000,
        shock: this.springs[i]?.length * 1000,
        sideFlex: w.sideFlex * 1000,
        ribDeflections: w.ribs.map((r) => r.compression * 1000),
        patches: w.patches.length,
      })),
    };
  }
}
