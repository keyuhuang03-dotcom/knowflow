import { POST as recognizeCatalog, PUT as confirmCatalog } from "../src/app/api/subjects/[id]/catalog/route";
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
    let unclear = false;
    const provider = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks).toString();
      const system = JSON.parse(body).messages[0].content;
      const reading = system.startsWith("你只做精确");
      if (system.startsWith("只转录教材目录")) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ entries: [{ path: ["第一章", "第一节"], page: 3 }, { path: ["第一章", "第一节"], page: 3 }, { path: ["第一章", "第二节"], page: null }], warnings: ["页码需校对"] }) } }] })); return; }
      receivedImage ||= body.includes("data:image/png;base64,");
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reading ? { rotation: 0, recognition: unclear ? "uncertain" : "clear", questionCount: 1, question: "测试题", studentWork: "", uncertainty: unclear ? "公式不清" : "" } : { analysis: { ...emptyAnalysis, recognition: unclear ? "uncertain" : "clear", diagnosisStatus: "confirmed", question: "测试题", coreConcept: "极限", stickingPoint: "学生不会", errorReason: "粗心" }, recommendations: [{ nodeId: "limit", reason: "本地测试返回" }, { nodeId: "foreign" }, { nodeId: "invented" }, { nodeId: "limit" }] }) } }] }));
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
      assert.equal(data.analysis.diagnosisStatus, "unconfirmed", "provider cannot confirm on the user's behalf");
      const noWork = await (await analyze(new Request("http://localhost/api/ai/analyze-mistake", { method: "POST", body: JSON.stringify({ ...body, userWork: "" }) }))).json();
      assert.match(noWork.analysis.errorReason, /无法判断/);
      unclear = true;
      const uncertain = await (await analyze(new Request("http://localhost/api/ai/analyze-mistake", { method: "POST", body: JSON.stringify(body) }))).json();
      assert.equal(uncertain.analysis.recognition, "uncertain");
      assert.deepEqual(uncertain.recommendations, []);
      const catalogContext = { params: Promise.resolve({ id: "math" }) };
      const previewResponse = await recognizeCatalog(request({ images: [`/uploads/${name}`] }), catalogContext);
      assert.equal(previewResponse.status, 200);
      const preview = await previewResponse.json();
      assert.equal(preview.entries.length, 2, "duplicate full paths removed");
      assert.equal(await prisma.knowledgeNode.count(), 3, "recognition alone does not mutate the skeleton");
      assert.equal((await confirmCatalog(request({ textbookTitle: "测试主教材", entries: preview.entries }), catalogContext)).status, 400, "confirmation required");
      const linksBeforeImport = (await prisma.mistakeItem.findUniqueOrThrow({ where: { id: saved.id }, include: { linkedNodes: true } })).linkedNodes.map(n => n.id).sort();
      const countMistakes = await prisma.mistakeItem.count();
      const catalogSave = { textbookTitle: "测试主教材", entries: preview.entries, confirmed: true };
      assert.equal((await confirmCatalog(request({ ...catalogSave, textbookTitle: "另一本教材" }), catalogContext)).status, 400);
      assert.equal((await (await confirmCatalog(request(catalogSave), catalogContext)).json()).created, 3);
      assert.equal((await (await confirmCatalog(request(catalogSave), catalogContext)).json()).created, 0, "repeat import reuses the full path");
      assert.equal(await prisma.mistakeItem.count(), countMistakes);
      const leaf = await prisma.knowledgeNode.findFirstOrThrow({ where: { name: "第一节" }, include: { parent: true } });
      assert.equal(leaf.parent?.name, "第一章"); assert.equal(leaf.pageStart, 3);
      const preserved = await prisma.mistakeItem.findUniqueOrThrow({ where: { id: saved.id }, include: { linkedNodes: true } });
      assert.deepEqual(preserved.linkedNodes.map(n => n.id).sort(), linksBeforeImport, "historical associations survive directory import");
      const confirmation = { ...data.analysis, diagnosisStatus: "confirmed", nextCheck: "检查定义域" };
      assert.equal((await PATCH(request({ analysis: confirmation }), ctx)).status, 200);
      const confirmed = await prisma.mistakeItem.findUniqueOrThrow({ where: { id: saved.id } });
      assert.equal(JSON.parse(confirmed.aiAnalysis!).diagnosisStatus, "confirmed");
      assert.equal(JSON.parse(confirmed.aiAnalysis!).nextCheck, "检查定义域");
    } finally { provider.close(); provider.closeAllConnections(); }
    assert.equal(await prisma.knowledgeNode.count(), 6, "only explicitly confirmed catalog import adds nodes");
  } finally { await unlink(file); await prisma.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
