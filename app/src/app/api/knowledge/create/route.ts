import { InputError, record, text } from "@/lib/mistake-contract";
import { integer, choice, nodeStatuses } from "@/lib/input-validation";
import { withAccess } from "@/lib/request-guard";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function POSTHandler(req: NextRequest) {
  try {
    const body = record(await req.json());
    const mastery = body.masteryLevel === undefined ? 0 : integer(body.masteryLevel, "掌握程度", 0, 5);
    const status = body.status === undefined ? "unlearned" : choice(body.status, "学习状态", nodeStatuses);
    if (body.relatedNames !== undefined && (!Array.isArray(body.relatedNames) || body.relatedNames.length > 30 || body.relatedNames.some(v => typeof v !== "string" || v.length > 180))) throw new InputError("关联名称格式无效");
    const name = text(body.name, "知识点名称", 180, true);
    const subjectName = text(body.subject, "科目", 80, true);

    if (!name || !subjectName) {
      return NextResponse.json(
        { error: "知识点名称和科目不能为空" },
        { status: 400 }
      );
    }

    const subject = await prisma.subject.findFirst({ where: { name: subjectName } });

    if (!subject) {
      return NextResponse.json({ error: "未找到对应科目" }, { status: 400 });
    }

    const existing = await prisma.knowledgeNode.findFirst({
      where: { catalogArchived: false, subjectId: subject.id, name },
      include: { subject: true },
    });

    if (existing) {
      return NextResponse.json({ node: existing, created: false });
    }

    let parentId: string | null = null;
    if (typeof body.parentName === "string" && body.parentName.trim()) {
      const parent = await prisma.knowledgeNode.findFirst({
        where: { catalogArchived: false, subjectId: subject.id, name: body.parentName.trim() },
      });
      parentId = parent?.id ?? null;
    }

    if (body.parentId) {
      const parent = await prisma.knowledgeNode.findUnique({ where: { id: text(body.parentId, "父节点", 128, true) } });
      if (!parent || parent.catalogArchived || parent.subjectId !== subject.id) throw new InputError("父节点不属于当前科目");
      parentId = parent.id;
    }
    const node = await prisma.knowledgeNode.create({
      data: {
        name,
        subjectId: subject.id,
        parentId,
        masteryLevel: mastery,
        status,
        description: body.description === undefined || body.description === null ? null : text(body.description, "说明", 100000),
        tags: body.tags === undefined || body.tags === null ? null : text(body.tags, "标签", 1000),
        nextReviewAt: new Date(),
      },
      include: { subject: true },
    });

    const relationNames = Array.isArray(body.relatedNames)
      ? body.relatedNames.filter((value: unknown): value is string => typeof value === "string")
      : [];

    for (const relationName of relationNames) {
      const target = await prisma.knowledgeNode.findFirst({
        where: { catalogArchived: false, name: relationName.trim(), id: { not: node.id } },
      });
      if (!target) continue;
      const duplicate = await prisma.knowledgeNodeRelation.findFirst({
        where: { sourceId: node.id, targetId: target.id },
      });
      if (!duplicate) {
        await prisma.knowledgeNodeRelation.create({
          data: { sourceId: node.id, targetId: target.id, label: "related" },
        });
      }
    }

    return NextResponse.json({ node, created: true }, { status: 201 });
  } catch (error) {
    if (error instanceof InputError) throw error;
    console.error("Create knowledge node failed");
    return NextResponse.json({ error: "创建知识点失败" }, { status: 500 });
  }
}

export const POST = withAccess(POSTHandler);
