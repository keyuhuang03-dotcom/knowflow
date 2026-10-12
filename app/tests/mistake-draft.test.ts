import { test } from "node:test";
import assert from "node:assert/strict";
import { persistDraft, restoreDraft, storageKey, type Draft } from "../src/lib/mistake-draft";
import { emptyAnalysis } from "../src/lib/mistake-contract";
const subjects = [{ id: "math", nodes: [{ id: "limit", name: "极限", path: "数学 / 极限" }] }];
const draft: Draft = { id: "12345678-1234-1234-1234-123456789012", subjectId: "math", title: "未完成", source: "教材", userWork: "卡在第二步", imageUrl: "/uploads/test.jpg", userWorkImageUrl: "", analysis: { ...emptyAnalysis, diagnosisStatus: "confirmed" }, recommendations: [], selected: ["limit"], status: "complete" };
test("persistent draft roundtrip keeps retry ID, input, uploaded image and explicit confirmation", () => {
  const values = new Map<string, string>();
  persistDraft({ setItem: (k, v) => { values.set(k, v); } }, draft);
  const restored = restoreDraft(values.get(storageKey)!, subjects)!;
  assert.equal(restored.id, draft.id);
  assert.equal(restored.userWork, draft.userWork);
  assert.equal(restored.imageUrl, draft.imageUrl);
  assert.equal(restored.analysis.diagnosisStatus, "confirmed");
});
test("stale nodes and corrupt draft data cannot bypass confirmation constraints", () => {
  assert.equal(restoreDraft("{broken", subjects), null);
  assert.equal(restoreDraft(JSON.stringify({ ...draft, subjectId: "removed" }), subjects), null);
  const restored = restoreDraft(JSON.stringify({ ...draft, selected: ["limit", "deleted", "limit"], recommendations: [null, { nodeId: "deleted" }] }), subjects)!;
  assert.deepEqual(restored.selected, ["limit"]);
  assert.deepEqual(restored.recommendations, []);
});
test("quota failure surfaces without mutating the in-memory draft or retry ID", () => {
  const snapshot = JSON.stringify(draft);
  assert.throws(() => persistDraft({ setItem: () => { throw new Error("QuotaExceededError"); } }, draft), /Quota/);
  assert.equal(JSON.stringify(draft), snapshot);
});
