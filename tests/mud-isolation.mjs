import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});
try {
  const errors = [],
    page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      'ridgebound.save.v1',
      JSON.stringify({
        version: 1,
        tune: { quality: 'Low' },
        graphics: { preset: 'Low', accumulation: true },
      }),
    ),
  );
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__RIDGEBOUND__, undefined, { timeout: 120000 });
  await page.locator('nav [data-mode=garage]').click();
  await page.evaluate(() => {
    const g = window.__RIDGEBOUND__;
    g.preview.paused = true;
    g.effects.clean();
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.__RIDGEBOUND__,
      c = document.createElement('canvas');
    c.width = g.renderer.domElement.width;
    c.height = g.renderer.domElement.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(g.renderer.domElement, 0, 0);
    window.__mudSamples = g.car.wheels.map((w) => {
      const p = w.getWorldPosition(g.car.root.position.clone());
      p.add(
        g.car.root.position
          .clone()
          .set(0.025, 0, 0)
          .applyQuaternion(w.getWorldQuaternion(g.car.root.quaternion.clone())),
      );
      p.project(g.camera);
      const x = Math.round((p.x * 0.5 + 0.5) * c.width),
        y = Math.round((0.5 - p.y * 0.5) * c.height);
      return { x, y, data: [...ctx.getImageData(x - 6, y - 6, 12, 12).data] };
    });
    g.effects.condition.mud = [0, 0.9, 0, 0, 0, 0.6, 0, 0];
  });
  const frame = await page.evaluate(() => window.__RIDGEBOUND__.renderer.info.render.frame);
  await page.waitForFunction(
    (frame) => window.__RIDGEBOUND__.renderer.info.render.frame > frame + 2,
    frame,
    { timeout: 120000 },
  );
  const regions = await page.evaluate(() => {
    const g = window.__RIDGEBOUND__,
      c = document.createElement('canvas');
    c.width = g.renderer.domElement.width;
    c.height = g.renderer.domElement.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(g.renderer.domElement, 0, 0);
    return window.__mudSamples.map((s, i) => {
      const data = ctx.getImageData(s.x - 6, s.y - 6, 12, 12).data;
      return {
        wheel: i,
        x: s.x,
        y: s.y,
        rms: Math.sqrt(s.data.reduce((n, v, k) => n + (v - data[k]) ** 2, 0) / data.length),
      };
    });
  });
  console.log(regions);
  assert.ok(regions[1].rms > 10);
  assert.ok(regions[0].rms < 0.1);
  assert.ok(regions[3].rms < 0.1);
  await page.screenshot({ path: '.artifacts/mud-isolation.png', timeout: 120000 });
  assert.deepEqual(errors, []);
  console.log(
    'Dirty front wheel changes; opposite front and visible rear wheel remain pixel-identical.',
  );
} finally {
  await browser.close();
}
