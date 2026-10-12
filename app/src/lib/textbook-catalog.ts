import { prisma } from "./prisma";
import { InputError, record, text } from "./mistake-contract";
export type CatalogEntry = { path: string[]; page: number | null };
export function parseCatalogEntries(value: unknown): CatalogEntry[] {
  if (!Array.isArray(value) || !value.length || value.length > 200) throw new InputError("请核对并选择 1～200 条目录");
  const seen = new Set<string>();
  return value.flatMap(item => {
    const raw = record(item);
    if (!Array.isArray(raw.path) || !raw.path.length || raw.path.length > 6) throw new InputError("目录层级应为 1～6 层");
    const path = raw.path.map(v => text(v, "目录名称", 150, true));
    const page = raw.page === undefined || raw.page === null ? null : raw.page;
    if (page !== null && (typeof page !== "number" || !Number.isInteger(page) || page < 1 || page > 10000)) throw new InputError("目录页码不正确");
    const key = JSON.stringify(path); if (seen.has(key)) return []; seen.add(key);
    return [{ path, page: page as number | null }];
  });
}
export async function importCatalog(subjectId: string, title: string, entries: CatalogEntry[]) {
  return prisma.$transaction(async tx => {
    const subject = await tx.subject.findUnique({ where: { id: subjectId } });
    if (!subject) throw new InputError("科目不存在");
    if (subject.textbookTitle && subject.textbookTitle !== title) throw new InputError("当前已有主教材，请先在“管理教材”中核对教材名称，避免混入另一本目录");
    let created = 0;
    for (const entry of entries) {
      let parentId: string | null = null;
      for (let i = 0; i < entry.path.length; i++) {
        const name = entry.path[i];
        const existing: { id: string } | null = await tx.knowledgeNode.findFirst({ where: { subjectId, parentId, name }, select: { id: true } });
        if (existing) parentId = existing.id;
        else {
          const node: { id: string } = await tx.knowledgeNode.create({ data: { subjectId, name, parentId, pageStart: i === entry.path.length - 1 ? entry.page : null }, select: { id: true } });
          parentId = node.id; created++;
        }
      }
    }
    if (!subject.textbookTitle) await tx.subject.update({ where: { id: subjectId }, data: { textbookTitle: title } });
    return { created };
  }, { timeout: 15000 });
}
