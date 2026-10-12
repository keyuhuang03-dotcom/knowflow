import { test } from "node:test";
import assert from "node:assert/strict";
import { cropRect, imageSize, prepareImage } from "../src/lib/mistake-image";
test("mobile image sizing bounds output without upscaling and rejects extreme dimensions", () => {
  assert.deepEqual(imageSize(4032, 3024), { width: 2400, height: 1800 });
  assert.deepEqual(imageSize(3024, 4032), { width: 1800, height: 2400 });
  assert.deepEqual(imageSize(600, 400), { width: 600, height: 400 });
  assert.throws(() => imageSize(20000, 20000));
  assert.throws(() => imageSize(0, 100));
});
test("crop geometry retains readable positive area and rejects invalid edges", () => {
  assert.deepEqual(cropRect(1000, 800, [10, 20, 30, 10]), { x: 100, y: 160, width: 600, height: 560 });
  assert.deepEqual(cropRect(100, 100, [40,40,40,40]), { x: 40, y: 40, width: 20, height: 20 });
  assert.throws(() => cropRect(100, 100, [NaN,0,0,0]));
});
test("unsupported formats and oversized files fail before allocating a decoder", async () => {
  await assert.rejects(prepareImage(new Blob(["HEIC data"], { type: "image/jpeg" })), /HEIC/);
  await assert.rejects(prepareImage(new Blob([new Uint8Array(26 * 1024 * 1024)])), /25MB/);
});
