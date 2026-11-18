import * as T from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { maps, biomeHeight, type MapId } from './map-definitions';
export type TerrainPiece = {
  kind: 'rock' | 'slab' | 'timber' | 'concrete';
  position: [number, number, number];
  size: [number, number, number];
  yaw: number;
  pitch: number;
  course: string;
};
export const laneX = [-2.4, -0.8, 0.8, 2.4];
/** Dimensions in metres. The relaxed shoulders remain open alongside each authored line. */
export function mapPieces(id: MapId): TerrainPiece[] {
  if (id === 'forest') return [];
  const map = maps.find((m) => m.id === id)!,
    out: TerrainPiece[] = [];
  for (let lane = 0; lane < 4; lane++)
    for (let obstacle = 0; obstacle < 4; obstacle++) {
      const z =
          id === 'rainforest' && lane === 0
            ? [-1.75, -0.9, 0.85, 1.85][obstacle]
            : -1.75 + obstacle * 1.05,
        x = laneX[lane] + [0.06, -0.08, 0.09, -0.04][obstacle];
      const h = [0.02, 0.035, 0.055, 0.078][lane] * (obstacle % 2 ? 0.85 : 1);
      const kind =
        id === 'competition'
          ? obstacle % 2 === 0
            ? 'timber'
            : 'concrete'
          : id === 'rainforest'
            ? obstacle % 2 === 0
              ? 'timber'
              : 'rock'
            : obstacle === 2
              ? 'slab'
              : 'rock';
      out.push({
        kind,
        position: [map.x + x, biomeHeight(id, x, z) + h * 0.38, map.z + z],
        size: [lane === 3 ? 0.13 : 0.105, h * 0.62, 0.12 + (obstacle === 2 ? 0.06 : 0)],
        yaw: [0.15, -0.25, 0.35, -0.1][obstacle],
        pitch: kind === 'slab' ? [0.025, 0.12, 0.25, 0.4][lane] : 0,
        course: `${id}-${lane}`,
      });
    }
  if (id === 'granite')
    for (const [x, z, w, h, l, yaw] of [
      [-4, 1, 0.65, 0.24, 1.1, 0.2],
      [4, -1, 0.7, 0.32, 1.3, -0.4],
      [-3.8, -3.5, 0.55, 0.28, 0.7, 0.5],
      [3.7, 3.7, 0.8, 0.35, 0.9, -0.2],
    ])
      out.push({
        kind: 'slab',
        position: [map.x + x, biomeHeight(id, x, z) + h * 0.4, map.z + z],
        size: [w, h, l],
        yaw,
        pitch: 0.25,
        course: 'scenery',
      });
  if (id === 'quarry')
    for (const [x, z, w, h, l] of [
      [-4.1, -2, 0.6, 0.22, 0.7],
      [4, -1, 0.65, 0.28, 0.8],
      [-3.9, 3.5, 0.7, 0.32, 0.8],
      [3.9, 3.4, 0.6, 0.28, 0.9],
    ])
      out.push({
        kind: 'rock',
        position: [map.x + x, biomeHeight(id, x, z) + h * 0.4, map.z + z],
        size: [w, h, l],
        yaw: 0.2,
        pitch: 0,
        course: 'scenery',
      });
  return out;
}
/** The exact same geometry is used by rendering and convex/cuboid collision construction. */
export function pieceGeometry(p: TerrainPiece) {
  if (p.kind === 'rock' || p.kind === 'slab') {
    const geometry = mergeVertices(new T.IcosahedronGeometry(1, 5)),
      positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        y = positions.getY(i),
        z = positions.getZ(i),
        n = 1 + 0.055 * Math.sin(x * 7 + y * 5 + z * 9);
      positions.setXYZ(i, x * p.size[0] * n, y * p.size[1] * n, z * p.size[2] * n);
    }
    geometry.computeVertexNormals();
    return geometry;
  }
  return new T.BoxGeometry(p.size[0] * 2, p.size[1] * 2, p.size[2] * 2);
}
export function addPieceCollider(world: RAPIER.World, p: TerrainPiece) {
  const rotation = new T.Quaternion().setFromEuler(new T.Euler(p.pitch, p.yaw, 0));
  let desc: RAPIER.ColliderDesc;
  if (p.kind === 'rock' || p.kind === 'slab') {
    const g = pieceGeometry(p);
    desc = RAPIER.ColliderDesc.convexHull(new Float32Array(g.attributes.position.array))!;
    g.dispose();
  } else
    desc = RAPIER.ColliderDesc.roundCuboid(
      Math.max(0.001, p.size[0] - 0.002),
      Math.max(0.001, p.size[1] - 0.002),
      Math.max(0.001, p.size[2] - 0.002),
      0.002,
    );
  return world.createCollider(
    desc
      .setTranslation(...p.position)
      .setRotation(rotation)
      .setFriction(1)
      .setRestitution(0),
  );
}
