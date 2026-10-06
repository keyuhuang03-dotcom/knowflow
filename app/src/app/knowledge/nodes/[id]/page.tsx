import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { nodePath } from "@/lib/mistake-contract";
import NodeDetail from "@/components/knowledge/NodeDetail";
export const dynamic = "force-dynamic";
export default async function NodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const node = await prisma.knowledgeNode.findUnique({ where: { id }, include: { subject: true, chapter: true, notes: { orderBy: { updatedAt: "desc" } } } });
  if (!node) notFound();
  const [all, mistakes] = await Promise.all([
    prisma.knowledgeNode.findMany({ where: { subjectId: node.subjectId } }),
    prisma.mistakeItem.findMany({ where: { OR: [{ knowledgeNodeId: id }, { linkedNodes: { some: { id } } }] }, orderBy: { createdAt: "desc" } }),
  ]);
  return <NodeDetail node={{ id, name: node.name, subjectId: node.subjectId, status: node.status, description: node.description, path: nodePath(node, all, node.subject.name), lastReviewAt: node.lastReviewAt?.toISOString() || null }} mistakes={mistakes.map(m => ({ id: m.id, title: m.title, source: m.source, errorReason: m.errorReason, reviewStatus: m.reviewStatus, reviewedAt: m.reviewedAt?.toISOString() || null }))} notes={node.notes.map(n => ({ id: n.id, title: n.title, content: n.content, tags: n.tags }))} />;
}
