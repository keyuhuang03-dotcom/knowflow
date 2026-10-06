import { prisma } from "./prisma";
import { nodePath } from "./mistake-contract";
export async function getCatalog(subjectId?: string) {
  const subjects = await prisma.subject.findMany({
    where: subjectId ? { id: subjectId } : undefined,
    orderBy: { createdAt: "asc" },
    include: { knowledgeNodes: { include: { chapter: true, mistakeItems: { select: { id: true } }, linkedMistakes: { select: { id: true } }, notes: { select: { id: true, tags: true } } }, orderBy: { createdAt: "asc" } } },
  });
  return subjects.map(s => ({
    id: s.id, name: s.name, textbookTitle: s.textbookTitle,
    nodes: s.knowledgeNodes.map(n => ({
      id: n.id, name: n.name, parentId: n.parentId, status: n.status,
      chapter: n.chapter?.name || null, order: n.chapter?.order || 0,
      path: nodePath(n, s.knowledgeNodes, s.name), lastReviewAt: n.lastReviewAt?.toISOString() || null,
      mistakeCount: new Set([...n.mistakeItems, ...n.linkedMistakes].map(m => m.id)).size,
      noteCount: n.notes.filter(n => n.tags !== "method").length,
      methodCount: n.notes.filter(n => n.tags === "method").length,
    })),
  }));
}
export type Catalog = Awaited<ReturnType<typeof getCatalog>>;
