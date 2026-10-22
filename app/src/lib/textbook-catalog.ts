import { partBooks, validateSubjectPart } from "./subject-parts";
import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import { InputError, record, text } from "./mistake-contract";
export type CatalogEntry = { path: string[]; page: number | null };
export type CatalogMode = "append" | "replace";
export class CatalogConflict extends InputError {}
export function parseCatalogEntries(value: unknown): CatalogEntry[] {
  if (!Array.isArray(value) || !value.length || value.length > 200) throw new InputError("请核对并选择 1～200 条目录");
  const entries = new Map<string, CatalogEntry>();
  for (const item of value) {
    const raw = record(item);
    if (!Array.isArray(raw.path) || !raw.path.length || raw.path.length > 6) throw new InputError("目录层级应为 1～6 层");
    const path = raw.path.map(v => text(v, "目录名称", 150, true));
    const page = raw.page === undefined || raw.page === null ? null : raw.page;
    if (page !== null && (typeof page !== "number" || !Number.isInteger(page) || page < 1 || page > 10000)) throw new InputError("目录页码不正确");
    const key = JSON.stringify(path); const previous = entries.get(key);
    if (previous?.page != null && page != null && previous.page !== page) throw new InputError(`“${path.join(" / ")}”出现不同页码，请对照原图核对`);
    entries.set(key, { path, page: page ?? previous?.page ?? null });
  }
  return [...entries.values()];
}
export function catalogWarnings(entries: CatalogEntry[]) {
  const warnings: string[] = []; const paths = new Map(entries.map(e => [JSON.stringify(e.path), e]));
  for (const e of entries) {
    if (e.page === null) warnings.push(`“${e.path.join(" / ")}”页码待核对`);
    if (e.path.length === 1 && /^\d+\.\d+/.test(e.path[0])) warnings.push(`“${e.path[0]}”看起来是小节，尚未归入章节，请修改层级`);
    const parent = paths.get(JSON.stringify(e.path.slice(0, -1)));
    if (parent?.page != null && e.page != null && e.page < parent.page) warnings.push(`“${e.path.join(" / ")}”页码早于上级章节，请核对`);
  }
  if (entries.length > 3 && entries.every(e => e.path.length === 1)) warnings.push("结果全部为同级目录，请核对原图是否包含缩进的小节；不要直接将小节作为章节保存。");
  return [...new Set(warnings)].slice(0, 30);
}
export async function importCatalog(subjectId: string, title: string, entries: CatalogEntry[], options: { mode?: CatalogMode; dryRun?: boolean; revision?: string; part?: string | null } = {}) {
  const mode = options.mode || "append";
  return prisma.$transaction(async tx => {
    const subject = await tx.subject.findUnique({ where: { id: subjectId } });
    if (!subject) throw new InputError("科目不存在");
    const part = validateSubjectPart(subjectId, options.part);
    const books = partBooks(subject.partTextbooks);
    if (!part && (Object.keys(books).length || await tx.knowledgeNode.count({where:{subjectId,subjectPart:{not:null}}}))) throw new InputError("请先选择高数、线代等所属部分，不能覆盖整个科目");
    const currentTitle = part ? books[part] : subject.textbookTitle;
    if (mode === "append" && currentTitle && currentTitle !== title) throw new InputError("追加模式不能混入另一本教材，请改用替换整本目录并核对影响范围");
    const nodes = await tx.knowledgeNode.findMany({ where: { subjectId, subjectPart: part }, orderBy: { id: "asc" } });
    const revision = createHash("sha256").update(JSON.stringify([part, currentTitle, nodes.map(n => [n.id, n.name, n.parentId, n.pageStart, n.catalogArchived, n.catalogOrder, n.catalogImported])])).digest("hex");
    if (!options.dryRun && mode === "replace" && !options.revision) throw new InputError("请先预览替换范围，再确认保存");
    if (options.revision && options.revision !== revision) throw new CatalogConflict("目录已被其他操作修改，请重新预览保存影响");
    const byId = new Map(nodes.map(n => [n.id, n]));
    function fullPath(id: string, seen = new Set<string>()): string[] | null {
      const n = byId.get(id); if (!n || seen.has(id)) return null;
      seen.add(id); if (!n.parentId) return [n.name];
      const parent = fullPath(n.parentId, seen); return parent ? [...parent, n.name] : null;
    }
    const existing = new Map<string, typeof nodes[number]>();
    if (!currentTitle || currentTitle === title) for (const n of nodes) {
      const path = fullPath(n.id); if (!n.catalogArchived && path) { const key = JSON.stringify(path); if (!existing.has(key)) existing.set(key, n); }
    }
    // Parents are included even if only a leaf was selected. Explicit parent pages win.
    const desired = new Map<string, CatalogEntry>();
    for (const entry of entries) for (let i = 1; i <= entry.path.length; i++) {
      const path = entry.path.slice(0, i), key = JSON.stringify(path);
      if (!desired.has(key)) desired.set(key, { path, page: null });
      if (i === entry.path.length) desired.set(key, entry);
    }
    const retained = new Set([...desired.keys()].flatMap(k => existing.has(k) ? [existing.get(k)!.id] : []));
    const archiveIds = mode === "replace" ? nodes.filter(n => !n.catalogArchived && !retained.has(n.id)).map(n => n.id) : [];
    const result = { created: desired.size - retained.size, reused: retained.size, archived: archiveIds.length, total: desired.size, revision, mode };
    if (options.dryRun) return result;
    const resolved = new Map<string, string>();
    let order = mode === "append" ? Math.max(0, ...nodes.map(n => n.catalogOrder)) + 1 : 0;
    for (const [key, entry] of desired) {
      const prior = existing.get(key);
      const parentId = entry.path.length > 1 ? resolved.get(JSON.stringify(entry.path.slice(0, -1)))! : null;
      if (prior) {
        // Personal content and associations are untouched. Replace updates catalog metadata only.
        await tx.knowledgeNode.update({ where: { id: prior.id }, data: { catalogImported: true, pageStart: mode === "replace" ? entry.page : entry.page ?? prior.pageStart, ...(mode === "replace" ? { catalogOrder: order++, chapterId: null, pageEnd: null } : {}) } });
        resolved.set(key, prior.id);
      } else {
        const node = await tx.knowledgeNode.create({ data: { subjectId, subjectPart: part, catalogImported: true, name: entry.path.at(-1)!, parentId, pageStart: entry.page, catalogOrder: order++ } });
        resolved.set(key, node.id);
      }
    }
    if (archiveIds.length) await tx.knowledgeNode.updateMany({ where: { id: { in: archiveIds } }, data: { catalogArchived: true } });
    await tx.subject.update({ where: { id: subjectId }, data: part ? { partTextbooks: JSON.stringify({...books,[part]:title}) } : { textbookTitle: title } });
    return result;
  }, { timeout: 30000 });
}
