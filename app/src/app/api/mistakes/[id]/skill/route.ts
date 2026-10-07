import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { InputError, record, text } from "@/lib/mistake-contract";
import { createSkillRecord, loadSkillSource, reviseSkillRecord } from "@/lib/mistake-skill";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const body = record(await request.json());
    const item = await loadSkillSource(id);
    if (!item) return NextResponse.json({ error: "错题不存在" }, { status: 404 });
    if (body.action === "create") {
      if (item.skillRecordId) return NextResponse.json({ id: item.skillRecordId, created: false, wordReady: true });
      const result = await createSkillRecord(item);
      await prisma.mistakeItem.update({ where: { id }, data: { skillRecordId: result.id } });
      return NextResponse.json(result);
    }
    if (body.action === "revise") {
      const correction = text(body.correction, "诊断纠正", 4000, true);
      return NextResponse.json(await reviseSkillRecord(item, correction));
    }
    throw new InputError("操作不正确");
  } catch (error) {
    return NextResponse.json({ error: error instanceof InputError ? error.message : error instanceof Error ? error.message : "Skill 处理失败，请重试" }, { status: error instanceof InputError || error instanceof SyntaxError ? 400 : 500 });
  }
}
