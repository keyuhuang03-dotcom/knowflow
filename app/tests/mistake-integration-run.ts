import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { saveConfirmedMistake } from "../src/lib/mistake-service";
import { emptyAnalysis } from "../src/lib/mistake-contract";
import { uploadRoot } from "../src/lib/mistake-files";
import { PATCH } from "../src/app/api/mistakes/[id]/route";
import { POST as analyze } from "../src/app/api/ai/analyze-mistake/route";
import { createServer } from "node:http";
import { once } from "node:events";
import { POST as upload } from "../src/app/api/upload/route";
import { GET as serveUpload } from "../src/app/uploads/[filename]/route";
async function main() {
  const name = `${randomUUID()}.png`;
  await mkdir(uploadRoot(), { recursive: true });
  const file = path.join(uploadRoot(), name);
  await writeFile(file, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/9sAAAAASUVORK5CYII=", "base64"));
  try {
    const uploadRequest = (purpose: string) => {
      const form = new FormData();
      form.append("file", new File(["%PDF-1.4\nTest-only document"], "note.pdf", { type: "application/pdf" }));
      if (purpose) form.append("purpose", purpose);
      return new Request("http://localhost/api/upload", { method: "POST", body: form });
    };
    assert.equal((await upload(uploadRequest("mistake"))).status, 400, "mistake intake must reject documents");
    const noteUpload = await upload(uploadRequest(""));
    assert.equal(noteUpload.status, 200, "legacy notes still support PDFs");
    const noteAsset = await noteUpload.json();
    const noteFilename = path.basename(noteAsset.url);
    try {
      const served = await serveUpload(new Request("http://localhost"), { params: Promise.resolve({ filename: noteFilename }) });
      assert.equal(served.status, 200);
      assert.match(served.headers.get("Content-Disposition") || "", /attachment/);
    } finally { await unlink(path.join(uploadRoot(), noteFilename)); }
    assert.equal((await serveUpload(new Request("http://localhost"), { params: Promise.resolve({ filename: "../../.env" }) })).status, 404);
    await prisma.subject.createMany({ data: [{ id: "math", name: "数学", textbookTitle: "测试主教材" }, { id: "english", name: "英语" }] });
    await prisma.knowledgeNode.createMany({ data: [{ id: "limit", name: "极限", subjectId: "math" }, { id: "equivalent", name: "等价无穷小", subjectId: "math" }, { id: "foreign", name: "阅读", subjectId: "english" }] });
    const body = { id: randomUUID(), subjectId: "math", title: "极限题", imageUrl: `/uploads/${name}`, nodeIds: ["limit", "equivalent"], confirmed: true, source: "习题册 第18题", userWork: "相减时直接替换", analysis: { ...emptyAnalysis, coreConcept: "极限", reviewTip: "先检查相减后的高阶项" } };
    for (const invalid of [{ confirmed: false }, { nodeIds: [] }, { nodeIds: ["foreign"] }, { nodeIds: ["invented"] }, { imageUrl: "/uploads/../../secret.png" }]) await assert.rejects(saveConfirmedMistake({ ...body, ...invalid }));
    assert.equal(await prisma.mistakeItem.count(), 0);
    const saved = await saveConfirmedMistake(body);
    assert.equal(saved.linkedNodes.length, 2);
    assert.equal(saved.source, body.source);
    assert.equal(saved.knowledgeNodeId, "limit");
    assert.equal((await saveConfirmedMistake(body)).id, saved.id);
    assert.equal(await prisma.mistakeItem.count(), 1);
    for (const id of body.nodeIds) assert.equal(await prisma.mistakeItem.count({ where: { OR: [{ knowledgeNodeId: id }, { linkedNodes: { some: { id } } }] } }), 1);
    const request = (value: unknown) => new Request("http://localhost/api/mistakes/id", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
    const ctx = { params: Promise.resolve({ id: saved.id }) };
    assert.equal((await PATCH(request({ nodeIds: ["foreign"], confirmed: true }), ctx)).status, 400);
    assert.equal((await PATCH(request({ nodeIds: ["equivalent"] }), ctx)).status, 400);
    assert.equal((await PATCH(request({ reviewStatus: "invalid" }), ctx)).status, 400);
    assert.equal((await PATCH(request({ nodeIds: ["equivalent"], confirmed: true, userNote: "我的补充", reviewStatus: "mastered" }), ctx)).status, 200);
    const updated = await prisma.mistakeItem.findUniqueOrThrow({ where: { id: saved.id }, include: { linkedNodes: true } });
    assert.deepEqual(updated.linkedNodes.map(n => n.id), ["equivalent"]);
    assert.equal(updated.knowledgeNodeId, "equivalent");
    assert.equal(updated.userNote, "我的补充"); assert.ok(updated.reviewedAt);
    assert.ok((await prisma.knowledgeNode.findUniqueOrThrow({ where: { id: "equivalent" } })).lastReviewAt);
    assert.equal(await prisma.mistakeItem.count({ where: { OR: [{ knowledgeNodeId: "limit" }, { linkedNodes: { some: { id: "limit" } } }] } }), 0);
    delete process.env.MISTAKE_AI_API_KEY;
    assert.equal((await analyze(new Request("http://localhost/api/ai/analyze-mistake", { method: "POST", body: JSON.stringify(body) }))).status, 503);
    // A local provider fixture validates the real adapter without paid/external AI.
    let receivedImage = false;
    const provider = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      receivedImage = Buffer.concat(chunks).toString().includes("data:image/png;base64,");
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ analysis: { ...emptyAnalysis, question: "测试题", coreConcept: "极限" }, recommendations: [{ nodeId: "limit", reason: "本地测试返回" }, { nodeId: "foreign" }, { nodeId: "invented" }, { nodeId: "limit" }] }) } }] }));
    });
    provider.listen(0, "127.0.0.1"); await once(provider, "listening");
    const address = provider.address();
    assert.ok(address && typeof address === "object");
    process.env.MISTAKE_AI_API_KEY = "local-test-only";
    process.env.MISTAKE_AI_MODEL = "fixture-model";
    process.env.MISTAKE_AI_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
    try {
      const result = await analyze(new Request("http://localhost/api/ai/analyze-mistake", { method: "POST", body: JSON.stringify(body) }));
      assert.equal(result.status, 200);
      const data = await result.json();
      assert.equal(data.analysis.origin, "ai");
      assert.deepEqual(data.recommendations.map((r: { nodeId: string }) => r.nodeId), ["limit"]);
      assert.ok(receivedImage);
    } finally { provider.close(); provider.closeAllConnections(); }
    assert.equal(await prisma.knowledgeNode.count(), 3, "AI must never create a node");
  } finally { await unlink(file); await prisma.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
