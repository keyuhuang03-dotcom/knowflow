import { partBooks, subjectParts, validateSubjectPart } from "@/lib/subject-parts";
import { withAccess } from "@/lib/request-guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { InputError, record, text } from "@/lib/mistake-contract";
async function PATCHHandler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = record(await req.json());
    if (body.confirmed !== true) throw new InputError("请确认当前目录作为主教材知识骨架");
    const id = (await params).id;
    if (!await prisma.subject.findUnique({ where: { id } })) return NextResponse.json({ error: "科目不存在" }, { status: 404 });
    const textbookTitle = text(body.textbookTitle, "主教材名称", 150, true);
    const part = validateSubjectPart(id, body.part);
    if (subjectParts[id]?.length && !part) throw new InputError("请进入科目页，先选择高数或线代等具体部分再设置教材");
    return NextResponse.json(await prisma.$transaction(async tx => {
      const subject = await tx.subject.findUniqueOrThrow({where:{id}});
      return tx.subject.update({where:{id},data:part ? {partTextbooks:JSON.stringify({...partBooks(subject.partTextbooks),[part]:textbookTitle})} : {textbookTitle}});
    }));
  } catch (error) { return NextResponse.json({ error: error instanceof InputError ? error.message : "更新失败，请重试" }, { status: error instanceof InputError ? 400 : 500 }); }
}

export const PATCH = withAccess(PATCHHandler);
