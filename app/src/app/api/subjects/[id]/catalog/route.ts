import { recognizeCatalogPage } from "@/lib/catalog-ai";
import { catalogJobView, startCatalogJob } from "@/lib/catalog-jobs";
import { validateSubjectPart } from "@/lib/subject-parts";
import { AiBudgetExceeded } from "@/lib/release-controls";
import { withAccess } from "@/lib/request-guard";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { InputError, record, text } from "@/lib/mistake-contract";
import { importCatalog, parseCatalogEntries, CatalogConflict } from "@/lib/textbook-catalog";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
async function POSTHandler(req: Request, { params }: Context) {
  try {
    const id = (await params).id;
    if (!await prisma.subject.findUnique({ where: { id } })) return NextResponse.json({ error: "科目不存在" }, { status: 404 });
    const body = record(await req.json());
    if (body.background === true) return NextResponse.json(await startCatalogJob(id, body.part, body.images, body.retryJobId), { status: 202 });
    if (!Array.isArray(body.images) || !body.images.length || body.images.length > 6) throw new InputError("请上传 1～6 张目录照片");
    if (!process.env.MISTAKE_AI_API_KEY || !process.env.MISTAKE_AI_MODEL) return NextResponse.json({ error: "尚未配置图片识别服务" }, { status: 503 });
    return NextResponse.json(await recognizeCatalogPage(body.images));
  } catch (error) { if (error instanceof AiBudgetExceeded) throw error; return NextResponse.json({ error: error instanceof InputError ? error.message : "目录识别暂时失败，照片已保留，可重新识别。" }, { status: error instanceof InputError ? 400 : 502 }); }
}
async function PUTHandler(req: Request, { params }: Context) {
  try {
    const body = record(await req.json());
    const mode = body.mode === undefined ? "append" : body.mode;
    if (mode !== "append" && mode !== "replace") throw new InputError("请选择追加或替换模式");
    const dryRun = body.dryRun === true;
    if (!dryRun && body.confirmed !== true) throw new InputError("请先核对目录并确认保存");
    if (!dryRun && mode === "replace" && body.replaceConfirmed !== true) throw new InputError("替换前请确认旧目录将移入历史目录");
    return NextResponse.json(await importCatalog((await params).id, text(body.textbookTitle, "教材名称", 150, true), parseCatalogEntries(body.entries), { mode, dryRun, part: body.part as string | undefined, jobId: body.jobId === undefined ? undefined : text(body.jobId, "目录任务", 100, true), revision: body.revision === undefined ? undefined : text(body.revision, "目录版本", 64, true) }));
  } catch (error) { if (error instanceof AiBudgetExceeded) throw error; return NextResponse.json({ error: error instanceof InputError ? error.message : "目录保存失败，预览仍保留，请重试。" }, { status: error instanceof CatalogConflict ? 409 : error instanceof InputError ? 400 : 500 }); }
}

export const POST = withAccess(POSTHandler);
export const PUT = withAccess(PUTHandler);

async function GETHandler(req: Request, { params }: Context) {
  try {
    const subjectId = (await params).id;
    const part = validateSubjectPart(subjectId, new URL(req.url).searchParams.get("part")) || "";
    const job = await prisma.catalogJob.findFirst({ where: { subjectId, part }, orderBy: { createdAt: "desc" } });
    return NextResponse.json(job ? catalogJobView(job) : null, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof InputError ? error.message : "暂时无法读取识别进度" }, { status: error instanceof InputError ? 400 : 500 }); }
}
export const GET = withAccess(GETHandler);

async function DELETEHandler(req: Request, { params }: Context) {
  const subjectId = (await params).id;
  const url = new URL(req.url);
  const part = validateSubjectPart(subjectId, url.searchParams.get("part")) || "";
  await prisma.catalogJob.updateMany({ where: { id: url.searchParams.get("jobId") || "", subjectId, part, status: { in: ["queued", "running", "ready", "failed"] } }, data: { status: "discarded", owner: null, leaseUntil: null } });
  return NextResponse.json({ status: "discarded" });
}
export const DELETE = withAccess(DELETEHandler);
