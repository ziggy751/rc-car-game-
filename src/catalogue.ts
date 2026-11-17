import { defaults, type Tune } from './dynamics/tuning';
export type VehicleId = 'r1' | 'c2';
export type VehicleSpec = {
  id: VehicleId;
  name: string;
  category: string;
  price: number;
  description: string;
  scale: string;
  wheelbase: number;
  bodyMass: number;
  bodyHeight: number;
  chassisMass: number;
  paint: string;
  preset: Partial<Tune>;
};
export const vehicles: VehicleSpec[] = [
  {
    id: 'r1',
    name: 'R1 Fieldcraft',
    category: 'SCALE TRAIL / LADDER FRAME',
    price: 0,
    scale: '1:10',
    wheelbase: 324,
    bodyMass: 0.32,
    bodyHeight: 0.15,
    chassisMass: 1.05,
    paint: '#496d62',
    description:
      'A hard-shell short-cab trail rig. Steel ladder rails, four-link axles and a serviceable 540 drivetrain.',
    preset: { paint: '#496d62' },
  },
  {
    id: 'c2',
    name: 'C2 Needle',
    category: 'LCG COMPETITION / TUBE FRAME',
    price: 600,
    scale: '1:10',
    wheelbase: 324,
    bodyMass: 0.16,
    bodyHeight: 0.095,
    chassisMass: 0.9,
    paint: '#b36535',
    description:
      'An exposed competition chassis with a low battery tray, lighter cage and longer-travel setup. Same serviceable axle platform; a different centre of gravity.',
    preset: {
      paint: '#b36535',
      batteryHeight: 0.045,
      batteryPosition: 0.025,
      foam: 1800,
      spring: 45,
      rearSpring: 45,
      ride: 0.065,
      body: true,
    },
  },
];
export function vehicleSpec(id: string) {
  return vehicles.find((v) => v.id === id) ?? vehicles[0];
}
export function vehicleTune(id: VehicleId): Tune {
  return { ...defaults, ...vehicleSpec(id).preset, vehicle: id };
}
export const tuningPresets: { name: string; description: string; tune: Partial<Tune> }[] = [
  {
    name: 'Soft rock',
    description: 'Compliant inserts, supple springs and low range.',
    tune: {
      compound: 'soft',
      foam: 1000,
      sidewall: 1300,
      spring: 40,
      rearSpring: 40,
      damping: 4,
      rearDamping: 4,
      rebound: 14,
      gearRatio: 25,
      dragBrake: 0.7,
    },
  },
  {
    name: 'Trail',
    description: 'Supported sidewalls, balanced shocks and trail reduction.',
    tune: {
      compound: 'trail',
      foam: 3400,
      sidewall: 3500,
      spring: 55,
      rearSpring: 55,
      damping: 5,
      rearDamping: 5,
      rebound: 17.5,
      gearRatio: 20,
      motor: 'trail',
      dragBrake: 0.45,
    },
  },
  {
    name: 'Competition',
    description: 'Low pack, soft carcass, weighted wheels and precise inputs.',
    tune: {
      compound: 'soft',
      foam: 1600,
      sidewall: 1800,
      batteryHeight: 0.045,
      wheelWeight: 0.06,
      gearRatio: 28,
      motor: 'torque',
      sensitivity: 0.75,
      dragBrake: 0.8,
    },
  },
  {
    name: 'Wet weather',
    description: 'Soft compound with firmer insert support and slow gearing.',
    tune: {
      compound: 'soft',
      foam: 2800,
      sidewall: 3000,
      gearRatio: 30,
      motor: 'torque',
      sensitivity: 0.65,
      dragBrake: 0.65,
    },
  },
];
