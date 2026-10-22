import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { uploadRoot } from "./mistake-files";
const execute = promisify(execFile);
export function databaseFile() {
  const url = process.env.DATABASE_URL || "";
  if (!url.startsWith("file:")) throw new Error("SQLite path unavailable");
  const value = url.slice(5).split("?")[0];
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), "prisma", value);
}
export async function beforeRestoreBackup() {
  const root = process.env.BACKUP_ROOT || path.resolve(process.cwd(), "../data/backups");
  await mkdir(root, { recursive: true, mode: 0o700 });
  const output = path.join(root, `before-restore-${Date.now()}-${randomUUID()}.tar.gz`);
  const tool = process.env.BACKUP_TOOL_PATH || path.resolve(process.cwd(), "../scripts/export-cloud-data.py");
  await execute("python3", [tool, output, "--database", databaseFile(), "--uploads", uploadRoot(), "--skill-data", process.env.MISTAKE_SKILL_DATA_ROOT || path.resolve(process.cwd(), "data/mistake-skill")], { timeout: 120000, maxBuffer: 1024 * 1024 });
  return output;
}
