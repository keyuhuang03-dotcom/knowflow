import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
test("durable multi-page catalog resumes between workers and requires preview confirmation", () => {
 const dir=mkdtempSync(path.join(tmpdir(),"knowflow-catalog-jobs-"));
 writeFileSync(path.join(dir,"test.db"),"");
 const env={...process.env,DATABASE_URL:`file:${dir}/test.db`,UPLOAD_ROOT:`${dir}/uploads`};
 try {
  execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env,stdio:"pipe"});
  execFileSync(process.execPath,["--import","tsx","tests/catalog-jobs-run.ts"],{env,stdio:"pipe"});
 } catch(e) {const error=e as Error & {stdout?:Buffer;stderr?:Buffer};throw new Error(`${error.message}\n${error.stdout||""}\n${error.stderr||""}`);}
 finally {rmSync(dir,{recursive:true,force:true});}
});
