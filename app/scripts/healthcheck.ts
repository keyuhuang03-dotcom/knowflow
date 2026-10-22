import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  if (process.argv.includes("worker")) {
    const { prisma } = await import("../src/lib/prisma");
    try { if (!await prisma.workerLease.findFirst({ where: { id: "mistake-organizer", expiresAt: { gt: new Date() } } })) throw new Error(); }
    finally { await prisma.$disconnect(); }
  } else {
    const { createSession, SESSION_COOKIE } = await import("../src/lib/auth");
    const response = await fetch(`http://127.0.0.1:${Number(process.argv.find(v => v.startsWith("--port="))?.split("=")[1] || 3000)}/api/health/ready`, { headers: { cookie: `${SESSION_COOKIE}=${createSession()}` }, signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error();
  }
}
main().catch(() => { console.error("Service is not ready"); process.exitCode = 1; });
