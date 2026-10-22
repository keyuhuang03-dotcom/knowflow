import { prisma } from "./prisma";
import { InputError, parseAnalysis, parseNodeIds, record, text } from "./mistake-contract";
import { parseImagePages, readImagePages } from "./mistake-pages";
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

/** Persist before analysis: no textbook, diagnosis or node confirmation required. */
export async function saveCapturedMistake(value: unknown) {
  const body = record(value);
  const id = text(body.id, "记录标识", 100, true);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new InputError("记录标识不正确");
  const existing = await prisma.mistakeItem.findUnique({ where: { id }, include: mistakeInclude });
  if (existing) {
    if (body.imageUrls !== undefined && JSON.stringify(parseImagePages(body.imageUrls, text(body.imageUrl, "原题图片", 250))) !== JSON.stringify(readImagePages(existing.imageUrls, existing.imageUrl))) throw new InputError("本次录入已经保存，重试不能替换页面。请从我的错题查看已保存记录，新的一题请使用新的录入草稿。");
    return existing;
  }
  const image = await readUploadedImage(body.imageUrl);
  const pages = parseImagePages(body.imageUrls, image.url);
  for (const url of pages.slice(1)) await readUploadedImage(url);
  const workUrl = text(body.userWorkImageUrl, "解题图片", 250);
  if (workUrl) await readUploadedImage(workUrl);
  const subjectId = text(body.subjectId, "科目", 100) || null;
  const nodeIds = body.nodeIds === undefined || Array.isArray(body.nodeIds) && !body.nodeIds.length ? [] : parseNodeIds(body.nodeIds);
  const data = { title: text(body.title, "题目名称", 180) || "待整理错题", content: "见原题图片", imageUrl: image.url, imageUrls: JSON.stringify(pages), source: text(body.source, "来源", 500), userWork: text(body.userWork, "解题过程"), userWorkImageUrl: workUrl || null };
  try {
    return await prisma.$transaction(async tx => {
      if (subjectId && !await tx.subject.findUnique({ where: { id: subjectId } })) throw new InputError("科目已删除，请选择未确定科目后重试");
      if (nodeIds.length && (!subjectId || await tx.knowledgeNode.count({ where: { id: { in: nodeIds }, subjectId } }) !== nodeIds.length)) throw new InputError("知识点已变更，请重新选择");
      const item = await tx.mistakeItem.create({ data: { ...data, aiAnalysis: JSON.stringify({ selfReport: { stickingPoint: data.userWork.slice(0, 4000), causes: [], customCause: "" } }), id, subjectId, processingStatus: "queued", linksConfirmed: Boolean(nodeIds.length), knowledgeNodeId: nodeIds[0] || null, linkedNodes: { connect: nodeIds.map(id => ({ id })) }, job: { create: { inputVersion: 0 } } }, include: mistakeInclude });
      return item;
    });
  } catch (error) {
    // Concurrent retries converge on the same durable record and job.
    const saved = await prisma.mistakeItem.findUnique({ where: { id }, include: mistakeInclude });
    if (saved) {
      if (JSON.stringify(readImagePages(saved.imageUrls, saved.imageUrl)) !== JSON.stringify(pages)) throw new InputError("同一录入标识已经保存了另一批页面，请从我的错题查看原记录");
      return saved;
    }
    throw error;
  }
}
