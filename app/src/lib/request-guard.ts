import { InputError, record } from "./mistake-contract";
import { acquireRequest, AiBudgetExceeded, enterMutation } from "./release-controls";
import { NextRequest, NextResponse } from "next/server";
import { authConfig, requestSession } from "./auth";
export const UPLOAD_BODY_LIMIT = 26 * 1024 * 1024;
export const JSON_BODY_LIMIT = 1024 * 1024;
export const LOGIN_BODY_LIMIT = 4096;
export class BodyTooLarge extends Error {}
export class BodyReadTimedOut extends Error {}
export function bodyLimit(path: string) { return path === "/api/upload" ? UPLOAD_BODY_LIMIT : path === "/api/auth/login" ? LOGIN_BODY_LIMIT : JSON_BODY_LIMIT; }
export function sameOrigin(req: Request) {
  const config = authConfig();
  return Boolean(config && req.headers.get("origin") === config.origin && req.headers.get("sec-fetch-site") !== "cross-site");
}
export async function readBounded(req: Request, limit: number, timeoutMs = 60000) {
  const length = req.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) throw new BodyTooLarge();
  if (!req.body) return Buffer.alloc(0);
  const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { reject(new BodyReadTimedOut()); void reader.cancel().catch(() => {}); }, timeoutMs); });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]); if (done) break;
      size += value.byteLength; if (size > limit) { void reader.cancel().catch(() => {}); throw new BodyTooLarge(); }
      chunks.push(value);
    }
  } finally { clearTimeout(timer!); reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}
export function withAccess<T extends unknown[]>(handler: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    const req = args[0] as Request | undefined;
    if (!req || !requestSession(req)) return NextResponse.json({ error: "请先登录" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    const method = req.method.toUpperCase(); const pathname = new URL(req.url).pathname;
    const writes = !["GET", "HEAD", "OPTIONS"].includes(method);
    if (writes && !sameOrigin(req)) return NextResponse.json({ error: "请求来源不受信任，请刷新页面后重试" }, { status: 403 });
    // Reserve before reading bodies to bound concurrent uploads and AI requests.
    const release = acquireRequest(pathname, method);
    if (!release) return NextResponse.json({ error: "操作过于频繁或任务正在处理，请稍后重试" }, { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
    const finishMutation = writes || pathname.endsWith("/skill/word") ? enterMutation() : () => {};
    if (!finishMutation) { release(); return NextResponse.json({ error: "整库恢复正在进行，请稍后重试；输入仍保留" }, { status: 503, headers: { "Retry-After": "30" } }); }
    try {
      if (writes) {
        const bytes = await readBounded(req, bodyLimit(pathname));
        if (pathname !== "/api/upload" && bytes.length) record(JSON.parse(bytes.toString()));
        args[0] = new NextRequest(req.url, { method, headers: req.headers, body: new Uint8Array(bytes) });
      }
      const response = await handler(...args);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : "";
      const status = error instanceof BodyTooLarge ? 413 : error instanceof BodyReadTimedOut ? 408 : error instanceof AiBudgetExceeded ? 429 : error instanceof InputError || error instanceof SyntaxError || code === "P2003" ? 400 : code === "P2025" ? 404 : 500;
      if (status === 500) console.error("API operation failed:", pathname);
      const message = error instanceof InputError || error instanceof AiBudgetExceeded ? error.message : status === 413 ? "请求过大，请减少图片数量或内容长度" : status === 408 ? "请求读取超时，请恢复网络后重试" : status === 400 ? "输入格式或关联数据无效" : status === 404 ? "记录不存在" : "操作失败，请稍后重试";
      return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
    } finally { finishMutation(); release(); }
  };
}
