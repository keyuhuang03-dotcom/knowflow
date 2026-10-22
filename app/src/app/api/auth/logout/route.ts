import { NextResponse } from "next/server";
import { withAccess } from "@/lib/request-guard";
import { authConfig, SESSION_COOKIE } from "@/lib/auth";
async function logout(_req: Request) {
  void _req;
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: authConfig()?.secure, sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
export const POST = withAccess(logout);
