export type MapId = 'forest' | 'granite' | 'rainforest' | 'quarry' | 'competition';
export type MapSpec = {
  id: MapId;
  name: string;
  subtitle: string;
  description: string;
  x: number;
  z: number;
  color: string;
};
export const maps: MapSpec[] = [
  {
    id: 'forest',
    name: 'Silver Pine',
    subtitle: 'FOREST TRAIL PARK',
    x: -1,
    z: 4,
    color: '#a8b18b',
    description:
      'Root shelves, mossy stone, timber and the creek. Four familiar lines remain, with open shoulders for exploration.',
  },
  {
    id: 'granite',
    name: 'Granite Crown',
    subtitle: 'EXTREME ROCK PARK',
    x: -12,
    z: -8,
    color: '#b1aaa1',
    description:
      'Stacked granite fins, sloping slabs and a narrow summit spine. Choose the ramped shoulders or tackle the ledges head-on.',
  },
  {
    id: 'rainforest',
    name: 'Hollow Creek',
    subtitle: 'MUDDY RAINFOREST',
    x: -12,
    z: 10,
    color: '#7c9d81',
    description:
      'Rooted gullies, a shallow stream and deformable wet soil. Supported bypasses flank the deep mud and a small cascade feeds the crossing.',
  },
  {
    id: 'quarry',
    name: 'Redbank Quarry',
    subtitle: 'QUARRY & BOULDER PARK',
    x: 10,
    z: 10,
    color: '#c8a978',
    description:
      'Cut stone terraces, gravel benches and an old service yard. Wide gravel access lines sit beside tight boulder passages.',
  },
  {
    id: 'competition',
    name: 'Works Circuit',
    subtitle: 'RC COMPETITION PARK',
    x: 0,
    z: -11,
    color: '#dfaa55',
    description:
      'Hand-built timber, concrete wedges, balance beams and gated rock sections. Four measured courses share an open practice apron.',
  },
];
export function mapSpec(id: string) {
  return maps.find((m) => m.id === id) ?? maps[0];
}
export function regionAt(x: number, z: number): MapSpec | null {
  return maps.slice(1).find((m) => Math.abs(x - m.x) < 5 && Math.abs(z - m.z) < 5) ?? null;
}
export function biomeHeight(id: MapId, x: number, z: number) {
  if (id === 'granite')
    return (
      0.12 +
      0.025 * (z + 3) +
      0.16 * Math.exp(-((x + 2.8) ** 2 + (z - 2) ** 2) / 2.4) +
      0.025 * Math.sin(x * 0.9) * Math.cos(z * 0.8)
    );
  if (id === 'rainforest')
    return (
      0.11 +
      0.018 * Math.sin(x * 0.9) +
      0.025 * Math.cos(z * 0.7) -
      0.065 * Math.exp(-((z / 0.65) ** 2))
    );
  if (id === 'quarry')
    return 0.08 + 0.018 * (z + 3) + 0.012 * Math.sin(x * 1.2) * Math.cos(z * 0.7);
  if (id === 'competition') return 0.025;
  return 0;
}
export function mudBounds(id: MapId) {
  return id === 'rainforest'
    ? { x: -12, z: 10.8, width: 7.6, length: 1.8, depth: 0.055, wetness: 0.9 }
    : null;
}
export function mapWater(x: number, z: number) {
  const map = regionAt(x, z);
  if (map?.id === 'rainforest' && Math.abs(z - map.z) < 0.32 && Math.abs(x - map.x) < 4.3)
    return 0.085;
  return null;
}
