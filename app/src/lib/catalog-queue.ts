import { prisma } from "./prisma";
import { WORKER_LEASE_ID } from "./mistake-queue";
import { recognizeCatalogPage } from "./catalog-ai";
import { parseCatalogEntries, catalogWarnings, type CatalogEntry } from "./textbook-catalog";
import { InputError } from "./mistake-contract";
import { AiBudgetExceeded } from "./release-controls";
export async function runCatalogOnce(owner: string, leaseMs = 90000) {
  const now = new Date();
  const lock = await prisma.workerLease.updateMany({ where: { id: WORKER_LEASE_ID, OR: [{ owner }, { expiresAt: { lte: now } }] }, data: { owner, expiresAt: new Date(Date.now() + leaseMs) } });
  if (!lock.count) return false;
  const job = await prisma.$transaction(async tx => {
    const next = await tx.catalogJob.findFirst({ where: { OR: [{ status: "queued", availableAt: { lte: now } }, { status: "running", leaseUntil: { lte: now } }] }, orderBy: { availableAt: "asc" } });
    if (!next) return null;
    if (next.attempts >= 3) { await tx.catalogJob.update({ where: { id: next.id }, data: { status: "failed", owner: null, leaseUntil: null, lastError: "识别中断且已达到重试上限，已完成页仍保留，可继续重试。" } }); return null; }
    return tx.catalogJob.update({ where: { id: next.id }, data: { status: "running", attempts: { increment: 1 }, owner, leaseUntil: new Date(Date.now() + leaseMs), lastError: null } });
  });
  if (!job) return false;
  const heartbeat = setInterval(() => {
    void prisma.$transaction(async tx => {
      const renewed = await tx.workerLease.updateMany({ where: { id: WORKER_LEASE_ID, owner, expiresAt: { gt: new Date() } }, data: { expiresAt: new Date(Date.now() + leaseMs) } });
      if (renewed.count) await tx.catalogJob.updateMany({ where: { id: job.id, owner, status: "running" }, data: { leaseUntil: new Date(Date.now() + leaseMs) } });
    }).catch(() => {});
  }, Math.max(100, Math.floor(leaseMs / 3)));
  const commit = async (data: Parameters<typeof prisma.catalogJob.updateMany>[0]["data"]) => {
    await prisma.$transaction(async tx => {
      const lease = await tx.workerLease.findUnique({ where: { id: WORKER_LEASE_ID } });
      if (lease?.owner !== owner || lease.expiresAt <= new Date()) return;
      await tx.catalogJob.updateMany({ where: { id: job.id, owner, status: "running", completedPages: job.completedPages }, data: { ...data, owner: null, leaseUntil: null } });
    });
  }
  try {
    const images: string[] = JSON.parse(job.images);
    const previous: CatalogEntry[] = JSON.parse(job.entries);
    const started = Date.now();
    const result = await recognizeCatalogPage([images[job.completedPages]], previous);
    const entries = parseCatalogEntries([...previous, ...result.entries]);
    const warnings = [...new Set([...JSON.parse(job.warnings), ...result.warnings, ...catalogWarnings(entries)])].slice(0, 50);
    await commit({ entries: JSON.stringify(entries), warnings: JSON.stringify(warnings), completedPages: job.completedPages + 1, status: job.completedPages + 1 === images.length ? "ready" : "queued", attempts: 0, availableAt: new Date(), lastError: null });
    console.info(`[catalog] page ${job.completedPages + 1}/${images.length} ${Date.now() - started}ms`);
  } catch (error) {
    const terminal = error instanceof InputError || error instanceof AiBudgetExceeded || job.attempts >= 3;
    await commit({ status: terminal ? "failed" : "queued", availableAt: new Date(Date.now() + 5000 * 2 ** (job.attempts - 1)), lastError: error instanceof InputError || error instanceof AiBudgetExceeded ? error.message : (terminal ? "目录服务暂时失败，已达重试上限；已识别页和照片保留，可继续重试。" : "目录服务暂时失败，正在有限重试；已识别页和照片仍保留。") });
  } finally { clearInterval(heartbeat); }
  return true;
}
