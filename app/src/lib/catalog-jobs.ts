import { prisma } from "./prisma";
import { InputError } from "./mistake-contract";
import { subjectParts, validateSubjectPart } from "./subject-parts";
import { readUploadedImage } from "./mistake-files";
export function catalogJobView(job: { id: string; status: string; completedPages: number; images: string; entries: string; warnings: string; lastError: string | null }) {
  const images: string[] = JSON.parse(job.images);
  return { id: job.id, status: job.status, completedPages: job.completedPages, totalPages: images.length, images, entries: JSON.parse(job.entries), warnings: JSON.parse(job.warnings), error: job.lastError };
}
export async function startCatalogJob(subjectId: string, partValue: unknown, images: unknown, retryId?: unknown) {
  const part = validateSubjectPart(subjectId, partValue) || "";
  if (subjectParts[subjectId]?.length && !part) throw new InputError("请先选择教材所属部分，例如数据结构或计算机网络");
  if (retryId !== undefined) {
    if (typeof retryId !== "string") throw new InputError("目录任务无效");
    const job = await prisma.catalogJob.findFirst({ where: { id: retryId, subjectId, part } });
    if (!job) throw new InputError("目录任务不存在");
    if (job.status === "failed") return catalogJobView(await prisma.catalogJob.update({ where: { id: job.id }, data: { status: "queued", attempts: 0, availableAt: new Date(), lastError: null } }));
    return catalogJobView(job);
  }
  if (!Array.isArray(images) || !images.length || images.length > 6 || images.some(v => typeof v !== "string")) throw new InputError("请上传 1～6 张目录照片");
  const files = await Promise.all(images.map(url => readUploadedImage(url)));
  if (files.reduce((sum, f) => sum + f.bytes.length, 0) > 24 * 1024 * 1024) throw new InputError("目录图片总大小超过24MB，请分批识别");
  const encoded = JSON.stringify(images);
  return prisma.$transaction(async tx => {
    const latest = await tx.catalogJob.findFirst({ where: { subjectId, part }, orderBy: { createdAt: "desc" } });
    if (latest && ["queued", "running", "ready"].includes(latest.status)) {
      if (latest.images === encoded) return catalogJobView(latest);
      throw new InputError("此部分已有未完成或待保存的识别任务，请先恢复并处理该预览。");
    }
    return catalogJobView(await tx.catalogJob.create({ data: { subjectId, part, images: encoded } }));
  });
}
