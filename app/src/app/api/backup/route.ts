import { prisma } from "@/lib/prisma";
import { InputError } from "@/lib/mistake-contract";
import { NextResponse } from "next/server";

interface BackupPayload {
  version: 1 | 2;
  exportedAt: string;
  data: {
    users: Array<{ id: string; name: string; examDate: string; createdAt: string }>;
    subjects: Array<{ id: string; name: string; targetScore: number | null; color: string; createdAt: string }>;
    chapters: Array<{ id: string; subjectId: string; name: string; progress: number; order: number }>;
    knowledgeNodes: Array<{ id: string; subjectId: string; chapterId: string | null; parentId: string | null; name: string; masteryLevel: number; status: string; tags: string | null; pageStart: number | null; pageEnd: number | null; description: string | null; nextReviewAt: string | null; lastReviewAt: string | null; createdAt: string }>;
    relations: Array<{ id: string; sourceId: string; targetId: string; label: string | null }>;
    mistakes: Array<{ id: string; subjectId: string | null; knowledgeNodeId: string | null; title: string; content: string; imageUrl: string | null; imageUrls?: string | null; answer: string | null; errorType: string | null; errorReason: string | null; aiAnalysis: string | null; relatedKnowledge: string | null; reviewStatus: string; createdAt: string; reviewedAt: string | null; linkedNodeIds?: string[]; source?: string | null; userWork?: string | null; userWorkImageUrl?: string | null; userNote?: string | null; skillRecordId?: string | null; processingStatus?: string; processingError?: string | null; inputVersion?: number; linksConfirmed?: boolean; updatedAt?: string }>;
    sessions: Array<{ id: string; userId: string; subjectId: string; date: string; durationMinutes: number; notes: string | null }>;
    tasks: Array<{ id: string; userId: string; subjectId: string | null; title: string; completed: boolean; priority: number; date: string; createdAt: string }>;
    reviews: Array<{ id: string; date: string; rating: number; aiSummary: string; strengths: string | null; problems: string | null; suggestion: string | null; createdAt: string }>;
    resources: Array<{ id: string; subjectId: string; knowledgeNodeId: string | null; title: string; type: string; fileUrl: string | null; tags: string | null; createdAt: string }>;
    jobs?: Array<{ id: string; mistakeId: string; inputVersion: number; status: string; attempts: number; maxAttempts: number; availableAt: string; leaseUntil: string | null; owner: string | null; lastError: string | null; createdAt: string; updatedAt: string }>;
    notes: Array<{ id: string; title: string; content: string; tags: string | null; createdAt: string; updatedAt: string; knowledgeNodeIds: string[] }>;
  };
}

export async function GET() {
  const [users, subjects, chapters, knowledgeNodes, relations, mistakes, sessions, tasks, reviews, resources, notes, jobs] = await prisma.$transaction(async tx => Promise.all([
    tx.user.findMany(),
    tx.subject.findMany(),
    tx.chapter.findMany(),
    tx.knowledgeNode.findMany(),
    tx.knowledgeNodeRelation.findMany(),
    tx.mistakeItem.findMany({ include: { linkedNodes: { select: { id: true } } } }),
    tx.studySession.findMany(),
    tx.task.findMany(),
    tx.dailyReview.findMany(),
    tx.resource.findMany(),
    tx.note.findMany({ include: { knowledgeNodes: { select: { id: true } } } }),
    tx.mistakeJob.findMany(),
  ]));

  return NextResponse.json({
    version: 2,
    exportedAt: new Date().toISOString(),
    data: {
      users,
      subjects,
      chapters,
      knowledgeNodes,
      relations,
      mistakes: mistakes.map(({ linkedNodes, ...item }) => ({ ...item, linkedNodeIds: linkedNodes.map(n => n.id) })),
      jobs,
      sessions,
      tasks,
      reviews,
      resources,
      notes: notes.map(({ knowledgeNodes: linkedNodes, ...note }) => ({
        ...note,
        knowledgeNodeIds: linkedNodes.map((node) => node.id),
      })),
    },
  });
}

const date = (value: string) => new Date(value);
const optionalDate = (value: string | null) => value ? new Date(value) : null;

export async function POST(req: Request) {
  try {
    const backup = await req.json() as BackupPayload;
    if (![1, 2].includes(backup?.version) || !backup.data || !Array.isArray(backup.data.users)) {
      return NextResponse.json({ error: "备份文件格式无效" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const lease = await tx.workerLease.findFirst({ where: { expiresAt: { gt: new Date() } } });
      if (lease) throw new InputError("请先停止后台 Worker 再导入备份");
      await tx.mistakeJob.deleteMany();
      await tx.workerLease.deleteMany();
      await tx.studySession.deleteMany();
      await tx.task.deleteMany();
      await tx.mistakeItem.deleteMany();
      await tx.dailyReview.deleteMany();
      await tx.note.deleteMany();
      await tx.resource.deleteMany();
      await tx.knowledgeNodeRelation.deleteMany();
      await tx.knowledgeNode.deleteMany();
      await tx.chapter.deleteMany();
      await tx.subject.deleteMany();
      await tx.user.deleteMany();

      if (backup.data.users.length) await tx.user.createMany({ data: backup.data.users.map((item) => ({ ...item, examDate: date(item.examDate), createdAt: date(item.createdAt) })) });
      if (backup.data.subjects.length) await tx.subject.createMany({ data: backup.data.subjects.map((item) => ({ ...item, createdAt: date(item.createdAt) })) });
      if (backup.data.chapters.length) await tx.chapter.createMany({ data: backup.data.chapters });
      if (backup.data.knowledgeNodes.length) await tx.knowledgeNode.createMany({ data: backup.data.knowledgeNodes.map((item) => ({ ...item, nextReviewAt: optionalDate(item.nextReviewAt), lastReviewAt: optionalDate(item.lastReviewAt), createdAt: date(item.createdAt) })) });
      if (backup.data.relations.length) await tx.knowledgeNodeRelation.createMany({ data: backup.data.relations });
      for (const item of backup.data.mistakes) {
        const { linkedNodeIds, updatedAt, ...fields } = item;
        await tx.mistakeItem.create({ data: { ...fields, processingStatus: fields.processingStatus === "processing" ? "queued" : fields.processingStatus, createdAt: date(item.createdAt), reviewedAt: optionalDate(item.reviewedAt), updatedAt: updatedAt ? date(updatedAt) : date(item.createdAt), linkedNodes: { connect: [...new Set(linkedNodeIds || (item.knowledgeNodeId ? [item.knowledgeNodeId] : []))].map(id => ({ id })) } } });
      }
      for (const job of backup.data.jobs || []) await tx.mistakeJob.create({ data: { ...job, status: job.status === "running" ? "queued" : job.status, owner: null, leaseUntil: null, availableAt: new Date(), createdAt: date(job.createdAt), updatedAt: date(job.updatedAt) } });
      if (backup.data.sessions.length) await tx.studySession.createMany({ data: backup.data.sessions.map((item) => ({ ...item, date: date(item.date) })) });
      if (backup.data.tasks.length) await tx.task.createMany({ data: backup.data.tasks.map((item) => ({ ...item, date: date(item.date), createdAt: date(item.createdAt) })) });
      if (backup.data.reviews.length) await tx.dailyReview.createMany({ data: backup.data.reviews.map((item) => ({ ...item, date: date(item.date), createdAt: date(item.createdAt) })) });
      if (backup.data.resources.length) await tx.resource.createMany({ data: backup.data.resources.map((item) => ({ ...item, createdAt: date(item.createdAt) })) });
      for (const note of backup.data.notes) {
        await tx.note.create({
          data: {
            id: note.id,
            title: note.title,
            content: note.content,
            tags: note.tags,
            createdAt: date(note.createdAt),
            updatedAt: date(note.updatedAt),
            knowledgeNodes: { connect: note.knowledgeNodeIds.map((id) => ({ id })) },
          },
        });
      }
    }, { timeout: 30_000 });

    return NextResponse.json({ ok: true, importedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Import backup failed:", error);
    return NextResponse.json({ error: error instanceof InputError ? error.message : "导入失败，原数据未被替换" }, { status: error instanceof InputError ? 409 : 500 });
  }
}
