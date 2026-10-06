import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { InputError, record, text } from "@/lib/mistake-contract";
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = record(await req.json());
    if (body.confirmed !== true) throw new InputError("请确认当前目录作为主教材知识骨架");
    const id = (await params).id;
    if (!await prisma.subject.findUnique({ where: { id } })) return NextResponse.json({ error: "科目不存在" }, { status: 404 });
    const textbookTitle = text(body.textbookTitle, "主教材名称", 150, true);
    return NextResponse.json(await prisma.subject.update({ where: { id }, data: { textbookTitle } }));
  } catch (error) { return NextResponse.json({ error: error instanceof InputError ? error.message : "更新失败，请重试" }, { status: error instanceof InputError ? 400 : 500 }); }
}
