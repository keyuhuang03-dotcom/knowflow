import { textbookForNode, textbookSummary } from "./subject-parts";
import { parseRecognition, recognitionOnly } from "./mistake-recognition";
import { AiBudgetExceeded } from "./release-controls";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { analyzeUploadedMistake, AIUnavailable } from "./mistake-ai";
import { readImagePages } from "./mistake-pages";
import { InputError, nodePath, preserveSelfReport } from "./mistake-contract";

export const WORKER_LEASE_ID = "mistake-organizer";
export async function enqueueMistake(tx: Prisma.TransactionClient, mistakeId: string, inputVersion: number) {
  return tx.mistakeJob.upsert({ where: { mistakeId }, create: { mistakeId, inputVersion }, update: { inputVersion, status: "queued", attempts: 0, availableAt: new Date(), leaseUntil: null, owner: null, lastError: null } });
}
export async function releaseWorker(owner: string) {
  await prisma.workerLease.deleteMany({ where: { id: WORKER_LEASE_ID, owner } });
}
export async function runWorkerOnce(owner = randomUUID(), leaseMs = 90000) {
  const now = new Date();
  await prisma.workerLease.upsert({ where: { id: WORKER_LEASE_ID }, create: { id: WORKER_LEASE_ID, owner: "", expiresAt: new Date(0) }, update: {} });
  const lock = await prisma.workerLease.updateMany({ where: { id: WORKER_LEASE_ID, OR: [{ owner }, { expiresAt: { lte: now } }] }, data: { owner, expiresAt: new Date(Date.now() + leaseMs) } });
  if (!lock.count) return false;
  const job = await prisma.$transaction(async tx => {
    // Exhausted work abandoned by a crashed process becomes visible as failed.
    const expired = await tx.mistakeJob.findMany({ where: { OR: [{ status: "running", leaseUntil: { lte: now } }, { status: "queued", availableAt: { lte: now } }] } });
    for (const j of expired) if (j.attempts >= j.maxAttempts) {
      await tx.mistakeJob.update({ where: { id: j.id }, data: { status: "failed", owner: null, leaseUntil: null, lastError: "整理中断且已达到重试上限，可手动重试。" } });
      await tx.mistakeItem.updateMany({ where: { id: j.mistakeId, inputVersion: j.inputVersion }, data: { processingStatus: "failed", processingError: "整理中断且已达到重试上限，可手动重试。" } });
    }
    const next = await tx.mistakeJob.findFirst({ where: { attempts: { lt: tx.mistakeJob.fields.maxAttempts }, OR: [{ status: "queued", availableAt: { lte: now } }, { status: "running", leaseUntil: { lte: now } }] }, orderBy: { availableAt: "asc" } });
    if (!next || next.attempts >= next.maxAttempts) return null;
    const claimed = await tx.mistakeJob.updateMany({ where: { id: next.id, inputVersion: next.inputVersion, OR: [{ status: "queued", availableAt: { lte: now } }, { status: "running", leaseUntil: { lte: now } }] }, data: { status: "running", attempts: { increment: 1 }, owner, leaseUntil: new Date(Date.now() + leaseMs) } });
    if (!claimed.count) return null;
    await tx.mistakeItem.updateMany({ where: { id: next.mistakeId, inputVersion: next.inputVersion }, data: { processingStatus: "processing", processingError: null } });
    return { ...next, attempts: next.attempts + 1 };
  });
  if (!job) return false;
  const heartbeat = setInterval(() => {
    void prisma.$transaction(async tx => {
      const renewed = await tx.workerLease.updateMany({ where: { id: WORKER_LEASE_ID, owner, expiresAt: { gt: new Date() } }, data: { expiresAt: new Date(Date.now() + leaseMs) } });
      if (renewed.count) await tx.mistakeJob.updateMany({ where: { id: job.id, status: "running", owner, inputVersion: job.inputVersion }, data: { leaseUntil: new Date(Date.now() + leaseMs) } });
    }).catch(() => { /* Expired leases are reclaimed; stale results cannot commit. */ });
  }, Math.max(100, Math.floor(leaseMs / 3)));
  try {
    const item = await prisma.mistakeItem.findUniqueOrThrow({ where: { id: job.mistakeId }, include: { subject: true, linkedNodes: true } });
    if (item.inputVersion !== job.inputVersion) return true;
    const allNodes = await prisma.knowledgeNode.findMany({ where: { catalogArchived: false, ...(item.subjectId ? { subjectId: item.subjectId } : {}) }, include: { chapter: true, subject: true } });
    const nodes = allNodes.filter(n => textbookForNode(n.subject, n.subjectPart));
    let checkpoint;
    try {
      const saved = JSON.parse(item.aiAnalysis || "{}").recognitionCheckpoint;
      if (saved?.inputVersion === job.inputVersion) {
        const parsed = parseRecognition({ ...saved.result, rotation: 0 });
        if (parsed.recognition === "clear") checkpoint = parsed;
      }
    } catch { /* Invalid or older checkpoints are safely re-recognized. */ }
    const onRecognized = async (recognized: ReturnType<typeof parseRecognition>) => {
      await prisma.$transaction(async tx => {
        const lease = await tx.workerLease.findUnique({ where: { id: WORKER_LEASE_ID } });
        const activeJob = await tx.mistakeJob.findUnique({ where: { id: job.id } });
        const current = await tx.mistakeItem.findUnique({ where: { id: item.id } });
        if (lease?.owner !== owner || lease.expiresAt <= new Date() || activeJob?.owner !== owner || activeJob.status !== "running" || activeJob.inputVersion !== job.inputVersion || current?.inputVersion !== job.inputVersion) throw new Error("Task changed");
        await tx.mistakeItem.update({ where: { id: item.id }, data: {
          content: recognized.question,
          aiAnalysis: JSON.stringify({ ...preserveSelfReport({ ...recognitionOnly(recognized), recognition: "clear", cardPending: true }, current.aiAnalysis), recognitionCheckpoint: { inputVersion: job.inputVersion, result: recognized } }),
        } });
      });
    };
    const result = await analyzeUploadedMistake({ recognized: checkpoint, onRecognized, imageUrl: item.imageUrl || "", imageUrls: readImagePages(item.imageUrls, item.imageUrl), userWorkImageUrl: item.userWorkImageUrl || "", userWork: item.userWork || "", source: item.source || "", subject: item.subject?.name || "未确定", textbook: (item.subject ? textbookSummary(item.subject) : "") || "未设置；只整理内容，不创建教材节点", candidates: nodes.map(n => ({ id: n.id, name: n.name, path: nodePath(n, nodes.filter(x => x.subjectId === n.subjectId), n.subject.name) })) });
    const chosen = nodes.filter(n => result.recommendations.some(r => r.nodeId === n.id));
    // Ambiguous cross-subject matches remain unlinked. No invented subject/node.
    const subjects = new Set(chosen.map(n => n.subjectId));
    const links = subjects.size <= 1 ? chosen : [];
    await prisma.$transaction(async tx => {
      const lease = await tx.workerLease.findUnique({ where: { id: WORKER_LEASE_ID } });
      if (lease?.owner !== owner || lease.expiresAt <= new Date()) return;
      const applied = await tx.mistakeJob.updateMany({ where: { id: job.id, owner, status: "running", inputVersion: job.inputVersion }, data: { status: "complete", leaseUntil: null, owner: null, lastError: null } });
      if (!applied.count) return;
      const current = await tx.mistakeItem.findUnique({ where: { id: item.id } });
      if (!current || current.inputVersion !== job.inputVersion) return;
      const activeLinks = await tx.knowledgeNode.findMany({ where: { id: { in: links.map(n => n.id) }, catalogArchived: false } });
      const activeRecommendations = result.recommendations.filter(r => activeLinks.some(n => n.id === r.nodeId));
      await tx.mistakeItem.update({ where: { id: item.id }, data: {
        content: result.analysis.question, aiAnalysis: JSON.stringify({ ...preserveSelfReport(result.analysis, current.aiAnalysis), recommendations: activeRecommendations }), errorReason: result.analysis.errorReason,
        title: current.title === "待整理错题" ? result.analysis.coreConcept.slice(0, 100) || "错题记录" : current.title,
        processingStatus: result.analysis.recognition === "clear" && !result.analysis.cardPending ? "complete" : "needs_information", processingError: null,
        ...(!current.linksConfirmed ? { subjectId: current.subjectId || activeLinks[0]?.subjectId || null, knowledgeNodeId: activeLinks[0]?.id || null, linkedNodes: { set: activeLinks.map(n => ({ id: n.id })) }, relatedKnowledge: JSON.stringify(activeLinks.map(n => n.name)) } : {}),
      } });
    });
  } catch (error) {
    const terminal = error instanceof AiBudgetExceeded || error instanceof AIUnavailable || error instanceof InputError || job.attempts >= job.maxAttempts;
    const message = error instanceof AiBudgetExceeded ? error.message : error instanceof AIUnavailable ? "尚未配置图片分析服务。照片和记录已保存，配置后可重试。" : error instanceof InputError ? `图片暂时无法读取：${error.message}。记录仍保留。` : "AI 整理暂时失败，照片和记录已保存。";
    await prisma.$transaction(async tx => {
      const lease = await tx.workerLease.findUnique({ where: { id: WORKER_LEASE_ID } });
      if (lease?.owner !== owner || lease.expiresAt <= new Date()) return;
      const changed = await tx.mistakeJob.updateMany({ where: { id: job.id, owner, status: "running", inputVersion: job.inputVersion }, data: { status: terminal ? "failed" : "queued", availableAt: new Date(Date.now() + 5000 * 2 ** (job.attempts - 1)), leaseUntil: null, owner: null, lastError: message } });
      if (changed.count) await tx.mistakeItem.updateMany({ where: { id: job.mistakeId, inputVersion: job.inputVersion }, data: { processingStatus: terminal ? "failed" : "queued", processingError: message } });
    });
  } finally { clearInterval(heartbeat); }
  return true;
}
