import { record } from "@/lib/mistake-contract";
import { text } from "@/lib/mistake-contract";
import { integer } from "@/lib/input-validation";
import { withAccess } from "@/lib/request-guard";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function POSTHandler(req: NextRequest) {
  const { title, priority, subjectId } = record(await req.json());
  const normalizedTitle = text(title, "任务内容", 500, true);
  if (!normalizedTitle) {
    return NextResponse.json({ error: "任务内容不能为空" }, { status: 400 });
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const user = await prisma.user.findFirst();
  if (!user) {
    return NextResponse.json({ error: "用户数据尚未初始化" }, { status: 400 });
  }
  const task = await prisma.task.create({
    data: {
      title: normalizedTitle,
      userId: user.id,
      subjectId: subjectId === undefined || subjectId === null || subjectId === "" ? null : text(subjectId, "科目", 128, true),
      priority: priority === undefined ? 0 : integer(priority, "优先级", 0, 2),
      date: today,
    },
    include: { subject: true },
  });

  return NextResponse.json(task);
}

export const POST = withAccess(POSTHandler);
