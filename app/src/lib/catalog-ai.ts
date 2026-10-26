import OpenAI from "openai";
import { catalogRecognitionPrompt, decodeCatalogRecognition } from "./catalog-recognition";
import { catalogWarnings, type CatalogEntry } from "./textbook-catalog";
import { InputError, record } from "./mistake-contract";
import { readUploadedImage } from "./mistake-files";
import { reserveAiUsage } from "./release-controls";
export async function recognizeCatalogPage(urls: string[], previous: CatalogEntry[] = []) {
  if (!process.env.MISTAKE_AI_API_KEY || !process.env.MISTAKE_AI_MODEL) throw new InputError("尚未配置图片识别服务");
  const images = await Promise.all(urls.map(url => readUploadedImage(url)));
  if (images.reduce((sum, image) => sum + image.bytes.length, 0) > 24 * 1024 * 1024) throw new InputError("目录图片总大小超过24MB，请分批识别");
  const baseURL = process.env.MISTAKE_AI_BASE_URL || "https://api.openai.com/v1";
  const client = new OpenAI({ apiKey: process.env.MISTAKE_AI_API_KEY, baseURL, timeout: 45000, maxRetries: 0 });
  await reserveAiUsage();
  const continuation = previous.at(-1)?.path || [];
  const response = await client.chat.completions.create({
    model: process.env.MISTAKE_AI_MODEL,
    ...(new URL(baseURL).hostname === "api.deepseek.com" ? { reasoning_effort: "none" as const } : {}),
    response_format: { type: "json_object" }, max_tokens: urls.length === 1 ? 6000 : 12000,
    messages: [
      { role: "system", content: catalogRecognitionPrompt + (previous.length ? `\n本次接续上一页，上一页最后一项完整路径为${JSON.stringify(continuation)}。depth沿用该层级（可从第2层等开始）；若新章则depth=1。只返回本页条目，不重述前页内容。` : "") },
      { role: "user", content: images.flatMap((image, i) => [{ type: "text" as const, text: `目录照片第 ${i + 1}/${images.length} 页。` }, { type: "image_url" as const, image_url: { url: `data:${image.type};base64,${image.bytes.toString("base64")}`, detail: "high" as const } }]) },
    ],
  });
  if (response.choices[0]?.finish_reason === "length") throw new InputError("本页目录过密、识别结果被截断，请裁剪为较小区域后重新上传；已完成页保留。");
  const raw = record(JSON.parse(response.choices[0]?.message.content || "{}"));
  const entries = decodeCatalogRecognition(raw, continuation);
  return { entries, warnings: [...catalogWarnings(entries), ...(Array.isArray(raw.warnings) ? raw.warnings.filter((v): v is string => typeof v === "string").slice(0, 20).map(v => v.slice(0, 500)) : [])] };
}
