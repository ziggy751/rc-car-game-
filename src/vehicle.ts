import * as T from 'three';
import { surfaceMaterial } from './material-library';
import { weatherMaterial, type SoilUniforms } from './environment-effects';
import type { Simulation, VehiclePose } from './physics';
import { tyreMaterial } from './dynamics/deformation';
import { buildBody, railGeometry } from './body-models';
import type { VehicleId } from './catalogue';
import { box, mesh, metal, rod, tube, label, noiseTexture } from './materials';
export const wheelPositions = [
  [-0.128, 0, 0.162],
  [0.128, 0, 0.162],
  [-0.128, 0, -0.162],
  [0.128, 0, -0.162],
];
export class Crawler {
  soilUniforms: SoilUniforms = {
    soil: { value: 0 },
    wet: { value: 0 },
    vehicleInverse: { value: new T.Matrix4() },
  };
  battery = new T.Group();
  root = new T.Group();
  shell = new T.Group();
  mechanics = new T.Group();
  wheels: T.Group[] = [];
  axles: T.Group[] = [];
  springs: T.Group[] = [];
  links: T.Mesh[] = [];
  paint = new T.MeshPhysicalMaterial({
    color: '#496d62',
    roughness: 0.39,
    metalness: 0.12,
    clearcoat: 0.65,
    clearcoatRoughness: 0.3,
    side: T.DoubleSide,
  });
  rim = metal('#be9d68', 0.35, 0.85);
  deformations: ReturnType<typeof tyreMaterial>[] = [];
  radius = 0.059;
  spin = [0, 0, 0, 0];
  constructor(public vehicle: VehicleId = 'r1') {
    const black = metal('#171c1d', 0.52, 0.65),
      steel = metal('#79848a', 0.24, 0.9),
      red = metal('#b93f22', 0.3, 0.6),
      rubber = surfaceMaterial('rubber');
    this.root.add(this.shell, this.mechanics, this.battery);
    const c = this.mechanics;
    // Continuous ladder chassis rails, shaped through their raised axle clearances.
    for (const x of [-0.067, 0.067]) {
      const rail = [
        [x, 0.005, -0.23],
        [x, 0.015, -0.19],
        [x, 0.045, -0.13],
        [x, 0.03, -0.06],
        [x, 0.03, 0.07],
        [x, 0.045, 0.15],
        [x, 0.015, 0.23],
      ];
      if (this.vehicle === 'r1') mesh(railGeometry(rail), black, c);
      else tube(c, black, rail, 0.0035);
      for (let z = -0.18; z < 0.2; z += 0.035) {
        const bolt = mesh(new T.CylinderGeometry(0.0023, 0.0023, 0.016, 6), steel, c, [x, 0.03, z]);
        bolt.rotation.z = Math.PI / 2;
      }
    }
    for (const z of [-0.19, -0.08, 0.08, 0.19]) box(c, black, [0.146, 0.009, 0.012], [0, 0.028, z]);
    box(c, black, [0.11, 0.008, 0.13], [0, 0.022, 0]);
    const motor = mesh(
      new T.CylinderGeometry(0.018, 0.018, 0.055, 32),
      red,
      c,
      [0.02, 0.054, -0.02],
    );
    motor.rotation.z = Math.PI / 2;
    for (let i = 0; i < 8; i++)
      box(c, steel, [0.003, 0.012, 0.002], [-0.012 + i * 0.009, 0.069, -0.02]);
    box(c, black, [0.045, 0.036, 0.042], [-0.015, 0.05, 0.036]);
    box(this.battery, metal('#222d39'), [0.053, 0.026, 0.092], [0, 0.066, -0.119]);
    box(this.battery, metal('#3681a0'), [0.047, 0.001, 0.07], [0, 0.08, -0.119]);
    for (const z of [-0.15, -0.09]) box(this.battery, black, [0.06, 0.004, 0.008], [0, 0.084, z]);
    box(c, red, [0.035, 0.014, 0.027], [-0.041, 0.052, 0.085]);
    for (let i = 0; i < 8; i++)
      box(c, black, [0.003, 0.009, 0.029], [-0.054 + i * 0.004, 0.064, 0.085]);
    box(c, black, [0.027, 0.019, 0.021], [0.04, 0.055, 0.073]);
    tube(
      c,
      red,
      [
        [0, 0.08, -0.08],
        [0.048, 0.096, -0.04],
        [0.056, 0.07, 0.08],
        [0.01, 0.06, 0.09],
      ],
      0.002,
    );
    tube(
      c,
      metal('#d6a14d'),
      [
        [0.02, 0.05, -0.02],
        [0.06, 0.09, 0.02],
        [0.045, 0.065, 0.075],
      ],
      0.0015,
    );
    tube(
      c,
      black,
      [
        [-0.02, 0.08, -0.08],
        [-0.05, 0.09, -0.04],
        [-0.05, 0.07, 0.08],
      ],
      0.002,
    );
    for (const z of [-0.162, 0.162])
      for (const side of [-1, 1]) {
        box(c, black, [0.008, 0.058, 0.021], [side * 0.081, 0.051, z * 0.92]);
        for (const y of [0.04, 0.06, 0.08]) {
          const bolt = mesh(new T.CylinderGeometry(0.0018, 0.0018, 0.012, 6), steel, c, [
            side * 0.081,
            y,
            z * 0.92,
          ]);
          bolt.rotation.z = Math.PI / 2;
        }
      }
    const batteryLabel = mesh(
      new T.PlaneGeometry(0.041, 0.055),
      label('2S / LiPo', '#e1e6d2', '#20343b'),
      this.battery,
      [0, 0.0805, -0.119],
    );
    batteryLabel.rotation.x = -Math.PI / 2;
    box(c, black, [0.028, 0.018, 0.025], [0, 0.045, 0.153]);
    for (const x of [-0.012, 0.012])
      for (const z of [0.143, 0.163])
        mesh(new T.SphereGeometry(0.0015, 6, 4), steel, c, [x, 0.055, z]);
    buildBody(this.shell, this.paint, this.vehicle);
    // Four genuinely separate wheel assemblies; instanced tread and beadlock hardware.
    for (let i = 0; i < 4; i++) {
      const w = this.createWheel(rubber, steel, black);
      this.wheels.push(w);
      this.root.add(w);
      w.position.set(wheelPositions[i][0], -0.024, wheelPositions[i][2]);
      const spring = new T.Group();
      this.root.add(spring);
      this.springs.push(spring);
      mesh(new T.CylinderGeometry(0.006, 0.006, 0.045, 12), red, spring, [0, 0.0225, 0]);
      mesh(new T.CylinderGeometry(0.0027, 0.0027, 0.055, 10), steel, spring, [0, 0.002, 0]);
      const points = [];
      for (let j = 0; j <= 160; j++) {
        const t = j / 160;
        points.push(
          new T.Vector3(
            Math.cos(t * Math.PI * 16) * 0.008,
            t * 0.063 - 0.018,
            Math.sin(t * Math.PI * 16) * 0.008,
          ),
        );
      }
      mesh(
        new T.TubeGeometry(new T.CatmullRomCurve3(points), 160, 0.00135, 5, false),
        steel,
        spring,
      );
    }
    for (let i = 0; i < 2; i++) {
      const a = new T.Group();
      this.axles.push(a);
      this.root.add(a);
      rod(a, black, [-0.12, 0, 0], [0.12, 0, 0], 0.009);
      const diff = mesh(new T.SphereGeometry(0.022, 24, 16), black, a);
      diff.scale.set(1, 0.8, 1.1);
      const cover = mesh(new T.CylinderGeometry(0.017, 0.017, 0.005, 12), red, a, [0, 0, 0.018]);
      cover.rotation.x = Math.PI / 2;
      for (const x of [-0.112, 0.112]) box(a, black, [0.021, 0.028, 0.027], [x, -0.002, 0]);
      for (let j = 0; j < 6; j++) {
        const angle = (j * Math.PI) / 3;
        const b = mesh(new T.SphereGeometry(0.002, 6, 4), steel, a, [
          Math.cos(angle) * 0.014,
          Math.sin(angle) * 0.014,
          0.022,
        ]);
        b.name = 'differential bolt';
      }
    }
    for (let i = 0; i < 12; i++) {
      const l = mesh(
        new T.CylinderGeometry(i < 8 ? 0.0025 : 0.004, i < 8 ? 0.0025 : 0.004, 1, 10),
        steel,
        this.root,
      );
      this.links.push(l);
    }
    for (const shaft of this.links.slice(8, 10)) {
      for (const y of [-0.45, 0.45]) {
        const ring = mesh(new T.CylinderGeometry(0.006, 0.006, 0.05, 10), steel, shaft, [0, y, 0]);
        rod(shaft, steel, [-0.008, y, 0], [0.008, y, 0], 0.0015);
        ring.name = 'universal joint';
      }
    }
    const mats = new Set<T.MeshStandardMaterial>();
    this.root.traverse((object) => {
      if (
        object instanceof T.Mesh &&
        object.material instanceof T.MeshStandardMaterial &&
        !object.material.transparent &&
        object.material.emissiveIntensity <= 1
      )
        mats.add(object.material);
    });
    for (const material of mats) weatherMaterial(material, this.soilUniforms);
    this.update([0.065, 0.065, 0.065, 0.065], 0, [0, 0, 0, 0]);
  }
  createWheel(rubber: T.Material, steel: T.Material, black: T.Material) {
    const w = new T.Group(),
      rotation = new T.Group();
    w.add(rotation);
    rotation.name = 'spin';
    const deformation = tyreMaterial(rubber as T.MeshStandardMaterial);
    this.deformations.push(deformation);
    rubber = deformation.material;
    const profile = [
      new T.Vector2(0.03, -0.022),
      new T.Vector2(0.045, -0.023),
      new T.Vector2(0.054, -0.018),
      new T.Vector2(0.056, -0.01),
      new T.Vector2(0.056, 0.01),
      new T.Vector2(0.054, 0.018),
      new T.Vector2(0.045, 0.023),
      new T.Vector2(0.03, 0.022),
      new T.Vector2(0.03, -0.022),
    ];
    const tyre = mesh(new T.LatheGeometry(profile, 96), rubber, rotation);
    tyre.rotation.z = Math.PI / 2;
    tyre.customDepthMaterial = deformation.depth;
    const tread = new T.InstancedMesh(new T.BoxGeometry(0.013, 0.006, 0.012), rubber, 40 * 3);
    const mat = new T.Matrix4(),
      q = new T.Quaternion(),
      sc = new T.Vector3(1, 1, 1);
    let k = 0;
    for (let row = -1; row <= 1; row++)
      for (let j = 0; j < 40; j++) {
        const a = ((j + (row === 0 ? 0.5 : 0)) * Math.PI) / 20;
        q.setFromEuler(new T.Euler(a, 0, row * 0.3));
        mat.compose(new T.Vector3(row * 0.014, Math.cos(a) * 0.057, -Math.sin(a) * 0.057), q, sc);
        tread.setMatrixAt(k++, mat);
      }
    tread.castShadow = true;
    tread.customDepthMaterial = deformation.depth;
    rotation.add(tread);
    const hub = mesh(new T.CylinderGeometry(0.03, 0.03, 0.041, 32), black, rotation);
    hub.rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) {
      const ring = mesh(new T.TorusGeometry(0.028, 0.003, 8, 40), this.rim, rotation, [
        side * 0.024,
        0,
        0,
      ]);
      ring.rotation.y = Math.PI / 2;
      for (let j = 0; j < 16; j++) {
        const a = (j * Math.PI) / 8;
        mesh(new T.SphereGeometry(0.0018, 6, 5), steel, rotation, [
          side * 0.026,
          Math.cos(a) * 0.028,
          Math.sin(a) * 0.028,
        ]);
      }
      for (let j = 0; j < 6; j++) {
        const a = (j * Math.PI) / 3;
        rod(
          rotation,
          this.rim,
          [side * 0.022, Math.cos(a) * 0.008, Math.sin(a) * 0.008],
          [side * 0.022, Math.cos(a + 0.16) * 0.024, Math.sin(a + 0.16) * 0.024],
          0.003,
        );
      }
      const cap = mesh(new T.CylinderGeometry(0.008, 0.008, 0.048, 6), steel, rotation);
      cap.rotation.z = Math.PI / 2;
    }
    return w;
  }
  update(lengths: number[], steer: number, rotations: number[]) {
    for (let i = 0; i < 4; i++) {
      const [x, , z] = wheelPositions[i];
      const y = 0.065 - lengths[i];
      const w = this.wheels[i];
      w.position.set(x, y, z);
      w.rotation.y = i < 2 ? steer : 0;
      w.children[0].rotation.x = rotations[i];
      const spring = this.springs[i];
      const start = new T.Vector3(x * 0.65, 0.06, z * 0.92),
        end = new T.Vector3(x, y + 0.01, z);
      spring.position.copy(end);
      const delta = start.sub(end);
      spring.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.clone().normalize());
      spring.scale.y = delta.length() / 0.065;
    }
    for (let a = 0; a < 2; a++) {
      const left = this.wheels[a * 2].position,
        right = this.wheels[a * 2 + 1].position,
        axle = this.axles[a];
      axle.position.copy(left).add(right).multiplyScalar(0.5);
      axle.quaternion.setFromUnitVectors(
        new T.Vector3(1, 0, 0),
        right.clone().sub(left).normalize(),
      );
      for (let j = 0; j < 4; j++) {
        const side = j % 2 === 0 ? -1 : 1;
        this.connect(
          this.links[a * 4 + j],
          new T.Vector3(side * (j < 2 ? 0.06 : 0.03), 0.02, a === 0 ? 0.035 : -0.035),
          new T.Vector3(side * (j < 2 ? 0.1 : 0.045), axle.position.y, axle.position.z),
        );
      }
      this.connect(this.links[8 + a], new T.Vector3(0, 0.025, 0), axle.position);
    }
    this.connect(
      this.links[10],
      this.wheels[0].position.clone().add(new T.Vector3(0, 0, 0.015)),
      this.wheels[1].position.clone().add(new T.Vector3(0, 0, 0.015)),
    );
    this.connect(
      this.links[11],
      new T.Vector3(-0.05, 0.04, 0.15),
      this.wheels[1].position.clone().add(new T.Vector3(0, 0, 0.015)),
    );
  }
  connect(o: T.Mesh, a: T.Vector3, b: T.Vector3) {
    const d = b.clone().sub(a);
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.scale.y = d.length();
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  }
  sync(sim: Simulation, pose: VehiclePose) {
    this.root.position.copy(pose.body.position);
    this.root.quaternion.copy(pose.body.rotation);
    const inverse = pose.body.rotation.clone().invert();
    const local = (p: T.Vector3) => p.clone().sub(pose.body.position).applyQuaternion(inverse);
    pose.wheels.forEach((wheel, i) => {
      const w = this.wheels[i];
      w.position.copy(local(wheel.position));
      w.quaternion.copy(inverse).multiply(wheel.rotation);
      w.children[0].rotation.set(0, 0, 0);
      w.scale.set(sim.tune.tyreWidth / 0.044, sim.tune.radius / 0.059, sim.tune.radius / 0.059);
      const u = this.deformations[i].uniforms,
        state = sim.wheels[i];
      u.patchCount.value = state.patches.length;
      u.tyreWidth.value = sim.tune.tyreWidth;
      u.tyreRadius.value = sim.tune.radius;
      u.tyreSideFlex.value = state.sideFlex;
      state.patches.forEach((patch, j) => {
        u.patchPoints.value[j].copy(patch.point);
        u.patchNormals.value[j].copy(patch.normal);
        u.patchDepths.value[j] = patch.depth;
      });
      u.tyrePoint.value.copy(state.point);
      u.tyreNormal.value.copy(state.normal);
      u.tyreDeflection.value = state.compression;
      u.tyreCentre.value.copy(wheel.position);
      u.tyreAxis.value.set(1, 0, 0).applyQuaternion(wheel.rotation);
    });
    pose.axles.forEach((a, i) => {
      this.axles[i].position.copy(local(a.position));
      this.axles[i].quaternion.copy(inverse).multiply(a.rotation);
      if (sim.tune.axleType === 'portal')
        this.axles[i].position.add(
          new T.Vector3(0, 0.016, 0).applyQuaternion(this.axles[i].quaternion),
        );
      this.connect(this.links[8 + i], new T.Vector3(0, 0.025, 0), local(a.position));
      this.links[8 + i].rotateY(sim.driveshaftAngles[i]);
    });
    sim.links.forEach((link, i) => {
      const a = pose.axles[i < 4 ? 0 : 1];
      const end = link.bottom.clone().applyQuaternion(a.rotation).add(a.position);
      this.connect(this.links[i], link.top, local(end));
    });
    sim.springs.forEach((spring, i) => {
      const a = pose.axles[i < 2 ? 0 : 1];
      const end = local(spring.bottom.clone().applyQuaternion(a.rotation).add(a.position));
      const delta = spring.top.clone().sub(end),
        group = this.springs[i];
      group.position.copy(end);
      group.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.clone().normalize());
      group.scale.y = delta.length() / 0.065;
    });
    const frontEnds = [0, 1].map((i) =>
      new T.Vector3(0, 0, 0.015)
        .applyQuaternion(pose.carriers[i].rotation)
        .add(pose.carriers[i].position),
    );
    this.connect(this.links[10], local(frontEnds[0]), local(frontEnds[1]));
    this.connect(this.links[11], new T.Vector3(-0.05, 0.04, 0.15), local(frontEnds[1]));
  }
  dispose() {
    const geometries = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>();
    this.root.traverse((o) => {
      if (o instanceof T.SpotLight) o.shadow.dispose();
      if (o instanceof T.Mesh) {
        geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => {
      for (const value of Object.values(m)) {
        if (value instanceof T.Texture && !value.userData.sharedPBR) value.dispose();
      }
      m.dispose();
    });
    this.deformations.forEach((d) => d.depth.dispose());
    this.root.removeFromParent();
  }
  setTyres(radius: number) {
    this.radius = radius;
    for (const w of this.wheels) w.scale.setScalar(radius / 0.059);
  }
}
