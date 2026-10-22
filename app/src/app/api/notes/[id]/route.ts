import { record, text } from "@/lib/mistake-contract";
import { existingNodes } from "@/lib/input-validation";
import { withAccess } from "@/lib/request-guard";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function PATCHHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = record(await req.json());
  const title = body.title === undefined ? undefined : text(body.title, "笔记标题", 180);
  const content = body.content === undefined ? undefined : text(body.content, "笔记内容", 100000);
  const tags = body.tags === undefined ? undefined : body.tags === null ? null : text(body.tags, "标签", 1000);
  const knowledgeNodeIds = body.knowledgeNodeIds === undefined ? undefined : await existingNodes(body.knowledgeNodeIds);

  // If knowledgeNodeIds provided, set the connections (replace all)
  const note = await prisma.note.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(tags !== undefined && { tags }),
      ...(knowledgeNodeIds !== undefined && {
        knowledgeNodes: { set: knowledgeNodeIds.map((kid: string) => ({ id: kid })) },
      }),
    },
    include: { knowledgeNodes: { select: { id: true, name: true } } },
  });
  return NextResponse.json(note);
}

async function DELETEHandler(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.note.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export const PATCH = withAccess(PATCHHandler);
export const DELETE = withAccess(DELETEHandler);
