import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
test("durable capture: worker process, restart, retries, singleton, editing race and backup", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "knowflow-queue-"));
  writeFileSync(path.join(dir, "test.db"), "");
  const env = { ...process.env, DATABASE_URL: `file:${path.join(dir, "test.db")}`, UPLOAD_ROOT: path.join(dir, "uploads"), MISTAKE_AI_API_KEY: "", MISTAKE_AI_MODEL: "" };
  try {
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, stdio: "pipe" });
    execFileSync(process.execPath, ["--import", "tsx", "tests/mistake-queue-run.ts"], { env, stdio: "pipe", timeout: 60000 });
  } catch (error) {
    const output = error as Error & { stdout?: Buffer; stderr?: Buffer };
    throw new Error(`${output.message}\n${output.stdout || ""}\n${output.stderr || ""}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
