import { beforeAll, describe, it, expect } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Simulation, defaults, type Tune } from '../src/physics';
import { powerSystems, ElectricDrive, motorConstants } from '../src/dynamics/powertrain';
import { MudField } from '../src/mud-field';
import { maps, biomeHeight } from '../src/map-definitions';
import { mapPieces, addPieceCollider } from '../src/map-layout';
import { courses } from '../src/courses';
beforeAll(async () => {
  await RAPIER.init();
});
const idle = { throttle: 0, steer: 0, brake: false };
const run = (s: Simulation, n: number, throttle = 0) => {
  for (let i = 0; i < n; i++) s.step(1 / 240, { ...idle, throttle });
};
function rig(tune: Partial<Tune> = {}) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(30, 0.1, 30).setTranslation(0, -0.1, 0).setFriction(1),
  );
  return new Simulation(world, { ...defaults, ...tune });
}
describe('electrical motor and gear rebuild', () => {
  it('reduces current as back-EMF rises, respects both current limits and heats under stall', () => {
    const tune = { ...defaults },
      stalled = new ElectricDrive(),
      spinning = new ElectricDrive(),
      omega = 900;
    for (let i = 0; i < 240; i++) {
      stalled.step(1 / 240, tune, 0, 1, false);
      spinning.step(1 / 240, tune, omega, 1, false);
    }
    expect(stalled.current).toBeLessThanOrEqual(tune.escCurrent);
    expect(stalled.batteryAmps).toBeLessThanOrEqual(tune.batteryCurrent + 0.1);
    expect(stalled.current).toBeGreaterThan(spinning.current * 3);
    expect(stalled.temperature).toBeGreaterThan(spinning.temperature);
    expect(motorConstants(tune).kt).toBeGreaterThan(0);
  });
  it('preserves vehicle mass, reflects rotor inertia and couples electrical RPM to actual wheels', () => {
    const s = rig();
    run(s, 480);
    run(s, 480, 0.5);
    const speed = s.wheels.reduce((n, w) => n + w.body.angvel().x - s.body.angvel().x, 0) / 4;
    expect(s.parts).toHaveLength(17);
    expect(s.mass).toBeCloseTo(3.16, 2);
    expect((s.motorRPM * 2 * Math.PI) / 60 / s.ratio).toBeCloseTo(speed, 0);
    expect(s.speed).toBeGreaterThan(0.15);
    s.world.free();
  });
  it('provides distinct low-speed response and real speed for five configurations', () => {
    const results = [];
    for (const spec of powerSystems) {
      const s = rig({ ...spec.preset, powerSystem: spec.id });
      run(s, 360);
      run(s, 480, 0.05);
      const slow = s.speed;
      run(s, 720, 1);
      results.push({ id: spec.id, slow, fast: s.speed, current: s.motorCurrent, rpm: s.motorRPM });
      expect(s.speed).toBeGreaterThan(0.5);
      expect(s.speed).toBeLessThan(4);
      expect(s.motorCurrent).toBeLessThanOrEqual(s.tune.escCurrent + 0.01);
      s.world.free();
    }
    console.log('POWER CONFIGURATIONS', results);
    expect(results.find((r) => r.id === 'performance')!.fast).toBeGreaterThan(
      results[0].fast * 1.8,
    );
    expect(results.find((r) => r.id === 'sensored')!.slow).toBeGreaterThan(results[0].slow * 1.5);
  }, 60000);
  it('climbs a 45 mm ledge through wheel torque at full brushed input and half sensored input', () => {
    for (const [id, throttle] of [
      ['scale', 1],
      ['sensored', 0.5],
    ] as const) {
      const spec = powerSystems.find((p) => p.id === id)!,
        s = rig({ ...spec.preset, powerSystem: id });
      s.world.createCollider(
        RAPIER.ColliderDesc.roundCuboid(0.35, 0.0225, 0.12, 0.004)
          .setTranslation(0, 0.0225, 0.65)
          .setFriction(1),
      );
      run(s, 480);
      let pitch = 0;
      for (let i = 0; i < 1440; i++) {
        run(s, 1, throttle);
        pitch = Math.max(pitch, s.pitch);
      }
      console.log('LEDGE CLIMB', { id, z: s.body.translation().z, pitch });
      expect(s.body.translation().z).toBeGreaterThan(1.1);
      expect(pitch).toBeGreaterThan(4);
      s.world.free();
    }
  }, 20000);
  it('keeps finite traction: a slippery blocked climb produces wheelspin', () => {
    const s = rig();
    s.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.4, 0.1, 0.1).setTranslation(0, 0.1, 0.65).setFriction(0.25),
    );
    run(s, 360);
    let slip = 0;
    for (let i = 0; i < 960; i++) {
      run(s, 1, 0.8);
      slip = Math.max(slip, ...s.wheels.map((w) => Math.abs(w.slip)));
    }
    expect(slip).toBeGreaterThan(0.4);
    expect(s.body.translation().z).toBeLessThan(0.6);
    s.world.free();
  });
});
describe('physical terrain and course construction', () => {
  it('has four accessible difficulty levels in each of five distinct locations', () => {
    expect(maps).toHaveLength(5);
    expect(courses).toHaveLength(20);
    for (const map of maps) {
      const local = courses.filter((c) => c.map === map.id);
      expect(local.map((c) => c.grade).sort()).toEqual(['Easy', 'Extreme', 'Hard', 'Medium']);
      for (const course of local) {
        expect(Math.abs(course.x)).toBeLessThan(19);
        expect(Math.abs(course.z)).toBeLessThan(19);
        expect(course.gateWidth).toBeGreaterThan(0.3);
      }
    }
  });
  it('uses a matching soil heightfield and lowers real collider support under loaded tyre contact', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
      field = new MudField(world, 0, 0, 7.6, 1.8, 0.055, (x, z) => 0.1 + x * 0.005 + z * 0.01);
    world.step();
    const support = (x: number, z: number) =>
      1 -
      world.castRay(new RAPIER.Ray({ x, y: 1, z }, { x: 0, y: -1, z: 0 }), 2, true)!.timeOfImpact;
    expect(support(1.013, 0.213)).toBeCloseTo(0.107195, 4);
    const before = support(0, 0);
    for (let i = 0; i < 720; i++)
      field.step(1 / 240, [
        {
          point: { x: 0, y: field.height(0, 0), z: 0 },
          load: 9,
          slip: 0.8,
          contact: true,
          width: 0.044,
        },
      ]);
    world.step();
    const after = support(0, 0);
    console.log('PHYSICAL MUD RUT', { before, after, versions: field.version });
    expect(after).toBeLessThan(before - 0.005);
    expect(after).toBeGreaterThan(before - 0.056);
    expect(field.sampleSurface(0, 0).mudDepth).toBeLessThan(0.055);
    world.free();
  });
  it('does not deform soil when tyres are unloaded or supported by a log above it', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
      field = new MudField(world, 0, 0, 7.6, 1.8, 0.055, () => 0.1);
    for (let i = 0; i < 240; i++)
      field.step(1 / 240, [
        { point: { x: 0, y: 0.2, z: 0 }, load: 8, slip: 1, contact: true, width: 0.044 },
      ]);
    expect(field.version).toBe(0);
    expect(field.height(0, 0)).toBeCloseTo(0.1);
    world.free();
  });
  it('keeps an achievable relaxed line through each newly authored map', () => {
    for (const map of maps.slice(1)) {
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      const size = 10,
        cols = 100,
        rows = 100,
        heights = new Float32Array((cols + 1) * (rows + 1));
      for (let c = 0; c <= cols; c++)
        for (let r = 0; r <= rows; r++)
          heights[r + c * (rows + 1)] = biomeHeight(
            map.id,
            -5 + (c / cols) * size,
            -5 + (r / rows) * size,
          );
      world.createCollider(
        RAPIER.ColliderDesc.heightfield(
          rows,
          cols,
          heights,
          { x: size, y: 1, z: size },
          RAPIER.HeightFieldFlags.FIX_INTERNAL_EDGES,
        )
          .setTranslation(map.x, 0, map.z)
          .setFriction(1),
      );
      for (const piece of mapPieces(map.id)) addPieceCollider(world, piece);
      const spec = powerSystems[0],
        s = new Simulation(
          world,
          { ...defaults, ...spec.preset, powerSystem: 'scale' },
          { heightAt: (x, z) => biomeHeight(map.id, x - map.x, z - map.z) },
        );
      const course = courses.find((c) => c.map === map.id && c.grade === 'Easy')!;
      s.reset(course.x, course.z);
      run(s, 480);
      for (let i = 0; i < 4800 && s.body.translation().z - course.z < 5.4; i++) run(s, 1, 0.8);
      console.log('RELAXED MAP LINE', {
        map: map.id,
        z: s.body.translation().z - course.z,
        roll: s.roll,
      });
      expect(s.body.translation().z - course.z).toBeGreaterThan(5.2);
      expect(Math.abs(s.roll)).toBeLessThan(35);
      world.free();
    }
  }, 60000);
});

import { Vector3, Group } from 'three';
import { ParticlePool } from '../src/environment-effects';
import { StuckMud } from '../src/stuck-mud';
describe('connected mud impacts', () => {
  it('sweeps a travelling mud clump against a nearby assembly and reports the impact', () => {
    const pool = new ParticlePool(10),
      grain = pool.slots[0];
    grain.life = 1;
    grain.kind = 'mud';
    grain.size = 0.003;
    grain.p.set(0, 0.1, 0);
    grain.velocity.set(1, 0, 0);
    let actor = -1;
    pool.onImpact = (_, hit) => (actor = hit.actor!);
    pool.update(
      0.02,
      () => -1,
      (from, to) =>
        to.x > 0.01
          ? { point: new Vector3(0.01, to.y, 0), normal: new Vector3(-1, 0, 0), actor: 2 }
          : null,
    );
    expect(actor).toBe(2);
    expect(grain.life).toBe(0);
    expect(grain.p.x).toBeLessThan(0.01);
  });
  it('washes submerged attached deposits, keeps dry deposits, and reuses washed slots', () => {
    const parents = Array.from({ length: 7 }, () => new Group()),
      mud = new StuckMud(parents);
    parents[0].position.y = 0.02;
    parents[1].position.y = 0.2;
    parents.forEach((p) => p.updateMatrixWorld(true));
    for (const actor of [0, 1]) mud.add(actor, new Vector3(), new Vector3(0, 1, 0), 0.004);
    for (let i = 0; i < 300; i++) mud.wash(0.01, () => 0.05);
    expect(mud.pools[0].count).toBe(0);
    expect(mud.pools[1].count).toBe(1);
    mud.add(0, new Vector3(), new Vector3(0, 1, 0), 0.003);
    expect(mud.pools[0].count).toBe(1);
    mud.clean();
    expect(mud.pools.every((p) => p.count === 0)).toBe(true);
  });
});
