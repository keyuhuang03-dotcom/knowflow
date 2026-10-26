import { prisma } from "./prisma";
import { subjectParts } from "./subject-parts";
export type RecentIntake = { id: string; title: string; detail: string; href: string; kind: "mistake" | "catalog"; status: string; label: string; pending: boolean; createdAt: string };
export async function recentIntakes(): Promise<RecentIntake[]> {
  const [mistakes, catalogs] = await Promise.all([
    prisma.mistakeItem.findMany({ take: 4, orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true, title: true, createdAt: true, processingStatus: true, subject: { select: { name: true } } } }),
    prisma.catalogJob.findMany({ take: 4, where: { status: { not: "discarded" } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true, subjectId: true, part: true, createdAt: true, status: true, completedPages: true, subject: { select: { name: true } } } }),
  ]);
  return [...mistakes.map(m => ({ id: m.id, title: `${m.subject?.name || "待定科目"} · 错题`, detail: m.title, href: `/wrong-questions/${m.id}`, kind: "mistake" as const, status: m.processingStatus, label: ({ queued: "等待整理", processing: "AI 整理中", failed: "整理失败 · 重试", needs_information: "题干待核对", complete: "已整理" } as Record<string,string>)[m.processingStatus] || "已保存", pending: ["queued", "processing"].includes(m.processingStatus), createdAt: m.createdAt.toISOString() })),
    ...catalogs.map(c => ({ id: c.id, title: `${subjectParts[c.subjectId]?.find(p => p.id === c.part)?.name || c.subject.name} · 教材目录`, detail: c.status === "saved" ? "目录已保存至知识库" : `已识别 ${c.completedPages} 页`, href: `/knowledge/${c.subjectId}?${new URLSearchParams({ ...(c.part ? { part: c.part } : {}), catalog: "1" })}`, kind: "catalog" as const, status: c.status, label: ({ queued: "等待识别", running: "目录识别中", ready: "目录待确认", failed: "识别失败 · 重试", saved: "已归档" } as Record<string,string>)[c.status] || "已保存", pending: ["queued", "running"].includes(c.status), createdAt: c.createdAt.toISOString() }))].sort((a,b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).slice(0,4);
}
