import { FixtureRequest as Request } from "./auth-fixture";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once, EventEmitter } from "node:events";
import { readFile, readdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { saveConfirmedMistake } from "../src/lib/mistake-service";
import { emptyAnalysis } from "../src/lib/mistake-contract";
import { POST as upload } from "../src/app/api/upload/route";
import { GET as status, POST as retry } from "../src/app/api/mistakes/[id]/processing/route";
import { PATCH } from "../src/app/api/mistakes/[id]/route";
import { GET as backup, POST as restore } from "../src/app/api/backup/route";
import { GET as graph } from "../src/app/api/knowledge/route";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/9sAAAAASUVORK5CYII=", "base64");
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (body: unknown) => new Request("http://localhost", { method: "POST", body: JSON.stringify(body) });
async function captured(id = randomUUID(), multiple = false) {
  const form = new FormData(); form.append("file", new File([png], "question.png", { type: "image/png" })); if (multiple) form.append("file", new File([Buffer.concat([png, Buffer.from("page-two")])], "second.png", { type: "image/png" })); form.append("purpose", "mistake"); form.append("capture", JSON.stringify({ id }));
  const response = await upload(new Request("http://localhost/api/upload", { method: "POST", body: form })); assert.equal(response.status, 200);
  return { ...await response.json(), id };
}
function worker(env: Record<string, string | undefined> = {}) {
  const child = spawn(process.execPath, ["--import", "tsx", "scripts/mistake-worker.ts", "--once", "--lease-ms=1000"], { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let output = ""; child.stdout.on("data", b => { output += b; }); child.stderr.on("data", b => { output += b; });
  const exited = once(child, "exit").then(([code]) => { if (code !== 0 && code !== null) throw new Error(output); });
  return { child, exited };
}
async function main() {
  let mode: "clear" | "unclear" | "cardfailure" | "failure" | "hold" | "nomatch" = "clear";
  let calls = 0;
  let receivedPages = 0;
  const events = new EventEmitter();
  let release = () => {};
  const provider = createServer(async (req, res) => {
    let body = ""; for await (const chunk of req) { body += chunk; }
    const payload = JSON.parse(body);
    const reading = payload.messages[0].content.startsWith("你只做精确");
    if (reading) receivedPages = payload.messages[1].content.filter((part: { type: string }) => part.type === "image_url").length;
    calls++;
    if (mode === "hold") { events.emit("entered"); await new Promise<void>(resolve => { release = resolve; }); }
    if (mode === "failure" || (mode === "cardfailure" && !reading)) { res.statusCode = 500; res.end("fixture failure"); return; }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reading ? { rotation: 0, recognition: mode === "unclear" ? "uncertain" : "clear", questionCount: 1, question: "识别题目", studentWork: "", uncertainty: mode === "unclear" ? "积分上限不清" : "" } : { analysis: { ...emptyAnalysis, standardSolution: "1. 使用极限定义。2. 代入计算。", finalAnswer: "$1$", recognition: mode === "unclear" ? "uncertain" : "clear", question: "识别题目", coreConcept: "极限", errorReason: "模型试图断言粗心" }, recommendations: mode === "nomatch" ? [] : [{ nodeId: "limit", reason: "现有节点" }, { nodeId: "equivalent", reason: "另一知识点" }, { nodeId: "invented" }] }) } }] }));
  });
  provider.listen(0, "127.0.0.1"); await once(provider, "listening");
  const address = provider.address(); assert.ok(address && typeof address === "object");
  const ai = { MISTAKE_AI_API_KEY: "fixture-only", MISTAKE_AI_MODEL: "fixture", MISTAKE_AI_BASE_URL: `http://127.0.0.1:${address.port}/v1` };
  try {
    await prisma.subject.create({ data: { id: "math", name: "数学", textbookTitle: "测试教材" } });
    await prisma.knowledgeNode.createMany({ data: [{ id: "limit", subjectId: "math", name: "极限" }, { id: "equivalent", subjectId: "math", name: "等价无穷小" }] });
    const first = await captured();
    await captured(first.id); // identical image + UUID retry, including a lost response
    assert.equal(await prisma.mistakeItem.count(), 1); assert.equal(await prisma.mistakeJob.count(), 1); assert.equal((await readdir(process.env.UPLOAD_ROOT!)).length, 1);
    const original = await prisma.mistakeItem.findUniqueOrThrow({ where: { id: first.id }, include: { linkedNodes: true } });
    assert.equal(original.subjectId, null); assert.equal(original.linkedNodes.length, 0); assert.equal(original.processingStatus, "queued");
    await worker().exited;
    assert.equal((await prisma.mistakeItem.findUniqueOrThrow({ where: { id: first.id } })).processingStatus, "failed");
    assert.deepEqual(await readFile(path.join(process.env.UPLOAD_ROOT!, path.basename(first.url))), png);
    assert.equal((await status(new Request("http://localhost"), context(first.id))).status, 200);
    await retry(request({}), context(first.id)); await retry(request({}), context(first.id));
    assert.equal(await prisma.mistakeJob.count(), 1);
    await worker(ai).exited; // processing occurs in another process, no browser involved
    const organized = await prisma.mistakeItem.findUniqueOrThrow({ where: { id: first.id }, include: { linkedNodes: true } });
    assert.equal(organized.processingStatus, "complete"); assert.equal(organized.subjectId, "math"); assert.equal(organized.linkedNodes.length, 2);
    assert.equal(JSON.parse(organized.aiAnalysis!).errorReason, "");
    assert.ok(JSON.parse(organized.aiAnalysis!).standardSolution);
    assert.equal(JSON.parse(organized.aiAnalysis!).diagnosisStatus, "unconfirmed");
    const g = await (await graph(new Request("http://localhost/api/knowledge"))).json(); for (const n of g.nodes) assert.equal(n.mistakeCount, 1);

    const multi = await captured(randomUUID(), true); await captured(multi.id, true);
    const multipleItem = await prisma.mistakeItem.findUniqueOrThrow({ where: { id: multi.id } });
    assert.equal(JSON.parse(multipleItem.imageUrls!).length, 2); assert.equal(await prisma.mistakeJob.count({ where: { mistakeId: multi.id } }), 1);
    await worker(ai).exited; assert.equal(receivedPages, 2, "OCR receives every page of the same question");
    const noMatch = await captured(); mode = "nomatch"; await worker(ai).exited;
    assert.equal((await prisma.mistakeItem.findUniqueOrThrow({ where: { id: noMatch.id } })).subjectId, null);
    const unclear = await captured(); mode = "unclear"; const unclearCalls = calls; await worker(ai).exited; assert.equal(calls - unclearCalls, 1, "unclear recognition skips analysis");
    assert.equal((await prisma.mistakeItem.findUniqueOrThrow({ where: { id: unclear.id } })).processingStatus, "needs_information");
    assert.equal(await prisma.knowledgeNode.count(), 2);

    const partial = await captured(); mode = "cardfailure"; await worker(ai).exited;
    const partialItem = await prisma.mistakeItem.findUniqueOrThrow({ where: { id: partial.id } });
    assert.equal(partialItem.processingStatus, "needs_information");
    assert.equal(partialItem.content, "识别题目", "recognition survives downstream analysis failure");
    assert.equal(JSON.parse(partialItem.aiAnalysis!).cardPending, true);
    const failing = await captured(); mode = "failure"; const beforeCalls = calls;
    for (let i = 0; i < 3; i++) { await worker(ai).exited; await prisma.mistakeJob.updateMany({ where: { mistakeId: failing.id, status: "queued" }, data: { availableAt: new Date(0) } }); }
    assert.equal(calls - beforeCalls, 3); await worker(ai).exited; assert.equal(calls - beforeCalls, 3);
    assert.equal((await prisma.mistakeJob.findUniqueOrThrow({ where: { mistakeId: failing.id } })).status, "failed");
    assert.ok(await readFile(path.join(process.env.UPLOAD_ROOT!, path.basename(failing.url))));

    const restart = await captured(); mode = "hold"; const entered = once(events, "entered"); const crashed = worker(ai); await entered;
    const lockedCalls = calls; await worker(ai).exited; assert.equal(calls, lockedCalls, "a second worker cannot process concurrently");
    crashed.child.kill("SIGKILL"); await crashed.exited; release(); await delay(1200); mode = "clear";
    await worker(ai).exited;
    assert.equal((await prisma.mistakeJob.findUniqueOrThrow({ where: { mistakeId: restart.id } })).attempts, 2);
    assert.equal((await prisma.mistakeItem.findUniqueOrThrow({ where: { id: restart.id } })).processingStatus, "complete");

    const reflection = await captured(); mode = "hold";
    const reflectionEntered = once(events, "entered"); const reflectingWorker = worker(ai); await reflectionEntered;
    const selfReport = { stickingPoint: "换元后不会改上下限", causes: ["计算或符号错误"], customCause: "漏写负号" };
    assert.equal((await PATCH(request({ selfReport }), context(reflection.id))).status, 200);
    const during = await prisma.mistakeItem.findUniqueOrThrow({ where: { id: reflection.id } });
    assert.equal(during.inputVersion, 0, "reflection does not cancel or restart processing");
    mode = "clear"; release(); await reflectingWorker.exited;
    const reflected = await prisma.mistakeItem.findUniqueOrThrow({ where: { id: reflection.id } });
    assert.equal(reflected.processingStatus, "complete");
    assert.deepEqual(JSON.parse(reflected.aiAnalysis!).selfReport, selfReport, "in-flight AI preserves user reflection");
    assert.equal((await PATCH(request({ selfReport: { ...selfReport, causes: [123] } }), context(reflection.id))).status, 400);
    assert.equal((await PATCH(request({ analysis: { ...emptyAnalysis, question: "校对题干" } }), context(reflection.id))).status, 200);
    assert.deepEqual(JSON.parse((await prisma.mistakeItem.findUniqueOrThrow({ where: { id: reflection.id } })).aiAnalysis!).selfReport, selfReport);
    mode = "clear"; await retry(request({}), context(reflection.id)); await worker(ai).exited;
    assert.deepEqual(JSON.parse((await prisma.mistakeItem.findUniqueOrThrow({ where: { id: reflection.id } })).aiAnalysis!).selfReport, selfReport, "reanalyzing preserves reflection");

    const editing = await captured(); mode = "hold"; const editingEntered = once(events, "entered"); const stale = worker(ai); await editingEntered;
    assert.equal((await PATCH(request({ analysis: { ...emptyAnalysis, question: "用户校对题目", coreConcept: "用户修改" } }), context(editing.id))).status, 200);
    release(); await stale.exited;
    const edited = await prisma.mistakeItem.findUniqueOrThrow({ where: { id: editing.id } });
    assert.equal(edited.content, "用户校对题目"); assert.equal((await prisma.mistakeJob.findUniqueOrThrow({ where: { mistakeId: editing.id } })).status, "cancelled");
    assert.equal((await PATCH(request({ nodeIds: [], confirmed: true }), context(first.id))).status, 200);
    assert.equal((await prisma.mistakeItem.findUniqueOrThrow({ where: { id: first.id } })).knowledgeNodeId, null);

    const legacy = await saveConfirmedMistake({ id: randomUUID(), title: "历史兼容", subjectId: "math", imageUrl: first.url, nodeIds: ["limit", "equivalent"], confirmed: true, analysis: emptyAnalysis });
    assert.equal(legacy.linkedNodes.length, 2); assert.equal(legacy.processingStatus, "complete");
    const exported = await (await backup(new Request("http://localhost/api/backup"))).json(); assert.equal(exported.version, 2); exported.restoreConfirmed = true;
    assert.equal(exported.data.mistakes.find((m: { id: string }) => m.id === legacy.id).linkedNodeIds.length, 2);
    assert.equal((await restore(request(exported))).status, 200);
    assert.equal((await prisma.mistakeItem.findUniqueOrThrow({ where: { id: legacy.id }, include: { linkedNodes: true } })).linkedNodes.length, 2);
    assert.equal(await prisma.mistakeJob.count(), exported.data.jobs.length);
    assert.equal(JSON.parse((await prisma.mistakeItem.findUniqueOrThrow({ where: { id: multi.id } })).imageUrls!).length, 2, "backup restores every page");
    const invalid = structuredClone(exported); invalid.data.mistakes[0].linkedNodeIds = ["missing"];
    assert.equal((await restore(request(invalid))).status, 400); assert.equal(await prisma.mistakeItem.count(), exported.data.mistakes.length);
    const v1 = structuredClone(exported); v1.version = 1; delete v1.data.jobs;
    for (const m of v1.data.mistakes) { delete m.linkedNodeIds; m.processingStatus = "complete"; }
    assert.equal((await restore(request(v1))).status, 200);
    assert.equal((await prisma.mistakeItem.findUniqueOrThrow({ where: { id: legacy.id }, include: { linkedNodes: true } })).linkedNodes.length, 1, "legacy backups recover their available primary relation");
    console.log("PASS capture idempotency, separate worker, AI failure, unknown subject, 0/multiple nodes, bounded retries, SIGKILL recovery, singleton, stale-result guard, legacy save and backup v1/v2");
  } finally { release(); provider.close(); provider.closeAllConnections(); await prisma.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
