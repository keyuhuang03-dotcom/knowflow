// Explicit isolated HTTP/browser check; never uses the personal database or AI.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { once } from "node:events";
import { hashPassword } from "../src/lib/auth";
async function main() {
const dir = mkdtempSync(path.join(tmpdir(), "knowflow-auth-http-"));
const base = "http://127.0.0.1:3104";
const password = "isolated-login-fixture-password";
const env = { ...process.env, DATABASE_URL: `file:${dir}/test.db`, UPLOAD_ROOT: `${dir}/uploads`, APP_ORIGIN: base, AUTH_USERNAME: "fixture", AUTH_PASSWORD_HASH: await hashPassword(password), AUTH_SECRET: "isolated-http-fixture-secret-32-characters", MISTAKE_AI_API_KEY: "", MISTAKE_AI_MODEL: "", DEEPSEEK_API_KEY: "" };
writeFileSync(`${dir}/test.db`, ""); mkdirSync(`${dir}/uploads`);
execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, stdio: "pipe" });
execFileSync(process.execPath, ["--import", "tsx", "scripts/bootstrap.ts"], { env, stdio: "pipe" });
writeFileSync(`${dir}/uploads/probe.png`, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/9sAAAAASUVORK5CYII=", "base64"));
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3104"], { env, stdio: ["ignore", "pipe", "pipe"] });
let output = ""; server.stdout.on("data", b => output += b); server.stderr.on("data", b => output += b);
try {
  let ready = false; for (let i = 0; i < 100; i++) { try { if ((await fetch(base + "/login")).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert.ok(ready, output);
  assert.equal((await fetch(base + "/api/health/live")).status, 200);
  assert.equal((await fetch(base + "/api/health/ready")).status, 401);
  const { chromium } = await import(process.env.KNOWFLOW_PLAYWRIGHT || "playwright");
  const browser = await chromium.launch({ executablePath: process.env.KNOWFLOW_CHROME || undefined, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await context.newPage(); const errors: string[] = []; page.on("pageerror", (e: Error) => errors.push(e.message));
    for (const url of ["/api/user", "/api/backup", "/uploads/probe.png", "/api/mistakes/anything/skill/word"]) assert.equal((await context.request.get(base + url)).status(), 401, url);
    const bypass = await fetch(base + "/knowledge", { redirect: "manual", headers: { "x-knowflow-path": "/login", "x-middleware-subrequest": "proxy" } }); assert.equal(bypass.status, 307);
    await page.goto(base + "/knowledge"); await page.getByRole("heading", { name: "回到你的知识世界" }).waitFor(); assert.equal(await page.getByRole("navigation", { name: "主导航" }).count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: "/private/tmp/knowflow-login-mobile.png", fullPage: true });
    await page.getByLabel("账号", { exact: true }).fill("fixture"); await page.getByLabel("密码", { exact: true }).fill("wrong-password"); await page.getByRole("button", { name: "进入知序" }).click(); await page.getByRole("alert").waitFor();
    await page.getByLabel("密码", { exact: true }).fill(password); await page.getByRole("button", { name: "进入知序" }).click(); await page.waitForURL(base + "/knowledge");
    const cookie = (await context.cookies()).find((c: { name: string }) => c.name === "knowflow_session")!; assert.ok(cookie.httpOnly); assert.equal(cookie.sameSite, "Strict");
    assert.equal((await context.request.get(base + "/api/user")).status(), 200); assert.equal((await context.request.get(base + "/api/backup")).status(), 200); assert.equal((await context.request.get(base + "/uploads/probe.png")).status(), 200);
    assert.equal((await context.request.patch(base + "/api/user", { headers: { Origin: "https://evil.test" }, data: {} })).status(), 403);
    assert.equal((await context.request.get(base + "/api/health/ready")).status(), 200);
    assert.equal((await context.request.post(base + "/api/backup", { headers: { Origin: base }, data: { restoreConfirmed: true } })).status(), 403);
    const before = await (await context.request.get(base + "/api/user")).json();
    assert.equal((await context.request.patch(base + "/api/user", { headers: { Origin: base }, data: { examDate: "2026-02-30" } })).status(), 400);
    assert.deepEqual(await (await context.request.get(base + "/api/user")).json(), before);
    const headers = { cookie: `knowflow_session=${cookie.value}`, origin: base, "content-type": "application/json" };
    const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(700_000)); c.enqueue(new Uint8Array(700_000)); c.close(); } });
    const oversized = await fetch(base + "/api/notes", { method: "POST", headers, body, duplex: "half" } as RequestInit); assert.equal(oversized.status, 413);
    assert.equal((await context.request.post(base + "/api/upload", { headers: { Origin: base }, data: Buffer.alloc(26 * 1024 * 1024 + 1) })).status(), 413);
    const malformed = await context.request.post(base + "/api/notes", { headers: { ...headers, cookie: "knowflow_session=forged" }, data: {} }); assert.equal(malformed.status(), 401);
    await page.goto(base + "/settings"); await page.getByRole("button", { name: "退出登录" }).click(); await page.waitForURL(base + "/login"); assert.equal((await context.request.get(base + "/api/backup")).status(), 401);
    await page.setViewportSize({ width: 1440, height: 900 }); await page.screenshot({ path: "/private/tmp/knowflow-login-desktop.png", fullPage: true }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); assert.deepEqual(errors, []);
    execFileSync(process.execPath, ["tests/auto-capture.browser.mjs"], { env: { ...env, KNOWFLOW_ALLOW_FIXTURE_WRITES: "1", KNOWFLOW_TEST_URL: base, KNOWFLOW_TEST_DATABASE_URL: env.DATABASE_URL, KNOWFLOW_TEST_UPLOAD_ROOT: env.UPLOAD_ROOT, KNOWFLOW_TEST_AUTH_USERNAME: "fixture", KNOWFLOW_TEST_AUTH_PASSWORD: password }, stdio: "pipe", timeout: 60_000 });
    console.log("PASS authenticated multi-page capture, draft restore, upload retry and detached worker; direct-port auth, pages/API/images/exports, forged bypass headers, login/logout, mobile/desktop layout, origin rejection, chunked JSON 413 and upload 413; health privacy, production restore refusal and invalid date without data mutation; isolated DB only");
  } finally { await browser.close(); }
} finally { server.kill("SIGTERM"); await once(server, "exit"); }

}
main().catch(error => { console.error(error); process.exitCode = 1; });
