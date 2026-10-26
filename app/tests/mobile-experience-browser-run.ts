// Isolated database + mocked recognition only. Saves through the real catalog API.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { once } from "node:events";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
async function main(){
 const dir=mkdtempSync(path.join(tmpdir(),'knowflow-review-browser-'));
 const base='http://127.0.0.1:3107', password='fixture-catalog-password';
 const env={...process.env,DATABASE_URL:`file:${dir}/test.db`,UPLOAD_ROOT:`${dir}/uploads`,APP_ORIGIN:base,AUTH_USERNAME:'fixture',AUTH_PASSWORD_HASH:await hashPassword(password),AUTH_SECRET:'catalog-fixture-only-secret-32-characters',MISTAKE_AI_API_KEY:'',MISTAKE_AI_MODEL:'',DEEPSEEK_API_KEY:''};
 writeFileSync(`${dir}/test.db`,'');mkdirSync(`${dir}/uploads`);
 execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env,stdio:'pipe'});
 execFileSync(process.execPath,['--import','tsx','scripts/bootstrap.ts'],{env,stdio:'pipe'});
 const db=new PrismaClient({datasourceUrl:env.DATABASE_URL});
 await db.subject.update({where:{id:'math'},data:{partTextbooks:JSON.stringify({calculus:'武忠祥高等数学基础篇'})}});
 await db.subject.update({where:{id:'cs'},data:{partTextbooks:'{}',textbookTitle:null}});
 const item=await db.mistakeItem.create({data:{id:'mobile-fixture',subjectId:'math',title:'积分与换元练习',content:'题目',processingStatus:'processing',createdAt:new Date('2026-10-26T01:00:00Z')}});
 await db.catalogJob.create({data:{id:'catalog-fixture',subjectId:'cs',part:'data-structures',images:'[]',status:'running',createdAt:new Date('2026-10-26T00:59:00Z')}});
 const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3107'],{env,stdio:['ignore','pipe','pipe']});
 let output='';server.stdout.on('data',b=>output+=b);server.stderr.on('data',b=>output+=b);
 try {
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/login')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,output);
  if(process.env.KNOWFLOW_MOBILE_PHASE==='after') assert.equal((await fetch(base+'/api/recent-intakes')).status,401);
  const {chromium}=await import(process.env.KNOWFLOW_PLAYWRIGHT || 'playwright');
  const browser=await chromium.launch({executablePath:process.env.KNOWFLOW_CHROME || undefined,headless:true});
  try {
   const phase=process.env.KNOWFLOW_MOBILE_PHASE || 'before';
   const metrics=[];
   for(const width of [375,390,430,768,769,1440]) {
    const ctx=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1});
    assert.equal((await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{username:'fixture',password}})).status(),200);
    const p=await ctx.newPage();const errors:string[]=[];p.on('pageerror',(e:Error)=>errors.push(e.message));
    for(const route of ['','knowledge']) {
     await p.goto(base+'/'+route,{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);
     assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' overflow '+width);
     metrics.push({width,route,height:await p.evaluate(()=>document.documentElement.scrollHeight)});
     await p.screenshot({path:`../data/mobile-experience-20261026/${phase}-${route||'home'}-${width}.png`,fullPage:true,animations:'disabled'});
     if(phase==='after' && width<=768) {
      const nav=p.getByRole('navigation',{name:'手机导航'});assert.ok(await nav.isVisible());
      assert.equal(await nav.getByRole('link',{name:'拍照',exact:true}).getAttribute('href'),'/wrong-questions/new');
      const b=await nav.boundingBox();assert.ok(b && b.y+b.height<=844);
      if(route==='knowledge') {
       const cards=p.locator('[data-subject-card]');assert.equal(await cards.count(),4);
       for(const card of await cards.all()){const box=await card.boundingBox();assert.ok(box && box.height<150);}
       const empty=p.locator('[data-subject-card="cs"]');assert.equal(await empty.locator('progress').isVisible(),false);
       const last=await cards.last().boundingBox();assert.ok(last && last.y+last.height<b!.y,'all four subjects above navigation');
      } else {
       const capture=p.getByRole('link',{name:'拍下错题',exact:false});const box=await capture.boundingBox();assert.ok(box && box.y+box.height<600);
       await p.getByText('AI 整理中',{exact:true}).waitFor();await p.getByText('目录识别中',{exact:true}).waitFor();
      }
     }
    }
    assert.deepEqual(errors,[]);await ctx.close();
   }
   if(phase==='after') {
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    await ctx.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{username:'fixture',password}});
    const p=await ctx.newPage();await p.goto(base+'/');
    await p.getByRole('link',{name:'拍下错题',exact:false}).click();
    await p.getByRole('heading',{name:'拍下这次卡点',exact:true}).waitFor();
    assert.equal(await p.locator('input[capture=environment]').count()>0,true);
    await p.getByRole('navigation',{name:'手机导航'}).getByRole('link',{name:'首页',exact:true}).click();
    await p.getByRole('link',{name:'录入教材目录',exact:false}).click();await p.getByRole('dialog').waitFor();
    await p.getByRole('dialog').getByRole('link',{name:'数学',exact:false}).click();
    await p.locator('input[type=file]').first().waitFor({state:'attached'});
    await p.getByRole('link',{name:'线性代数',exact:true}).click();
    await p.locator('input[type=file]').first().waitFor({state:'attached'});
    await p.goto(base+'/');
    await db.mistakeItem.update({where:{id:item.id},data:{processingStatus:'complete'}});
    await p.getByText('已整理',{exact:true}).waitFor({timeout:20000});
    await db.catalogJob.update({where:{id:'catalog-fixture'},data:{status:'ready'}});
    await p.getByText('目录待确认',{exact:true}).waitFor({timeout:20000});
    await ctx.close();
   }
   writeFileSync(`../data/mobile-experience-20261026/${phase}-metrics.json`,JSON.stringify(metrics,null,2));
   console.log('PASS '+phase+' screenshots, widths, navigation, compact cards and background statuses');
  } finally {await browser.close();}
 } finally {server.kill('SIGTERM');await once(server,'exit');await db.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
