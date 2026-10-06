import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCatalog } from "@/lib/knowledge-data";
import { readAnalysis } from "@/lib/mistake-contract";
import { mistakeInclude } from "@/lib/mistake-service";
import MistakeDetail from "@/components/wrong-questions/MistakeDetail";
export const dynamic = "force-dynamic";
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const item = await prisma.mistakeItem.findUnique({ where: { id: (await params).id }, include: mistakeInclude });
  if (!item) notFound();
  const [subject] = await getCatalog(item.subjectId);
  const ids = new Set([...item.linkedNodes.map(n => n.id), ...(item.knowledgeNodeId ? [item.knowledgeNodeId] : [])]);
  const candidates = subject.nodes.map(n => ({ id: n.id, name: n.name, path: n.path }));
  return <MistakeDetail item={{ id: item.id, title: item.title, content: item.content, imageUrl: item.imageUrl, source: item.source, userWork: item.userWork, userWorkImageUrl: item.userWorkImageUrl, userNote: item.userNote, reviewStatus: item.reviewStatus, reviewedAt: item.reviewedAt?.toISOString() || null, subjectId: item.subjectId, analysis: readAnalysis(item.aiAnalysis), nodes: candidates.filter(n => ids.has(n.id)) }} candidates={candidates} />;
}
