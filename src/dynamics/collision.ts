import RAPIER from '@dimforge/rapier3d-compat';
/** Sample static support across the footprint before an explicit recovery, not while driving. */
export function recoverySupport(
  world: RAPIER.World,
  x: number,
  z: number,
  fromY: number,
  vehicleHandles: ReadonlySet<number>,
  fallback: number,
) {
  let support = fallback;
  for (const [dx, dz] of [
    [0, 0],
    [-0.128, 0.162],
    [0.128, 0.162],
    [-0.128, -0.162],
    [0.128, -0.162],
  ]) {
    const hit = world.castRay(
      new RAPIER.Ray({ x: x + dx, y: fromY, z: z + dz }, { x: 0, y: -1, z: 0 }),
      20,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      (collider) => !collider.parent() || !vehicleHandles.has(collider.parent()!.handle),
    );
    if (hit) support = Math.max(support, fromY - hit.timeOfImpact);
  }
  return support;
}
