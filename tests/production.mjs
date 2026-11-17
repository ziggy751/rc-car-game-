import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('ridgebound.save.v1',JSON.stringify({version:1,tune:{quality:'Low'},builds:[],completed:[]})));
const response=await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173/');assert.equal(response.status(),200);
await page.waitForFunction(()=>window.__RIDGEBOUND__,undefined,{timeout:120000});
await page.locator('#camera').click();assert.match(await page.locator('#camera').textContent(),/Low RC camera/);
await page.locator('#photo').click();const downloadPromise=page.waitForEvent('download');await page.locator('#download-photo').click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/^ridgebound-.*\.png$/);assert.equal(await download.failure(),null);await page.locator('#exit-photo').click();
await page.locator('nav [data-mode=garage]').click();assert.equal(await page.locator('#telemetry').isVisible(),false);assert.equal(await page.locator('.primary .arrow').count(),1);
assert.deepEqual(errors,[]);console.log('Production checks passed: HTTP 200, bundled assets/WASM initialisation, camera switch, PNG download, workshop controls, no page errors.');
}finally{await browser.close();}
