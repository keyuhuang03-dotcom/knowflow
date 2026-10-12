import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRecognition, recognitionOnly } from "../src/lib/mistake-recognition";

test("multi-question images cannot become clear even when the model claims clarity", () => {
  const r = parseRecognition({ rotation: 0, recognition: "clear", questionCount: 2, question: "第6题", studentWork: "学生旁注" });
  assert.equal(r.recognition, "uncertain");
  assert.match(r.uncertainty, /多道题/);
  assert.equal(recognitionOnly(r).method, "");
  assert.equal(recognitionOnly(r).recognizedWork, "学生旁注");
});
test("unclear critical symbols and missing question counts stop diagnosis", () => {
  for (const raw of [{ rotation: 0, recognition: "clear", questionCount: 1, question: "积分上限需校对" }, { rotation: 0, recognition: "clear", question: "求导" }, { rotation: 0, recognition: "clear", questionCount: 1, question: "" }]) assert.equal(parseRecognition(raw).recognition, "uncertain");
});
test("a single clear question keeps same-photo handwriting separate from the printed question", () => {
  const r = parseRecognition({ rotation: 0, recognition: "clear", questionCount: 1, question: "求 $f(2)$", studentWork: "没有考虑常数求导为0" });
  assert.equal(r.recognition, "clear");
  assert.equal(r.question, "求 $f(2)$");
  assert.equal(r.studentWork, "没有考虑常数求导为0");
});

test("sideways or contradictory OCR cannot silently claim clarity", () => {
  for (const raw of [{ rotation: 90, recognition: "clear", questionCount: 1, question: "求导" }, { rotation: 0, recognition: "clear", questionCount: 1, question: "求导", uncertainty: "指数不清" }]) assert.equal(parseRecognition(raw).recognition, "uncertain");
});
