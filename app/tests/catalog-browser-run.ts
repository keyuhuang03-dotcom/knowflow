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
 const dir=mkdtempSync(path.join(tmpdir(),'knowflow-catalog-browser-'));
 const base='http://127.0.0.1:3105', password='fixture-catalog-password';
 const env={...process.env,DATABASE_URL:`file:${dir}/test.db`,UPLOAD_ROOT:`${dir}/uploads`,APP_ORIGIN:base,AUTH_USERNAME:'fixture',AUTH_PASSWORD_HASH:await hashPassword(password),AUTH_SECRET:'catalog-fixture-only-secret-32-characters',MISTAKE_AI_API_KEY:'',MISTAKE_AI_MODEL:'',DEEPSEEK_API_KEY:''};
 writeFileSync(`${dir}/test.db`,'');mkdirSync(`${dir}/uploads`);
 execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env,stdio:'pipe'});
 execFileSync(process.execPath,['--import','tsx','scripts/bootstrap.ts'],{env,stdio:'pipe'});
 const db=new PrismaClient({datasourceUrl:env.DATABASE_URL});
 await db.subject.update({where:{id:'math'},data:{textbookTitle:'测试教材',partTextbooks:JSON.stringify({calculus:'测试教材'})}});
 const old=await db.knowledgeNode.create({data:{subjectId:'math',subjectPart:'calculus',name:'旧目录条目'}});
 await db.note.create({data:{title:'历史笔记',content:'保留',knowledgeNodes:{connect:{id:old.id}}}});
 const entries=[{path:['第一章 函数'],page:1},{path:['第一章 函数','1.1 映射'],page:3},{path:['第一章 函数','1.1 映射','1.1.1 定义'],page:4},{path:['第二章 极限'],page:21},{path:['第二章 极限','2.1 数列'],page:22}];
 const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3105'],{env,stdio:['ignore','pipe','pipe']});
 let output='';server.stdout.on('data',b=>output+=b);server.stderr.on('data',b=>output+=b);
 try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/login')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,output);
  const {chromium}=await import(process.env.KNOWFLOW_PLAYWRIGHT || 'playwright');
  const browser=await chromium.launch({executablePath:process.env.KNOWFLOW_CHROME || undefined,headless:true});
  try{
   const context=await browser.newContext({viewport:{width:390,height:844}});const p=await context.newPage();const errors:string[]=[];p.on('pageerror',(e:Error)=>errors.push(e.message));
   assert.equal((await context.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{username:'fixture',password}})).status(),200);
   await p.goto(base+'/knowledge/math');await p.getByRole('button',{name:'拍照识别教材目录',exact:true}).click();

   await p.locator('input[type=file]').first().setInputFiles({name:'目录.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/9sAAAAASUVORK5CYII=','base64')});
   await p.getByRole('button',{name:'上传全部 1 页 / 重试',exact:true}).click();
   await p.getByText('全部目录页面已上传，可以识别。',{exact:true}).waitFor();
   await p.getByRole('button',{name:'识别目录（1 页）',exact:true}).click();await p.getByText('后台识别 · 已完成 0/1 页',{exact:true}).waitFor();
   const task=await db.catalogJob.findFirstOrThrow();
   await db.catalogJob.update({where:{id:task.id},data:{images:JSON.stringify([...JSON.parse(task.images),...JSON.parse(task.images)]),entries:JSON.stringify(entries.slice(0,2)),completedPages:1}});
   await p.reload();await p.getByText('后台识别 · 已完成 1/2 页',{exact:true}).waitFor();
   await db.catalogJob.update({where:{id:task.id},data:{entries:JSON.stringify(entries),warnings:'[]',status:'ready',completedPages:2}});
   await p.getByRole('heading',{name:'目录层级预览'}).waitFor();
   await p.getByText('识别完成 · 尚未保存目录',{exact:true}).waitFor();
   await p.reload();await p.getByRole('heading',{name:'目录层级预览'}).waitFor();
   await p.getByText('2.1 数列',{exact:true}).waitFor();
   assert.equal(await db.knowledgeNode.count(),1);
   await p.getByRole('button',{name:'预览保存影响',exact:true}).click();await p.getByRole('button',{name:'确认替换，保留旧目录学习记录',exact:true}).waitFor();assert.equal(await db.knowledgeNode.count(),1);
   await p.getByRole('button',{name:'确认替换，保留旧目录学习记录',exact:true}).click();await p.getByText(/目录已保存：新增 5/).waitFor();
   await p.getByRole('button',{name:'拍照识别教材目录',exact:true}).click();
   const panel=p.locator('section.wb-panel').filter({has:p.getByRole('heading',{name:'教材目录',exact:true})});
   await panel.locator('summary').filter({hasText:'第一章 函数'}).waitFor();
   assert.equal(await panel.getByText('1.1 映射',{exact:true}).isVisible(),false);
   await panel.locator('summary').filter({hasText:'第一章 函数'}).click();assert.equal(await panel.getByText('1.1 映射',{exact:true}).isVisible(),true);
   assert.equal(await panel.getByText('1.1.1 定义',{exact:true}).isVisible(),false);
   await panel.locator('summary').filter({hasText:'1.1 映射'}).click();assert.equal(await panel.getByText('1.1.1 定义',{exact:true}).isVisible(),true);
   assert.equal(await panel.getByText('第 4 页',{exact:true}).isVisible(),true);
   await p.reload();assert.equal(await panel.getByText('1.1 映射',{exact:true}).isVisible(),false);
   await p.getByRole('textbox',{name:'搜索知识点'}).fill('1.1.1');assert.equal(await panel.getByText('1.1.1 定义',{exact:true}).isVisible(),true);
   await p.getByRole('textbox',{name:'搜索知识点'}).fill('');
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:'/private/tmp/knowflow-catalog-mobile.png',fullPage:true});
   await p.getByRole('button',{name:'历史目录',exact:true}).click();await p.getByRole('link',{name:/旧目录条目/}).waitFor();
   assert.equal(await db.note.count({where:{knowledgeNodes:{some:{id:old.id}}}}),1);
   await p.setViewportSize({width:1440,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
   console.log('PASS background catalog progress/reload/preview/replace, chapter drilldown, pages, search ancestors, collapse after reload, archived notes and responsive layout');
  }finally{await browser.close();}
 }finally{server.kill('SIGTERM');await once(server,'exit');await db.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
