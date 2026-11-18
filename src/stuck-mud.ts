import * as T from 'three';
/** Small pooled deposits attach to the struck chassis/axle/wheel assembly, never to screen coordinates. */
export class StuckMud {
  pools: T.InstancedMesh[] = [];
  counts = Array(7).fill(0);
  cursor = Array(7).fill(0);
  constructor(parents: T.Group[]) {
    const material = new T.MeshStandardMaterial({ color: '#5b4931', roughness: 0.65 });
    parents.forEach((parent) => {
      const pool = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), material, 32);
      pool.count = 0;
      pool.instanceMatrix.setUsage(T.DynamicDrawUsage);
      pool.frustumCulled = false;
      parent.add(pool);
      this.pools.push(pool);
    });
  }
  add(actor: number, point: T.Vector3, normal: T.Vector3, size: number) {
    if (!this.pools[actor]) return;
    const o = new T.Object3D();
    o.position.copy(point).addScaledVector(normal, size * 0.25);
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), normal);
    o.scale.set(size * 0.9, size * 0.4, size * 1.25);
    o.updateMatrix();
    const pool = this.pools[actor],
      index = pool.count < 32 ? pool.count++ : this.cursor[actor]++ % 32;
    pool.setMatrixAt(index, o.matrix);
    this.counts[actor] = pool.count;
    pool.instanceMatrix.needsUpdate = true;
  }
  wash(dt: number, waterAt: (p: T.Vector3) => number | null) {
    const m = new T.Matrix4(),
      p = new T.Vector3();
    for (const pool of this.pools) {
      for (let i = pool.count - 1; i >= 0; i--) {
        pool.getMatrixAt(i, m);
        p.setFromMatrixPosition(m).applyMatrix4(pool.matrixWorld);
        const water = waterAt(p);
        if (water !== null && p.y < water) {
          const decay = Math.exp(-dt * 1.8);
          m.scale(new T.Vector3(decay, decay, decay));
          const s = new T.Vector3().setFromMatrixScale(m);
          if (Math.max(s.x, s.y, s.z) < 0.0008) {
            pool.getMatrixAt(pool.count - 1, m);
            pool.count--;
          }
          pool.setMatrixAt(i, m);
          pool.instanceMatrix.needsUpdate = true;
        }
      }
    }
  }
  show(value: boolean, wet: number) {
    for (const p of this.pools) p.visible = value;
    (this.pools[0].material as T.MeshStandardMaterial).roughness = 0.95 - wet * 0.55;
  }
  clean() {
    this.counts.fill(0);
    this.cursor.fill(0);
    this.pools.forEach((p) => (p.count = 0));
  }
}
