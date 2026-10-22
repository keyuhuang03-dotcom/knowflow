import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export const SESSION_COOKIE = "knowflow_session";
export const SESSION_SECONDS = 60 * 60 * 24 * 7;
export function authConfig() {
  const username = process.env.AUTH_USERNAME?.trim();
  const hash = process.env.AUTH_PASSWORD_HASH;
  const secret = process.env.AUTH_SECRET;
  const origin = process.env.APP_ORIGIN;
  if (!username || !hash || !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash) || !secret || secret.length < 32 || !origin) return null;
  try {
    const url = new URL(origin);
    if (url.origin !== origin || !["http:", "https:"].includes(url.protocol)) return null;
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return null;
    return { username, hash, secret, origin, secure: url.protocol === "https:" };
  } catch { return null; }
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function checkPassword(username: string, password: string) {
  const config = authConfig(); if (!config || password.length > 256) return false;
  const [, salt, hash] = config.hash.split(":");
  const actual = await derive(password, salt, 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(hash, "hex")) && username === config.username;
}
function signature(payload: string) {
  const config = authConfig(); if (!config) return "";
  return createHmac("sha256", config.secret).update(config.origin).update("\0").update(config.hash).update(payload).digest("base64url");
}
export function createSession(now = Date.now()) {
  if (!authConfig()) throw new Error("Login configuration unavailable");
  const payload = Buffer.from(JSON.stringify({ expires: now + SESSION_SECONDS * 1000, nonce: randomBytes(16).toString("hex") })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export function validSession(token: string | undefined, now = Date.now()) {
  if (!authConfig() || !token || token.length > 1024) return false;
  try {
    const parts = token.split("."); if (parts.length !== 2) return false;
    const expected = Buffer.from(signature(parts[0])); const actual = Buffer.from(parts[1]);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    return typeof payload.expires === "number" && payload.expires > now && payload.expires <= now + SESSION_SECONDS * 1000;
  } catch { return false; }
}
export function requestSession(req: Request) {
  const token = (req.headers.get("cookie") || "").split(";").map(v => v.trim()).find(v => v.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return validSession(token);
}
export function safeNext(value: unknown) {
  return typeof value === "string" && /^\/(?!\/)/.test(value) && !/[\\\u0000-\u0020]/.test(value) && !value.startsWith("/login") ? value : "/knowledge";
}
