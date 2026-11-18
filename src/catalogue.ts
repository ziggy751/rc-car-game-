import { defaults, type Tune } from './dynamics/tuning';
export type VehicleId = 'r1' | 'c2' | 'w3' | 'b4';
export type VehicleSpec = {
  id: VehicleId;
  name: string;
  category: string;
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
    scale: '1:10',
    wheelbase: 324,
    bodyMass: 0.32,
    bodyHeight: 0.15,
    chassisMass: 1.05,
    paint: '#496d62',
    description:
      'A hard-shell short-cab trail rig. Steel ladder rails, four-link axles and a serviceable 540 drivetrain.',
    preset: { paint: '#496d62', powerSystem: 'scale' },
  },
  {
    id: 'c2',
    name: 'C2 Needle',
    category: 'LCG COMPETITION / TUBE FRAME',
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
      powerSystem: 'competition',
      motorKind: 'brushless',
      kv: 1600,
      escCurrent: 50,
      batteryCurrent: 35,
      escPunch: 2.8,
      gearRatio: 24,
      batteryHeight: 0.045,
      batteryPosition: 0.025,
      foam: 1800,
      spring: 45,
      rearSpring: 45,
      ride: 0.065,
      body: true,
    },
  },
  {
    id: 'w3',
    name: 'W3 Outrider',
    category: 'EXPEDITION / PORTAL WAGON',
    scale: '1:10',
    wheelbase: 324,
    bodyMass: 0.46,
    bodyHeight: 0.145,
    chassisMass: 1.08,
    paint: '#a5afa0',
    description:
      'A closed four-door utility wagon with a ribbed cargo roof, rear-mounted spare and portal housings. A heavier shell and forward battery give it a distinct balance.',
    preset: {
      paint: '#a5afa0',
      powerSystem: 'torque',
      turns: 35,
      voltage: 11.1,
      escCurrent: 38,
      batteryCurrent: 30,
      escPunch: 1.6,
      axleType: 'portal',
      batteryPosition: 0.055,
      batteryHeight: 0.055,
      spring: 65,
      rearSpring: 60,
      foam: 3100,
      compound: 'trail',
      gearRatio: 22,
    },
  },
  {
    id: 'b4',
    name: 'B4 Switchback',
    category: 'TECHNICAL BUGGY / PORTAL AXLES',
    scale: '1:10',
    wheelbase: 324,
    bodyMass: 0.2,
    bodyHeight: 0.105,
    chassisMass: 0.94,
    paint: '#518a8e',
    description:
      'A single-seat buggy with a narrow cockpit, swept nose and exposed rear service cage. Larger supported tyres, long shock stroke and portal clearance suit technical boulders.',
    preset: {
      paint: '#518a8e',
      powerSystem: 'performance',
      motorKind: 'brushless',
      kv: 2300,
      voltage: 11.1,
      escCurrent: 60,
      batteryCurrent: 45,
      escPunch: 3.2,
      axleType: 'portal',
      batteryHeight: 0.045,
      batteryPosition: -0.025,
      radius: 0.063,
      tyreWidth: 0.049,
      spring: 58,
      rearSpring: 52,
      travel: 0.08,
      rearTravel: 0.08,
      foam: 1900,
      sidewall: 2600,
      gearRatio: 16,
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
