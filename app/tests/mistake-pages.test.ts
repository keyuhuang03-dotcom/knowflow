import { test } from "node:test";
import assert from "node:assert/strict";
import { parseImagePages, readImagePages } from "../src/lib/mistake-pages";
const first = "/uploads/first.jpg", second = "/uploads/second.png";
test("ordered image pages preserve legacy single-photo records", () => {
  assert.deepEqual(parseImagePages([first, second], first), [first, second]);
  assert.deepEqual(readImagePages(null, first), [first]);
  assert.deepEqual(readImagePages("invalid historical data", first), [first]);
  assert.deepEqual(readImagePages(JSON.stringify([first, second]), first), [first, second]);
});
test("invalid page batches cannot replace a saved question or escape upload storage", () => {
  for (const value of [[], [second, first], [first, first], [first, "/uploads/../../.env"], [first, "https://example.com/a.jpg"], Array.from({length:7}, (_, i) => `/uploads/${i}.jpg`)]) assert.throws(() => parseImagePages(value, first));
});
