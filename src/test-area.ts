import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { box, metal, mesh, label, rod } from './materials';
import { surfaces, type Surface } from './dynamics/surfaces';
export const testStations = [
  { name: 'Turning pad', x: 10, z: -10 },
  { name: 'Articulation ramp', x: 12, z: -6 },
  { name: '20° climb', x: 10, z: -3.6 },
  { name: '25° sidehill', x: 14.5, z: -10 },
  { name: 'Grip lanes', x: 8, z: -5 },
];
export class TestArea {
  group = new T.Group();
  materials = new Map<number, Surface>();
  constructor(public world: RAPIER.World) {
    const floor = this.solid([10, 0.08, 12], [11, -0.04, -7], metal('#515c50', 0.98, 0));
    floor.name = 'Physical test area';
    const paint = new T.MeshBasicMaterial({ color: '#d8ca8f', side: T.DoubleSide });
    for (const radius of [0.5, 1, 1.5]) {
      const ring = mesh(
        new T.RingGeometry(radius - 0.006, radius + 0.006, 96),
        paint,
        this.group,
        [10, 0.001, -10],
      );
      ring.rotation.x = -Math.PI / 2;
    }
    // One wheel ramp rising 45 mm over 0.8 m; adjacent lane stays flat.
    this.ramp(0.13, 0.045, 0.8, 11.872, -5.5, 0);
    this.ramp(0.8, 0.48, 1.32, 10, -2.8, 0);
    this.ramp(0.8, 0.37, 1.2, 14.5, -9.2, Math.PI / 2);
    for (const [i, name] of ['Dry granite', 'Wet rock', 'Gravel', 'Mud'].entries()) {
      const x = 7.6 + i * 0.6;
      this.solid(
        [0.48, 0.006, 1.6],
        [x, 0.006, -4.4],
        metal(['#8d8b7c', '#49655f', '#9d9479', '#584a35'][i], 0.9, 0),
        surfaces[name as keyof typeof surfaces],
      );
      const caption = mesh(new T.PlaneGeometry(0.42, 0.13), label(name.toUpperCase()), this.group, [
        x,
        0.016,
        -5.3,
      ]);
      caption.rotation.x = -Math.PI / 2;
    }
    // Rounded physical step obstacles; no raycast-only obstacle stand-ins.
    for (let i = 0; i < 5; i++) {
      const radius = 0.015 + i * 0.008,
        x = 9.2,
        z = -7.2 + i * 0.19;
      const m = mesh(new T.SphereGeometry(radius, 20, 12), metal('#828775', 0.95, 0), this.group, [
        x,
        radius * 0.4,
        z,
      ]);
      const collider = world.createCollider(
        RAPIER.ColliderDesc.ball(radius)
          .setTranslation(x, radius * 0.4, z)
          .setFriction(1),
      );
      this.materials.set(collider.handle, surfaces['Dry granite']);
      m.name = 'Measured step';
    }
    for (const station of testStations) {
      rod(
        this.group,
        metal('#c2b677', 0.8, 0),
        [station.x - 0.5, 0, station.z],
        [station.x - 0.5, 0.35, station.z],
        0.007,
      );
      mesh(new T.PlaneGeometry(0.55, 0.12), label(station.name.toUpperCase()), this.group, [
        station.x - 0.5,
        0.32,
        station.z,
      ]);
    }
  }
  solid(size: number[], pos: number[], material: T.Material, surface = surfaces['Test concrete']) {
    const m = box(this.group, material, size, pos),
      c = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2)
          .setTranslation(pos[0], pos[1], pos[2])
          .setFriction(1)
          .setRestitution(0),
      );
    this.materials.set(c.handle, surface);
    return m;
  }
  ramp(width: number, height: number, length: number, x: number, z: number, yaw: number) {
    // Exact wedge mesh shared with the collision geometry.
    const verts = new Float32Array([
      -width / 2,
      0,
      -length / 2,
      width / 2,
      0,
      -length / 2,
      -width / 2,
      height,
      length / 2,
      width / 2,
      height,
      length / 2,
      -width / 2,
      0,
      length / 2,
      width / 2,
      0,
      length / 2,
    ]);
    const indices = new Uint32Array([
      0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5, 0, 4, 2, 1, 3, 5, 0, 1, 4, 1, 5, 4,
    ]);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(verts, 3));
    g.setIndex(new T.BufferAttribute(indices, 1));
    g.computeVertexNormals();
    const m = mesh(g, metal('#7b8171', 0.9, 0), this.group, [x, 0.002, z]);
    m.rotation.y = yaw;
    m.updateMatrix();
    const collision = g.clone().applyMatrix4(m.matrix);
    const c = this.world.createCollider(
      RAPIER.ColliderDesc.trimesh(
        new Float32Array(collision.attributes.position.array),
        indices,
      ).setFriction(1),
    );
    this.materials.set(c.handle, surfaces['Dry granite']);
  }
  surfaceAt(p: RAPIER.Vector, c: RAPIER.Collider) {
    return (
      this.materials.get(c.handle) ??
      (p.z > 3.2 && p.z < 4.2
        ? surfaces['Wet rock']
        : Math.abs(p.x) < 1 && p.z < 2.6
          ? surfaces['Dry granite']
          : surfaces['Forest loam'])
    );
  }
}
