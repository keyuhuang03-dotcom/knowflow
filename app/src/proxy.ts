import { NextRequest, NextResponse } from "next/server";
import { requestSession } from "./lib/auth";
import { bodyLimit } from "./lib/request-guard";
export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const headers = new Headers(req.headers); headers.set("x-knowflow-path", path);
  const publicPath = path === "/api/health/live" || path === "/login" || path === "/api/auth/login" || path.startsWith("/_next/static/") || path === "/_next/webpack-hmr" || ["/knowflow/mascot-logo.svg", "/knowflow/mascot-books.svg", "/favicon.ico", "/manifest.json", "/icon-192-v2.png", "/icon-512-v2.png", "/apple-touch-icon.png"].includes(path);
  if (!publicPath && !requestSession(req)) {
    if (path.startsWith("/api/") || path.startsWith("/uploads/") || path.startsWith("/_next/image")) return NextResponse.json({ error: "请先登录" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    const url = new URL("/login", req.url); url.searchParams.set("next", path + req.nextUrl.search); return NextResponse.redirect(url);
  }
  if (path.startsWith("/api/")) {
    const length = req.headers.get("content-length");
    if (length && (!/^\d+$/.test(length) || Number(length) > bodyLimit(path))) return NextResponse.json({ error: "请求过大" }, { status: 413 });
  }
  return NextResponse.next({ request: { headers } });
}

// APIs validate independently before reading bodies. Avoid Proxy's extra body copy.
// Uploaded public files stay matched too, so build-time static inventory is protected.
export const config = { matcher: ["/((?!api/|_next/static/).*)"] };
