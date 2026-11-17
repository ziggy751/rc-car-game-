import { Quaternion, Vector3 } from 'three';
import type { RigidBody, Vector } from '@dimforge/rapier3d-compat';
export const v = (p: Vector) => new Vector3(p.x, p.y, p.z);
export const q = (p: { x: number; y: number; z: number; w: number }) =>
  new Quaternion(p.x, p.y, p.z, p.w);
export const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
export const approach = (x: number, target: number, rate: number, dt: number) =>
  x + clamp(target - x, -rate * dt, rate * dt);
export const exponential = (x: number, expo: number) =>
  Math.sign(x) * ((1 - expo) * Math.abs(x) + expo * Math.abs(x) ** 3);
export const point = (b: RigidBody, local: Vector) =>
  v(local).applyQuaternion(q(b.rotation())).add(v(b.translation()));
export function ackermann(centre: number, wheelbase = 0.324, track = 0.256) {
  if (Math.abs(centre) < 1e-6) return [0, 0];
  const sign = Math.sign(centre),
    r = wheelbase / Math.tan(Math.abs(centre));
  const inner = Math.atan(wheelbase / Math.max(0.06, r - track / 2)),
    outer = Math.atan(wheelbase / (r + track / 2));
  return sign > 0 ? [outer, inner] : [-inner, -outer];
}
