import { partBooks, subjectParts } from "./subject-parts";
import { prisma } from "./prisma";
import { nodePath } from "./mistake-contract";
export async function getCatalog(subjectId?: string, includeHistory = false) {
  const subjects = await prisma.subject.findMany({
    where: subjectId ? { id: subjectId } : undefined,
    orderBy: { createdAt: "asc" },
    include: { knowledgeNodes: { where: includeHistory ? {} : { catalogArchived: false }, include: { chapter: true, mistakeItems: { select: { id: true } }, linkedMistakes: { select: { id: true } }, notes: { select: { id: true, tags: true } } }, orderBy: [{ catalogOrder: "asc" }, { createdAt: "asc" }] } },
  });
  return subjects.map(s => ({
    id: s.id, name: s.name, textbookTitle: s.textbookTitle,
    parts: (subjectParts[s.id] || []).map(p => ({...p, textbookTitle: partBooks(s.partTextbooks)[p.id] || null})),
    nodes: s.knowledgeNodes.map(n => ({
      subjectPart: n.subjectPart, catalogImported: n.catalogImported, catalogArchived: n.catalogArchived, pageStart: n.pageStart, catalogOrder: n.catalogOrder,
      id: n.id, name: n.name, parentId: n.parentId, status: n.status,
      chapter: n.chapter?.name || null, order: n.chapter?.order || 0,
      path: nodePath(n, s.knowledgeNodes, [s.name, subjectParts[s.id]?.find(p => p.id === n.subjectPart)?.name].filter(Boolean).join(" / ")), lastReviewAt: n.lastReviewAt?.toISOString() || null,
      mistakeCount: new Set([...n.mistakeItems, ...n.linkedMistakes].map(m => m.id)).size,
      noteCount: n.notes.filter(n => n.tags !== "method").length,
      methodCount: n.notes.filter(n => n.tags === "method").length,
    })),
  }));
}
export type Catalog = Awaited<ReturnType<typeof getCatalog>>;
