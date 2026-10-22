import { test } from "node:test";
import assert from "node:assert/strict";
import { acquireRequest, budgetDay, enterMutation, pauseForRestore } from "../src/lib/release-controls";
import { readBounded, BodyReadTimedOut } from "../src/lib/request-guard";
import { dateValue, integer } from "../src/lib/input-validation";
test("upload concurrency releases once and time windows expire", () => {
  const now = Date.now() + 1000000;
  const a = acquireRequest("/api/upload", "POST", now)!;
  const b = acquireRequest("/api/upload", "POST", now)!;
  assert.equal(acquireRequest("/api/upload", "POST", now), null);
  a(); a();
  const c = acquireRequest("/api/upload", "POST", now)!; c(); b();
  for (let i = 0; i < 17; i++) acquireRequest("/api/upload", "POST", now)!();
  assert.equal(acquireRequest("/api/upload", "POST", now), null);
  acquireRequest("/api/upload", "POST", now + 60001)!();
});
test("restore requires exclusive mutation and blocks concurrent writes", () => {
  const a = enterMutation()!; const b = enterMutation()!;
  assert.throws(() => pauseForRestore()); b();
  const resume = pauseForRestore(); assert.equal(enterMutation(), null);
  resume(); a(); enterMutation()!();
});
test("slow request body deadline cancels stream", async () => {
  let cancelled = false;
  const req = new Request("http://localhost", { method: "POST", body: new ReadableStream({ cancel() { cancelled = true; } }), duplex: "half" } as RequestInit);
  await assert.rejects(readBounded(req, 10, 10), BodyReadTimedOut); assert.equal(cancelled, true);
});
test("calendar and integer validation reject invalid input; budget day uses Shanghai", () => {
  assert.throws(() => dateValue("2026-02-30", "日期"));
  assert.throws(() => integer(1.5, "数值", 0, 5));
  assert.equal(budgetDay(new Date("2026-10-12T16:00:00Z")), "2026-10-13");
});
