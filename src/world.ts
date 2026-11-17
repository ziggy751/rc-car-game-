import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { surfaceMaterial, terrainMaterial } from './material-library';
import { bendVegetation } from './environment-effects';
import { courses } from './courses';
import { courseRocks, courseDistance, buildCourseMarkers } from './course-terrain';
import { surfaces, type Surface } from './dynamics/surfaces';
import { Sky } from 'three/addons/objects/Sky.js';
import { box, mesh, metal, rod, tube, label, noiseTexture } from './materials';
export const trailX = (z: number) => Math.sin(z * 0.42) * 0.65;
export function groundHeight(x: number, z: number) {
  if (x > 5.7 && x < 16.3 && z > -13.3 && z < -0.7) return -0.16;
  const trailDistance = Math.abs(x - trailX(z));
  const ridge = 0.15 * Math.sin(z * 0.6) + 0.1 * Math.sin(x * 0.8 + z * 0.3);
  const detail =
    (Math.sin(x * 14 + z * 7) * Math.sin(z * 13 - x * 4) * 0.014 +
      Math.sin(x * 4 - z * 3) * 0.025) *
    Math.min(1, trailDistance + 0.12);
  const hill =
    0.7 * Math.exp(-((x + 3) ** 2 + (z - 6) ** 2) / 18) +
    0.35 * Math.exp(-((x - 3) ** 2 + (z - 9) ** 2) / 10);
  const creek = -0.19 * Math.exp(-(((z - 3.7) / 0.46) ** 2));
  const blend = T.MathUtils.smoothstep(Math.hypot(x, z), 0.35, 0.75);
  return (ridge + detail + hill + creek) * blend;
}
export function creekWaterHeight() {
  return Math.min(groundHeight(0, 3.7), groundHeight(0.65, 3.7)) + 0.085;
}
export function bridgeDeckHeight(z: number) {
  const t = T.MathUtils.clamp((z - 3.08) / (22 * 0.055), 0, 1);
  return (
    T.MathUtils.lerp(groundHeight(0.65, 3.08), groundHeight(0.65, 4.29), t) +
    0.035 +
    Math.sin(t * Math.PI) * 0.025
  );
}
export const trails = courses;
export class Park {
  sunOffset = new T.Vector3(-10, 16, -8);
  terrainWet = { value: 0 };
  plantUniforms: ReturnType<typeof bendVegetation> | null = null;
  sky: Sky;
  hemisphere: T.HemisphereLight;
  materialSurfaces = new Map<number, Surface>();
  group = new T.Group();
  garage = new T.Group();
  water: T.Mesh;
  sun: T.DirectionalLight;
  vegetation = new T.Group();
  colliders: RAPIER.Collider[] = [];
  constructor(
    public scene: T.Scene,
    public physics: RAPIER.World,
  ) {
    const rockMat = surfaceMaterial('rock'),
      moss = surfaceMaterial('moss');
    const terrain = terrainMaterial(),
      groundMat = terrain.material;
    this.terrainWet = terrain.uniforms.groundWet;
    const geo = new T.PlaneGeometry(40, 40, 240, 240);
    geo.rotateX(-Math.PI / 2);
    const positions = geo.attributes.position;
    const colors = [];
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        z = positions.getZ(i),
        y = groundHeight(x, z);
      positions.setY(i, y);
      const d = courseDistance(x, z);
      const color = new T.Color(d < 0.52 ? '#ae9672' : d < 0.85 ? '#6b7048' : '#53613b');
      if (Math.abs(z - 3.7) < 0.35) color.set('#635547');
      color.multiplyScalar(0.85 + 0.15 * Math.sin(x * 17 + z * 8));
      colors.push(color.r, color.g, color.b);
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    mesh(geo, groundMat, this.group);
    this.collider(geo);
    // Authored granite steps: purposeful lines, with lower shoulders for alternate routes.
    const rocks = courseRocks;
    let seed = 87;
    const rand = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const makeRock = (x: number, z: number, sx: number, sy: number, sz: number, collide = true) => {
      if (x > 5.5 && x < 16.5 && z > -13.5 && z < -0.5) return;
      const g = new T.IcosahedronGeometry(1, 3);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          y = p.getY(i),
          z = p.getZ(i);
        const n =
          1 +
          0.11 * Math.sin(x * 12 + y * 9) * Math.sin(z * 8 - x * 4) +
          0.035 * Math.sin(x * 34 + z * 23);
        p.setXYZ(i, x * n * sx, y * n * sy, z * n * sz);
      }
      g.computeVertexNormals();
      const r = mesh(g, rand() > 0.23 ? rockMat : moss, this.group, [
        x,
        groundHeight(x, z) + sy * 0.25,
        z,
      ]);
      r.rotation.y = rand() * 6;
      if (collide) {
        r.updateMatrix();
        const c = g.clone().applyMatrix4(r.matrix);
        this.collider(c, surfaces['Dry granite']);
        c.dispose();
      }
    };
    for (const [x, z, sx, sy, sz] of rocks) makeRock(x, z, sx, sy, sz);
    for (let i = 0; i < 125; i++) {
      const x = (rand() - 0.5) * 26,
        z = (rand() - 0.2) * 27;
      if (courseDistance(x, z) < 0.65) continue;
      makeRock(
        x,
        z,
        0.08 + rand() * 0.6,
        0.06 + rand() * 0.4,
        0.1 + rand() * 0.6,
        Math.abs(x) < 6 && z < 14,
      );
    }
    // Shallow transparent creek, animated ripples; the bed is the same collision terrain.
    const waterMat = new T.MeshPhysicalMaterial({
      color: '#527b76',
      roughness: 0.18,
      metalness: 0.2,
      transparent: true,
      opacity: 0.64,
      clearcoat: 1,
      normalMap: noiseTexture('rock'),
      normalScale: new T.Vector2(0.09, 0.09),
      side: T.DoubleSide,
    });
    this.water = mesh(new T.PlaneGeometry(25, 0.78, 80, 8), waterMat, this.group, [
      0,
      creekWaterHeight(),
      3.7,
    ]);
    this.water.rotation.x = -Math.PI / 2;
    this.water.receiveShadow = true;
    // Bridge follows an intentionally shallow grade across the stream.
    const wood = metal('#847253', 0.91, 0);
    wood.map = noiseTexture('wood');
    const iron = metal('#292f29', 0.7, 0.65);
    for (let i = 0; i < 23; i++) {
      const z = 3.08 + i * 0.055;
      const y = bridgeDeckHeight(z);
      const plank = box(this.group, wood, [0.51, 0.022, 0.05], [0.65, y, z]);
      const g = plank.geometry.clone();
      plank.updateMatrix();
      g.applyMatrix4(plank.matrix);
      this.collider(g, surfaces['Timber']);
      g.dispose();
      for (const x of [0.42, 0.88])
        mesh(new T.SphereGeometry(0.003, 5, 4), iron, this.group, [x, y + 0.012, z]);
    }
    for (const x of [0.39, 0.91]) {
      tube(
        this.group,
        wood,
        [
          [x, bridgeDeckHeight(3.04) - 0.015, 3.04],
          [x, bridgeDeckHeight(3.7) - 0.015, 3.7],
          [x, bridgeDeckHeight(4.35) - 0.015, 4.35],
        ],
        0.019,
      );
      for (const z of [3.1, 3.7, 4.3])
        rod(
          this.group,
          wood,
          [x, groundHeight(x, z) - 0.01, z],
          [x, bridgeDeckHeight(z) + 0.11, z],
          0.006,
        );
      tube(
        this.group,
        iron,
        [
          [x, bridgeDeckHeight(3.1) + 0.1, 3.1],
          [x, bridgeDeckHeight(3.4) + 0.08, 3.4],
          [x, bridgeDeckHeight(3.7) + 0.1, 3.7],
          [x, bridgeDeckHeight(4) + 0.08, 4],
          [x, bridgeDeckHeight(4.3) + 0.1, 4.3],
        ],
        0.004,
      );
    }
    // Forest canopy: branching trunks and needle-bearing boughs instanced into one draw call.
    const bark = surfaceMaterial('bark');
    for (const texture of [bark.map, bark.normalMap, bark.roughnessMap]) texture!.repeat.set(3, 7);
    const leafMaterial = new T.MeshStandardMaterial({
      color: '#acbe9c',
      roughness: 1,
      side: T.DoubleSide,
    });
    // Needle sprays with branching silhouettes: open geometry, no stacked cone canopies.
    const leafGeo = new T.BufferGeometry();
    const needles: number[] = [];
    const leafColors: number[] = [];
    for (let branch = -1; branch <= 1; branch++)
      for (let n = 0; n < 13; n++)
        for (const side of [-1, 1]) {
          const t = n / 13,
            z = t * 0.94,
            x = branch * (0.12 + Math.sin(t * Math.PI) * 0.2),
            y = -t * 0.12;
          const reach = (1 - t * 0.6) * (0.12 + Math.abs(branch) * 0.035),
            ex = x + side * reach,
            ez = z + 0.07;
          needles.push(x, y, z, ex, y + 0.018, ez, x + side * 0.024, y + 0.004, z + 0.06);
          const c = new T.Color().setHSL(0.24 + (n % 3) * 0.012, 0.25, 0.16 + (n % 4) * 0.025);
          for (let k = 0; k < 3; k++) leafColors.push(c.r, c.g, c.b);
        }
    leafGeo.setAttribute('position', new T.Float32BufferAttribute(needles, 3));
    leafGeo.setAttribute('color', new T.Float32BufferAttribute(leafColors, 3));
    leafGeo.computeVertexNormals();
    leafMaterial.vertexColors = true;
    const foliage = new T.InstancedMesh(leafGeo, leafMaterial, 6200);
    let idx = 0;
    const dummy = new T.Object3D();
    for (let i = 0; i < 110; i++) {
      const x = (rand() - 0.5) * 33,
        z = (rand() - 0.5) * 38;
      if (courseDistance(x, z) < 0.85 || (x > 5.5 && x < 16.5 && z > -13.5 && z < -0.5)) continue;
      const y = groundHeight(x, z),
        h = 2.3 + rand() * 3.5,
        r = 0.055 + rand() * 0.055;
      const trunk = mesh(new T.CylinderGeometry(r * 0.2, r, h, 12, 5), bark, this.vegetation, [
        x,
        y + h / 2,
        z,
      ]);
      if (Math.abs(x) < 5 && z < 12)
        this.colliders.push(
          physics.createCollider(
            RAPIER.ColliderDesc.cylinder(h / 2, r).setTranslation(x, y + h / 2, z),
          ),
        );
      for (let l = 0; l < 11; l++) {
        const cy = y + h * (0.23 + l * 0.06),
          spread = (1 - l / 13) * (0.38 + h * 0.08);
        for (let b = 0; b < 5; b++) {
          const a = b * Math.PI * 0.4 + l * 0.9 + rand() * 0.3;
          const ex = x + Math.cos(a) * spread,
            ez = z + Math.sin(a) * spread;
          if (i < 25) rod(this.vegetation, bark, [x, cy, z], [ex, cy - 0.12, ez], r * 0.18);
          if (idx < 6200) {
            dummy.position.set(x, cy, z);
            dummy.scale.set(spread, spread, spread * 1.3);
            dummy.rotation.set((rand() - 0.5) * 0.3, Math.PI / 2 - a, (rand() - 0.5) * 0.2);
            dummy.updateMatrix();
            foliage.setMatrixAt(idx++, dummy.matrix);
            foliage.setColorAt(
              idx - 1,
              new T.Color().setHSL(0.23 + rand() * 0.05, 0.2 + rand() * 0.18, 0.31 + rand() * 0.18),
            );
          }
        }
      }
      for (let j = 0; j < 4; j++) {
        const a = (j * Math.PI) / 2 + rand();
        tube(
          this.vegetation,
          bark,
          [
            [x, y + 0.08, z],
            [x + Math.cos(a) * 0.13, y + 0.015, z + Math.sin(a) * 0.13],
            [
              x + Math.cos(a) * 0.35,
              groundHeight(x + Math.cos(a) * 0.35, z + Math.sin(a) * 0.35),
              z + Math.sin(a) * 0.35,
            ],
          ],
          0.016,
        );
      }
    }
    foliage.count = idx;
    foliage.castShadow = false;
    this.vegetation.add(foliage);
    // Pinnate ferns, each frond made from individual tapered leaflets.
    const fernGeo = new T.BufferGeometry();
    const vertices = [];
    for (let f = 0; f < 7; f++)
      for (let i = 1; i < 10; i++)
        for (const side of [-1, 1]) {
          const t = i / 10,
            a = (f * Math.PI * 2) / 7,
            r = t * 0.17,
            y = Math.sin(t * Math.PI) * 0.11;
          const x = Math.cos(a) * r,
            z = Math.sin(a) * r;
          const len = (1 - t) * 0.05;
          vertices.push(
            x,
            y,
            z,
            x + Math.cos(a + side * 0.95) * len,
            y + 0.006,
            z + Math.sin(a + side * 0.95) * len,
            x + Math.cos(a) * 0.018,
            y + 0.004,
            z + Math.sin(a) * 0.018,
          );
        }
    fernGeo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    fernGeo.computeVertexNormals();
    const ferns = new T.InstancedMesh(
      fernGeo,
      new T.MeshStandardMaterial({ color: '#738749', roughness: 0.95, side: T.DoubleSide }),
      850,
    );
    for (let i = 0; i < 850; i++) {
      let x = (rand() - 0.5) * 22,
        z = (rand() - 0.3) * 25;
      if (Math.abs(x - trailX(z)) < 0.52) {
        x += x > 0 ? 0.7 : -0.7;
      }
      dummy.position.set(x, groundHeight(x, z), z);
      dummy.scale.setScalar(0.5 + rand() * 1.3);
      dummy.rotation.set(0, rand() * 6, 0);
      dummy.updateMatrix();
      ferns.setMatrixAt(i, dummy.matrix);
    }
    ferns.name = 'interactive-ferns';
    this.plantUniforms = bendVegetation(ferns.material as T.MeshStandardMaterial);
    this.vegetation.add(ferns);
    this.group.add(this.vegetation);
    // Fallen log and root obstacle with collision.
    const log = rod(
      this.group,
      bark,
      [-0.55, groundHeight(-0.55, 5) + 0.04, 5],
      [0.55, groundHeight(0.55, 5.25) + 0.04, 5.25],
      0.043,
    );
    log.updateMatrix();
    this.collider(log.geometry.clone().applyMatrix4(log.matrix));
    buildCourseMarkers(this.group, groundHeight);
    this.sign('FERN CREEK', '01  /  MODERATE', -1.05, 0.2);
    this.sign('GRANITE SPINE', '02  /  ADVANCED', -2.7, 4.7);
    // Distant ridgeline, continuous triangulated mountains and subtle snow caps.
    const mountainMat = new T.MeshStandardMaterial({
      color: '#747c74',
      roughness: 1,
      flatShading: true,
    });
    for (let i = 0; i < 17; i++) {
      const angle = (i / 17) * Math.PI * 2;
      const x = Math.cos(angle) * 47,
        z = Math.sin(angle) * 47,
        h = 10 + rand() * 15;
      const g = new T.ConeGeometry(9 + rand() * 6, h, 7, 5);
      const p = g.attributes.position;
      for (let j = 0; j < p.count; j++) {
        const y = p.getY(j);
        p.setY(j, y + Math.sin(p.getX(j) * 1.7 + p.getZ(j)) * Math.min(2, (h / 2 - y) * 0.1));
      }
      g.computeVertexNormals();
      mesh(g, mountainMat, this.group, [x, h / 2 - 3, z]);
    }
    scene.add(this.group);
    const sky = new Sky();
    this.sky = sky;
    sky.scale.setScalar(300);
    sky.material.uniforms.turbidity.value = 5;
    sky.material.uniforms.rayleigh.value = 1.8;
    const sunPos = new T.Vector3(-25, 35, -15);
    sky.material.uniforms.sunPosition.value.copy(sunPos);
    scene.add(sky);
    this.hemisphere = new T.HemisphereLight('#cfdfeb', '#5f644c', 1.15);
    scene.add(this.hemisphere);
    this.sun = new T.DirectionalLight('#ffe6bd', 3.0);
    this.sun.position.copy(sunPos);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -5,
      right: 5,
      top: 5,
      bottom: -5,
      near: 0.1,
      far: 80,
    });
    this.sun.shadow.bias = -0.00015;
    this.sun.shadow.normalBias = 0.006;
    this.sun.shadow.radius = 3;
    scene.add(this.sun, this.sun.target);
    scene.fog = new T.FogExp2('#a0afa0', 0.021);
    this.buildGarage();
    scene.add(this.garage);
  }
  collider(geo: T.BufferGeometry, surface?: Surface) {
    const positions = new Float32Array(geo.attributes.position.array);
    const indices = geo.index
      ? new Uint32Array(geo.index.array)
      : Uint32Array.from({ length: positions.length / 3 }, (_, i) => i);
    const collider = this.physics.createCollider(
      RAPIER.ColliderDesc.trimesh(positions, indices).setFriction(1),
    );
    this.colliders.push(collider);
    if (surface) this.materialSurfaces.set(collider.handle, surface);
  }
  sign(title: string, sub: string, x: number, z: number) {
    const y = groundHeight(x, z),
      wood = metal('#554d39', 0.9, 0);
    for (const a of [-0.17, 0.17]) rod(this.group, wood, [x + a, y, z], [x + a, y + 0.5, z], 0.014);
    box(this.group, metal('#25322a', 0.9, 0), [0.43, 0.24, 0.026], [x, y + 0.42, z]);
    mesh(new T.PlaneGeometry(0.39, 0.098), label(title, '#efdfb5'), this.group, [
      x,
      y + 0.45,
      z - 0.016,
    ]).rotation.y = Math.PI;
    mesh(new T.PlaneGeometry(0.36, 0.07), label(sub, '#b3b8a0'), this.group, [
      x,
      y + 0.38,
      z - 0.016,
    ]).rotation.y = Math.PI;
  }
  buildGarage() {
    const g = this.garage;
    g.position.x = 60;
    const charcoal = metal('#202b2b', 0.6, 0.5),
      wood = metal('#807355', 0.8, 0);
    wood.map = noiseTexture('wood');
    const steel = metal('#7f8783', 0.35, 0.8),
      red = metal('#8d4429'),
      rubber = metal('#12191b', 0.92, 0);
    box(g, metal('#434b45', 0.98, 0), [3, 0.06, 3], [0, -0.04, 0]);
    box(g, charcoal, [3, 1.8, 0.06], [0, 0.85, -0.86]);
    box(g, charcoal, [0.05, 1.8, 2.5], [-1.49, 0.85, 0.3]);
    // Workbench with milled edge, drawers, vise and a rubber service mat.
    box(g, wood, [1.3, 0.045, 0.67], [0, 0.3, 0]);
    box(g, rubber, [0.69, 0.006, 0.49], [0, 0.326, 0]);
    for (const x of [-0.5, 0.5]) box(g, charcoal, [0.035, 0.3, 0.035], [x, 0.13, 0.23]);
    for (const x of [-0.48, 0.48]) {
      box(g, charcoal, [0.26, 0.27, 0.53], [x, 0.14, -0.015]);
      for (let i = 0; i < 5; i++) {
        box(g, steel, [0.23, 0.003, 0.002], [x, 0.045 + i * 0.048, 0.253]);
        box(g, steel, [0.1, 0.008, 0.012], [x, 0.065 + i * 0.048, 0.258]);
      }
    }
    // Shelves with spare wheels, shock sets, motor cans and battery boxes.
    for (let k = 0; k < 3; k++) {
      const y = 0.37 + k * 0.28;
      box(g, wood, [2.7, 0.023, 0.25], [0, y, -0.71]);
      for (let i = 0; i < 7; i++) {
        const x = -1.1 + i * 0.35;
        if (k === 0) {
          const tyre = mesh(new T.TorusGeometry(0.053, 0.02, 12, 32), rubber, g, [
            x,
            y + 0.08,
            -0.66,
          ]);
          tyre.rotation.y = 0.2;
          mesh(new T.TorusGeometry(0.032, 0.004, 8, 24), steel, g, [x, y + 0.08, -0.636]);
        }
        if (k === 1) {
          box(g, red, [0.2, 0.095, 0.12], [x, y + 0.06, -0.69]);
          mesh(new T.PlaneGeometry(0.16, 0.04), label(i % 2 ? 'DRIVETRAIN' : 'TRAIL / PARTS'), g, [
            x,
            y + 0.06,
            -0.625,
          ]);
        }
        if (k === 2) {
          for (let j = 0; j < 3; j++) {
            const motor = mesh(
              new T.CylinderGeometry(0.018, 0.018, 0.06, 20),
              i % 2 ? red : steel,
              g,
              [x + j * 0.05, y + 0.04, -0.69],
            );
            motor.rotation.x = Math.PI / 2;
          }
        }
      }
    }
    // Pegboard tool panel.
    box(g, metal('#594e3b', 0.9, 0), [0.64, 0.54, 0.016], [-0.99, 0.64, -0.54]);
    for (let i = 0; i < 9; i++) {
      const x = -1.25 + i * 0.065;
      rod(g, steel, [x, 0.58, -0.52], [x, 0.81 - (i % 3) * 0.045, -0.52], 0.004);
      box(g, i % 2 ? red : rubber, [0.015, 0.064, 0.016], [x, 0.56, -0.52]);
    }
    for (const x of [-1.15, -0.45, 0.3, 1.05]) {
      box(g, charcoal, [0.48, 0.024, 0.04], [x, 1.26, -0.55]);
      box(
        g,
        new T.MeshStandardMaterial({ color: '#fff0cc', emissive: '#ffe2a1', emissiveIntensity: 3 }),
        [0.44, 0.008, 0.035],
        [x, 1.245, -0.55],
      );
    }
    mesh(
      new T.PlaneGeometry(0.65, 0.16),
      label('RIDGEBOUND / WORKS', '#e7dcc0'),
      g,
      [0.76, 1.03, -0.81],
    );
    // Bench spares and hand tools at actual RC scale.
    for (let i = 0; i < 4; i++) {
      const x = -0.46 + i * 0.047;
      rod(g, steel, [x, 0.335, 0.13], [x + 0.02, 0.335, 0.24], 0.002);
      box(g, red, [0.008, 0.008, 0.028], [x + 0.02, 0.335, 0.25]);
    }
    box(g, charcoal, [0.075, 0.034, 0.07], [0.48, 0.344, 0.02]);
    box(g, steel, [0.055, 0.014, 0.08], [0.48, 0.366, 0.02]);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const gear = mesh(new T.TorusGeometry(0.018, 0.004, 6, 24), steel, g, [
        0.36 + Math.cos(a) * 0.04,
        0.337,
        -0.12 + Math.sin(a) * 0.04,
      ]);
      gear.rotation.x = Math.PI / 2;
    }
    const key = new T.PointLight('#ffe5ba', 4, 4, 2);
    key.position.set(0.65, 1.1, 0.6);
    g.add(key);
    const fill = new T.PointLight('#a9c5d6', 2, 3, 2);
    fill.position.set(-0.6, 0.9, 0.4);
    g.add(fill);
  }
  update(time: number, position: T.Vector3) {
    const mat = this.water.material as T.MeshPhysicalMaterial;
    mat.normalMap!.offset.set(time * 0.007, time * 0.011);
    this.sun.position.copy(position).add(this.sunOffset);
    this.sun.target.position.copy(position);
    this.sun.target.updateMatrixWorld();
  }
}
