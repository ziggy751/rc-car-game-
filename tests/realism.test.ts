import { beforeAll, it, expect, describe } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Simulation } from '../src/physics';
import { vehicles, vehicleTune, type VehicleId } from '../src/catalogue';
import { cleanCondition, updateCondition, validateCondition } from '../src/soiling';
import { loadState } from '../src/state';
import { courses, CourseRun } from '../src/courses';
beforeAll(async () => {
  await RAPIER.init();
});
function rig(id: VehicleId = 'r1', extra = {}) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(10, 0.1, 10).setTranslation(0, -0.1, 0));
  return new Simulation(world, { ...vehicleTune(id), ...extra });
}
function run(s: Simulation, n: number, throttle = 0) {
  for (let i = 0; i < n; i++) s.step(1 / 240, { throttle, steer: 0, brake: false });
}
describe('stable mechanical contact', () => {
  it('holds contact and limits parked oscillation for soft and stock inserts', () => {
    for (const foam of [400, 2400]) {
      const s = rig('r1', { foam });
      run(s, 720);
      let min = 99,
        max = -99,
        drops = 0;
      for (let i = 0; i < 1200; i++) {
        run(s, 1);
        min = Math.min(min, s.body.translation().y);
        max = Math.max(max, s.body.translation().y);
        if (s.contacts < 4) drops++;
      }
      console.log('PARKED STABILITY', { foam, peakToPeakMm: (max - min) * 1000, drops });
      expect(max - min).toBeLessThan(0.001);
      expect(drops).toBeLessThan(8);
      s.world.free();
    }
  }, 15000);
  it('places large tyres above the entire sampled terrain footprint on reset', () => {
    const s = rig('r1', { radius: 0.067 });
    s.reset();
    expect(s.wheels.every((w) => w.body.translation().y - s.tune.radius >= -0.000001)).toBe(true);
    s.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.06, 0.035, 0.06).setTranslation(-0.128, 0.035, 0.162),
    );
    s.world.step();
    s.reset();
    expect(s.wheels[0].body.translation().y - s.tune.radius).toBeGreaterThan(0.069);
    s.world.free();
  });
  it('lets unloaded rubber recover instead of retaining deformation in the air', () => {
    const s = rig('r1', { foam: 1000 });
    run(s, 720);
    expect(s.wheels[0].compression).toBeGreaterThan(0.002);
    for (const b of s.parts) {
      const p = b.translation();
      b.setTranslation({ x: p.x, y: p.y + 2, z: p.z }, true);
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    run(s, 120);
    expect(s.wheels[0].compression).toBeLessThan(0.004);
    s.world.free();
  });
  it('applies ballast position and link mounting changes to physical mass and geometry', () => {
    const s = rig();
    const mass = s.mass,
      com = s.com.z;
    s.tune.ballast = 0.25;
    s.tune.ballastPosition = 0.12;
    s.tune.linkHeight = 0.004;
    s.applyTune();
    expect(s.mass - mass).toBeCloseTo(0.25, 3);
    expect(s.com.z).toBeGreaterThan(com + 0.006);
    expect(s.links[0].top.y).toBeCloseTo(0.008);
    run(s, 480, 0.25);
    expect(Number.isFinite(s.body.translation().y)).toBe(true);
    expect(Math.abs(s.roll)).toBeLessThan(20);
    s.world.free();
  });
  it('changes actual driven axle speed through overdrive without a chassis velocity command', () => {
    const s = rig('r1', { frontOverdrive: 0.15 });
    s.reset(0, 0, 2);
    run(s, 180, 0.5);
    const front = (s.wheels[0].omega + s.wheels[1].omega) / 2,
      rear = (s.wheels[2].omega + s.wheels[3].omega) / 2;
    console.log('OVERDRIVE', { front, rear });
    expect(front).toBeGreaterThan(rear * 1.08);
    s.world.free();
  });
  it('drives and reverses every free catalogue vehicle with real mass differences', () => {
    const masses = [];
    for (const spec of vehicles) {
      const s = rig(spec.id);
      run(s, 480);
      const start = s.body.translation().z;
      run(s, 480, 0.4);
      expect(s.body.translation().z).toBeGreaterThan(start + 0.08);
      run(s, 720, -0.4);
      expect(s.body.translation().z).toBeLessThan(start + 0.12);
      expect(Math.abs(s.roll)).toBeLessThan(15);
      masses.push(s.mass);
      s.world.free();
    }
    expect(new Set(masses.map((m) => m.toFixed(2))).size).toBe(4);
  }, 20000);
});
describe('localized persistent dirt, washing and wear', () => {
  const sample = {
    contact: true,
    water: false,
    surface: 'Mud',
    load: 8,
    speed: 0.3,
    omega: 10,
    radius: 0.059,
    slip: 0.6,
  };
  it('deposits on the exposed wheel and its arch rather than equally coating the whole car', () => {
    const state = cleanCondition();
    for (let i = 0; i < 240; i++) updateCondition(state, [sample], 1 / 240);
    expect(state.mud[0]).toBeGreaterThan(0.1);
    expect(state.mud[4]).toBeGreaterThan(0);
    expect(state.mud[1]).toBe(0);
    expect(state.mud[7]).toBe(0);
    expect(state.wet).toBeGreaterThan(0);
  });
  it('accumulates dust during matched rolling and washes only immersed zones', () => {
    const state = validateCondition(null, 0.6);
    for (let i = 0; i < 240; i++)
      updateCondition(state, [{ ...sample, surface: 'Forest loam', slip: 0 }], 1 / 240);
    expect(state.dust).toBeGreaterThan(0);
    for (let i = 0; i < 240; i++)
      updateCondition(state, [{ ...sample, water: true, surface: 'Wet rock' }], 1 / 240);
    expect(state.mud[0]).toBeLessThan(0.4);
    expect(state.mud[1]).toBe(0.6);
    expect(state.mud[4]).toBeLessThan(0.6);
  });
  it('retains separate conditions, camera settings and wear preferences through legacy migration', () => {
    const s = loadState({
      getItem: () =>
        JSON.stringify({
          version: 1,
          dirt: { r1: 0.4 },
          condition: { c2: { mud: [0.8], dust: 0.2, wet: 0.4, scuffs: 0.1 } },
          preferences: { camera: 4, visualWear: false },
        }),
    });
    expect(s.condition.r1?.mud).toEqual(Array(8).fill(0.4));
    expect(s.condition.c2?.mud[0]).toBe(0.8);
    expect(s.preferences).toEqual({ camera: 4, visualWear: false });
  });
});

it('returns ordered checkpoints without counting the recovery teleport as travel', () => {
  const run = new CourseRun({
    ...courses[0],
    x: 0,
    z: 0,
    gates: [
      [0, 1],
      [0, 2],
    ],
  });
  run.update(0, 1.1, 2);
  expect(run.checkpoint()).toEqual({ x: 0, z: 1 });
  const distance = run.distance;
  run.recover();
  run.reposition(0, 1);
  run.update(0, 1.1, 0.1);
  expect(run.distance - distance).toBeCloseTo(0.1);
  expect(run.gate).toBe(1);
  expect(run.time).toBeCloseTo(22.1);
});
