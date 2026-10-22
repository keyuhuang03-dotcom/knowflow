import { InputError, record, text } from "@/lib/mistake-contract";
import { dateValue, integer, choice, nodeStatuses } from "@/lib/input-validation";
import { withAccess } from "@/lib/request-guard";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function PATCHHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = record(await req.json());
  return prisma.$transaction(async tx => {
  const current = await tx.knowledgeNode.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "知识点不存在" }, { status: 404 });
  if (body.chapterId !== undefined && body.chapterId !== null) {
    const chapter = await tx.chapter.findUnique({ where: { id: text(body.chapterId, "章节", 128, true) } });
    if (!chapter || chapter.subjectId !== current.subjectId) throw new InputError("章节不属于当前科目");
  }
  const pageStart = body.pageStart === undefined ? current.pageStart : body.pageStart === null ? null : integer(body.pageStart, "起始页", 0, 100000);
  const pageEnd = body.pageEnd === undefined ? current.pageEnd : body.pageEnd === null ? null : integer(body.pageEnd, "结束页", 0, 100000);
  if (pageStart !== null && pageEnd !== null && pageStart > pageEnd) throw new InputError("起始页不能大于结束页");

  const node = await tx.knowledgeNode.update({
    where: { id },
    data: {
      name: body.name === undefined ? undefined : text(body.name, "知识点名称", 180, true),
      masteryLevel: body.masteryLevel === undefined ? undefined : integer(body.masteryLevel, "掌握程度", 0, 5),
      status: body.status === undefined ? undefined : choice(body.status, "学习状态", nodeStatuses),
      tags: body.tags === undefined ? undefined : body.tags === null ? null : text(body.tags, "标签", 1000),
      pageStart: body.pageStart === undefined ? undefined : pageStart,
      pageEnd: body.pageEnd === undefined ? undefined : pageEnd,
      description: body.description === undefined ? undefined : body.description === null ? null : text(body.description, "个人理解", 100000),
      chapterId: body.chapterId === undefined ? undefined : body.chapterId === null ? null : text(body.chapterId, "章节", 128, true),
      lastReviewAt: body.lastReviewAt === undefined ? undefined : body.lastReviewAt === null ? null : dateValue(body.lastReviewAt, "复习日期"),
    },
  });

  return NextResponse.json(node);
  });
}

// Add relation with note
async function POSTHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const noteId = text(record(await req.json()).noteId, "笔记编号", 128, true);

  await prisma.knowledgeNode.update({
    where: { id },
    data: {
      notes: { connect: { id: noteId } },
    },
  });

  return NextResponse.json({ ok: true });
}

// Remove relation with note
async function DELETEHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const noteId = text(body.noteId, "笔记编号", 128, true);

  if (!noteId) {
    return NextResponse.json({ error: "noteId required" }, { status: 400 });
  }

  await prisma.knowledgeNode.update({
    where: { id },
    data: {
      notes: { disconnect: { id: noteId } },
    },
  });

  return NextResponse.json({ ok: true });
}

export const PATCH = withAccess(PATCHHandler);
export const POST = withAccess(POSTHandler);
export const DELETE = withAccess(DELETEHandler);
