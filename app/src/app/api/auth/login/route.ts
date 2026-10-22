import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { authConfig, checkPassword, createSession, safeNext, SESSION_COOKIE, SESSION_SECONDS } from "@/lib/auth";
import { BodyTooLarge, BodyReadTimedOut, LOGIN_BODY_LIMIT, readBounded, sameOrigin } from "@/lib/request-guard";
const attempts = new Map<string, { count: number; expires: number }>();
let active = 0;
function allowLogin(key: string) {
  const now = Date.now(); for (const [k, v] of attempts) if (v.expires <= now) attempts.delete(k);
  const client = attempts.get(key) || { count: 0, expires: now + 300_000 };
  const global = attempts.get("global") || { count: 0, expires: now + 60_000 };
  if (client.count >= 5 || attempts.size > 1000) return 300;
  if (global.count >= 30) return 60;
  if (active >= 2) return 2;
  client.count++; global.count++; attempts.set(key, client); attempts.set("global", global); return 0;
}
export async function POST(req: Request) {
  const config = authConfig();
  if (!config) return NextResponse.json({ error: "登录尚未配置，请在服务器终端完成账号配置" }, { status: 503 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "请求来源不受信任" }, { status: 403 });
  const forwarded = req.headers.get("x-knowflow-client-ip") || "";
  const key = process.env.AUTH_TRUST_PROXY_IP === "true" && isIP(forwarded) ? `ip:${forwarded}` : "local";
  const retry = allowLogin(key);
  if (retry) return NextResponse.json({ error: "尝试过于频繁，请稍后再试" }, { status: 429, headers: { "Retry-After": String(retry) } });
  active++;
  try {
    const body = JSON.parse((await readBounded(req, LOGIN_BODY_LIMIT)).toString());
    if (typeof body.username !== "string" || typeof body.password !== "string" || body.username.length > 100 || body.password.length > 256 || !await checkPassword(body.username, body.password)) return NextResponse.json({ error: "账号或密码不正确" }, { status: 401 });
    attempts.delete(key);
    const response = NextResponse.json({ next: safeNext(body.next) });
    response.cookies.set(SESSION_COOKIE, createSession(), { httpOnly: true, secure: config.secure, sameSite: "strict", path: "/", maxAge: SESSION_SECONDS });
    response.headers.set("Cache-Control", "no-store"); return response;
  } catch (error) { return NextResponse.json({ error: error instanceof BodyTooLarge ? "登录请求过大" : error instanceof BodyReadTimedOut ? "登录请求读取超时，请重试" : "登录请求无效" }, { status: error instanceof BodyTooLarge ? 413 : error instanceof BodyReadTimedOut ? 408 : 400 }); }
  finally { active--; }
}
