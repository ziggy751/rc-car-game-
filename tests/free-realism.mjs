import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
const errors = [],
  checks = [],
  vehicles = [];
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
  page.setDefaultTimeout(90000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem('ridgebound.save.v1'))
      localStorage.setItem(
        'ridgebound.save.v1',
        JSON.stringify({ version: 1, tune: { quality: 'Low' }, owned: ['r1'], credits: 0 }),
      );
  });
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__RIDGEBOUND__, undefined, { timeout: 120000 });
  const game = (fn) => page.evaluate(fn);
  await page.locator('nav [data-mode=garage]').click();
  assert.equal(await page.locator('[data-vehicle]').count(), 4);
  assert.equal(await page.locator('#buy-vehicle,#sell-vehicle').count(), 0);
  for (const id of ['r1', 'c2', 'w3', 'b4']) {
    await page.locator(`[data-vehicle=${id}]`).click();
    assert.equal(await game(() => window.__RIDGEBOUND__.preview.tune.vehicle), id);
    if (id === 'w3' || id === 'b4')
      await page.screenshot({ path: `.artifacts/free-${id}-garage.png`, timeout: 120000 });
    await page.locator('#test-drive-vehicle').click();
    assert.equal(await game(() => window.__RIDGEBOUND__.sim.tune.vehicle), id);
    assert.equal(await game(() => window.__RIDGEBOUND__.state.credits), 0);
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__RIDGEBOUND__.sim.distance > 0.08, undefined, {
      timeout: 90000,
    });
    await page.keyboard.up('KeyW');
    vehicles.push(
      await game(() => ({
        id: window.__RIDGEBOUND__.state.tune.vehicle,
        mass: window.__RIDGEBOUND__.sim.mass,
        distance: window.__RIDGEBOUND__.sim.distance,
      })),
    );
    await page.locator('#hud-menu').click();
    await page.locator('[data-go=garage]').click();
  }
  checks.push(
    'All four vehicles are freely selectable and actually drive with zero challenge points',
  );
  await page.locator('#select-vehicle').click();
  await page.locator('#tread').selectOption('trail');
  await page.waitForFunction(() => window.__RIDGEBOUND__.car.treadMeshes[0].count === 48);
  await page.locator('[data-category=Drivetrain]').click();
  await page.locator('#frontOverdrive').fill('12');
  await page.locator('#frontOverdrive').dispatchEvent('input');
  await page.locator('#rearUnderdrive').fill('5');
  await page.locator('#rearUnderdrive').dispatchEvent('input');
  assert.equal(await game(() => window.__RIDGEBOUND__.sim.tune.frontOverdrive), 0.12);
  const mass = await game(() => window.__RIDGEBOUND__.sim.mass);
  await page.locator('[data-category=Weight]').click();
  await page.locator('#ballast').fill('150');
  await page.locator('#ballast').dispatchEvent('input');
  assert.ok(Math.abs((await game(() => window.__RIDGEBOUND__.sim.mass)) - mass - 0.15) < 0.001);
  await page.locator('[data-category=Suspension]').click();
  await page.locator('#linkHeight').fill('3');
  await page.locator('#linkHeight').dispatchEvent('input');
  assert.ok(Math.abs((await game(() => window.__RIDGEBOUND__.sim.links[0].top.y)) - 0.007) < 1e-8);
  checks.push(
    'Tread mesh, axle ratios, actual ballast mass and real link anchors respond to tuning',
  );
  await page.locator('[data-mode=settings]').click();
  await page.locator('[data-graphic=accumulation]').check();
  await page.locator('#visual-wear').uncheck();
  await page.locator('nav [data-mode=garage]').click();
  await game(() => {
    const g = window.__RIDGEBOUND__;
    g.effects.condition = {
      mud: [0.8, 0, 0.5, 0, 0.45, 0, 0.25, 0],
      wet: 0.8,
      dust: 0.3,
      scuffs: 0.2,
    };
    g.ui.onSave();
  });
  await page.waitForFunction(() => window.__RIDGEBOUND__.car.soilUniforms.zones.value[0] > 0.7);
  await page.screenshot({ path: '.artifacts/zoned-mud-preview.png', timeout: 120000 });
  await page.locator('#show-clean').click();
  await page.waitForFunction(() =>
    window.__RIDGEBOUND__.car.soilUniforms.zones.value.every((v) => v === 0),
  );
  assert.equal(await game(() => window.__RIDGEBOUND__.effects.condition.mud[0]), 0.8);
  await page.locator('#show-current').click();
  await page.waitForFunction(() => window.__RIDGEBOUND__.car.soilUniforms.zones.value[0] > 0.7);
  await page.locator('#clean-vehicle').click();
  assert.equal(await game(() => window.__RIDGEBOUND__.effects.soil), 0);
  checks.push(
    'Zoned mud shader, non-destructive clean comparison, free cleaning and optional visual wear',
  );
  await game(() => {
    const g = window.__RIDGEBOUND__;
    g.ui.onTestStation(5);
    g.sim.reset(13, -4.45);
  });
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__RIDGEBOUND__.effects.wet > 0.02, undefined, {
    timeout: 90000,
  });
  await page.keyboard.up('KeyW');
  await page.waitForFunction(() => window.__RIDGEBOUND__.effects.rippleData.length > 0);
  assert.equal(await game(() => window.__RIDGEBOUND__.testArea.waterLevel(13, -4.45)), 0.035);
  checks.push('Dedicated water trough produces actual immersion, wetness and ripples');
  await page.locator('#hud-camera').click();
  const camera = await game(() => window.__RIDGEBOUND__.state.preferences.camera);
  await page.locator('#hud-photo').click();
  await page.locator('#photo-weather').selectOption('Sunset');
  await page.locator('#photo-dof').check();
  await page.locator('#photo-focus').fill('.7');
  await page.locator('#photo-focus').dispatchEvent('input');
  await page.waitForFunction(
    () =>
      window.__RIDGEBOUND__.render.dof.enabled &&
      Math.abs(window.__RIDGEBOUND__.render.dof.uniforms.focus.value - 0.7) < 0.001,
  );
  await page.locator('#exit-photo').click();
  checks.push('Photo weather, real DoF and manual focus');
  await page.locator('#hud-menu').click();
  await page.locator('[data-go=settings]').click();
  await page.locator('[data-graphic=dof]').uncheck();
  await page.locator('#texture-size').selectOption('256');
  await page.locator('#wheel-detail').selectOption('1');
  await page.locator('#tyre-deformation').uncheck();
  await page.waitForFunction(() => {
    const g = window.__RIDGEBOUND__;
    return (
      g.car.tyreMeshes[0].material.normalMap.image.width === 256 &&
      g.car.visualDetail === 1 &&
      g.car.deformations.every((d) => d.uniforms.tyreDeflection.value === 0)
    );
  });
  assert.ok(await game(() => window.__RIDGEBOUND__.sim.wheels.some((w) => w.compression > 0)));
  checks.push(
    'Actual texture resizing, wheel LOD and visual deformation toggle preserve physical compression',
  );
  await page.locator('#sound').click();
  assert.equal(await game(() => window.__RIDGEBOUND__.state.tune.audio), true);
  await page.reload();
  await page.waitForFunction(() => window.__RIDGEBOUND__, undefined, { timeout: 120000 });
  const state = await game(() => window.__RIDGEBOUND__.state);
  assert.equal(state.tune.vehicle, 'b4');
  assert.equal(state.tune.ballast, 0.15);
  assert.equal(state.tune.frontOverdrive, 0.12);
  assert.equal(state.tune.linkHeight, 0.003);
  assert.equal(state.preferences.visualWear, false);
  assert.equal(state.preferences.camera, camera);
  assert.equal(state.graphics.textureSize, 256);
  assert.equal(state.graphics.wheelDetail, 1);
  assert.equal(state.graphics.tyreDeformation, false);
  checks.push('New tuning, camera, wear and graphics preferences survive reload');
  assert.deepEqual(errors, []);
  writeFileSync(
    '.artifacts/free-realism-results.json',
    JSON.stringify({ checks, vehicles, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, vehicles, errors }, null, 2));
} finally {
  await browser.close();
}
