// Optional browser QA; uses an existing Playwright installation, not a project dependency.
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import path from 'node:path';
const { chromium } = await import(process.env.KNOWFLOW_PLAYWRIGHT || 'playwright');
(async () => {
 const browser = await chromium.launch({executablePath:process.env.KNOWFLOW_CHROME || undefined,headless:true});
 try {
 const context = await browser.newContext({viewport:{width:1512,height:1100}});
 const page = await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.KNOWFLOW_TEST_URL || 'http://127.0.0.1:3000'}/design-lab`,{waitUntil:'networkidle'});
 await page.locator('[data-variant="C"][data-refraction="active"]').waitFor();
 assert.equal(await page.locator('[data-variant]').count(),3);
 const samples=page.locator('[data-variant]');
 for(let i=0;i<3;i++) assert.equal(await samples.nth(i).getByText('数学',{exact:true}).count(),1);
 await page.screenshot({path:path.join(tmpdir(), 'knowflow-glass-desktop.png'),fullPage:true});
 for(const [name,val] of [['transparency',90],['blur',8],['highlight',50],['refraction',6],['shadow',40]]) await page.locator('#glass-'+name).fill(String(val));
 await page.getByRole('button',{name:'选择此方案',exact:true}).last().click();
 const exported=await page.getByRole('textbox',{name:'当前方案 CSS 参数'}).inputValue();
 assert.match(exported,/--glass-tint: 0.10/);assert.match(exported,/--glass-blur: 8px/);assert.match(exported,/--glass-refraction: 6px/);
 assert.equal(await page.locator('feDisplacementMap').getAttribute('scale'),'6');
 await page.getByLabel('C 使用兼容模式').check();assert.equal(await page.locator('[data-variant="C"]').getAttribute('data-refraction'),'off');
 await page.getByLabel('C 使用兼容模式').uncheck();
 await page.getByLabel('显示通透观察标记').check();
 await page.screenshot({path:path.join(tmpdir(), 'knowflow-glass-probe.png'),fullPage:true});
 for(const name of ['青柠微光','奶油日光','纯净奶白','晨间柔光']) {await page.getByRole('button',{name,exact:true}).click();assert.equal(await page.getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true');}
 await page.getByRole('button',{name:'恢复默认'}).click();assert.equal(await page.locator('#glass-blur').inputValue(),'16');
 await page.getByRole('button',{name:'复制 CSS 参数'}).click();await page.locator('p[role="status"]').filter({hasText:/已复制|无法自动复制/}).waitFor();
 await page.locator('#glass-blur').fill('0'); await page.locator('#glass-refraction').fill('8'); const activeImage = await page.locator('[data-variant="C"]').screenshot(); await page.getByLabel('C 使用兼容模式').check(); const fallbackImage = await page.locator('[data-variant="C"]').screenshot(); assert.equal(activeImage.equals(fallbackImage), false, 'SVG refraction must change actual pixels'); await page.getByLabel('C 使用兼容模式').uncheck();
 await page.emulateMedia({contrast:'more'});await page.locator('[data-variant="C"][data-refraction="off"]').waitFor();assert.equal(await page.locator('[data-variant="C"]').getAttribute('data-refraction'),'off');
 const mobile = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}); const p=await mobile.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(`${process.env.KNOWFLOW_TEST_URL || 'http://127.0.0.1:3000'}/design-lab`,{waitUntil:'networkidle'});await p.getByLabel('C 使用兼容模式').check(); await p.getByLabel('C 使用兼容模式').uncheck(); await p.locator('[data-variant="C"][data-refraction="off"]').waitFor(); assert.equal(await p.locator('[data-variant="C"]').getAttribute('data-refraction'),'off');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await p.screenshot({path:path.join(tmpdir(), 'knowflow-glass-mobile.png'),fullPage:true});
 await p.setViewportSize({width:320,height:740}); assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('PASS: three cards, all sliders, export, copy feedback, four backgrounds, fallback, contrast, mobile layout; no page errors.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
