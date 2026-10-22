import { withAccess } from "@/lib/request-guard";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { InputError } from "@/lib/mistake-contract";
import { mistakeInclude, saveConfirmedMistake, saveCapturedMistake } from "@/lib/mistake-service";

async function GETHandler(_req: Request) {
  void _req;
  return NextResponse.json(await prisma.mistakeItem.findMany({ include: mistakeInclude, orderBy: { createdAt: "desc" } }));
}
async function POSTHandler(req: Request) {
  try { const body = await req.json(); return NextResponse.json(await (body.mode === "capture" ? saveCapturedMistake(body) : saveConfirmedMistake(body)), { status: 201 }); }
  catch (error) {
    return NextResponse.json({ error: error instanceof InputError ? error.message : "保存失败，请保留草稿并重试" }, { status: error instanceof InputError || error instanceof SyntaxError ? 400 : 500 });
  }
}

export const GET = withAccess(GETHandler);
export const POST = withAccess(POSTHandler);
