import { catalogRecognitionPrompt, decodeCatalogRecognition } from "@/lib/catalog-recognition";
import { AiBudgetExceeded } from "@/lib/release-controls";
import { reserveAiUsage } from "@/lib/release-controls";
import { withAccess } from "@/lib/request-guard";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { InputError, record, text } from "@/lib/mistake-contract";
import { readUploadedImage } from "@/lib/mistake-files";
import { importCatalog, parseCatalogEntries, catalogWarnings, CatalogConflict } from "@/lib/textbook-catalog";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
async function POSTHandler(req: Request, { params }: Context) {
  try {
    const id = (await params).id;
    if (!await prisma.subject.findUnique({ where: { id } })) return NextResponse.json({ error: "科目不存在" }, { status: 404 });
    const body = record(await req.json());
    if (!Array.isArray(body.images) || !body.images.length || body.images.length > 6) throw new InputError("请上传 1～6 张目录照片");
    if (!process.env.MISTAKE_AI_API_KEY || !process.env.MISTAKE_AI_MODEL) return NextResponse.json({ error: "尚未配置图片识别服务" }, { status: 503 });
    const images = await Promise.all(body.images.map(url => readUploadedImage(url)));
    if (images.reduce((sum, image) => sum + image.bytes.length, 0) > 24 * 1024 * 1024) throw new InputError("目录图片总大小超过24MB，请分批识别");
    const baseURL = process.env.MISTAKE_AI_BASE_URL || "https://api.openai.com/v1";
    const client = new OpenAI({ apiKey: process.env.MISTAKE_AI_API_KEY, baseURL, timeout: 90000, maxRetries: 0 });
    await reserveAiUsage();
    const response = await client.chat.completions.create({
      model: process.env.MISTAKE_AI_MODEL,
      ...(new URL(baseURL).hostname === "api.deepseek.com" ? { reasoning_effort: "none" as const } : {}),
      response_format: { type: "json_object" }, max_tokens: 12000,
      messages: [
        { role: "system", content: catalogRecognitionPrompt },
        { role: "user", content: images.flatMap((image, i) => [{ type: "text" as const, text: `目录照片第 ${i + 1}/${images.length} 页，按此顺序衔接。` }, { type: "image_url" as const, image_url: { url: `data:${image.type};base64,${image.bytes.toString("base64")}`, detail: "high" as const } }]) },
      ],
    });
    if (response.choices[0]?.finish_reason === "length") return NextResponse.json({ error: "目录较长，结果不完整。请减少到 1～2 页后分批识别。照片仍保留。" }, { status: 422 });
    const raw = record(JSON.parse(response.choices[0]?.message.content || "{}"));
    if ((Array.isArray(raw.items) && !raw.items.length) || (Array.isArray(raw.entries) && !raw.entries.length)) return NextResponse.json({ error: "未识别到可用目录，请检查照片是否清晰、方向正确。" }, { status: 422 });
    const entries = decodeCatalogRecognition(raw);
    return NextResponse.json({ entries, warnings: [...catalogWarnings(entries), ...(Array.isArray(raw.warnings) ? raw.warnings.filter((v): v is string => typeof v === "string").slice(0, 20).map(v => v.slice(0, 500)) : [])] });
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
    return NextResponse.json(await importCatalog((await params).id, text(body.textbookTitle, "教材名称", 150, true), parseCatalogEntries(body.entries), { mode, dryRun, part: body.part as string | undefined, revision: body.revision === undefined ? undefined : text(body.revision, "目录版本", 64, true) }));
  } catch (error) { if (error instanceof AiBudgetExceeded) throw error; return NextResponse.json({ error: error instanceof InputError ? error.message : "目录保存失败，预览仍保留，请重试。" }, { status: error instanceof CatalogConflict ? 409 : error instanceof InputError ? 400 : 500 }); }
}

export const POST = withAccess(POSTHandler);
export const PUT = withAccess(PUTHandler);
