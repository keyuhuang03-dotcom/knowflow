import { prisma } from "@/lib/prisma";
import MistakeList from "@/components/wrong-questions/MistakeList";
export const dynamic = "force-dynamic";
export default async function WrongQuestionsPage() {
  const items = await prisma.mistakeItem.findMany({ include: { subject: true, knowledgeNode: true, linkedNodes: true }, orderBy: { createdAt: "desc" } });
  return <MistakeList items={items.map(m => ({ id: m.id, title: m.title, subjectId: m.subjectId || "", subject: m.subject?.name || "科目未确定", source: m.source || "", reason: m.errorReason || "", status: m.reviewStatus, processingStatus: m.processingStatus, nodes: [...new Set([...m.linkedNodes.map(n => n.name), ...(m.knowledgeNode ? [m.knowledgeNode.name] : [])])] }))} />;
}
