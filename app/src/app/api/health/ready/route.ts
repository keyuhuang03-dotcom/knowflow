import { withAccess } from "@/lib/request-guard";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth";
async function ready(_req: Request) {
  void _req;
  try {
    if (!authConfig() || !await prisma.user.findFirst({ select: { id: true } })) return Response.json({ ready: false }, { status: 503 });
    await Promise.all([prisma.workerLease.count(), prisma.aiUsageDay.count()]);
    return Response.json({ ready: true });
  } catch { return Response.json({ ready: false }, { status: 503 }); }
}
export const GET = withAccess(ready);
