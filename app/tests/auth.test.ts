import { test } from "node:test";
import assert from "node:assert/strict";
import { authConfig, hashPassword, checkPassword, createSession, validSession, safeNext } from "../src/lib/auth";
import { withAccess, readBounded, BodyTooLarge } from "../src/lib/request-guard";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as logout } from "../src/app/api/auth/logout/route";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
test("password, signed session, expiry, password rotation and redirect safety", async () => {
  process.env.APP_ORIGIN = "http://localhost"; process.env.AUTH_USERNAME = "fixture"; process.env.AUTH_SECRET = "fixture-secret-with-at-least-32-characters";
  process.env.AUTH_PASSWORD_HASH = await hashPassword("fixture-password-long");
  assert.ok(authConfig()); assert.equal(await checkPassword("fixture", "wrong"), false); assert.equal(await checkPassword("wrong", "fixture-password-long"), false);
  assert.equal(await checkPassword("fixture", "fixture-password-long"), true);
  const cookie = createSession(); assert.equal(validSession(cookie), true); assert.equal(validSession(cookie + "x"), false);
  assert.equal(validSession(createSession(Date.now() - 8 * 86400_000)), false);
  process.env.AUTH_SECRET += "rotated"; assert.equal(validSession(cookie), false);
  const token = createSession(); process.env.AUTH_PASSWORD_HASH = await hashPassword("another-password-long"); assert.equal(validSession(token), false);
  for (const input of ["https://evil.test", "//evil.test", "/\\evil.test", "/login"]) assert.equal(safeNext(input), "/knowledge");
  assert.equal(safeNext("/wrong-questions?filter=queued"), "/wrong-questions?filter=queued");
});
test("login issues HttpOnly cookie, guards bypass and forged origin, logout clears cookie", async () => {
  process.env.APP_ORIGIN = "http://localhost"; process.env.AUTH_USERNAME = "fixture"; process.env.AUTH_SECRET = "fixture-secret-with-at-least-32-characters"; process.env.AUTH_PASSWORD_HASH = await hashPassword("fixture-password-long");
  const make = (origin = "http://localhost", password = "fixture-password-long") => new Request("http://localhost/api/auth/login", { method: "POST", headers: { origin }, body: JSON.stringify({ username: "fixture", password, next: "//evil.test" }) });
  assert.equal((await login(make("https://evil.test"))).status, 403); assert.equal((await login(make("http://localhost", "bad"))).status, 401);
  const response = await login(make()); assert.equal(response.status, 200); assert.equal((await response.json()).next, "/knowledge");
  const cookie = response.headers.get("set-cookie")!; assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=strict/i); assert.match(cookie, /Max-Age=604800/);
  let invoked = false;
  const handler = withAccess(async (req: Request) => { invoked = true; return Response.json(await req.json()); });
  assert.equal((await handler(new Request("http://localhost/api/notes", { method: "POST", body: "{}" }))).status, 401); assert.equal(invoked, false);
  const headers = { cookie, origin: "https://evil.test" }; assert.equal((await handler(new Request("http://localhost/api/notes", { method: "POST", headers, body: "{}" }))).status, 403); assert.equal(invoked, false);
  headers.origin = "http://localhost"; assert.equal((await handler(new Request("http://localhost/api/notes", { method: "POST", headers, body: "{}" }))).status, 200); assert.equal(invoked, true);
  const cleared = await logout(new Request("http://localhost/api/auth/logout", { method: "POST", headers })); assert.match(cleared.headers.get("set-cookie")!, /Max-Age=0/);
  const expiredHash = process.env.AUTH_PASSWORD_HASH; delete process.env.AUTH_PASSWORD_HASH; assert.equal((await handler(new Request("http://localhost/api/notes", { headers }))).status, 401); process.env.AUTH_PASSWORD_HASH = expiredHash;
});
test("body reader rejects declared and chunked excess before invoking handlers", async () => {
  await assert.rejects(readBounded(new Request("http://localhost", { method: "POST", headers: { "content-length": "100" }, body: "{}" }), 10), BodyTooLarge);
  let cancelled = false;
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(8)); controller.enqueue(new Uint8Array(8)); }, cancel() { cancelled = true; } });
  const req = new Request("http://localhost", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  await assert.rejects(readBounded(req, 10), BodyTooLarge); assert.equal(cancelled, true);
  assert.equal((await readBounded(new Request("http://localhost", { method: "POST", body: "{}" }), 10)).toString(), "{}");
});
test("all business API and uploaded-file exports carry independent access guards", () => {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : e.name === "route.ts" ? [path.join(dir, e.name)] : []);
  const routes = [...walk("src/app/api"), "src/app/uploads/[filename]/route.ts"].filter(p => !p.includes("/api/auth/") && !p.includes("/api/health/live/"));
  for (const p of routes) {
    const source = readFileSync(p, "utf8"); assert.doesNotMatch(source, /export async function (GET|POST|PUT|PATCH|DELETE)/, p);
    assert.match(source, /export const (GET|POST|PUT|PATCH|DELETE) = withAccess\(/, p);
  }
  assert.ok(routes.length > 20);
});
test("HTTPS login uses Secure cookies and brute-force retries are bounded", async () => {
  process.env.APP_ORIGIN = "https://study.example.com"; process.env.AUTH_USERNAME = "fixture"; process.env.AUTH_SECRET = "fixture-secret-with-at-least-32-characters"; process.env.AUTH_PASSWORD_HASH = await hashPassword("fixture-password-long");
  const make = (password: string) => new Request("https://study.example.com/api/auth/login", { method: "POST", headers: { origin: "https://study.example.com" }, body: JSON.stringify({ username: "fixture", password }) });
  const response = await login(make("fixture-password-long")); assert.equal(response.status, 200); assert.match(response.headers.get("set-cookie")!, /; Secure/i);
  for (let i = 0; i < 5; i++) assert.equal((await login(make("wrong"))).status, 401);
  assert.equal((await login(make("fixture-password-long"))).status, 429);
});
