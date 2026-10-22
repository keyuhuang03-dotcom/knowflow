import { withAccess } from "@/lib/request-guard";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { InputError, parseSelfReport, preserveSelfReport, parseAnalysis, parseNodeIds, record, text } from "@/lib/mistake-contract";
import { enqueueMistake } from "@/lib/mistake-queue";
import { readUploadedImage } from "@/lib/mistake-files";
import { mistakeInclude } from "@/lib/mistake-service";
type Context = { params: Promise<{ id: string }> };
async function GETHandler(_req: Request, { params }: Context) {
  const item = await prisma.mistakeItem.findUnique({ where: { id: (await params).id }, include: mistakeInclude });
  return item ? NextResponse.json(item) : NextResponse.json({ error: "错题不存在" }, { status: 404 });
}
async function PATCHHandler(req: Request, { params }: Context) {
  try {
    const { id } = await params;
    const body = record(await req.json());
    const item = await prisma.mistakeItem.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: "错题不存在" }, { status: 404 });
    if (body.selfReport !== undefined) {
      if (Object.keys(body).some(key => key !== "selfReport")) throw new InputError("请单独保存卡点与错因");
      const selfReport = parseSelfReport(body.selfReport);
      const updated = await prisma.$transaction(async tx => {
        const current = await tx.mistakeItem.findUniqueOrThrow({ where: { id } });
        let existing: Record<string, unknown> = {};
        try { existing = record(JSON.parse(current.aiAnalysis || "{}")); } catch { existing = { reviewTip: current.aiAnalysis || "" }; }
        return tx.mistakeItem.update({ where: { id }, data: { aiAnalysis: JSON.stringify({ ...existing, selfReport }) }, include: mistakeInclude });
      });
      return NextResponse.json(updated);
    }
    if (item.skillRecordId && body.userWork !== undefined && text(body.userWork, "解题过程") !== (item.userWork || "")) throw new InputError("完整诊断已归档；请使用诊断修订补充解题过程，原始作答不可覆盖");
    const reviewStatus = body.reviewStatus === undefined ? undefined : text(body.reviewStatus, "复习状态", 30);
    if (reviewStatus && !["pending", "reviewing", "mastered"].includes(reviewStatus)) throw new InputError("复习状态不正确");
    const analysis = body.analysis === undefined ? undefined : parseAnalysis(body.analysis);
    const ids = body.nodeIds === undefined ? undefined : Array.isArray(body.nodeIds) && !body.nodeIds.length ? [] : parseNodeIds(body.nodeIds);
    const workUrl = body.userWorkImageUrl === undefined ? undefined : text(body.userWorkImageUrl, "解题图片", 250);
    if (workUrl) await readUploadedImage(workUrl);
    if (item.skillRecordId && workUrl !== undefined && workUrl !== item.userWorkImageUrl) throw new InputError("原始过程已归档，请使用诊断修订");
    let subjectId = body.subjectId === undefined ? item.subjectId : text(body.subjectId, "科目", 100) || null;
    if (item.skillRecordId && subjectId !== item.subjectId) throw new InputError("原始科目已归档，请使用诊断修订");
    if (subjectId && !await prisma.subject.findUnique({ where: { id: subjectId } })) throw new InputError("科目不存在");
    if (item.skillRecordId && ids) {
      const current = await prisma.mistakeItem.findUnique({ where: { id }, include: { linkedNodes: true } });
      const original = (current?.linkedNodes || []).map(n => n.id).sort();
      if (JSON.stringify([...ids].sort()) !== JSON.stringify(original)) throw new InputError("完整诊断已归档；知识点归属需通过诊断修订核对，不能直接改写旧记录");
    }
    if (ids) {
      if (body.confirmed !== true) throw new InputError("请确认关联修改");
      const nodes = await prisma.knowledgeNode.findMany({ where: { id: { in: ids } } });
      if (!subjectId && nodes.length && new Set(nodes.map(n => n.subjectId)).size === 1) subjectId = nodes[0].subjectId;
      if (nodes.length !== ids.length || nodes.some(n => n.subjectId !== subjectId)) throw new InputError("知识点已变更，请重新选择");
    }
    const updated = await prisma.$transaction(async tx => {
    const changesInput = ["title", "source", "userWork", "userWorkImageUrl", "subjectId", "analysis", "nodeIds"].some(k => body[k] !== undefined);
    const reanalyze = body.analysis === undefined && (body.userWork !== undefined || workUrl !== undefined || body.subjectId !== undefined);
    const current = await tx.mistakeItem.findUniqueOrThrow({ where: { id } });
    if (current.inputVersion !== item.inputVersion) throw new InputError("记录已更新，请刷新后重试");
    const version = current.inputVersion + (changesInput ? 1 : 0);
    if (changesInput) {
      await tx.mistakeJob.updateMany({ where: { mistakeId: id }, data: { status: "cancelled", owner: null, leaseUntil: null } });
      if (reanalyze && !item.skillRecordId) await enqueueMistake(tx, id, version);
    }
    const saved = await tx.mistakeItem.update({ where: { id }, data: {
      inputVersion: version, subjectId,
      ...(changesInput ? { processingStatus: reanalyze && !item.skillRecordId ? "queued" : "complete", processingError: null } : {}),
      userWorkImageUrl: workUrl === undefined ? undefined : workUrl || null,
      reviewStatus, reviewedAt: reviewStatus === "mastered" ? new Date() : undefined,
      userNote: body.userNote === undefined ? undefined : text(body.userNote, "我的补充"),
      title: body.title === undefined ? undefined : text(body.title, "题目名称", 180, true),
      source: body.source === undefined ? undefined : text(body.source, "来源", 500),
      userWork: body.userWork === undefined ? undefined : text(body.userWork, "解题过程"),
      aiAnalysis: analysis ? JSON.stringify(preserveSelfReport(analysis, current.aiAnalysis)) : undefined,
      content: analysis ? analysis.question || "见原题图片" : undefined,
      errorReason: analysis?.errorReason,
      linksConfirmed: ids ? true : undefined,
      knowledgeNodeId: ids ? ids[0] || null : subjectId !== item.subjectId ? null : undefined,
      linkedNodes: ids ? { set: ids.map(id => ({ id })) } : subjectId !== item.subjectId ? { set: [] } : undefined,
    }, include: mistakeInclude });
    if (reviewStatus === "mastered") {
      const reviewedIds = [...new Set([...saved.linkedNodes.map(n => n.id), ...(saved.knowledgeNodeId ? [saved.knowledgeNodeId] : [])])];
      await tx.knowledgeNode.updateMany({ where: { id: { in: reviewedIds } }, data: { lastReviewAt: saved.reviewedAt } });
    }
    return saved;
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof InputError ? error.message : "保存失败，请重试" }, { status: error instanceof InputError || error instanceof SyntaxError ? 400 : 500 });
  }
}
async function DELETEHandler(_req: Request, { params }: Context) {
  const id = (await params).id;
  const item = await prisma.mistakeItem.findUnique({ where: { id }, select: { skillRecordId: true } });
  if (item?.skillRecordId) return NextResponse.json({ error: "这道错题含有不可覆盖的 Skill 诊断历史，暂不能直接删除" }, { status: 409 });
  await prisma.mistakeItem.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}

export const GET = withAccess(GETHandler);
export const PATCH = withAccess(PATCHHandler);
export const DELETE = withAccess(DELETEHandler);
