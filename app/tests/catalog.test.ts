import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCatalogEntries, catalogWarnings } from "../src/lib/textbook-catalog";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
test("catalog preserves hierarchy and explicit pages; duplicate conflicts cannot silently win", () => {
 const entries = parseCatalogEntries([{path:['第一章 函数'],page:null},{path:['第一章 函数'],page:3},{path:['第一章 函数','1.1 映射'],page:5}]);
 assert.equal(entries.length,2);assert.equal(entries[0].page,3);assert.equal(entries[1].path.length,2);
 assert.throws(()=>parseCatalogEntries([{path:['第一章'],page:3},{path:['第一章'],page:5}]));
 assert.throws(()=>parseCatalogEntries([{path:['第一章'],page:1.5}]));
 assert.ok(catalogWarnings([{path:['1.1 函数'],page:null}]).length>=2);
 assert.ok(catalogWarnings([{path:['第一章'],page:10},{path:['第一章','第一节'],page:2}]).some(x=>x.includes('早于')));
});
test("isolated catalog replacement preserves learning links, previews safely and rejects stale revisions", () => {
 const dir=mkdtempSync(path.join(tmpdir(),'knowflow-catalog-'));writeFileSync(path.join(dir,'test.db'),'');
 const env={...process.env,DATABASE_URL:`file:${path.join(dir,'test.db')}`};
 try {
  execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env,stdio:'pipe'});
  execFileSync(process.execPath,['--import','tsx','tests/catalog-run.ts'],{env,stdio:'pipe',timeout:30000});
 } catch(error){const e=error as Error & {stdout?:Buffer;stderr?:Buffer};throw new Error(`${e.message}\n${e.stdout||''}\n${e.stderr||''}`);}
 finally{rmSync(dir,{recursive:true,force:true});}
});

test("compact AI catalog preserves group hierarchy and rejects skipped parents or incomplete output", async () => {
 const { decodeCatalogRecognition } = await import('../src/lib/catalog-recognition');
 const entries=decodeCatalogRecognition({items:[[1,'第一章',null],[2,'第一节',2],[3,'考试内容概要',2],[4,'一、定义',2],[3,'常考题型',6],[4,'一、定义',6],[1,'第二章',null],[2,'概要',42]],truncated:false});
 assert.deepEqual(entries[5].path,['第一章','第一节','常考题型','一、定义']);
 assert.deepEqual(entries[7].path,['第二章','概要']);
 assert.throws(()=>decodeCatalogRecognition({items:[[1,'第一章',null],[3,'缺失父节',3]]}));
 assert.throws(()=>decodeCatalogRecognition({items:[[1,'第一章',null]],truncated:true}));
});
