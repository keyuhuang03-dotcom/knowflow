import { Prisma } from "@prisma/client";
import { InputError, record, text } from "./mistake-contract";
import { ids, dateValue } from "./input-validation";
const models: Record<string, string> = { users: "User", subjects: "Subject", chapters: "Chapter", knowledgeNodes: "KnowledgeNode", relations: "KnowledgeNodeRelation", mistakes: "MistakeItem", sessions: "StudySession", tasks: "Task", reviews: "DailyReview", resources: "Resource", notes: "Note", jobs: "MistakeJob" };
export function validateBackup(value: unknown) {
  const root = record(value); if (root.version !== 1 && root.version !== 2) throw new InputError("备份版本不支持");
  const data = record(root.data);
  if (Object.keys(data).some(key => !Object.hasOwn(models, key))) throw new InputError("备份包含未知集合");
  const requiredDates: Record<string, string[]> = { users: ["examDate", "createdAt"], subjects: ["createdAt"], knowledgeNodes: ["createdAt"], mistakes: ["createdAt"], sessions: ["date"], tasks: ["date", "createdAt"], reviews: ["date", "createdAt"], resources: ["createdAt"], notes: ["createdAt", "updatedAt"], jobs: ["createdAt", "updatedAt", "availableAt"] };
  const sets: Record<string, Set<string>> = {};
  for (const [table, modelName] of Object.entries(models)) {
    const rows = table === "jobs" && data[table] === undefined ? [] : data[table];
    if (!Array.isArray(rows) || rows.length > 10000) throw new InputError(`${table}备份集合缺失或过大`);
    const model = Prisma.dmmf.datamodel.models.find(m => m.name === modelName)!;
    sets[table] = new Set();
    for (const raw of rows) {
      const item = record(raw);
      for (const key of requiredDates[table] || []) dateValue(item[key], "备份日期");
      const id = text(item.id, "备份记录标识", 128, true);
      if (sets[table].has(id)) throw new InputError(`${table}存在重复记录标识`); sets[table].add(id);
      for (const [key, v] of Object.entries(item)) {
        if (key === "linkedNodeIds" && table === "mistakes" || key === "knowledgeNodeIds" && table === "notes") { ids(v, "知识关联", 500); continue; }
        const field = model.fields.find(f => f.name === key && f.kind !== "object");
        if (!field) throw new InputError(`${table}包含未知字段`);
        if (v === null) { if (field.isRequired) throw new InputError(`${table}必填字段为空`); continue; }
        if (field.type === "String" && (typeof v !== "string" || v.length > 200000) || field.type === "Boolean" && typeof v !== "boolean" || ["Int", "Float"].includes(field.type) && (typeof v !== "number" || !Number.isFinite(v) || field.type === "Int" && !Number.isInteger(v))) throw new InputError(`${table}字段类型无效`);
        if (field.type === "DateTime") dateValue(v, "备份日期");
      }
      for (const field of model.fields) if (field.kind !== "object" && field.isRequired && !field.hasDefaultValue && field.type !== "DateTime" && item[field.name] === undefined) throw new InputError(`${table}缺少必填字段`);
      if (table === "notes" && !Array.isArray(item.knowledgeNodeIds)) throw new InputError("笔记缺少知识关联集合");
      if (table === "jobs" && (Number(item.maxAttempts) < 1 || Number(item.maxAttempts) > 10 || Number(item.attempts) < 0 || Number(item.attempts) > 10)) throw new InputError("任务重试次数无效");
    }
  }
  const links: Record<string, Record<string, string>> = { chapters: { subjectId: "subjects" }, knowledgeNodes: { subjectId: "subjects", parentId: "knowledgeNodes", chapterId: "chapters" }, relations: { sourceId: "knowledgeNodes", targetId: "knowledgeNodes" }, mistakes: { subjectId: "subjects", knowledgeNodeId: "knowledgeNodes" }, sessions: { userId: "users", subjectId: "subjects" }, tasks: { userId: "users", subjectId: "subjects" }, resources: { subjectId: "subjects", knowledgeNodeId: "knowledgeNodes" }, jobs: { mistakeId: "mistakes" } };
  for (const [table, fields] of Object.entries(links)) for (const raw of (data[table] || []) as unknown[]) {
    const item = record(raw); for (const [field, target] of Object.entries(fields)) if (item[field] !== null && item[field] !== undefined && !sets[target].has(String(item[field]))) throw new InputError(`${table}引用的记录不存在`);
  }
  for (const table of ["notes", "mistakes"]) for (const raw of data[table] as unknown[]) {
    const item = record(raw); const linked = item[table === "notes" ? "knowledgeNodeIds" : "linkedNodeIds"];
    if (linked !== undefined && ids(linked, "知识关联", 500).some(id => !sets.knowledgeNodes.has(id))) throw new InputError("备份知识关联不存在");
  }
}
