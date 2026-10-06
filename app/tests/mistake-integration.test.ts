import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
test("isolated database: migrations, confirmation, associations, retries and edits", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "kaoyan-test-"));
  writeFileSync(path.join(dir, "test.db"), "");
  const env = { ...process.env, DATABASE_URL: `file:${path.join(dir, "test.db")}` };
  try {
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, stdio: "pipe" });
    execFileSync(process.execPath, ["--import", "tsx", "tests/mistake-integration-run.ts"], { env, stdio: "pipe" });
  } catch (error) {
    const output = error as Error & { stdout?: Buffer; stderr?: Buffer };
    throw new Error(`${output.message}\n${output.stdout || ""}\n${output.stderr || ""}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
