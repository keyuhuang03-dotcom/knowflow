import { test } from "node:test";
import assert from "node:assert/strict";
import { filterRecommendations, nodePath, parseAnalysis, parseNodeIds, readAnalysis, requireStudentWorkEvidence } from "../src/lib/mistake-contract";
import { imageType } from "../src/lib/mistake-files";
test("recommendations reject invented IDs, duplicates and more than three nodes", () => {
  const candidates = ["a", "b", "c", "d"].map(id => ({ id, name: id, path: id }));
  const result = filterRecommendations(["invalid", { nodeId: "foreign" }, ...["a","a","b","c","d"].map(nodeId => ({ nodeId, reason: "match" }))], candidates);
  assert.deepEqual(result.map(r => r.nodeId), ["a", "b", "c"]);
});
test("node confirmation requires 1–3 valid IDs", () => {
  for (const value of [null, [], [""], [1], ["a","b","c","d"]]) assert.throws(() => parseNodeIds(value));
  assert.deepEqual(parseNodeIds(["a","b"]), ["a","b"]);
});
test("analysis validates text and legacy plain-text cards remain readable", () => {
  assert.throws(() => parseAnalysis({ question: { injection: true } }));
  assert.throws(() => parseAnalysis({ method: "a".repeat(12001) }));
  assert.equal(readAnalysis("旧版复习建议").reviewTip, "旧版复习建议");
});
test("AI cannot assign a personal error without student work", () => {
  const generated = parseAnalysis({ question: "求极限", coreConcept: "极限", stickingPoint: "学生不会替换", errorReason: "概念错误", method: "等价无穷小", reviewTip: "先检查极限形式" });
  const guarded = requireStudentWorkEvidence(generated, false);
  assert.match(guarded.stickingPoint, /缺少解题过程/);
  assert.match(guarded.errorReason, /无法判断/);
  assert.equal(guarded.coreConcept, "极限");
  assert.deepEqual(requireStudentWorkEvidence(generated, true), generated);
});
test("paths include ancestors and terminate even with a corrupt cycle", () => {
  const nodes = [{ id: "a", name: "极限", parentId: "b" }, { id: "b", name: "高等数学", parentId: "a" }];
  assert.equal(nodePath(nodes[0], nodes, "数学"), "数学 / 高等数学 / 极限");
});
test("uploads check file signatures instead of trusting extensions", () => {
  assert.equal(imageType(Buffer.from("<svg><script/></svg>")), null);
  assert.equal(imageType(Buffer.from([137,80,78,71,13,10,26,10])), "image/png");
});
