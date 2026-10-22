import { AiBudgetExceeded } from "@/lib/release-controls";
import { withAccess } from "@/lib/request-guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readWordCard } from "@/lib/mistake-skill";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
async function GETHandler(_request: Request, { params }: Context) {
  const { id } = await params;
  const item = await prisma.mistakeItem.findUnique({ where: { id }, select: { skillRecordId: true } });
  if (!item?.skillRecordId) return NextResponse.json({ error: "请先生成完整诊断" }, { status: 404 });
  try {
    const bytes = await readWordCard(item.skillRecordId);
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${item.skillRecordId}-review.docx"`, "Cache-Control": "no-store" } });
  } catch (error) { if (error instanceof AiBudgetExceeded) throw error; return NextResponse.json({ error: "Word 复习卡暂时无法导出，请检查 Skill 的 Python 文档依赖" }, { status: 503 }); }
}

export const GET = withAccess(GETHandler);
