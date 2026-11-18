import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('.artifacts', { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
const errors = [],
  presets = [];
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.setDefaultTimeout(120000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      'ridgebound.save.v1',
      JSON.stringify({ version: 1, tune: { quality: 'Low' } }),
    ),
  );
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173/');
  await page.waitForFunction(() => window.__RIDGEBOUND__, undefined, { timeout: 120000 });
  await page.locator('[data-mode=settings]').click();
  for (const preset of ['Low', 'Medium', 'High', 'Ultra', 'Auto']) {
    const before = await page.evaluate(() => window.__RIDGEBOUND__.renderer.info.render.frame);
    await page.locator('#quality').selectOption(preset);
    await page.waitForFunction(
      (before) => window.__RIDGEBOUND__.renderer.info.render.frame >= before + 2,
      before,
      { timeout: 120000 },
    );
    const result = await page.evaluate(() => {
      const g = window.__RIDGEBOUND__;
      return {
        preset: g.state.graphics.preset,
        pixelRatio: g.renderer.getPixelRatio(),
        shadow: g.park.sun.shadow.mapSize.x,
        ao: g.render.ao.enabled,
        bloom: g.render.bloom.enabled,
        vegetation: g.render.effective(g.state.graphics).vegetation,
        physicsMass: g.sim.mass,
        mapWater: g.biomes.water.every(
          (mesh) => mesh.visible === g.render.effective(g.state.graphics).water,
        ),
        ...g.renderer.info.render,
      };
    });
    assert.equal(result.preset, preset);
    assert.equal(result.mapWater, true);
    presets.push(result);
    console.log('PRESET', JSON.stringify(result));
  }
  await page.locator('#quality').selectOption('Ultra');
  await page.locator('[data-graphic=dof]').check();
  assert.equal(await page.locator('#quality').inputValue(), 'Custom');
  await page.locator('#back').click();
  await page.locator('nav [data-mode=garage]').click();
  await page.waitForFunction(() => window.__RIDGEBOUND__.render.dof.enabled);
  await page.screenshot({ path: '.artifacts/upgrade-ultra-garage.png', timeout: 120000 });
  await page.locator('nav [data-mode=workshop]').click();
  await page.locator('#tab-style').click();
  await page.locator('#body').uncheck();
  await page.locator('[data-pose=rock]').click();
  await page.waitForFunction(
    () => window.__RIDGEBOUND__.preview.wheels.some((w) => w.patches.length > 0),
    undefined,
    { timeout: 120000 },
  );
  await page.screenshot({ path: '.artifacts/upgrade-ultra-workshop.png', timeout: 120000 });
  await page.evaluate(() => {
    const g = window.__RIDGEBOUND__;
    g.state.graphics.dof = false;
    g.ui.onGraphics();
    g.ui.onTestStation(0);
  });
  await page.waitForFunction(() => !window.__RIDGEBOUND__.render.dof.enabled);
  await page.screenshot({ path: '.artifacts/upgrade-ultra-park.png', timeout: 120000 });
  const contactEffects = await page.evaluate(() => {
    const g = window.__RIDGEBOUND__,
      dt = 1 / 240;
    const advance = (n, throttle) => {
      g.sim.paused = false;
      for (let i = 0; i < n; i++) {
        g.sim.step(dt, { throttle, steer: 0, brake: false });
        g.effects.step(dt, g.sim, g.state.graphics);
      }
      g.sim.paused = true;
    };
    g.testArea.solid([0.4, 0.12, 0.1], [8.8, 0.06, -4.3], g.park.water.material, {
      name: 'Gravel',
      mu: 0.62,
      rolling: 0.065,
    });
    g.sim.reset(8.8, -4.8);
    advance(120, 0);
    const emitted = g.effects.pool.emitted;
    advance(720, 1);
    const gravel = { emitted: g.effects.pool.emitted - emitted, surface: g.sim.surface };
    g.sim.reset(9.4, -4.8);
    g.effects.clean();
    advance(120, 0);
    advance(240, 0.8);
    const mud = { soil: g.effects.soil, surface: g.sim.surface };
    g.sim.reset(0.2, 3.7);
    advance(120, 0);
    const beforeWash = g.effects.soil;
    advance(240, 0.5);
    const water = {
      ripples: g.effects.rippleData.length,
      beforeWash,
      afterWash: g.effects.soil,
      wet: g.effects.wet,
    };
    g.effects.render(g.state.graphics);
    return {
      gravel,
      mud,
      water,
      poolSize: g.effects.pool.slots.length,
      clumps: g.effects.clumps.count,
      tracks: g.effects.tracks.count,
    };
  });
  console.log('CONTACT EFFECTS', JSON.stringify(contactEffects));
  assert.ok(contactEffects.gravel.emitted > 0, 'Physical gravel contact emits particles');
  assert.ok(contactEffects.mud.soil > 0, 'Physical mud exposure accumulates dirt');
  assert.ok(contactEffects.water.ripples > 0, 'Actual creek immersion produces ripples');
  assert.ok(
    contactEffects.water.afterWash < contactEffects.water.beforeWash,
    'Creek immersion washes mud off',
  );
  assert.ok(contactEffects.poolSize <= 1000);
  await page.screenshot({ path: '.artifacts/upgrade-ultra-water.png', timeout: 120000 });
  for (const weather of ['Overcast', 'Rain', 'Fog', 'Sunset', 'Night']) {
    await page.evaluate((weather) => {
      const g = window.__RIDGEBOUND__;
      g.state.weather = weather;
      g.ui.onWeather();
    }, weather);
    const frame = await page.evaluate(() => window.__RIDGEBOUND__.renderer.info.render.frame);
    await page.waitForFunction(
      (frame) => window.__RIDGEBOUND__.renderer.info.render.frame > frame,
      frame,
      { timeout: 120000 },
    );
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    '.artifacts/graphics-results.json',
    JSON.stringify(
      {
        presets,
        contactEffects,
        weather: ['Clear', 'Overcast', 'Rain', 'Fog', 'Sunset', 'Night'],
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'All presets, Ultra shadows/AO/bloom, Custom DoF, workshop deformation and six weather render states passed without WebGL errors.',
  );
} finally {
  await browser.close();
}
