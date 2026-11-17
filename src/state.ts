import { isBindingCode } from './dynamics/controls';
import { defaults, type Tune } from './dynamics/tuning';
export type Action = 'forward' | 'reverse' | 'left' | 'right' | 'brake' | 'recover' | 'precision';
export const defaultBindings: Record<Action, string> = {
  forward: 'KeyW',
  reverse: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  brake: 'Space',
  recover: 'KeyR',
  precision: 'ShiftLeft',
};
export type Save = {
  version: 1;
  tune: Tune;
  builds: { name: string; tune: Tune }[];
  completed: number[];
  credits: number;
  bindings: Record<Action, string>;
};
export const SAVE_KEY = 'ridgebound.save.v1';
export function validateTune(value: unknown): Tune {
  const t = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>,
    out = { ...defaults };
  const bounds: Partial<Record<keyof Tune, [number, number]>> = {
    radius: [0.052, 0.067],
    spring: [25, 95],
    damping: [2, 10],
    ride: [0.05, 0.085],
    turns: [20, 55],
    kv: [800, 2500],
    voltage: [6, 11.1],
    capacity: [1, 4],
    batteryPosition: [-0.15, 0.12],
    batteryHeight: [0.045, 0.16],
    gearRatio: [12, 35],
    axleRatio: [3, 6],
    dragBrake: [0, 1],
    wheelWeight: [0, 0.15],
    tyreWidth: [0.034, 0.055],
    foam: [1200, 6000],
    preload: [0, 0.015],
    servoRate: [1, 10],
    servoTorque: [0.05, 3],
    endpoint: [0.25, 0.68],
    steeringExpo: [0, 0.8],
    throttleExpo: [0, 0.85],
    sensitivity: [0.2, 1],
  };
  for (const [key, [min, max]] of Object.entries(bounds)) {
    const value = t[key];
    if (typeof value === 'number' && Number.isFinite(value))
      (out as any)[key] = Math.max(min, Math.min(max, value));
  }
  const enums: Partial<Record<keyof Tune, string[]>> = {
    compound: ['soft', 'trail', 'hard'],
    motor: ['torque', 'trail'],
    quality: ['Low', 'Medium', 'High', 'Ultra'],
    motorKind: ['brushed', 'brushless'],
    axleType: ['straight', 'portal'],
    differential: ['locked', 'open'],
  };
  for (const [key, options] of Object.entries(enums))
    if (options.includes(t[key] as string)) (out as any)[key] = t[key];
  for (const key of ['body', 'audio', 'precision'] as const)
    if (typeof t[key] === 'boolean') out[key] = t[key];
  if (typeof t.paint === 'string' && /^#[0-9a-f]{6}$/i.test(t.paint)) out.paint = t.paint;
  return out;
}
export function loadState(storage: Pick<Storage, 'getItem'> = localStorage): Save {
  const base: Save = {
    version: 1,
    tune: { ...defaults },
    builds: [],
    completed: [],
    credits: 0,
    bindings: { ...defaultBindings },
  };
  try {
    const data = JSON.parse(storage.getItem(SAVE_KEY) || 'null');
    if (data?.version !== 1) return base;
    base.tune = validateTune(data.tune);
    base.completed = Array.isArray(data.completed)
      ? [
          ...new Set<number>(
            data.completed.filter(
              (x: unknown) => Number.isInteger(x) && Number(x) >= 0 && Number(x) < 4,
            ),
          ),
        ]
      : [];
    base.credits =
      typeof data.credits === 'number' && Number.isFinite(data.credits)
        ? Math.max(0, data.credits)
        : base.completed.length * 150;
    base.builds = Array.isArray(data.builds)
      ? data.builds
          .filter((b: any) => typeof b?.name === 'string' && b?.tune)
          .slice(0, 8)
          .map((b: any) => ({ name: b.name.slice(0, 40), tune: validateTune(b.tune) }))
      : [];
    for (const action of Object.keys(defaultBindings) as Action[]) {
      const code = data.bindings?.[action];
      if (typeof code === 'string' && isBindingCode(code)) base.bindings[action] = code;
    }
    return base;
  } catch {
    return base;
  }
}
export function saveState(state: Save, storage: Pick<Storage, 'setItem'> = localStorage) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
