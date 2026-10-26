// Isolated database + mocked recognition only. Saves through the real catalog API.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { once } from "node:events";
import { hashPassword } from "../src/lib/auth";
async function main(){
 const dir=mkdtempSync(path.join(tmpdir(),'knowflow-catalog-browser-'));
 const base='http://127.0.0.1:3105', password='fixture-catalog-password';
 const env={...process.env,DATABASE_URL:`file:${dir}/test.db`,UPLOAD_ROOT:`${dir}/uploads`,APP_ORIGIN:base,AUTH_USERNAME:'fixture',AUTH_PASSWORD_HASH:await hashPassword(password),AUTH_SECRET:'catalog-fixture-only-secret-32-characters',MISTAKE_AI_API_KEY:'',MISTAKE_AI_MODEL:'',DEEPSEEK_API_KEY:''};
 writeFileSync(`${dir}/test.db`,'');mkdirSync(`${dir}/uploads`);
 execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env,stdio:'pipe'});
 execFileSync(process.execPath,['--import','tsx','scripts/bootstrap.ts'],{env,stdio:'pipe'});
 const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3105'],{env,stdio:['ignore','pipe','pipe']});
 let output='';server.stdout.on('data',b=>output+=b);server.stderr.on('data',b=>output+=b);
 try {
  for(let i=0;i<100;i++){try{if((await fetch(base+'/login')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const {chromium}=await import(process.env.KNOWFLOW_PLAYWRIGHT || 'playwright');
  const browser=await chromium.launch({executablePath:process.env.KNOWFLOW_CHROME || undefined,headless:true});
  try {
   const {default:sharp}=await import('sharp');
   const buffer=await sharp({create:{width:1000,height:800,channels:3,background:'#dceaba'}}).png().toBuffer();
   for(const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},hasTouch:true});
    assert.equal((await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{username:'fixture',password}})).status(),200);
    const p=await context.newPage();const errors:string[]=[];p.on('pageerror',(e:Error)=>errors.push(e.message));
    await p.goto(base+'/wrong-questions/new');
    await p.locator('input[type=file]').first().setInputFiles([{name:'first.png',mimeType:'image/png',buffer},{name:'second.png',mimeType:'image/png',buffer}]);
    const img=p.locator('.wb-crop-preview img');await img.waitFor();
    await p.getByRole('button',{name:'裁剪当前页',exact:true}).click();
    assert.equal(await p.locator('input[type=range]').count(),0);
    const frame=p.locator('.wb-crop-selection');
    // All four edges follow the mouse and do not jump when first grabbed.
    for(const name of ['左边','上边','右边','下边']) {
     const h=p.getByRole('button',{name:'拖动裁剪框'+name,exact:true});await img.evaluate((el: HTMLElement)=>el.scrollIntoView({block:"center"}));
     const b=(await h.boundingBox())!;const before=(await frame.boundingBox())!;
     await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();
     await p.mouse.move(b.x+b.width/2+(name==='左边'?20:name==='右边'?-20:0),b.y+b.height/2+(name==='上边'?20:name==='下边'?-20:0),{steps:5});await p.mouse.up();
     const after=(await frame.boundingBox())!;assert.ok(after.width<before.width-15 || after.height<before.height-15);
    }
    await p.getByRole('button',{name:'重置裁剪框',exact:true}).click();
    const h=p.getByRole('button',{name:'拖动裁剪框左上角',exact:true});await img.evaluate((el: HTMLElement)=>el.scrollIntoView({block:"center"}));const b=(await h.boundingBox())!;
    const original=(await img.boundingBox())!;
    // Real Chromium touch events exercise pointer capture and prevent page scrolling.
    const cdp=await context.newCDPSession(p);const x=b.x+b.width/2,y=b.y+b.height/2;
    
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart' ,touchPoints:[{x,y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+original.width*.6,y:y+original.height*.5}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await p.waitForTimeout(100);const crop=(await frame.boundingBox())!;assert.ok(Math.abs(crop.width/original.width-.4)<.02);assert.ok(Math.abs(crop.height/original.height-.5)<.02);
    assert.equal(await p.getByRole('button',{name:'上传全部 2 页 / 重试',exact:true}).isEnabled(),false);
    await p.screenshot({path:`/private/tmp/knowflow-crop-${width}.png`,fullPage:true});
    await p.getByRole('button',{name:'应用裁剪',exact:true}).click();
    await p.waitForFunction(()=>{const i=document.querySelector('.wb-crop-preview img') as HTMLImageElement;return i?.naturalWidth>=399&&i?.naturalWidth<=401&&i?.naturalHeight>=399&&i?.naturalHeight<=401;});
    await p.getByRole('button',{name:'第 2 页',exact:true}).click();await p.waitForFunction(()=> (document.querySelector('.wb-crop-preview img') as HTMLImageElement)?.naturalWidth===1000);
    await p.getByRole('button',{name:'旋转 90°',exact:true}).click();await p.waitForFunction(()=> (document.querySelector('.wb-crop-preview img') as HTMLImageElement)?.naturalWidth===800);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await context.close();
   }
   console.log('PASS 390/1440px: four edges, touch corner, >40% crop, actual 400x400 output, multi-page preservation, rotation, no overflow or runtime errors');
  } finally {await browser.close();}
 } finally {server.kill('SIGTERM');await once(server,'exit');}
}
main().catch(e=>{console.error(e);process.exitCode=1});
