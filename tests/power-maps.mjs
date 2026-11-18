import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }),
    errors = [],
    routes = [];
  page.setDefaultTimeout(90000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      'ridgebound.save.v1',
      JSON.stringify({
        version: 1,
        credits: 0,
        tune: { quality: 'Low' },
        builds: [{ name: 'Preserved', tune: { foam: 3800 } }],
        completed: [0, 2],
      }),
    ),
  );
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__RIDGEBOUND__);
  await page.locator('nav [data-mode=workshop]').click();
  await page.locator('[data-category=Motor]').click();
  for (const profile of ['scale', 'torque', 'sensored', 'performance', 'competition']) {
    await page.locator('#powerSystem').selectOption(profile);
    const tune = await page.evaluate(() => window.__RIDGEBOUND__.sim.tune);
    assert.equal(tune.powerSystem, profile);
    assert.ok(tune.escCurrent > 20);
  }
  await page.locator('#powerSystem').selectOption('scale');
  await page.locator('[data-category=Electronics]').click();
  await page.locator('#escCurrent').fill('32');
  await page.locator('#escCurrent').dispatchEvent('input');
  assert.equal(await page.evaluate(() => window.__RIDGEBOUND__.sim.tune.escCurrent), 32);
  await page.screenshot({ path: '.artifacts/power-electronics.png' });
  await page.locator('nav [data-mode=map]').click();
  assert.equal(await page.locator('[data-map]').count(), 5);
  for (const map of ['forest', 'granite', 'rainforest', 'quarry', 'competition']) {
    await page.locator(`[data-map=${map}]`).click();
    assert.equal(await page.locator('[data-trail]').count(), 4);
    await page.locator('#free-roam').click();
    const data = await page.evaluate(() => {
      const g = window.__RIDGEBOUND__,
        s = g.sim;
      s.paused = false;
      const start = s.body.translation(),
        startZ = start.z;
      let mud = 0,
        wet = 0,
        maxRoll = 0;
      for (let i = 0; i < 4800 && s.body.translation().z - startZ < 5.4; i++) {
        s.step(1 / 240, { throttle: 0.8, steer: 0, brake: false });
        g.biomes.step(1 / 240, s);
        g.effects.step(1 / 240, s, g.state.graphics);
        if (s.wheels.some((w) => w.surface.name === 'Mud')) mud++;
        if (g.effects.wet > wet) wet = g.effects.wet;
        maxRoll = Math.max(maxRoll, Math.abs(s.roll));
      }
      s.paused = true;
      g.biomes.sync();
      return {
        map: g.park.activeMap,
        progress: s.body.translation().z - startZ,
        mudFrames: mud,
        wet,
        maxRoll,
        rutVersion: g.biomes.mud.version,
        contacts: s.contacts,
        mass: s.mass,
      };
    });
    routes.push(data);
    console.log(JSON.stringify(data));
    assert.equal(data.map, map);
    assert.ok(data.contacts > 0);
    assert.ok(Number.isFinite(data.progress));
    if (map !== 'forest')
      assert.ok(
        data.progress > 5.2,
        `${map} relaxed course should be traversable on its centre line`,
      );
    await page.screenshot({ path: `.artifacts/rebuild-${map}.png` });
    await page.evaluate(() => window.__RIDGEBOUND__.ui.setMode('map'));
  }
  const saved = await page.evaluate(() => window.__RIDGEBOUND__.state);
  assert.equal(saved.builds[0].name, 'Preserved');
  assert.deepEqual(saved.completed, [0, 2]);
  assert.equal(saved.credits, 0);
  assert.deepEqual(errors, []);
  writeFileSync('.artifacts/power-maps-results.json', JSON.stringify({ routes, errors }, null, 2));
} finally {
  await browser.close();
}
