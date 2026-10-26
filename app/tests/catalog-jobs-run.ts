import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { FixtureRequest as Request } from "./auth-fixture";
import { POST, GET, PUT, DELETE } from "../src/app/api/subjects/[id]/catalog/route";
const ctx={params:Promise.resolve({id:"cs"})};
const request=(body:unknown)=>new Request("http://localhost/api/subjects/cs/catalog",{method:"POST",body:JSON.stringify(body)});
async function main(){
 await mkdir(process.env.UPLOAD_ROOT!,{recursive:true});
 const image="/uploads/catalog.png";
 await writeFile(`${process.env.UPLOAD_ROOT}/catalog.png`,Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/9sAAAAASUVORK5CYII=","base64"));
 await prisma.subject.create({data:{id:"cs",name:"408"}});
 let calls=0,fail=true;
 const provider=createServer(async(req,res)=>{
  let body="";for await(const c of req)body+=c;calls++;
  assert.equal(JSON.parse(body).messages[1].content.filter((c:{type:string})=>c.type==="image_url").length,1);
  if(calls===2&&fail){res.statusCode=500;res.end("fixture failure");return;}
  const items=calls===1?[[1,"第一章 数据结构",1],[2,"1.1 概论",2]]:[[2,"1.2 线性表",10]];
  res.setHeader("Content-Type","application/json");res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({items,truncated:false,warnings:[]})}}]}));
 });
 provider.listen(0,"127.0.0.1");await once(provider,"listening");const address=provider.address();assert.ok(address&&typeof address!=="string");
 const env={...process.env,MISTAKE_AI_API_KEY:"fixture",MISTAKE_AI_MODEL:"fixture",MISTAKE_AI_BASE_URL:`http://127.0.0.1:${address.port}/v1`};
 async function work(){const child=spawn(process.execPath,["--import","tsx","scripts/mistake-worker.ts","--once"],{env,stdio:["ignore","pipe","pipe"]});let output="";child.stderr.on("data",b=>output+=b);const[code]=await once(child,"exit");assert.equal(code,0,output);}
 try {
  const body={background:true,part:"data-structures",images:[image,image]};
  const response=await POST(request(body),ctx);assert.equal(response.status,202);const job=await response.json();
  assert.equal((await(await POST(request(body),ctx)).json()).id,job.id,"lost response retries reuse the same active job");
  await work();let saved=await prisma.catalogJob.findUniqueOrThrow({where:{id:job.id}});assert.equal(saved.completedPages,1);assert.equal(saved.status,"queued");
  await work();saved=await prisma.catalogJob.findUniqueOrThrow({where:{id:job.id}});assert.equal(saved.completedPages,1);assert.equal(saved.attempts,1);
  fail=false;await prisma.catalogJob.update({where:{id:job.id},data:{availableAt:new Date(0)}});await work();
  const status=await(await GET(new Request("http://localhost/api/subjects/cs/catalog?part=data-structures"),ctx)).json();
  assert.equal(status.status,"ready");assert.equal(status.completedPages,2);assert.equal(calls,3,"completed first page is never re-recognized");
  assert.deepEqual(status.entries.at(-1),{path:["第一章 数据结构","1.2 线性表"],page:10});
  assert.equal(await prisma.knowledgeNode.count(),0,"recognition never changes the skeleton");
  assert.equal(await(await GET(new Request("http://localhost/api/subjects/cs/catalog?part=computer-networks"),ctx)).json(),null);
  const payload={part:"data-structures",jobId:job.id,textbookTitle:"测试教材",entries:status.entries,mode:"replace",dryRun:true};
  const plan=await(await PUT(request(payload),ctx)).json();assert.ok(plan.revision);assert.equal(await prisma.knowledgeNode.count(),0);
  assert.equal((await PUT(request({...payload,dryRun:false,confirmed:true,replaceConfirmed:true,revision:plan.revision}),ctx)).status,200);
  assert.equal(await prisma.knowledgeNode.count(),3);assert.equal((await prisma.catalogJob.findUniqueOrThrow({where:{id:job.id}})).status,"saved");
  const second=await(await POST(request(body),ctx)).json();
  assert.notEqual(second.id,job.id);
  await DELETE(new Request(`http://localhost/api/subjects/cs/catalog?part=data-structures&jobId=${second.id}`,{method:"DELETE"}),ctx);
  assert.equal((await prisma.catalogJob.findUniqueOrThrow({where:{id:second.id}})).status,"discarded");
  const beforeCalls=calls;await work();assert.equal(calls,beforeCalls,"discarded tasks cannot run");
  assert.equal(await prisma.knowledgeNode.count(),3,"discarding recognition preserves the saved textbook");
  console.log("PASS durable catalog pages, detached workers, partial-failure resume, duplicate submission, partition isolation and explicit save");
 }finally{provider.close();provider.closeAllConnections();await prisma.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
