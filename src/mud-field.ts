import RAPIER from '@dimforge/rapier3d-compat';
import type { Surface } from './dynamics/surfaces';
export type MudContact = {
  point: { x: number; y: number; z: number };
  load: number;
  slip: number;
  contact: boolean;
  width: number;
};
/** A physical soil heightfield, advanced at fixed simulation time regardless of visual preset. */
export class MudField {
  rows = 36;
  cols = 152;
  heights: Float32Array;
  original: Float32Array;
  collider: RAPIER.Collider;
  version = 0;
  elapsed = 0;
  dirty = false;
  surface: Surface = { name: 'Mud', mu: 0.36, rolling: 0.095, wetness: 0.9, mudDepth: 0.055 };
  constructor(
    public world: RAPIER.World,
    public x: number,
    public z: number,
    public width: number,
    public length: number,
    public depth: number,
    top: (x: number, z: number) => number,
  ) {
    this.heights = new Float32Array((this.rows + 1) * (this.cols + 1));
    for (let c = 0; c <= this.cols; c++)
      for (let r = 0; r <= this.rows; r++)
        this.heights[r + c * (this.rows + 1)] = top(
          x - width / 2 + (c * width) / this.cols,
          z - length / 2 + (r * length) / this.rows,
        );
    this.original = this.heights.slice();
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.heightfield(
        this.rows,
        this.cols,
        this.heights,
        { x: width, y: 1, z: length },
        RAPIER.HeightFieldFlags.FIX_INTERNAL_EDGES,
      )
        .setTranslation(x, 0, z)
        .setFriction(1),
    );
  }
  sampleSurface(x: number, z: number): Surface {
    const c = Math.max(
        0,
        Math.min(this.cols, Math.round(((x - this.x + this.width / 2) / this.width) * this.cols)),
      ),
      r = Math.max(
        0,
        Math.min(this.rows, Math.round(((z - this.z + this.length / 2) / this.length) * this.rows)),
      ),
      i = r + c * (this.rows + 1),
      sink = this.original[i] - this.heights[i],
      wet = 0.78 + 0.12 * Math.cos((x - this.x) * 0.8),
      remaining = Math.max(0.005, this.depth - sink);
    return {
      name: 'Mud',
      wetness: wet,
      mudDepth: remaining,
      mu: 0.65 * (1 - 0.6 * wet) * (1 + (sink / this.depth) * 0.08),
      rolling: 0.055 + remaining * 1.25,
    };
  }

  contains(x: number, z: number) {
    return Math.abs(x - this.x) < this.width / 2 && Math.abs(z - this.z) < this.length / 2;
  }
  height(x: number, z: number) {
    const c = Math.max(
        0,
        Math.min(this.cols, Math.round(((x - this.x + this.width / 2) / this.width) * this.cols)),
      ),
      r = Math.max(
        0,
        Math.min(this.rows, Math.round(((z - this.z + this.length / 2) / this.length) * this.rows)),
      );
    return this.heights[r + c * (this.rows + 1)];
  }
  step(dt: number, contacts: MudContact[]) {
    for (const s of contacts) {
      if (
        !s.contact ||
        !this.contains(s.point.x, s.point.z) ||
        s.load < 0.2 ||
        Math.abs(s.point.y - this.height(s.point.x, s.point.z)) > 0.016
      )
        continue;
      const cx = Math.round(((s.point.x - this.x + this.width / 2) / this.width) * this.cols),
        rz = Math.round(((s.point.z - this.z + this.length / 2) / this.length) * this.rows),
        sink =
          dt *
          0.004 *
          Math.min(2, s.load / 8) *
          (1 + Math.min(3, Math.abs(s.slip))) *
          this.surface.wetness!;
      for (let dc = -1; dc <= 1; dc++)
        for (let dr = -1; dr <= 1; dr++) {
          const c = cx + dc,
            r = rz + dr;
          if (c <= 0 || r <= 0 || c >= this.cols || r >= this.rows) continue;
          const index = r + c * (this.rows + 1),
            weight = Math.exp(
              -(
                ((dc * this.width) / this.cols / Math.max(0.025, s.width)) ** 2 +
                ((dr * this.length) / this.rows / 0.045) ** 2
              ),
            );
          const next = Math.max(
            this.original[index] - this.depth,
            this.heights[index] - sink * weight,
          );
          if (next !== this.heights[index]) {
            this.heights[index] = next;
            this.dirty = true;
          }
        }
    }
    this.elapsed += dt;
    if (this.dirty && this.elapsed >= 1 / 12) {
      this.collider.setShape(
        new RAPIER.Heightfield(
          this.rows,
          this.cols,
          this.heights,
          { x: this.width, y: 1, z: this.length },
          RAPIER.HeightFieldFlags.FIX_INTERNAL_EDGES,
        ),
      );
      this.elapsed = 0;
      this.version++;
      this.dirty = false;
    }
  }
}
