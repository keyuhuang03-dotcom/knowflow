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
 const item=await db.mistakeItem.create({data:{title:'可降阶的高阶微分方程（缺 $x$ 型）；二阶变系数方程降阶',content:'题目',processingStatus:'complete',aiAnalysis:JSON.stringify({version:1,origin:'ai',recognition:'clear',question:String.raw`求方程 $y''+\dfrac{2}{1-y}(y')^2=0$ 的通解（$y$ 不是恒常数）。`,standardSolution:String.raw`1. 令 $p=y'$，视 $p$ 为 $y$ 的函数，则 $y''=p\dfrac{dp}{dy}$。代入原方程得 $p\dfrac{dp}{dy}+\dfrac{2}{1-y}p^2=0$。
2. 分离变量并积分：$\dfrac{dp}{p}=\dfrac{2}{y-1}dy$，得 $p=C_1(y-1)^2$。
3. 回代并积分，得 $y=1-\dfrac{1}{C_1x+C_2}$。
4. 核对原题条件与定义域。`,finalAnswer:String.raw`$y=1-\dfrac{1}{C_1x+C_2}$，其中 $C_1\ne0$。`,errorOptions:['忘记乘指数',String.raw`令 $p=y'$ 后未把 $y''$ 写成 $p\dfrac{dp}{dy}$`,String.raw`除以 $p$ 时未说明 $p\not\equiv 0$ 的依据`]})}});
 const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3107'],{env,stdio:['ignore','pipe','pipe']});
 let output='';server.stdout.on('data',b=>output+=b);server.stderr.on('data',b=>output+=b);
 try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/login')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,output);
  const {chromium}=await import(process.env.KNOWFLOW_PLAYWRIGHT || 'playwright');
  const browser=await chromium.launch({executablePath:process.env.KNOWFLOW_CHROME || undefined,headless:true});
  try{
   const context=await browser.newContext({viewport:{width:390,height:844}});const p=await context.newPage();const errors:string[]=[];p.on('pageerror',(e:Error)=>errors.push(e.message));
   assert.equal((await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{username:'fixture',password}})).status(),200);
   await p.goto(base+'/wrong-questions/'+item.id);
   await p.getByRole('heading',{name:'标准解答',exact:true}).waitFor();
   assert.ok(await p.locator('h1 math').count()>0);
   assert.equal(await p.locator('.kf-reflection-options .wb-choice math').count(),5);
   assert.equal(await p.locator('ol > li').count(),4);
   assert.ok(!(await p.locator('h1').innerText()).includes('$'));
   assert.ok(!(await p.locator('.kf-reflection-options').innerText()).includes('$'));
   assert.equal(await p.getByRole('button',{name:'生成完整诊断',exact:true}).count(),0);
   assert.equal(await p.getByRole('checkbox',{checked:true}).count(),0);
   await p.getByRole('textbox',{name:'我的卡点（可选）',exact:true}).fill('不知道怎么求导');
   await p.getByRole('checkbox',{name:'忘记乘指数',exact:true}).check();
   await p.getByRole('textbox',{name:'自填错因（可选）',exact:true}).fill('漏写系数');
   await p.getByRole('button',{name:'保存卡点与错因',exact:true}).click();
   await p.getByText('已保存，不会重新调用 AI',{exact:true}).waitFor();
   await p.reload();
   assert.equal(await p.getByRole('textbox',{name:'我的卡点（可选）',exact:true}).inputValue(),'不知道怎么求导');
   assert.equal(await p.getByRole('checkbox',{name:'忘记乘指数',exact:true}).isChecked(),true);
   assert.equal(await p.getByRole('textbox',{name:'自填错因（可选）',exact:true}).inputValue(),'漏写系数');
   assert.equal(await db.mistakeJob.count(),0);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.screenshot({path:'/private/tmp/knowflow-review-mobile.png',fullPage:true});
   await p.setViewportSize({width:1440,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:'/private/tmp/knowflow-review-desktop.png',fullPage:true});assert.deepEqual(errors,[]);
   console.log('PASS standard solution/math, unselected suggestions, reflection save/reload, no AI job, mobile/desktop overflow');
  }finally{await browser.close();}
 }finally{server.kill('SIGTERM');await once(server,'exit');await db.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
