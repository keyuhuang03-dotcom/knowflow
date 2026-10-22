import { authenticate } from "./browser-auth.mjs";
// Optional read-only browser regression; no database writes.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.KNOWFLOW_PLAYWRIGHT || 'playwright');
const base=process.env.KNOWFLOW_TEST_URL || 'http://127.0.0.1:3000';

(async()=>{const b=await chromium.launch({executablePath:process.env.KNOWFLOW_CHROME || undefined,headless:true});try{const p=await b.newPage({viewport:{width:1366,height:900}});await authenticate(p.context(),base);const errors=[];p.on('pageerror',e=>errors.push(e.message));const routes=['/','/knowledge','/knowledge/math','/wrong-questions','/wrong-questions/new','/study-tracker','/settings','/notes','/tasks','/analytics','/daily-review','/knowledge/graph','/design-lab'];
for(const width of [1366,390]){await p.setViewportSize({width,height:900});for(const route of routes){const r=await p.goto(base+route,{waitUntil:'networkidle'});assert.equal(r.status(),200,route);const overflow=await p.evaluate(()=>({w:innerWidth,s:document.documentElement.scrollWidth}));assert.ok(overflow.s<=overflow.w,JSON.stringify({route,width,...overflow}));if(['/','/wrong-questions','/study-tracker','/settings'].includes(route)&&width===1366)await p.screenshot({path:'/tmp/kf-site-'+(route==='/'?'home':route.slice(1))+'.png',fullPage:true});console.log(width,route,'OK');}}
assert.deepEqual(errors,[]);console.log('PASS routes, desktop/mobile overflow and page errors');}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
