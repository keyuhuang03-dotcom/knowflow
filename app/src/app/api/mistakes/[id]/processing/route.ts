import { withAccess } from "@/lib/request-guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueMistake } from "@/lib/mistake-queue";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
async function GETHandler(_request: Request, { params }: Context) {
  const item = await prisma.mistakeItem.findUnique({ where: { id: (await params).id }, include: { job: true } });
  if (!item) return NextResponse.json({ error: "错题不存在" }, { status: 404 });
  return NextResponse.json({ id: item.id, status: item.processingStatus, error: item.processingError, attempts: item.job?.attempts || 0, maxAttempts: item.job?.maxAttempts || 3, updatedAt: item.updatedAt, imageUrl: item.imageUrl }, { headers: { "Cache-Control": "no-store" } });
}
async function POSTHandler(_request: Request, { params }: Context) {
  const id = (await params).id;
  const result = await prisma.$transaction(async tx => {
    const item = await tx.mistakeItem.findUnique({ where: { id }, include: { job: true } });
    if (!item) return "missing";
    if (item.skillRecordId) return "archived";
    if (item.job && ["queued", "running"].includes(item.job.status)) return "active";
    const version = item.inputVersion + 1;
    await tx.mistakeItem.update({ where: { id }, data: { inputVersion: version, processingStatus: "queued", processingError: null } });
    await enqueueMistake(tx, id, version);
    return "queued";
  });
  if (result === "missing") return NextResponse.json({ error: "错题不存在" }, { status: 404 });
  if (result === "archived") return NextResponse.json({ error: "完整诊断已归档，请通过修订纠正。" }, { status: 409 });
  return NextResponse.json({ status: result === "active" ? "active" : "queued" });
}

export const GET = withAccess(GETHandler);
export const POST = withAccess(POSTHandler);
