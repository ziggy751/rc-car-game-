import type { Tune } from './tuning';
export type PowerId = 'scale' | 'torque' | 'sensored' | 'performance' | 'competition';
export type PowerSpec = {
  id: PowerId;
  name: string;
  kind: 'brushed' | 'brushless';
  resistance: number;
  inductance: number;
  rotorInertia: number;
  noLoadCurrent: number;
  phaseLimit: number;
  batteryLimit: number;
  sensored: boolean;
  maxRPM: number;
  thermalMass: number;
  cooling: number;
  preset: Partial<Tune>;
};
/** Representative 540/550 electrical parameters, not manufacturer dyno data. SI internally. */
export const powerSystems: PowerSpec[] = [
  {
    id: 'scale',
    name: '540 scale brushed',
    kind: 'brushed',
    resistance: 0.22,
    inductance: 0.00022,
    rotorInertia: 1.1e-6,
    noLoadCurrent: 0.8,
    phaseLimit: 28,
    batteryLimit: 25,
    sensored: false,
    maxRPM: 32000,
    thermalMass: 28,
    cooling: 0.45,
    preset: {
      motorKind: 'brushed',
      turns: 27,
      voltage: 7.4,
      gearRatio: 18,
      escCurrent: 28,
      batteryCurrent: 25,
      escPunch: 1.8,
    },
  },
  {
    id: 'torque',
    name: '550 high-torque brushed',
    kind: 'brushed',
    resistance: 0.19,
    inductance: 0.00026,
    rotorInertia: 1.8e-6,
    noLoadCurrent: 0.9,
    phaseLimit: 38,
    batteryLimit: 30,
    sensored: false,
    maxRPM: 30000,
    thermalMass: 36,
    cooling: 0.5,
    preset: {
      motorKind: 'brushed',
      turns: 35,
      voltage: 11.1,
      gearRatio: 20,
      escCurrent: 38,
      batteryCurrent: 30,
      escPunch: 1.6,
    },
  },
  {
    id: 'sensored',
    name: 'FOC sensored brushless',
    kind: 'brushless',
    resistance: 0.105,
    inductance: 0.00012,
    rotorInertia: 1.6e-6,
    noLoadCurrent: 0.7,
    phaseLimit: 45,
    batteryLimit: 35,
    sensored: true,
    maxRPM: 45000,
    thermalMass: 32,
    cooling: 0.55,
    preset: {
      motorKind: 'brushless',
      kv: 1800,
      voltage: 7.4,
      gearRatio: 18,
      escCurrent: 45,
      batteryCurrent: 35,
      escPunch: 2.5,
    },
  },
  {
    id: 'performance',
    name: 'Performance brushless',
    kind: 'brushless',
    resistance: 0.075,
    inductance: 0.0001,
    rotorInertia: 1.5e-6,
    noLoadCurrent: 1.1,
    phaseLimit: 60,
    batteryLimit: 45,
    sensored: true,
    maxRPM: 55000,
    thermalMass: 34,
    cooling: 0.65,
    preset: {
      motorKind: 'brushless',
      kv: 2300,
      voltage: 11.1,
      gearRatio: 16,
      escCurrent: 60,
      batteryCurrent: 45,
      escPunch: 3.2,
    },
  },
  {
    id: 'competition',
    name: 'Competition sensored',
    kind: 'brushless',
    resistance: 0.12,
    inductance: 0.00015,
    rotorInertia: 1.4e-6,
    noLoadCurrent: 0.6,
    phaseLimit: 50,
    batteryLimit: 35,
    sensored: true,
    maxRPM: 42000,
    thermalMass: 30,
    cooling: 0.6,
    preset: {
      motorKind: 'brushless',
      kv: 1600,
      voltage: 7.4,
      gearRatio: 24,
      escCurrent: 50,
      batteryCurrent: 35,
      escPunch: 2.8,
      dragBrake: 0.8,
    },
  },
];
export function powerSpec(t: Tune) {
  return powerSystems.find((p) => p.id === t.powerSystem) ?? powerSystems[0];
}
export function motorConstants(t: Tune) {
  const spec = powerSpec(t),
    kv = t.motorKind === 'brushed' ? 42000 / t.turns : t.kv;
  return {
    spec,
    kv,
    kt: 60 / (2 * Math.PI * kv),
    resistance:
      spec.resistance * (t.motorKind === 'brushed' ? (t.turns / 27) ** 2 : (1800 / t.kv) ** 2),
  };
}
export class ElectricDrive {
  current = 0;
  duty = 0;
  temperature = 22;
  voltage = 7.4;
  batteryAmps = 0;
  usedAh = 0;
  integral = 0;
  shaftTorque = 0;
  limited = false;
  step(dt: number, t: Tune, omega: number, command: number, brake: boolean, shaftInertia?: number) {
    this.limited = false;
    const { spec, kv, kt, resistance } = motorConstants(t),
      soc = Math.max(0, 1 - this.usedAh / t.capacity);
    const packOCV = t.voltage * (0.86 + 0.14 * soc),
      packR = t.batteryResistance * (2.2 / t.capacity);
    this.voltage = Math.max(t.voltage * 0.65, packOCV - this.batteryAmps * packR);
    const thermal = Math.max(0.2, Math.min(1, (125 - this.temperature) / 30)),
      limit = t.escCurrent * thermal;
    const holding = brake || (Math.abs(command) < 0.001 && t.dragBrake > 0);
    if (spec.sensored || holding) {
      const target = holding
          ? 0
          : (command * Math.min(spec.maxRPM, kv * this.voltage) * 2 * Math.PI) / 60,
        error = target - omega;
      const bound = holding ? limit * (brake ? 1 : t.dragBrake) : limit;
      this.integral = Math.max(
        -bound,
        Math.min(bound, this.integral + error * dt * (holding ? 0.35 : 0.16)),
      );
      const demand = Math.max(
        -bound,
        Math.min(bound, error * (holding ? 0.03 : 0.045) + this.integral),
      );
      this.duty = Math.max(
        -1,
        Math.min(1, (kt * omega + resistance * demand) / Math.max(1, this.voltage)),
      );
    } else {
      this.integral = 0;
      this.duty = command;
    }
    if (Math.abs(command) < 0.001 && !holding) {
      this.current *= Math.exp(-dt * 60);
      this.duty = 0;
    } else {
      const electrical =
        ((this.current * spec.inductance) / dt + this.duty * this.voltage - kt * omega) /
        (resistance +
          spec.inductance / dt +
          (shaftInertia ? (kt * kt * dt * t.drivetrainEfficiency) / shaftInertia : 0));
      const batteryLimit = t.batteryCurrent / Math.max(0.08, Math.abs(this.duty));
      const cap = Math.min(limit, batteryLimit);
      this.current = Math.max(-cap, Math.min(cap, electrical));
      this.limited = Math.abs(electrical) > cap;
    }
    if (Math.abs(omega) > (spec.maxRPM * 2 * Math.PI) / 60 && this.current * omega > 0)
      this.current = 0;
    const emfTorque = this.current * kt,
      friction = spec.noLoadCurrent * kt * Math.tanh(omega / 8);
    this.shaftTorque = (emfTorque - friction) * t.drivetrainEfficiency;
    this.batteryAmps = Math.max(0, this.current * this.duty) + 0.06;
    this.usedAh += (this.batteryAmps * dt) / 3600;
    const heat =
      this.current * this.current * resistance +
      Math.abs(emfTorque * omega) * (1 - t.drivetrainEfficiency);
    this.temperature += ((heat - spec.cooling * (this.temperature - 22)) * dt) / spec.thermalMass;
    return this.shaftTorque;
  }
}
