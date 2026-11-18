import { maps } from './map-definitions';
import { laneX } from './map-layout';
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Extreme';
export type Course = {
  id: string;
  map?: import('./map-definitions').MapId;
  legacy: number;
  name: string;
  type: string;
  grade: Difficulty;
  distance: string;
  x: number;
  z: number;
  reward: number;
  color: string;
  gateWidth: number;
  gates: [number, number][];
  description: string;
  zone: string;
};
export const courses: Course[] = [
  {
    id: 'fern-creek',
    legacy: 0,
    name: 'Fern Creek',
    type: 'ROOTS & STONE',
    grade: 'Easy',
    distance: '4.2 m',
    x: 0,
    z: 0,
    reward: 150,
    color: '#a9c58b',
    gateWidth: 0.52,
    gates: [
      [0.1, 0.65],
      [0.2, 1.45],
      [-0.1, 2.25],
      [0.15, 3],
    ],
    zone: 'Forest',
    description:
      'A miniature woodland line: 18–30 mm steps, open gates and gentle roots. Start here and learn to place each tyre.',
  },
  {
    id: 'granite-spine',
    legacy: 1,
    name: 'Granite Spine',
    type: 'SLAB & SIDEHILL',
    grade: 'Hard',
    distance: '4.0 m',
    x: -2,
    z: 5,
    reward: 450,
    color: '#df9c62',
    gateWidth: 0.41,
    gates: [
      [-2, 5.65],
      [-2.2, 6.35],
      [-1.9, 7.05],
      [-1.55, 7.8],
    ],
    zone: 'Granite outcrop',
    description:
      '60–85 mm ramps, off-camber stone and narrow choices. Low gearing and careful tyre placement matter.',
  },
  {
    id: 'timberline',
    legacy: 2,
    name: 'The Timberline',
    type: 'CREEK & BRIDGE',
    grade: 'Medium',
    distance: '3.8 m',
    x: 0.65,
    z: 2.8,
    reward: 250,
    color: '#d7c37e',
    gateWidth: 0.46,
    gates: [
      [0.65, 3.35],
      [0.65, 4.05],
      [0.45, 4.75],
      [0.15, 5.45],
    ],
    zone: 'Creek',
    description:
      'A 510 mm timber bridge, wet stone and 35–55 mm obstacles. Smooth steering keeps you on the planks.',
  },
  {
    id: 'needle-point',
    legacy: 3,
    name: 'Needle Point',
    type: 'PRECISION COMPETITION',
    grade: 'Extreme',
    distance: '4.4 m',
    x: -5,
    z: 1,
    reward: 700,
    color: '#c27b73',
    gateWidth: 0.36,
    gates: [
      [-5, 1.7],
      [-5.15, 2.5],
      [-4.85, 3.3],
      [-5.1, 4.1],
    ],
    zone: 'Competition garden',
    description:
      '90–120 mm ledges with alternate shoulders, tilted slabs and tight gates. No artificial grip restrictions: use the line and the setup.',
  },
];
for (const map of maps.slice(1))
  for (let level = 0; level < 4; level++) {
    const labels = ['Easy', 'Medium', 'Hard', 'Extreme'] as Difficulty[],
      names = {
        granite: ['Shoulder Line', 'Split Slab', 'High Traverse', 'Crown Spine'],
        rainforest: ['Root Bypass', 'Creek Weave', 'Mud Gully', 'Flooded Roots'],
        quarry: ['Gravel Bench', 'Cut Stone', 'Boulder Slot', 'Ridge Cut'],
        competition: ['Club Line', 'Timber Test', 'Precision Loop', 'Final Gate'],
      } as Record<string, string[]>;
    const x = map.x + laneX[level];
    courses.push({
      id: `${map.id}-${level}`,
      map: map.id,
      legacy: courses.length,
      name: names[map.id][level],
      type: map.subtitle,
      grade: labels[level],
      distance: '6.0 m',
      x,
      z: map.z - 2.7,
      reward: [150, 250, 450, 700][level],
      color: map.color,
      gateWidth: [0.56, 0.5, 0.45, 0.41][level],
      gates: [
        [-0.02, -1.25],
        [0.04, 0.1],
        [-0.03, 1.4],
        [0.02, 2.7],
      ].map(([dx, z]) => [x + dx, map.z + z]),
      description: `${labels[level]} line through ${map.name}. Measured ${[20, 35, 55, 78][level]} mm obstacles with open approach shoulders.`,
      zone: map.name,
    });
  }
for (const course of courses) course.map ??= 'forest';

export type CourseRecord = {
  bestTime: number | null;
  bestScore: number;
  completions: number;
  recoveries: number;
};
export class CourseRun {
  gate = 0;
  recoveries = 0;
  elapsed = 0;
  distance = 0;
  finished = false;
  previous: { x: number; z: number };
  constructor(public course: Course) {
    this.previous = { x: course.x, z: course.z };
  }
  recover() {
    this.recoveries++;
  }
  checkpoint() {
    const point = this.gate ? this.course.gates[this.gate - 1] : [this.course.x, this.course.z];
    return { x: point[0], z: point[1] };
  }
  reposition(x: number, z: number) {
    this.previous = { x, z };
  }
  update(x: number, z: number, dt: number) {
    if (this.finished) return false;
    this.elapsed += dt;
    this.distance += Math.hypot(x - this.previous.x, z - this.previous.z);
    const g = this.course.gates[this.gate],
      before = this.gate === 0 ? [this.course.x, this.course.z] : this.course.gates[this.gate - 1];
    const dx = g[0] - before[0],
      dz = g[1] - before[1],
      length = Math.hypot(dx, dz),
      nx = dx / length,
      nz = dz / length;
    const a = (this.previous.x - g[0]) * nx + (this.previous.z - g[1]) * nz,
      b = (x - g[0]) * nx + (z - g[1]) * nz;
    if (a <= 0 && b > 0) {
      const t = -a / Math.max(0.000001, b - a),
        cx = this.previous.x + (x - this.previous.x) * t,
        cz = this.previous.z + (z - this.previous.z) * t,
        lateral = Math.abs((cx - g[0]) * -nz + (cz - g[1]) * nx);
      if (lateral <= this.course.gateWidth / 2 - 0.12) {
        this.gate++;
        this.finished = this.gate === this.course.gates.length;
      }
    }
    this.previous = { x, z };
    return this.finished;
  }
  get time() {
    return this.elapsed + this.recoveries * 20;
  }
  get score() {
    return Math.max(
      0,
      Math.round(
        1000 - this.time * 2 - this.recoveries * 120 - Math.max(0, this.distance - 5) * 12,
      ),
    );
  }
}
