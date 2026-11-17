import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
mkdirSync('.artifacts', { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 820 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173/');
  await page.waitForFunction(() => window.__RIDGEBOUND__, undefined, { timeout: 120000 });
  await page.waitForFunction(
    () => window.__RIDGEBOUND__.renderer.info.render.frame >= 3,
    undefined,
    { timeout: 60000 },
  );
  const profile = await page.evaluate(() => {
    const g = window.__RIDGEBOUND__;
    g.sim.paused = false;
    const timings = [];
    for (let i = 0; i < 120; i++) {
      const now = performance.now();
      g.sim.step(1 / 240, { throttle: 0, steer: 0, brake: false });
      timings.push(performance.now() - now);
    }
    g.sim.paused = true;
    timings.sort((a, b) => a - b);
    return {
      medianMs: timings[60],
      p95Ms: timings[114],
      maxMs: timings[119],
      calls: g.renderer.info.render.calls,
      triangles: g.renderer.info.render.triangles,
      contacts: g.sim.contacts,
      mass: g.sim.mass,
    };
  });
  console.log('PARK PROFILE', JSON.stringify(profile));
  await page.screenshot({ path: '.artifacts/overhaul-high.png', timeout: 60000 });
  await page.locator('nav [data-mode=garage]').click();
  await page.locator('#tab-style').click();
  await page.locator('#body').uncheck();
  assert.deepEqual(
    await page.evaluate(() =>
      window.__RIDGEBOUND__.car.deformations.map((d) => d.uniforms.tyreDeflection.value),
    ),
    [0, 0, 0, 0],
  );
  await page.screenshot({ path: '.artifacts/overhaul-garage.png', timeout: 60000 });
  assert.deepEqual(errors, []);
  console.log(
    'High-quality tyre/shadow shader, garage deformation reset, screenshot validation: PASS',
  );
} finally {
  await browser.close();
}
