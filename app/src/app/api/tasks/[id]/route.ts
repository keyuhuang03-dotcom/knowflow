import { record } from "@/lib/mistake-contract";
import { InputError } from "@/lib/mistake-contract";
import { withAccess } from "@/lib/request-guard";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function PATCHHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { completed } = record(await req.json());
  if (typeof completed !== "boolean") throw new InputError("完成状态必须是布尔值");

  const task = await prisma.task.update({
    where: { id },
    data: { completed },
  });

  return NextResponse.json(task);
}

async function DELETEHandler(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export const PATCH = withAccess(PATCHHandler);
export const DELETE = withAccess(DELETEHandler);
