import { beforeAll, describe, it, expect } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';
import { loadState, saveState, selectVehicle } from '../src/state';
import { vehicles, vehicleTune } from '../src/catalogue';
import { CourseRun, courses } from '../src/courses';
import { effectIntent, ParticlePool, type ContactSample } from '../src/environment-effects';
import { graphicPresets, validateGraphics } from '../src/graphics';
import { Simulation } from '../src/physics';
import { bridgeDeckHeight, groundHeight, creekWaterHeight } from '../src/world';
beforeAll(async () => {
  await RAPIER.init();
});
const fresh = () => loadState({ getItem: () => null });
const sample = (extra: Partial<ContactSample> = {}): ContactSample => ({
  contact: true,
  load: 8,
  omega: 10,
  radius: 0.059,
  speed: 0.05,
  slip: 0.8,
  lateral: 0,
  surface: 'Forest loam',
  point: new Vector3(),
  normal: new Vector3(0, 1, 0),
  axis: new Vector3(1, 0, 0),
  width: 0.044,
  water: false,
  ...extra,
});
describe('vehicle ownership and additive save migration', () => {
  it('makes every vehicle available with zero points and retains independent tuning', () => {
    const state = fresh();
    expect(state.owned).toEqual(vehicles.map((v) => v.id));
    expect(state.credits).toBe(0);
    state.tune.foam = 4200;
    for (const vehicle of vehicles) {
      expect(selectVehicle(state, vehicle.id)).toBe(true);
      expect(state.tune.vehicle).toBe(vehicle.id);
      expect(state.credits).toBe(0);
    }
    selectVehicle(state, 'c2');
    state.tune.foam = 900;
    selectVehicle(state, 'r1');
    expect(state.tune.foam).toBe(4200);
    selectVehicle(state, 'c2');
    expect(state.tune.foam).toBe(900);
    const migrated = loadState({
      getItem: () =>
        JSON.stringify({
          version: 1,
          owned: ['r1'],
          credits: 0,
          tune: { vehicle: 'c2', foam: 3200 },
        }),
    });
    expect(migrated.tune.vehicle).toBe('c2');
    expect(migrated.owned).toEqual(vehicles.map((v) => v.id));
  });
  it('preserves legacy credits/builds/progress even when a new optional record is corrupt', () => {
    const state = loadState({
      getItem: () =>
        JSON.stringify({
          version: 1,
          tune: { spring: 42, damping: 4, paint: '#42657b', quality: 'Low' },
          credits: 900,
          completed: [0, 2],
          builds: [{ name: 'Legacy', tune: { foam: 4400 } }],
          records: {
            'fern-creek': null,
            'needle-point': { bestTime: 45, bestScore: 800, completions: 1, recoveries: 0 },
          },
        }),
    });
    expect(state.credits).toBe(900);
    expect(state.completed).toEqual([0, 2]);
    expect(state.builds[0].name).toBe('Legacy');
    expect(state.tune.paint).toBe('#42657b');
    expect(state.tune.rearSpring).toBe(42);
    expect(state.tune.rearDamping).toBe(4);
    expect(state.graphics.preset).toBe('Low');
    expect(state.records['needle-point'].bestTime).toBe(45);
  });
  it('round trips freely selected profiles, mud, weather, course records and custom graphics', () => {
    const state = fresh();
    state.credits = 1000;
    selectVehicle(state, 'c2');
    state.tune.sidewall = 1700;
    state.dirt.c2 = 0.6;
    state.weather = 'Rain';
    state.records['fern-creek'] = { bestTime: 35, bestScore: 850, completions: 2, recoveries: 1 };
    state.graphics = { ...graphicPresets.Ultra, preset: 'Custom', dof: true };
    let json = '';
    saveState(state, {
      setItem: (_, value) => {
        json = value;
      },
    });
    expect(loadState({ getItem: () => json })).toEqual(state);
  });
});
describe('directional measured courses', () => {
  it('ignores side bypasses and backwards crossings, then completes forward gates in order', () => {
    const course = {
      ...courses[0],
      x: 0,
      z: 0,
      gates: [
        [0, 1],
        [0, 2],
      ] as [number, number][],
    };
    const run = new CourseRun(course);
    run.update(0.5, 1.1, 1);
    expect(run.gate).toBe(0);
    run.update(0, 0.8, 1);
    expect(run.gate).toBe(0);
    run.update(0, 1.1, 1);
    expect(run.gate).toBe(1);
    expect(run.update(0, 2.1, 1)).toBe(true);
    expect(run.finished).toBe(true);
    const elapsed = run.elapsed;
    run.update(0, 3, 4);
    expect(run.elapsed).toBe(elapsed);
  });
  it('adds real recovery penalties and reduces score', () => {
    const run = new CourseRun(courses[0]);
    run.update(0, 0.2, 10);
    const score = run.score;
    run.recover();
    expect(run.time).toBe(30);
    expect(run.score).toBeLessThan(score - 120);
  });
});
describe('contact driven environmental effects', () => {
  it('emits backwards from forward wheelspin and reverses ejection for reverse spin', () => {
    expect(effectIntent(sample()).direction.z).toBeLessThan(0);
    expect(
      effectIntent(sample({ omega: -10, speed: -0.05, slip: -0.8 })).direction.z,
    ).toBeGreaterThan(0);
  });
  it('does not emit dirt from airborne tyres, idle tyres, matched rolling contact or clean rock', () => {
    for (const s of [
      sample({ contact: false }),
      sample({ omega: 0, speed: 0, slip: 0 }),
      sample({ omega: 1, speed: 0.059, slip: 0 }),
      sample({ surface: 'Dry granite' }),
    ])
      expect(effectIntent(s).rate).toBe(0);
  });
  it('distinguishes gravel/mud/water and derives persistent soil and washing from contact', () => {
    expect(effectIntent(sample({ surface: 'Gravel' })).kind).toBe('gravel');
    expect(effectIntent(sample({ surface: 'Mud' })).mud).toBeGreaterThan(0);
    expect(effectIntent(sample({ surface: 'Mud', contact: false })).mud).toBe(0);
    const water = effectIntent(sample({ water: true }));
    expect(water.kind).toBe('water');
    expect(water.track).toBe(false);
    expect(water.wash).toBeGreaterThan(0);
  });
  it('recycles a bounded pool and lets ballistic debris and fine dust decay', () => {
    const pool = new ParticlePool(24),
      s = sample();
    for (let i = 0; i < 1000; i++) pool.emit(s, effectIntent(s), i % 3 === 0);
    expect(pool.slots).toHaveLength(24);
    expect(pool.active).toBe(24);
    for (let i = 0; i < 1000; i++) pool.update(0.01, () => 0);
    expect(pool.active).toBe(0);
    expect(pool.slots.every((p) => Number.isFinite(p.p.y))).toBe(true);
  });
});
describe('quality independence and local tyre compliance', () => {
  function rig(id: 'r1' | 'c2' = 'r1', foam = 2200) {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(3, 0.1, 3).setTranslation(0, -0.1, 0));
    return new Simulation(world, { ...vehicleTune(id), foam });
  }
  const settle = (s: Simulation, n = 480) => {
    for (let i = 0; i < n; i++) s.step(1 / 240, { throttle: 0, steer: 0, brake: true });
  };
  it('uses lighter actual bodies and a lower physical centre of mass for C2', () => {
    const a = rig('r1'),
      b = rig('c2');
    expect(a.mass - b.mass).toBeCloseTo(0.31, 3);
    expect(b.com.y).toBeLessThan(a.com.y - 0.008);
    a.world.free();
    b.world.free();
  });
  it('maintains distinct width-band collision loads on an edge rather than uniformly shrinking the tyre', () => {
    const s = rig();
    settle(s);
    s.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.009, 0.012, 0.05)
        .setTranslation(-0.143, 0.012, 0.162)
        .setFriction(1),
    );
    settle(s);
    const w = s.wheels[0],
      depths = w.ribs.map((r) => r.compression);
    console.log('LOCAL TYRE', depths, w.patches.length);
    expect(w.ribs).toHaveLength(3);
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(0.0002);
    expect(w.patches.length).toBeGreaterThan(0);
    expect(w.patches.length).toBeLessThanOrEqual(6);
    expect(depths.every((d) => d >= 0 && d <= 0.012)).toBe(true);
    s.world.free();
  });
  it('keeps identical physical results when particles/presets differ', () => {
    const positions = Object.values(graphicPresets).map((g) => {
      const s = rig();
      settle(s, 240);
      const pool = new ParticlePool(10);
      for (let i = 0; i < 240; i++) {
        s.step(1 / 240, { throttle: 0.4, steer: 0.3, brake: false });
        if (i % Math.max(1, Math.round(1 / g.particles)) === 0)
          pool.emit(sample(), effectIntent(sample()));
        pool.update(1 / 240, () => 0);
      }
      const result = new Vector3().copy(s.body.translation());
      s.world.free();
      return result;
    });
    expect(positions.every((p) => p.distanceTo(positions[0]) < 1e-8)).toBe(true);
  });
  it('bounds persisted custom settings and maps legacy quality without altering tuning', () => {
    const g = validateGraphics({
      preset: 'Custom',
      scale: 100,
      particles: -2,
      tracks: 9999,
      exposure: NaN,
    });
    expect(g.scale).toBe(1.5);
    expect(g.particles).toBe(0);
    expect(g.tracks).toBe(400);
    expect(g.exposure).toBe(1);
    expect(validateGraphics(null, 'Low')).toEqual(graphicPresets.Low);
  });
});

describe('authored bridge clearance', () => {
  it('keeps all planks above the creek bed and water while meeting the banks', () => {
    const water = creekWaterHeight();
    for (let i = 0; i < 23; i++) {
      const z = 3.08 + i * 0.055;
      expect(bridgeDeckHeight(z) - 0.011).toBeGreaterThan(groundHeight(0.65, z));
      expect(bridgeDeckHeight(z) - 0.011).toBeGreaterThan(water);
    }
    expect(bridgeDeckHeight(3.08) - groundHeight(0.65, 3.08)).toBeLessThan(0.04);
    expect(bridgeDeckHeight(4.29) - groundHeight(0.65, 4.29)).toBeLessThan(0.04);
  });
});
