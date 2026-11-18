export type Tune = {
  vehicle: 'r1' | 'c2' | 'w3' | 'b4';
  powerSystem: 'scale' | 'torque' | 'sensored' | 'performance' | 'competition';
  escCurrent: number;
  batteryCurrent: number;
  batteryResistance: number;
  escPunch: number;
  drivetrainEfficiency: number;
  sidewall: number;
  frontOverdrive: number;
  rearUnderdrive: number;
  ballast: number;
  ballastPosition: number;
  linkHeight: number;
  rearSpring: number;
  rearDamping: number;
  rebound: number;
  travel: number;
  rearTravel: number;
  tread: 'trail' | 'rock';
  compound: 'soft' | 'trail' | 'hard';
  radius: number;
  spring: number;
  damping: number;
  motor: 'torque' | 'trail';
  ride: number;
  paint: string;
  body: boolean;
  quality: 'Low' | 'Medium' | 'High' | 'Ultra';
  audio: boolean;
  motorKind: 'brushed' | 'brushless';
  turns: number;
  kv: number;
  voltage: number;
  capacity: number;
  batteryPosition: number;
  batteryHeight: number;
  gearRatio: number;
  axleRatio: number;
  axleType: 'straight' | 'portal';
  differential: 'locked' | 'open';
  dragBrake: number;
  wheelWeight: number;
  tyreWidth: number;
  foam: number;
  preload: number;
  servoRate: number;
  servoTorque: number;
  endpoint: number;
  steeringExpo: number;
  throttleExpo: number;
  sensitivity: number;
  precision: boolean;
};
export const defaults: Tune = {
  vehicle: 'r1',
  powerSystem: 'scale',
  escCurrent: 28,
  batteryCurrent: 25,
  batteryResistance: 0.022,
  escPunch: 1.8,
  drivetrainEfficiency: 0.82,
  sidewall: 2400,
  frontOverdrive: 0,
  rearUnderdrive: 0,
  ballast: 0,
  ballastPosition: 0,
  linkHeight: 0,
  rearSpring: 55,
  rearDamping: 5,
  rebound: 17.5,
  travel: 0.071,
  rearTravel: 0.071,
  tread: 'rock',
  compound: 'soft',
  radius: 0.059,
  spring: 55,
  damping: 5,
  motor: 'torque',
  ride: 0.065,
  paint: '#496d62',
  body: true,
  quality: 'High',
  audio: false,
  motorKind: 'brushed',
  turns: 27,
  kv: 1800,
  voltage: 7.4,
  capacity: 2.2,
  batteryPosition: -0.11,
  batteryHeight: 0.075,
  gearRatio: 20,
  axleRatio: 4,
  axleType: 'straight',
  differential: 'locked',
  dragBrake: 0.45,
  wheelWeight: 0,
  tyreWidth: 0.044,
  foam: 2400,
  preload: 0,
  servoRate: 6,
  servoTorque: 1.8,
  endpoint: 0.56,
  steeringExpo: 0.25,
  throttleExpo: 0.4,
  sensitivity: 1,
  precision: false,
};
