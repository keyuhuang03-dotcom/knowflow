import { prisma } from "./prisma";
import { InputError, parseAnalysis, parseNodeIds, record, text } from "./mistake-contract";
import { readUploadedImage } from "./mistake-files";

export const mistakeInclude = { subject: true, knowledgeNode: true, linkedNodes: true } as const;
export async function saveConfirmedMistake(value: unknown) {
  const body = record(value);
  if (body.confirmed !== true) throw new InputError("请先确认知识点关联");
  const id = text(body.id, "记录标识", 100, true);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new InputError("记录标识不正确");
  const subjectId = text(body.subjectId, "科目", 100, true);
  const nodeIds = parseNodeIds(body.nodeIds);
  const image = await readUploadedImage(body.imageUrl);
  const workUrl = text(body.userWorkImageUrl, "解题图片", 250);
  if (workUrl) await readUploadedImage(workUrl);
  const analysis = parseAnalysis(body.analysis);
  const data = {
    title: text(body.title, "题目名称", 180, true),
    content: analysis.question || "见原题图片", imageUrl: image.url,
    source: text(body.source, "来源", 500), userWork: text(body.userWork, "解题过程"),
    userWorkImageUrl: workUrl || null, errorReason: analysis.errorReason,
    aiAnalysis: JSON.stringify(analysis),
  };
  return prisma.$transaction(async tx => {
    const subject = await tx.subject.findUnique({ where: { id: subjectId } });
    if (!subject?.textbookTitle) throw new InputError("请先在科目知识库确认主教材和知识目录");
    const nodes = await tx.knowledgeNode.findMany({ where: { id: { in: nodeIds }, subjectId } });
    if (nodes.length !== nodeIds.length) throw new InputError("知识点已变更或不属于当前科目，请重新选择");
    const existing = await tx.mistakeItem.findUnique({ where: { id }, include: mistakeInclude });
    // A stable draft UUID makes retries after a lost response idempotent.
    if (existing) return existing;
    return tx.mistakeItem.create({ data: { ...data, id, subjectId, knowledgeNodeId: nodeIds[0], linkedNodes: { connect: nodeIds.map(id => ({ id })) }, relatedKnowledge: JSON.stringify(nodes.map(n => n.name)) }, include: mistakeInclude });
  });
}
