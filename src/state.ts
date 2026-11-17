import { validateGraphics, type Graphics } from './graphics';
import { vehicles, vehicleTune, type VehicleId } from './catalogue';
import { validateCondition, type SurfaceCondition } from './soiling';
import type { CourseRecord } from './courses';
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
  condition: Partial<Record<VehicleId, SurfaceCondition>>;
  preferences: { visualWear: boolean; camera: number };
  tune: Tune;
  builds: { name: string; tune: Tune }[];
  completed: number[];
  credits: number;
  bindings: Record<Action, string>;
  weather: 'Clear' | 'Overcast' | 'Rain' | 'Fog' | 'Sunset' | 'Night';
  dirt: Partial<Record<VehicleId, number>>;
  owned: VehicleId[];
  vehicleTunes: Partial<Record<VehicleId, Tune>>;
  records: Record<string, CourseRecord>;
  graphics: Graphics;
};
export const SAVE_KEY = 'ridgebound.save.v1';
export function validateTune(value: unknown): Tune {
  const t = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>,
    out = { ...defaults };
  const bounds: Partial<Record<keyof Tune, [number, number]>> = {
    sidewall: [400, 8000],
    frontOverdrive: [0, 0.2],
    rearUnderdrive: [0, 0.2],
    ballast: [0, 0.3],
    ballastPosition: [-0.12, 0.12],
    linkHeight: [-0.005, 0.005],
    rearSpring: [25, 95],
    rearDamping: [2, 10],
    rebound: [5, 40],
    travel: [0.04, 0.09],
    rearTravel: [0.04, 0.09],
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
    foam: [400, 8000],
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
    vehicle: vehicles.map((v) => v.id),
    tread: ['rock', 'trail'],
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
  if (t.rearSpring === undefined) out.rearSpring = out.spring;
  if (t.rearDamping === undefined) out.rearDamping = out.damping;
  if (t.rebound === undefined) out.rebound = out.damping * 3.5;
  return out;
}
export function loadState(storage: Pick<Storage, 'getItem'> = localStorage): Save {
  const base: Save = {
    version: 1,
    condition: Object.fromEntries(vehicles.map((v) => [v.id, validateCondition(null)])),
    preferences: { visualWear: true, camera: 0 },
    tune: { ...defaults },
    builds: [],
    completed: [],
    credits: 0,
    bindings: { ...defaultBindings },
    weather: 'Clear',
    dirt: {},
    owned: vehicles.map((v) => v.id),
    vehicleTunes: {},
    records: {},
    graphics: { ...validateGraphics(null) },
  };
  try {
    const data = JSON.parse(storage.getItem(SAVE_KEY) || 'null');
    if (data?.version !== 1) return base;
    base.tune = validateTune(data.tune);
    // Unlock every current/future catalogue entry, including when migrating old locked saves.
    base.owned = vehicles.map((v) => v.id);
    if (['Clear', 'Overcast', 'Rain', 'Fog', 'Sunset', 'Night'].includes(data.weather))
      base.weather = data.weather;
    for (const id of base.owned) {
      const dirt = data.dirt?.[id];
      if (typeof dirt === 'number' && Number.isFinite(dirt))
        base.dirt[id] = Math.max(0, Math.min(1, dirt));
    }
    for (const id of base.owned)
      base.condition[id] = validateCondition(data.condition?.[id], base.dirt[id] ?? 0);
    base.preferences.visualWear =
      typeof data.preferences?.visualWear === 'boolean' ? data.preferences.visualWear : true;
    base.preferences.camera =
      Number.isInteger(data.preferences?.camera) &&
      data.preferences.camera >= 0 &&
      data.preferences.camera < 6
        ? data.preferences.camera
        : 0;
    base.graphics = validateGraphics(data.graphics, base.tune.quality);
    for (const id of base.owned) {
      if (data.vehicleTunes?.[id])
        base.vehicleTunes[id] = validateTune({ ...data.vehicleTunes[id], vehicle: id });
    }
    if (data.records && typeof data.records === 'object')
      for (const [id, record] of Object.entries(data.records) as [string, any][]) {
        if (!record || typeof record !== 'object') continue;
        if (!['fern-creek', 'granite-spine', 'timberline', 'needle-point'].includes(id)) continue;
        base.records[id] = {
          bestTime:
            typeof record.bestTime === 'number' &&
            Number.isFinite(record.bestTime) &&
            record.bestTime > 0
              ? record.bestTime
              : null,
          bestScore:
            typeof record.bestScore === 'number'
              ? Math.max(0, Math.min(1000, record.bestScore))
              : 0,
          completions: Math.max(0, Math.floor(record.completions) || 0),
          recoveries: Math.max(0, Math.floor(record.recoveries) || 0),
        };
      }
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

export function selectVehicle(state: Save, id: VehicleId) {
  if (!vehicles.some((v) => v.id === id)) return false;
  state.vehicleTunes[state.tune.vehicle] = { ...state.tune };
  state.tune = validateTune({ ...(state.vehicleTunes[id] ?? vehicleTune(id)), vehicle: id });
  return true;
}
