import { record, text } from "@/lib/mistake-contract";
import { dateValue } from "@/lib/input-validation";
import { withAccess } from "@/lib/request-guard";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function GETHandler(_req: Request) {
  void _req;
  const user = await prisma.user.findFirst();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ id: user.id, name: user.name, examDate: user.examDate });
}

async function PATCHHandler(req: Request) {
  const body = record(await req.json());
  const user = await prisma.user.findFirst();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(body.name !== undefined && { name: text(body.name, "姓名", 80, true) }),
      ...(body.examDate !== undefined && { examDate: dateValue(body.examDate, "考试日期") }),
    },
  });

  return NextResponse.json({ id: updated.id, name: updated.name, examDate: updated.examDate });
}

export const GET = withAccess(GETHandler);
export const PATCH = withAccess(PATCHHandler);
