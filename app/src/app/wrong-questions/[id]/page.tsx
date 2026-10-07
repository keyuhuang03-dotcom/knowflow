import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCatalog } from "@/lib/knowledge-data";
import { readAnalysis } from "@/lib/mistake-contract";
import { mistakeInclude } from "@/lib/mistake-service";
import { readSkillRecord } from "@/lib/mistake-skill";
import MistakeDetail from "@/components/wrong-questions/MistakeDetail";
export const dynamic = "force-dynamic";
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const item = await prisma.mistakeItem.findUnique({ where: { id: (await params).id }, include: mistakeInclude });
  if (!item) notFound();
  const [subject] = await getCatalog(item.subjectId);
  const ids = new Set([...item.linkedNodes.map(n => n.id), ...(item.knowledgeNodeId ? [item.knowledgeNodeId] : [])]);
  const candidates = subject.nodes.map(n => ({ id: n.id, name: n.name, path: n.path }));
  let skill = null;
  let skillError = "";
  if (item.skillRecordId) {
    try {
      const details = await readSkillRecord(item.skillRecordId);
      const diagnosis = details.record.diagnosis.diagnosis as Record<string, unknown>;
      skill = {
        summary: typeof diagnosis.summary === "string" ? diagnosis.summary : "",
        errors: Array.isArray(diagnosis.errors) ? diagnosis.errors as { evidence: string; cause: string; repair: string; role: string }[] : [],
        formulas: Array.isArray(diagnosis.formulas) ? diagnosis.formulas as { expression: string; conditions: string[]; why_here: string }[] : [],
        triggerConditions: Array.isArray(diagnosis.trigger_conditions) ? diagnosis.trigger_conditions as string[] : [],
        correctReasoning: Array.isArray(diagnosis.correct_reasoning) ? diagnosis.correct_reasoning as string[] : [],
        transferQuestions: Array.isArray(diagnosis.transfer_questions) ? diagnosis.transfer_questions as string[] : [],
        mastery: details.mastery,
        diagnosisCard: details.diagnosisCard,
      };
    } catch (error) { skillError = error instanceof Error ? error.message : "Skill 记录暂时无法读取"; }
  }
  return <MistakeDetail item={{ id: item.id, title: item.title, content: item.content, imageUrl: item.imageUrl, source: item.source, userWork: item.userWork, userWorkImageUrl: item.userWorkImageUrl, userNote: item.userNote, reviewStatus: item.reviewStatus, reviewedAt: item.reviewedAt?.toISOString() || null, subjectId: item.subjectId, skillRecordId: item.skillRecordId, analysis: readAnalysis(item.aiAnalysis), nodes: candidates.filter(n => ids.has(n.id)) }} candidates={candidates} skill={skill} skillError={skillError} />;
}
