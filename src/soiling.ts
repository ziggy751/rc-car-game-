/** Persistent, graphics-independent exposure state. Wheel zones 0–3, matching arches/body zones 4–7. */
export type SurfaceCondition = { mud: number[]; dust: number; wet: number; scuffs: number };
export type Exposure = {
  contact: boolean;
  water: boolean;
  surface: string;
  load: number;
  speed: number;
  omega: number;
  radius: number;
  slip: number;
};
export function cleanCondition(): SurfaceCondition {
  return { mud: Array(8).fill(0), dust: 0, wet: 0, scuffs: 0 };
}
export function validateCondition(value: unknown, legacy = 0): SurfaceCondition {
  const input = (value && typeof value === 'object' ? value : {}) as Partial<SurfaceCondition>,
    out = cleanCondition(),
    bounded = (v: unknown, fallback = 0) =>
      typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
  out.mud = Array.from({ length: 8 }, (_, i) => bounded(input.mud?.[i], bounded(legacy)));
  out.dust = bounded(input.dust);
  out.wet = bounded(input.wet);
  out.scuffs = bounded(input.scuffs);
  return out;
}
export function updateCondition(
  state: SurfaceCondition,
  samples: Exposure[],
  dt: number,
  bodyScrape = 0,
) {
  let water = 0,
    mudWet = 0,
    dust = 0;
  samples.forEach((s, i) => {
    const motion = Math.abs(s.speed) + Math.abs(s.omega * s.radius) * 0.25,
      load = Math.min(1.5, s.load / 8),
      spray = Math.min(2, Math.abs(s.slip));
    if (s.contact && s.surface === 'Mud' && motion > 0.002) {
      const deposit = Math.min(0.4, motion * (0.5 + spray) * load);
      state.mud[i] = Math.min(1, state.mud[i] + dt * deposit);
      state.mud[i + 4] = Math.min(1, state.mud[i + 4] + dt * deposit * (0.22 + spray * 0.25));
      mudWet += deposit;
    }
    if (s.contact && (s.surface === 'Forest loam' || s.surface === 'Gravel'))
      dust += motion * load * 0.035;
    if (s.water) {
      state.mud[i] *= Math.exp(-dt * 0.75);
      state.mud[i + 4] *= Math.exp(-dt * 0.22);
      water++;
    }
  });
  state.dust = Math.max(0, Math.min(1, (state.dust + dust * dt) * Math.exp(-water * dt * 0.2)));
  state.wet = Math.max(
    0,
    Math.min(1, state.wet + (water * 0.15 + mudWet * 0.3 - state.wet * 0.018) * dt),
  );
  state.scuffs = Math.min(1, state.scuffs + Math.max(0, bodyScrape) * dt * 0.00012);
}
export function averageMud(state: SurfaceCondition) {
  return state.mud.reduce((n, v) => n + v, 0) / 8;
}
