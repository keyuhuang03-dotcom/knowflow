import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { InputError, parseAnalysis, parseNodeIds, record, text } from "@/lib/mistake-contract";
import { mistakeInclude } from "@/lib/mistake-service";
type Context = { params: Promise<{ id: string }> };
export async function GET(_req: Request, { params }: Context) {
  const item = await prisma.mistakeItem.findUnique({ where: { id: (await params).id }, include: mistakeInclude });
  return item ? NextResponse.json(item) : NextResponse.json({ error: "错题不存在" }, { status: 404 });
}
export async function PATCH(req: Request, { params }: Context) {
  try {
    const { id } = await params;
    const body = record(await req.json());
    const item = await prisma.mistakeItem.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ error: "错题不存在" }, { status: 404 });
    if (item.skillRecordId && body.userWork !== undefined && text(body.userWork, "解题过程") !== (item.userWork || "")) throw new InputError("完整诊断已归档；请使用诊断修订补充解题过程，原始作答不可覆盖");
    const reviewStatus = body.reviewStatus === undefined ? undefined : text(body.reviewStatus, "复习状态", 30);
    if (reviewStatus && !["pending", "reviewing", "mastered"].includes(reviewStatus)) throw new InputError("复习状态不正确");
    const analysis = body.analysis === undefined ? undefined : parseAnalysis(body.analysis);
    const ids = body.nodeIds === undefined ? undefined : parseNodeIds(body.nodeIds);
    if (item.skillRecordId && ids) {
      const current = await prisma.mistakeItem.findUnique({ where: { id }, include: { linkedNodes: true } });
      const original = (current?.linkedNodes || []).map(n => n.id).sort();
      if (JSON.stringify([...ids].sort()) !== JSON.stringify(original)) throw new InputError("完整诊断已归档；知识点归属需通过诊断修订核对，不能直接改写旧记录");
    }
    if (ids) {
      if (body.confirmed !== true) throw new InputError("请确认关联修改");
      const count = await prisma.knowledgeNode.count({ where: { id: { in: ids }, subjectId: item.subjectId } });
      if (count !== ids.length) throw new InputError("知识点已变更，请重新选择");
    }
    const updated = await prisma.$transaction(async tx => {
    const saved = await tx.mistakeItem.update({ where: { id }, data: {
      reviewStatus, reviewedAt: reviewStatus === "mastered" ? new Date() : undefined,
      userNote: body.userNote === undefined ? undefined : text(body.userNote, "我的补充"),
      title: body.title === undefined ? undefined : text(body.title, "题目名称", 180, true),
      source: body.source === undefined ? undefined : text(body.source, "来源", 500),
      userWork: body.userWork === undefined ? undefined : text(body.userWork, "解题过程"),
      aiAnalysis: analysis ? JSON.stringify(analysis) : undefined,
      content: analysis ? analysis.question || "见原题图片" : undefined,
      errorReason: analysis?.errorReason,
      knowledgeNodeId: ids?.[0], linkedNodes: ids ? { set: ids.map(id => ({ id })) } : undefined,
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
export async function DELETE(_req: Request, { params }: Context) {
  const id = (await params).id;
  const item = await prisma.mistakeItem.findUnique({ where: { id }, select: { skillRecordId: true } });
  if (item?.skillRecordId) return NextResponse.json({ error: "这道错题含有不可覆盖的 Skill 诊断历史，暂不能直接删除" }, { status: 409 });
  await prisma.mistakeItem.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
