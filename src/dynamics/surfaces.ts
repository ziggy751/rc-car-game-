import type { Collider, Vector } from '@dimforge/rapier3d-compat';
export type SurfaceName =
  | 'Dry granite'
  | 'Wet rock'
  | 'Forest loam'
  | 'Gravel'
  | 'Mud'
  | 'Timber'
  | 'Test concrete';
export type Surface = { name: SurfaceName; mu: number; rolling: number };
export const surfaces: Record<SurfaceName, Surface> = {
  'Dry granite': { name: 'Dry granite', mu: 1.0, rolling: 0.018 },
  'Wet rock': { name: 'Wet rock', mu: 0.45, rolling: 0.02 },
  'Forest loam': { name: 'Forest loam', mu: 0.78, rolling: 0.045 },
  Gravel: { name: 'Gravel', mu: 0.62, rolling: 0.065 },
  Mud: { name: 'Mud', mu: 0.34, rolling: 0.11 },
  Timber: { name: 'Timber', mu: 0.72, rolling: 0.018 },
  'Test concrete': { name: 'Test concrete', mu: 0.95, rolling: 0.012 },
};
export type SurfaceQuery = (point: Vector, collider: Collider) => Surface;
