import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      'ridgebound.save.v1',
      JSON.stringify({ version: 1, tune: { quality: 'Low' }, builds: [], completed: [] }),
    ),
  );
  const response = await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173/');
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => window.__RIDGEBOUND__, undefined, { timeout: 120000 });
  await page.locator('#camera').click();
  assert.match(await page.locator('#camera').textContent(), /Low RC camera/);
  await page.locator('#photo').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download-photo').click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^ridgebound-.*\.png$/);
  assert.equal(await download.failure(), null);
  await page.locator('#exit-photo').click();
  await page.locator('[data-mode="settings"]').click();
  await page.locator('[data-bind="forward"]').click();
  await page.keyboard.press('g');
  assert.equal(await page.evaluate(() => window.__RIDGEBOUND__.state.bindings.forward), 'KeyW');
  await page.keyboard.press('i');
  assert.equal(await page.evaluate(() => window.__RIDGEBOUND__.state.bindings.forward), 'KeyI');
  await page.locator('#back').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.__RIDGEBOUND__.ui.onTestStation(0));
  const touch = page.locator('[data-key="KeyW"]');
  await touch.hover();
  await page.mouse.down();
  await page.waitForFunction(() => window.__RIDGEBOUND__.sim.throttle > 0.08, undefined, {
    timeout: 30000,
  });
  await page.mouse.up();
  await page.locator('nav [data-mode=garage]').click();
  const bounds = await page.locator('#drive').boundingBox();
  assert.ok(bounds.y + bounds.height < 844 - 60, 'Garage action fits above footer');
  assert.deepEqual(
    await page.evaluate(() =>
      window.__RIDGEBOUND__.car.deformations.map((d) => d.uniforms.tyreDeflection.value),
    ),
    [0, 0, 0, 0],
  );
  assert.equal(await page.locator('#telemetry').isVisible(), false);
  assert.equal(await page.locator('.primary .arrow').count(), 1);
  assert.deepEqual(errors, []);
  console.log(
    'Production checks passed: HTTP 200, bundled assets/WASM initialisation, camera switch, PNG download, workshop controls/layout, reserved key conflicts, remapped touch throttle, garage tyre reset, no page errors.',
  );
} finally {
  await browser.close();
}
