import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
test("SQLite AI quota remains atomic across ten separate processes and subsequent calls", () => {
 const dir = mkdtempSync(path.join(tmpdir(), "knowflow-budget-"));
 writeFileSync(path.join(dir, "test.db"), "");
 const env = { ...process.env, DATABASE_URL: `file:${path.join(dir, "test.db")}` };
 try {
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, stdio: "pipe" });
  execFileSync(process.execPath, ["--import", "tsx", "tests/ai-budget-run.ts"], { env, stdio: "pipe", timeout: 30000 });
 } catch (error) { const e = error as Error & { stderr?: Buffer }; throw new Error(`${e.message}\n${e.stderr || ""}`); }
 finally { rmSync(dir, { recursive: true, force: true }); }
});
