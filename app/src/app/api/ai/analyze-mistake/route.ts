import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AIUnavailable, analyzeUploadedMistake } from "@/lib/mistake-ai";
import { InputError, nodePath, record, text } from "@/lib/mistake-contract";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = record(await request.json());
    const subjectId = text(body.subjectId, "科目", 100, true);
    const subject = await prisma.subject.findUnique({ where: { id: subjectId }, include: { knowledgeNodes: { include: { chapter: true } } } });
    if (!subject?.textbookTitle || !subject.knowledgeNodes.length) throw new InputError("请先确认主教材和知识目录");
    return NextResponse.json(await analyzeUploadedMistake({
      imageUrl: text(body.imageUrl, "原题图片", 250, true), userWorkImageUrl: text(body.userWorkImageUrl, "解题图片", 250),
      userWork: text(body.userWork, "解题过程"), source: text(body.source, "来源", 500), subject: subject.name, textbook: subject.textbookTitle,
      candidates: subject.knowledgeNodes.map(n => ({ id: n.id, name: n.name, path: nodePath(n, subject.knowledgeNodes, subject.name) })),
    }));
  } catch (error) {
    const expected = error instanceof InputError || error instanceof AIUnavailable;
    return NextResponse.json({ error: expected ? error.message : "AI 分析暂时失败，原图与草稿已保留。请重试，或手动补充后继续。" }, { status: error instanceof InputError || error instanceof SyntaxError ? 400 : error instanceof AIUnavailable ? 503 : 502 });
  }
}
