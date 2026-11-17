import { beforeAll, describe, it, expect } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { Simulation, defaults, type Input, type Tune } from '../src/physics';
import { FixedClock } from '../src/dynamics/clock';
import { ackermann, point, v, q } from '../src/dynamics/math';
import { surfaces } from '../src/dynamics/surfaces';
import { loadState, saveState, SAVE_KEY } from '../src/state';
beforeAll(async () => {
  await RAPIER.init();
});
const idle: Input = { throttle: 0, steer: 0, brake: false };
function setup(tune: Partial<Tune> = {}, slope = 0) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const rot = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -slope);
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(10, 0.1, 10)
      .setRotation(rot)
      .setTranslation(0, -0.1 / Math.cos(slope), 0)
      .setFriction(1),
  );
  const s = new Simulation(world, { ...defaults, ...tune });
  if (slope)
    for (const b of s.parts) {
      b.setTranslation(
        v(b.translation())
          .sub(new Vector3(0, 0.09, 0))
          .applyQuaternion(rot)
          .add(new Vector3(0, 0.09, 0)),
        true,
      );
      b.setRotation(rot.clone().multiply(q(b.rotation())), true);
    }
  return s;
}
function run(s: Simulation, seconds: number, input: Input = idle) {
  for (let i = 0; i < Math.round(seconds * 240); i++) s.step(1 / 240, input);
}
const heading = (s: Simulation) => {
  const f = new Vector3(0, 0, 1).applyQuaternion(q(s.body.rotation()));
  return Math.atan2(f.x, f.z);
};

describe('physical multi-body crawler', () => {
  it('has colliding wheels, two solid axles and eight constrained links; settles without a stabilizer', () => {
    const s = setup();
    run(s, 3);
    expect(s.parts.length).toBe(17);
    expect(s.axles).toHaveLength(2);
    expect(s.links).toHaveLength(8);
    expect(s.contacts).toBe(4);
    expect(s.speed).toBeLessThan(0.025);
    expect(Math.abs(s.roll)).toBeLessThan(6);
    expect(s.mass).toBeCloseTo(3.16, 1);
    const loads = s.wheels.reduce((n, w) => n + w.load, 0);
    expect(loads).toBeGreaterThan(s.mass * 9.81 * 0.8);
    expect(loads).toBeLessThan(s.mass * 9.81 * 1.2);
    s.world.free();
  });
  it('accelerates progressively using wheel torque and brakes to a halt', () => {
    const s = setup();
    run(s, 2);
    s.step(1 / 240, { throttle: 1, steer: 0, brake: false });
    expect(s.throttle).toBeLessThan(0.01);
    expect(s.speed).toBeLessThan(0.03);
    run(s, 2, { throttle: 0.45, steer: 0, brake: false });
    expect(s.body.translation().z).toBeGreaterThan(0.2);
    expect(s.speed).toBeGreaterThan(0.1);
    expect(s.speed).toBeLessThan(0.35);
    run(s, 1, { ...idle, brake: true });
    expect(s.speed).toBeLessThan(0.025);
    s.world.free();
  });
  it('precision mode gives lower real travel and wheel speed at the same input', () => {
    const fast = setup(),
      slow = setup();
    run(fast, 2);
    run(slow, 2);
    run(fast, 2, { throttle: 0.5, steer: 0, brake: false });
    run(slow, 2, { throttle: 0.5, steer: 0, brake: false, precision: true });
    expect(fast.speed).toBeGreaterThan(slow.speed * 1.8);
    expect(slow.distance).toBeLessThan(fast.distance);
    fast.world.free();
    slow.world.free();
  });
  it('turns through tyre forces with visible unequal front angles and returns toward centre', () => {
    const s = setup();
    run(s, 2);
    run(s, 4, { throttle: 0.5, steer: 1, brake: false });
    console.log('TURN METRICS', {
      x: s.body.translation().x,
      z: s.body.translation().z,
      yaw: heading(s),
      angles: s.wheels.slice(0, 2).map((w) => w.steering),
    });
    expect(s.body.translation().x).toBeGreaterThan(0.15);
    expect(heading(s)).toBeGreaterThan(0.35);
    expect(s.wheels[0].steering).toBeGreaterThan(0.12);
    expect(s.wheels[1].steering).toBeGreaterThan(s.wheels[0].steering);
    run(s, 3, { throttle: 0.35, steer: 0, brake: false });
    expect(Math.abs(s.steer)).toBeLessThan(0.001);
    expect(Math.max(...s.wheels.slice(0, 2).map((w) => Math.abs(w.steering)))).toBeLessThan(0.15);
    s.world.free();
  });
  it('reverse steering produces the opposite yaw sign', () => {
    const s = setup();
    run(s, 2);
    run(s, 4, { throttle: -0.5, steer: 1, brake: false });
    console.log('REVERSE', s.body.translation(), heading(s));
    expect(heading(s)).toBeLessThan(-0.25);
    s.world.free();
  });
  it('articulates a physical axle on a single wheel step and preserves link lengths', () => {
    const s = setup();
    run(s, 2);
    s.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.07, 0.018, 0.065)
        .setTranslation(-0.128, 0.018, 0.162)
        .setFriction(1),
    );
    run(s, 2, { ...idle, brake: true });
    const axle = s.axles[0];
    const axis = new Vector3(1, 0, 0).applyQuaternion(q(axle.rotation()));
    expect(Math.abs(axis.y)).toBeGreaterThan(0.035);
    expect(s.contacts).toBeGreaterThanOrEqual(3);
    for (const link of s.links) {
      const actual = point(s.body, link.top).distanceTo(point(link.axle, link.bottom));
      expect(Math.abs(actual - link.length)).toBeLessThan(0.003);
    }
    const axleWidth = v(s.wheels[0].body.translation()).distanceTo(
      v(s.wheels[1].body.translation()),
    );
    expect(axleWidth).toBeGreaterThan(0.25);
    expect(axleWidth).toBeLessThan(0.264);
    s.world.free();
  });
  it('climbs a 20-degree slope under drivetrain torque and holds downhill under braking', () => {
    const angle = (20 * Math.PI) / 180,
      s = setup({}, angle);
    run(s, 2, { ...idle, brake: true });
    const start = s.body.translation().z;
    run(s, 3, { throttle: 0.8, steer: 0, brake: false });
    console.log('SLOPE', s.body.translation().z - start, s.speed, s.pitch);
    expect(s.body.translation().z - start).toBeGreaterThan(0.12);
    run(s, 2, { ...idle, brake: true });
    expect(s.speed).toBeLessThan(0.06);
    s.world.free();
  });
  it('has finite grip and wheelspin on a low-friction surface', () => {
    const low = setup(),
      dry = setup();
    (low as any).surfaceQuery = () => ({ ...surfaces['Wet rock'], mu: 0.08 });
    run(low, 2);
    run(dry, 2);
    let wetPeak = 0,
      dryPeak = 0;
    for (let i = 0; i < 240; i++) {
      low.step(1 / 240, { throttle: 1, steer: 0, brake: false });
      dry.step(1 / 240, { throttle: 1, steer: 0, brake: false });
      wetPeak = Math.max(wetPeak, ...low.wheels.map((w) => Math.abs(w.slip)));
      dryPeak = Math.max(dryPeak, ...dry.wheels.map((w) => Math.abs(w.slip)));
    }
    const slip = (s: Simulation) => s.wheels.reduce((n, w) => n + Math.abs(w.slip), 0) / 4;
    console.log('SLIP', {
      wet: slip(low),
      dry: slip(dry),
      wetPeak,
      dryPeak,
      wetSpeed: low.speed,
      drySpeed: dry.speed,
      mu: low.wheels[0].collider.friction(),
    });
    expect(wetPeak).toBeGreaterThan(0.2);
    expect(wetPeak).toBeGreaterThan(dryPeak);
    low.world.free();
    dry.world.free();
  });
  it('open versus locked differentials redistribute wheel speed on split traction', () => {
    const open = setup({ differential: 'open' }),
      locked = setup({ differential: 'locked' });
    for (const s of [open, locked]) {
      (s as any).surfaceQuery = (p: Vector3) => ({
        ...surfaces['Test concrete'],
        mu: p.x < 0 ? 0.06 : 1,
      });
      run(s, 2);
      run(s, 0.7, { throttle: 0.8, steer: 0, brake: false });
    }
    const delta = (s: Simulation) =>
      Math.abs(s.wheels[0].omega - s.wheels[1].omega) +
      Math.abs(s.wheels[2].omega - s.wheels[3].omega);
    console.log('DIFFERENTIAL', { open: delta(open), locked: delta(locked) });
    expect(delta(open)).toBeGreaterThan(delta(locked));
    open.world.free();
    locked.world.free();
  });
  it('servo settings change achieved response while stationary steering remains bounded', () => {
    const quick = setup({ servoRate: 8, servoTorque: 2.5 }),
      slow = setup({ servoRate: 1, servoTorque: 0.1 });
    run(quick, 1);
    run(slow, 1);
    run(quick, 0.35, { ...idle, steer: 1 });
    run(slow, 0.35, { ...idle, steer: 1 });
    expect(quick.steer).toBeGreaterThan(slow.steer);
    expect(quick.servoTargets[1]).toBeLessThan(0.82);
    quick.world.free();
    slow.world.free();
  });
  it('battery position/height and wheel weights change actual mass, centre of mass and inertia', () => {
    const s = setup();
    const before = s.com.clone(),
      mass = s.mass,
      inertia = s.wheels[0].body.effectiveAngularInertia().m11;
    s.tune.batteryPosition = 0.1;
    s.tune.batteryHeight = 0.16;
    s.tune.wheelWeight = 0.1;
    s.applyTune();
    expect(s.com.z).toBeGreaterThan(before.z + 0.01);
    expect(s.mass).toBeGreaterThan(mass + 0.39);
    expect(s.wheels[0].body.effectiveAngularInertia().m11).toBeGreaterThan(inertia);
    s.tune.wheelWeight = 0;
    s.applyTune();
    expect(s.com.y).toBeGreaterThan(before.y + 0.006);
    s.world.free();
  });
  it('can tip and roll, without any automatic upright torque', () => {
    const s = setup();
    const centre = v(s.body.translation()),
      tilt = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 1.25);
    for (const b of s.parts) {
      b.setTranslation(
        v(b.translation())
          .sub(centre)
          .applyQuaternion(tilt)
          .add(centre)
          .add(new Vector3(0, 0.13, 0)),
        true,
      );
      b.setRotation(tilt.clone().multiply(q(b.rotation())), true);
    }
    run(s, 3);
    const up = new Vector3(0, 1, 0).applyQuaternion(q(s.body.rotation()));
    expect(up.y).toBeLessThan(0.4);
    s.world.free();
  });
  it('foam and compound change physical rolling compliance and friction', () => {
    const soft = setup({ foam: 1200, compound: 'soft' }),
      hard = setup({ foam: 6000, compound: 'hard' });
    run(soft, 2);
    run(hard, 2);
    expect(soft.wheels[0].compression).toBeGreaterThan(hard.wheels[0].compression * 2);
    expect(soft.wheels[0].collider.friction()).toBeGreaterThan(hard.wheels[0].collider.friction());
    soft.world.free();
    hard.world.free();
  });
  it('voltage and gearing affect real wheel speed, not a chassis velocity target', () => {
    const low = setup({ voltage: 6 }),
      high = setup({ voltage: 11.1 }),
      geared = setup({ voltage: 11.1, gearRatio: 35 });
    for (const s of [low, high, geared]) {
      run(s, 2);
      run(s, 2, { throttle: 0.7, steer: 0, brake: false });
    }
    console.log('MOTOR', { low: low.speed, high: high.speed, geared: geared.speed });
    expect(high.speed).toBeGreaterThan(low.speed * 1.3);
    expect(geared.speed).toBeLessThan(high.speed);
    [low, high, geared].forEach((s) => s.world.free());
  });
  it('recovers the complete constrained assembly together', () => {
    const s = setup();
    run(s, 1, { throttle: 0.5, steer: 0.5, brake: false });
    s.reset(1, 2);
    expect(s.body.translation().x).toBe(1);
    expect(s.body.translation().z).toBe(2);
    for (const b of s.parts) expect(v(b.linvel()).length()).toBe(0);
    expect(s.wheels[0].body.translation().z).toBeCloseTo(2.162, 3);
    s.world.free();
  });
});

describe('fixed-step rendering and geometric steering', () => {
  it('computes reciprocal Ackermann radii with bounded inner steering', () => {
    const [outer, inner] = ackermann(0.56);
    expect(inner).toBeGreaterThan(outer);
    expect(0.324 / Math.tan(outer) - 0.324 / Math.tan(inner)).toBeCloseTo(0.256, 6);
    expect(ackermann(-0.56)).toEqual([-inner, -outer]);
  });
  it('has equivalent physical results at 30, 60 and 120 render FPS', () => {
    const results = [30, 60, 120].map((fps) => {
      const s = setup(),
        clock = new FixedClock();
      for (let frame = 0; frame < fps * 3; frame++)
        clock.advance(1 / fps, (dt) => s.step(dt, { throttle: 0.4, steer: 0.4, brake: false }));
      const result = v(s.body.translation());
      expect(s.elapsed).toBeCloseTo(3, 7);
      s.world.free();
      return result;
    });
    expect(results[0].distanceTo(results[1])).toBeLessThan(0.00001);
    expect(results[0].distanceTo(results[2])).toBeLessThan(0.00001);
  });
  it('interpolates wheel and body transforms and bounds long-stall catch-up explicitly', () => {
    const s = setup();
    s.step(1 / 240, idle);
    const a = s.pose(0),
      b = s.pose(1),
      middle = s.pose(0.5);
    expect(
      middle.body.position.distanceTo(a.body.position.clone().lerp(b.body.position, 0.5)),
    ).toBeLessThan(1e-10);
    const clock = new FixedClock();
    let steps = 0;
    clock.advance(1, () => steps++);
    expect(steps).toBe(60);
    expect(clock.droppedTime).toBe(0.75);
    s.world.free();
  });
});

describe('backward-compatible player saves', () => {
  it('migrates original builds/progress without losing credits', () => {
    const legacy = {
      version: 1,
      tune: { radius: 0.063, motor: 'trail', paint: '#42657b' },
      builds: [{ name: 'Old build', tune: { compound: 'hard' } }],
      completed: [0],
      credits: 450,
    };
    const s = loadState({ getItem: () => JSON.stringify(legacy) });
    expect(s.credits).toBe(450);
    expect(s.completed).toEqual([0]);
    expect(s.tune.radius).toBe(0.063);
    expect(s.tune.motor).toBe('trail');
    expect(s.tune.voltage).toBe(defaults.voltage);
    expect(s.builds[0].tune.compound).toBe('hard');
    expect(s.bindings.forward).toBe('KeyW');
  });
  it('sanitises corrupt data and round trips advanced tuning and controls', () => {
    expect(loadState({ getItem: () => '{broken' }).tune).toEqual(defaults);
    const s = loadState({
      getItem: () =>
        JSON.stringify({ version: 1, tune: { radius: 999, spring: -1, paint: '<bad>' } }),
    });
    expect(s.tune.radius).toBe(0.067);
    expect(s.tune.spring).toBe(25);
    s.tune.differential = 'open';
    s.tune.voltage = 11.1;
    s.bindings.forward = 'KeyI';
    let json = '';
    expect(
      saveState(s, {
        setItem: (key, value) => {
          expect(key).toBe(SAVE_KEY);
          json = value;
        },
      }),
    ).toBe(true);
    expect(loadState({ getItem: () => json })).toEqual(s);
    expect(
      saveState(s, {
        setItem: () => {
          throw new Error('Quota');
        },
      }),
    ).toBe(false);
  });
});

describe('remapped transmitter inputs', () => {
  it('keeps touch controls working and resolves arrow aliases without contradictory inputs', async () => {
    const { bindingDown, touchBinding, isBindingCode } = await import('../src/dynamics/controls');
    const s = loadState({ getItem: () => null });
    s.bindings.forward = 'KeyI';
    s.bindings.reverse = 'ArrowUp';
    expect(touchBinding('KeyW', s.bindings)).toBe('KeyI');
    expect(bindingDown('forward', new Set(['KeyI']), s.bindings)).toBe(true);
    expect(bindingDown('forward', new Set(['ArrowUp']), s.bindings)).toBe(false);
    expect(bindingDown('reverse', new Set(['ArrowUp']), s.bindings)).toBe(true);
    expect(isBindingCode('KeyG')).toBe(false);
  });
});

describe('obstacle-aware recovery', () => {
  it('samples the actual obstacle footprint and recovers above it instead of inside it', async () => {
    const { recoverySupport } = await import('../src/dynamics/collision');
    const s = setup();
    s.world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2).setTranslation(0, 0.2, 0));
    s.world.step();
    const support = recoverySupport(s.world, 0, 0, 1, new Set(s.parts.map((b) => b.handle)), 0);
    expect(support).toBeCloseTo(0.4, 3);
    s.reset(0, 0, support);
    expect(s.wheels[0].body.translation().y - s.tune.radius).toBeGreaterThanOrEqual(0.399);
    s.world.free();
  });
});
