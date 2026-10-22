import { record, text } from "@/lib/mistake-contract";
import { existingNodes } from "@/lib/input-validation";
import { withAccess } from "@/lib/request-guard";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function GETHandler(_req: Request) {
  void _req;
  const notes = await prisma.note.findMany({
    include: { knowledgeNodes: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(notes);
}

async function POSTHandler(req: NextRequest) {
  const body = record(await req.json());
  const title = body.title === undefined ? undefined : text(body.title, "笔记标题", 180);
  const content = body.content === undefined ? undefined : text(body.content, "笔记内容", 100000);
  const tags = body.tags === undefined ? undefined : body.tags === null ? null : text(body.tags, "标签", 1000);
  const knowledgeNodeIds = body.knowledgeNodeIds === undefined ? undefined : await existingNodes(body.knowledgeNodeIds);
  const note = await prisma.note.create({
    data: {
      title: title || "未命名笔记",
      content: content || "",
      tags,
      ...(knowledgeNodeIds && knowledgeNodeIds.length > 0 && {
        knowledgeNodes: {
          connect: knowledgeNodeIds.map((id: string) => ({ id })),
        },
      }),
    },
    include: { knowledgeNodes: { select: { id: true, name: true } } },
  });
  return NextResponse.json(note);
}

export const GET = withAccess(GETHandler);
export const POST = withAccess(POSTHandler);
