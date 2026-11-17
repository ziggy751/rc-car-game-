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
  checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
  page.setDefaultTimeout(60000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem('ridgebound.save.v1'))
      localStorage.setItem(
        'ridgebound.save.v1',
        JSON.stringify({ version: 1, tune: { quality: 'Low' }, credits: 1000, completed: [] }),
      );
  });
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__RIDGEBOUND__, undefined, { timeout: 120000 });
  const game = (fn) => page.evaluate(fn);
  const snap = async (name) => {
    await page.screenshot({ path: `.artifacts/${name}.png`, timeout: 60000 });
  };
  assert.equal(await game(() => window.__RIDGEBOUND__.ui.mode), 'home');
  assert.equal(await game(() => window.__RIDGEBOUND__.sim.paused), true);
  checks.push('Home and physical bench initialise');
  await page.locator('nav [data-mode=garage]').click();
  await page.locator('[data-vehicle=c2]').click();
  assert.equal(await game(() => window.__RIDGEBOUND__.preview.tune.vehicle), 'c2');
  assert.equal(await game(() => window.__RIDGEBOUND__.sim.tune.vehicle), 'r1');
  await page.locator('#buy-vehicle').click();
  assert.equal(await game(() => window.__RIDGEBOUND__.state.credits), 400);
  assert.equal(await game(() => window.__RIDGEBOUND__.sim.tune.vehicle), 'c2');
  assert.ok(Math.abs((await game(() => window.__RIDGEBOUND__.sim.mass)) - 2.85) < 0.001);
  assert.equal(await game(() => window.__RIDGEBOUND__.sim.paused), true);
  await snap('upgrade-c2-owned');
  checks.push('3D C2 preview, purchase, real mass and paused selection');
  await page.locator('#select-vehicle').click();
  assert.equal(await game(() => window.__RIDGEBOUND__.ui.mode), 'workshop');
  await page.locator('#compound').selectOption('hard');
  await page.locator('#radius').fill('130');
  await page.locator('#radius').dispatchEvent('input');
  assert.equal(await game(() => window.__RIDGEBOUND__.sim.tune.radius), 0.065);
  await page.locator('[data-category=Suspension]').click();
  await page.locator('#rearSpring').fill('640');
  await page.locator('#rearSpring').dispatchEvent('input');
  assert.equal(await game(() => window.__RIDGEBOUND__.sim.tune.rearSpring), 80);
  await page.locator('[data-pose=articulation]').click();
  await page.waitForFunction(() => {
    const g = window.__RIDGEBOUND__;
    return Math.abs(g.preview.axles[0].rotation().z) > 0.01;
  });
  await page.locator('[data-pose=rock]').click();
  await page.locator('[data-category=Steering]').click();
  await page.locator('#preview-steer').fill('.8');
  await page.locator('#preview-steer').dispatchEvent('input');
  await page.waitForFunction(() => window.__RIDGEBOUND__.preview.steer > 0.3);
  checks.push('Independent front/rear tuning, physical articulation and live servo preview');
  await page.locator('#tab-style').click();
  await page.locator('[data-color="#42657b"]').click();
  await page.locator('#body').uncheck();
  assert.equal(await game(() => window.__RIDGEBOUND__.car.shell.visible), false);
  await snap('upgrade-mechanics');
  await page.locator('#body').check();
  await page.locator('#tab-builds').click();
  await page.locator('#build-name').fill('Creek competition');
  await page.locator('#save-build').click();
  assert.equal(await page.locator('[data-build]').count(), 1);
  checks.push('Paint, removable body and named build');
  await page.locator('nav [data-mode=map]').click();
  assert.equal(await page.locator('[data-trail]').count(), 4);
  await page.locator('[data-trail="2"]').click();
  await page.locator('#drive-course').click();
  assert.equal(await page.locator('header').isVisible(), false);
  assert.equal(await page.locator('#panel').isVisible(), false);
  assert.equal(await page.locator('#driving-hud').isVisible(), true);
  assert.equal(await game(() => window.__RIDGEBOUND__.run.course.id), 'timberline');
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__RIDGEBOUND__.sim.distance > 0.12, undefined, {
    timeout: 60000,
  });
  await page.keyboard.up('KeyW');
  checks.push('Four courses, clean driving HUD and keyboard movement');
  await snap('upgrade-driving');
  await page.locator('#hud-menu').click();
  const paused = await game(() => ({
    t: window.__RIDGEBOUND__.sim.elapsed,
    r: window.__RIDGEBOUND__.run.elapsed,
  }));
  await page.waitForTimeout(450);
  assert.deepEqual(
    await game(() => ({
      t: window.__RIDGEBOUND__.sim.elapsed,
      r: window.__RIDGEBOUND__.run.elapsed,
    })),
    paused,
  );
  await page.locator('#resume').click();
  await page.locator('#hud-recover').click();
  assert.equal(await game(() => window.__RIDGEBOUND__.run.recoveries), 1);
  checks.push('M menu freezes physics/course time; recovery penalised');
  await page.locator('#hud-camera').click();
  assert.match(await page.locator('#camera').textContent(), /Low RC camera/);
  await page.locator('#hud-photo').click();
  const downloading = page.waitForEvent('download');
  await page.locator('#download-photo').click();
  const download = await downloading;
  assert.equal(await download.failure(), null);
  assert.match(download.suggestedFilename(), /^ridgebound-.*\.png$/);
  await page.locator('#exit-photo').click();
  checks.push('Camera selection, paused photo mode and actual PNG export');
  await page.locator('#hud-menu').click();
  await page.locator('[data-go=settings]').click();
  await page.locator('#weather').selectOption('Rain');
  assert.equal(await game(() => window.__RIDGEBOUND__.render.currentWeather), 'Rain');
  await page.locator('#scale').fill('.85');
  await page.locator('#scale').dispatchEvent('input');
  assert.equal(await page.locator('#quality').inputValue(), 'Custom');
  assert.equal(await game(() => window.__RIDGEBOUND__.state.graphics.scale), 0.85);
  await page.locator('[data-bind=forward]').click();
  await page.keyboard.press('g');
  assert.equal(await game(() => window.__RIDGEBOUND__.state.bindings.forward), 'KeyW');
  await page.keyboard.press('i');
  assert.equal(await game(() => window.__RIDGEBOUND__.state.bindings.forward), 'KeyI');
  checks.push('Rain, real custom settings and reserved/remapped controls');
  await page.locator('#quality').selectOption('Low');
  await page.locator('#back').click();
  await page.setViewportSize({ width: 390, height: 844 });
  const touch = page.locator('[data-key=KeyW]');
  assert.equal(await touch.isVisible(), true);
  await touch.hover();
  await page.mouse.down();
  await page.waitForFunction(() => window.__RIDGEBOUND__.sim.throttle > 0.08);
  await page.mouse.up();
  await snap('upgrade-mobile');
  checks.push('Remapped touch input and mobile HUD');
  await page.keyboard.press('KeyM');
  await page.locator('[data-go=garage]').click();
  await game(() => {
    const g = window.__RIDGEBOUND__;
    g.effects.soil = 0.8;
    g.ui.onSave();
  });
  await page.locator('#clean-vehicle').click();
  assert.equal(await game(() => window.__RIDGEBOUND__.effects.soil), 0);
  checks.push('Persistent mud cleaning');
  await page.reload();
  await page.waitForFunction(() => window.__RIDGEBOUND__, undefined, { timeout: 120000 });
  const saved = await game(() => window.__RIDGEBOUND__.state);
  assert.equal(saved.tune.vehicle, 'c2');
  assert.equal(saved.tune.compound, 'hard');
  assert.equal(saved.tune.rearSpring, 80);
  assert.equal(saved.builds[0].name, 'Creek competition');
  assert.equal(saved.bindings.forward, 'KeyI');
  assert.equal(saved.weather, 'Rain');
  assert.equal(saved.dirt.c2, 0);
  checks.push('Profiles, tuning, graphics, builds, weather and input survive reload');
  assert.deepEqual(errors, []);
  writeFileSync('.artifacts/browser-results.json', JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} finally {
  await browser.close();
}
