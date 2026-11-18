import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { maps, mapWater, biomeHeight, mudBounds, type MapId } from './map-definitions';
import { mapPieces, pieceGeometry, addPieceCollider } from './map-layout';
import { surfaceMaterial } from './material-library';
import { mesh, box, rod, tube, metal, label } from './materials';
import { MudField } from './mud-field';
import { surfaces, type Surface } from './dynamics/surfaces';
import type { Simulation } from './physics';
export class MapEnvironments {
  groups = new Map<MapId, T.Group>();
  materials = new Map<number, Surface>();
  mud: MudField;
  mudMesh: T.Mesh;
  mudVersion = -1;
  vegetation: T.InstancedMesh[] = [];
  water: T.Mesh[] = [];
  constructor(scene: T.Scene, world: RAPIER.World) {
    for (const map of maps.slice(1)) {
      const group = new T.Group();
      group.name = map.name;
      this.groups.set(map.id, group);
      scene.add(group);
      group.visible = false;
      const rock = surfaceMaterial('rock'),
        moss = surfaceMaterial('moss'),
        timber = metal('#776447', 0.94, 0),
        concrete = surfaceMaterial('rock');
      for (const p of mapPieces(map.id)) {
        const m =
            p.kind === 'timber'
              ? timber
              : p.kind === 'concrete'
                ? concrete
                : map.id === 'rainforest'
                  ? moss
                  : rock,
          rendered = mesh(pieceGeometry(p), m, group, p.position);
        rendered.rotation.set(p.pitch, p.yaw, 0);
        const collider = addPieceCollider(world, p);
        this.materials.set(
          collider.handle,
          p.kind === 'timber'
            ? surfaces.Timber
            : map.id === 'rainforest'
              ? surfaces['Wet rock']
              : surfaces['Dry granite'],
        );
      }
      const ground = (x: number, z: number) => biomeHeight(map.id, x, z);
      // Dressing is deliberately placed outside the course lanes and their 0.6 m shoulders.
      if (map.id === 'granite' || map.id === 'quarry') {
        for (const side of [-1, 1])
          for (let j = 0; j < 6; j++) {
            const x = side * (4.1 + (j % 2) * 0.18),
              z = -4 + j * 1.5,
              h = 0.18 + (j % 3) * 0.08;
            const p = {
              kind: 'rock' as const,
              position: [map.x + x, ground(x, z) + h * 0.35, map.z + z] as [number, number, number],
              size: [0.22, h, 0.26] as [number, number, number],
              yaw: j * 0.37,
              pitch: 0.1,
              course: 'scenery',
            };
            mesh(pieceGeometry(p), rock, group, p.position);
            this.materials.set(addPieceCollider(world, p).handle, surfaces['Dry granite']);
          }
      }
      if (map.id === 'quarry') {
        const rust = metal('#77503a', 0.93, 0.5),
          steel = metal('#626963', 0.75, 0.65);
        for (const x of [-3.6, 3.6]) {
          box(group, rust, [0.42, 0.35, 0.32], [map.x + x, ground(x, -3.8) + 0.175, map.z - 3.8]);
          for (let j = 0; j < 5; j++)
            rod(
              group,
              steel,
              [map.x + x - 0.18 + j * 0.09, ground(x, -3.8) + 0.02, map.z - 3.965],
              [map.x + x - 0.18 + j * 0.09, ground(x, -3.8) + 0.34, map.z - 3.965],
              0.004,
            );
        }
        box(group, steel, [1.15, 0.018, 0.13], [map.x, ground(0, 3.5) + 0.1, map.z + 3.6]);
        for (const x of [-0.45, 0.45])
          rod(
            group,
            rust,
            [map.x + x, ground(x, 3.6), map.z + 3.6],
            [map.x + x, ground(x, 3.6) + 0.22, map.z + 3.6],
            0.013,
          );
        mesh(new T.PlaneGeometry(0.36, 0.12), label('REDBANK / SERVICE YARD'), group, [
          map.x - 3.6,
          ground(-3.6, -3.8) + 0.27,
          map.z - 3.965,
        ]);
      }
      if (map.id === 'competition') {
        const yellow = metal('#c5a459', 0.85, 0),
          wood = metal('#70614d', 0.95, 0);
        for (const x of [-4, 4])
          for (let j = 0; j < 5; j++) {
            rod(
              group,
              yellow,
              [map.x + x, 0.025, map.z - 3.8 + j * 1.6],
              [map.x + x, 0.15, map.z - 3.8 + j * 1.6],
              0.007,
            );
            if (j < 4)
              rod(
                group,
                wood,
                [map.x + x, 0.11, map.z - 3.8 + j * 1.6],
                [map.x + x, 0.11, map.z - 2.2 + j * 1.6],
                0.004,
              );
          }
        for (let i = 0; i < 5; i++) {
          const plank = box(
            group,
            wood,
            [0.18, 0.014, 0.065],
            [map.x - 3.9, 0.09, map.z - 1 + i * 0.13],
          );
          this.materials.set(
            world.createCollider(
              RAPIER.ColliderDesc.cuboid(0.18, 0.014, 0.065)
                .setTranslation(plank.position.x, 0.09, plank.position.z)
                .setFriction(1),
            ).handle,
            surfaces.Timber,
          );
        }
      }
      if (map.id === 'rainforest') {
        const bark = surfaceMaterial('bark'),
          leaf = metal('#4d7045', 0.94, 0),
          leafGeometry = new T.BufferGeometry(),
          v: number[] = [];
        for (let arm = 0; arm < 7; arm++)
          for (let segment = 0; segment < 12; segment++) {
            const a = (arm * Math.PI * 2) / 7,
              vertex = (t: number, side: number) => {
                const r = 0.32 * t,
                  w = 0.045 * Math.sin(t * Math.PI);
                return [
                  Math.cos(a) * r - Math.sin(a) * w * side,
                  0.24 * Math.sin(t * Math.PI * 0.85) - side * side * 0.008 * Math.sin(t * Math.PI),
                  Math.sin(a) * r + Math.cos(a) * w * side,
                ];
              },
              t = segment / 12,
              n = (segment + 1) / 12;
            v.push(
              ...vertex(t, -1),
              ...vertex(t, 1),
              ...vertex(n, -1),
              ...vertex(t, 1),
              ...vertex(n, 1),
              ...vertex(n, -1),
            );
          }
        leafGeometry.setAttribute('position', new T.Float32BufferAttribute(v, 3));
        leafGeometry.computeVertexNormals();
        leaf.side = T.DoubleSide;
        const plants = new T.InstancedMesh(leafGeometry, leaf, 260);
        const dummy = new T.Object3D();
        for (let i = 0; i < 260; i++) {
          const side = i % 2 ? -1 : 1,
            x = side * (3.35 + (i % 13) * 0.09),
            z = -4.4 + Math.floor(i / 26) * 0.85;
          dummy.position.set(map.x + x, ground(x, z), map.z + z);
          dummy.rotation.y = i * 0.79;
          dummy.scale.setScalar(0.55 + (i % 5) * 0.15);
          dummy.updateMatrix();
          plants.setMatrixAt(i, dummy.matrix);
        }
        this.vegetation.push(plants);
        group.add(plants);
        for (const side of [-1, 1])
          for (let j = 0; j < 6; j++) {
            const x = side * 4.35,
              z = -4 + j * 1.6,
              y = ground(x, z);
            rod(
              group,
              bark,
              [map.x + x, y, map.z + z],
              [map.x + x * 0.98, y + 2.0 + (j % 3) * 0.25, map.z + z + 0.08],
              0.055,
            );
            const crown = mesh(leafGeometry, leaf, group, [
              map.x + x * 0.98,
              y + 2.0 + (j % 3) * 0.25,
              map.z + z + 0.08,
            ]);
            crown.scale.setScalar(3.2);
            crown.rotation.y = j * 0.7;
            for (let k = 0; k < 4; k++) {
              const a = (k * Math.PI) / 2;
              const root = new T.Vector3(
                map.x + x + Math.cos(a) * 0.3,
                ground(x + Math.cos(a) * 0.3, z + Math.sin(a) * 0.3),
                map.z + z + Math.sin(a) * 0.3,
              );
              tube(group, bark, [[map.x + x, y + 0.12, map.z + z], root.toArray()], 0.018);
            }
          }
        const water = new T.MeshPhysicalMaterial({
          color: '#446d5d',
          roughness: 0.2,
          metalness: 0,
          transparent: true,
          opacity: 0.62,
          clearcoat: 1,
        });
        const creek = mesh(new T.PlaneGeometry(8.6, 0.64, 40, 6), water, group, [
          map.x,
          0.085,
          map.z,
        ]);
        creek.rotation.x = -Math.PI / 2;
        const cascade = mesh(new T.PlaneGeometry(0.3, 0.15, 8, 12), water, group, [
          map.x + 4.15,
          0.16,
          map.z - 0.22,
        ]);
        cascade.rotation.y = -0.3;
        this.water.push(creek, cascade);
      }
    }
    const bounds = mudBounds('rainforest')!;
    this.mud = new MudField(
      world,
      bounds.x,
      bounds.z,
      bounds.width,
      bounds.length,
      bounds.depth,
      (x, z) => biomeHeight('rainforest', x + 12, z - 10),
    );
    this.materials.set(this.mud.collider.handle, this.mud.surface);
    const geo = new T.PlaneGeometry(bounds.width, bounds.length, this.mud.cols, this.mud.rows);
    geo.rotateX(-Math.PI / 2);
    this.mudMesh = new T.Mesh(geo, surfaceMaterial('mud'));
    this.mudMesh.position.set(bounds.x, 0, bounds.z);
    this.mudMesh.receiveShadow = true;
    this.groups.get('rainforest')!.add(this.mudMesh);
    this.sync();
  }
  show(id: MapId, density: number, indoor = false, water = true) {
    for (const [key, group] of this.groups) group.visible = !indoor;
    for (const plants of this.vegetation) {
      plants.count = Math.floor(260 * density);
    }
    for (const mesh of this.water) mesh.visible = water;
  }
  step(dt: number, sim: Simulation) {
    this.mud.step(
      dt,
      sim.wheels.map((w) => ({
        point: w.point,
        load: w.load,
        slip: w.slip,
        contact: w.contact,
        width: sim.tune.tyreWidth,
      })),
    );
  }
  sync() {
    if (this.mudVersion === this.mud.version) return;
    this.mudVersion = this.mud.version;
    const p = this.mudMesh.geometry.attributes.position;
    for (let r = 0; r <= this.mud.rows; r++)
      for (let c = 0; c <= this.mud.cols; c++)
        p.setY(r * (this.mud.cols + 1) + c, this.mud.heights[r + c * (this.mud.rows + 1)]);
    p.needsUpdate = true;
    this.mudMesh.geometry.computeVertexNormals();
  }
}
