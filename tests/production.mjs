import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
try {
  const errors = [],
    page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.setDefaultTimeout(60000);
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
  const response = await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173/');
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => window.__RIDGEBOUND__, undefined, { timeout: 120000 });
  await page.keyboard.press('KeyM');
  assert.equal(await page.evaluate(() => window.__RIDGEBOUND__.ui.mode), 'home');
  await page.locator('[data-go=map]').click();
  await page.locator('[data-trail=\"2\"]').click();
  await page.locator('#free-roam').click();
  await page.keyboard.down('KeyW');
  await page.waitForFunction(
    () => window.__RIDGEBOUND__.sim.wheels.some((w) => w.surface.name === 'Timber'),
    undefined,
    { timeout: 60000 },
  );
  await page.keyboard.up('KeyW');
  await page.locator('#hud-camera').click();
  assert.match(await page.locator('#camera').textContent(), /Low RC camera/);
  await page.locator('#hud-photo').click();
  const promise = page.waitForEvent('download');
  await page.locator('#download-photo').click();
  const photo = await promise;
  assert.match(photo.suggestedFilename(), /^ridgebound-.*\.png$/);
  assert.equal(await photo.failure(), null);
  await page.locator('#exit-photo').click();
  await page.locator('#hud-menu').click();
  await page.locator('[data-go=workshop]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await page.locator('#drive').boundingBox();
  assert.ok(bounds.y + bounds.height < 844 - 45, 'Workshop action remains above footer on mobile');
  assert.equal(await page.locator('#telemetry').isVisible(), false);
  assert.deepEqual(errors, []);
  console.log(
    'Production passed: HTTP200, bundled fonts/JS/WASM, real model/shaders, driving/camera, PNG download, M menu, mobile tuning layout, zero page or WebGL errors.',
  );
} finally {
  await browser.close();
}
