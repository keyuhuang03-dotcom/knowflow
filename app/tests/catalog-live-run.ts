// Opt-in: sends generated, non-personal catalog images to the configured provider.
import { loadEnvConfig } from "@next/env";
import OpenAI from "openai";
import sharp from "sharp";
import assert from "node:assert/strict";
import { catalogRecognitionPrompt, decodeCatalogRecognition } from "../src/lib/catalog-recognition";


async function main() {
  if (process.env.KNOWFLOW_RUN_LIVE_AI !== "1") throw new Error("Live test requires explicit opt-in");
  loadEnvConfig(process.cwd());
  const model = process.env.MISTAKE_AI_MODEL, apiKey = process.env.MISTAKE_AI_API_KEY;
  if (!model || !apiKey) throw new Error("Image provider is not configured");
  const pages = [
    [["第一章 函数", 1, 0], ["1.1 映射", 3, 1], ["1.1.1 定义", 4, 2], ["1.2 复合函数", 8, 1], ["第二章 极限", 21, 0], ["2.1 数列极限", 22, 1], ["2.2 函数极限", 26, 1]],
    [["2.3 连续性", 32, 1], ["第三章 导数", 41, 0], ["3.1 导数定义", 42, 1]],
  ] as const;
  const images = await Promise.all(pages.map(async rows => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1100"><rect width="100%" height="100%" fill="white"/><g fill="black" font-family="PingFang SC, sans-serif" font-size="32"><text x="480" y="80">目录</text>${rows.map(([title, page, depth], i) => `<text x="${80 + depth * 42}" y="${170 + i * 100}" font-weight="${depth === 0 ? 600 : 400}">${title}</text><text x="900" y="${170 + i * 100}">${page}</text>`).join("")}</g></svg>`;
    return (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
  }));
  const baseURL = process.env.MISTAKE_AI_BASE_URL || "https://api.openai.com/v1";
  const client = new OpenAI({ apiKey, baseURL, timeout: 30000, maxRetries: 0 });
  const start = Date.now();
  const result = await client.chat.completions.create({
    model, response_format: { type: "json_object" }, max_tokens: 6000,
    ...(new URL(baseURL).hostname === "api.deepseek.com" ? { reasoning_effort: "none" as const } : {}),
    messages: [
      { role: "system", content: catalogRecognitionPrompt },
      { role: "user", content: images.flatMap((image, i) => [
        { type: "text" as const, text: `目录照片第 ${i + 1}/2 页，按此顺序衔接。` },
        { type: "image_url" as const, image_url: { url: `data:image/png;base64,${image}`, detail: "high" as const } },
      ]) },
    ],
  });
  assert.notEqual(result.choices[0]?.finish_reason, "length");
  const entries = decodeCatalogRecognition(JSON.parse(result.choices[0]?.message.content || "{}"));
  let chapter = "", section = "";
  const expected = pages.flatMap(rows => rows.map(([title, page, depth]) => {
    if (depth === 0) { chapter = title; section = ""; }
    if (depth === 1) section = title;
    return { path: depth === 0 ? [title] : depth === 1 ? [chapter, title] : [chapter, section, title], page };
  }));
  for (const item of expected) assert.ok(entries.some(e => JSON.stringify(e.path) === JSON.stringify(item.path) && e.page === item.page), `Incorrect title, hierarchy or page: ${item.path.join(" / ")}`);
  assert.equal(entries.length, expected.length);
  console.log(`PASS live synthetic two-page catalog: ${entries.length} exact titles, paths and pages; cross-page continuation; ${Math.round((Date.now() - start) / 1000)}s. Not a real-photo accuracy benchmark.`);
}
main().catch(e => {
  console.error(e instanceof assert.AssertionError ? e.message : "Live check failed; check provider connectivity/configuration. No credentials logged.");
  process.exitCode = 1;
});
