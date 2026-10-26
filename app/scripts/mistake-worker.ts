import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

loadEnvConfig(process.cwd());
async function main() {
  const { runWorkerOnce, releaseWorker } = await import("../src/lib/mistake-queue");
  const { runCatalogOnce } = await import("../src/lib/catalog-queue");
  const { prisma } = await import("../src/lib/prisma");
  const owner = randomUUID();
  const leaseArgument = process.argv.find(v => v.startsWith("--lease-ms="));
  const leaseMs = leaseArgument ? Math.max(1000, Number(leaseArgument.split("=")[1]) || 90000) : 90000;
  let stop = false;
  process.on("SIGINT", () => { stop = true; });
  process.on("SIGTERM", () => { stop = true; });
  console.log("KnowFlow mistake worker started (single SQLite lease, concurrency 1)");
  try {
    do {
      try { if (!await runWorkerOnce(owner, leaseMs)) await runCatalogOnce(owner, leaseMs); } catch { console.error("Worker database temporarily unavailable; will retry. No record deleted."); }
      if (process.argv.includes("--once")) break;
      if (!stop) await delay(1000);
    } while (!stop);
  } finally { await releaseWorker(owner); await prisma.$disconnect(); }
}
main().catch(() => { console.error("Worker startup failed. Check database migration and configuration."); process.exitCode = 1; });
