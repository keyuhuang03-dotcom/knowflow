import { record } from "@/lib/mistake-contract";
import { InputError, text } from "@/lib/mistake-contract";
import { integer } from "@/lib/input-validation";
import { withAccess } from "@/lib/request-guard";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function GETHandler(_req: Request) {
  void _req;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todaySessions, recentSessions] = await Promise.all([
    prisma.studySession.findMany({
      where: { date: { gte: today, lt: tomorrow } },
      include: { subject: true },
      orderBy: { date: "desc" },
    }),
    prisma.studySession.findMany({
      include: { subject: true },
      orderBy: { date: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({ today: todaySessions, recent: recentSessions });
}

async function POSTHandler(req: NextRequest) {
  const body = record(await req.json());
  const subjectId = text(body.subjectId, "科目", 128, true);
  const durationMinutes = integer(body.durationMinutes, "学习分钟数", 1, 1440);
  const user = await prisma.user.findFirst();

  // Find or use the subject name directly (subject ID might be the name string)
  let subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) {
    subject = await prisma.subject.findFirst({ where: { name: subjectId } });
  }

  if (!subject || !user) throw new InputError("科目或用户尚未初始化");
  const session = await prisma.studySession.create({
    data: {
      userId: user?.id || "default",
      subjectId: subject?.id || subjectId,
      durationMinutes,
      date: new Date(),
    },
    include: { subject: true },
  });

  return NextResponse.json(session);
}

export const GET = withAccess(GETHandler);
export const POST = withAccess(POSTHandler);
