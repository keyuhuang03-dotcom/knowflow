import { Prisma } from "@prisma/client";
import { InputError } from "./mistake-contract";
// Keep the legacy browser JSON export bounded; complete snapshots use streaming file tools.
export async function checkExportSize(tx: Prisma.TransactionClient) {
  const models = new Set(["User", "Subject", "Chapter", "KnowledgeNode", "KnowledgeNodeRelation", "MistakeItem", "StudySession", "Task", "DailyReview", "Resource", "Note", "MistakeJob"]);
  let estimate = 0;
  for (const model of Prisma.dmmf.datamodel.models.filter(m => models.has(m.name))) {
    const columns = model.fields.filter(f => f.kind !== "object" && f.type === "String").map(f => `COALESCE(length(CAST("${f.name}" AS BLOB)),0)`);
    const query = `SELECT COALESCE(SUM(${columns.join("+") || "0"}),0) AS bytes, COUNT(*) AS count FROM "${model.name}"`;
    const [result] = await tx.$queryRawUnsafe<Array<{ bytes: number | bigint; count: number | bigint }>>(query);
    estimate += Number(result.bytes) * 6 + Number(result.count) * 2048;
  }
  for (const table of ["_MistakeNodes", "_KnowledgeNodeToNote"]) {
    const [row] = await tx.$queryRawUnsafe<Array<{ count: number | bigint }>>(`SELECT COUNT(*) AS count FROM "${table}"`);
    estimate += Number(row.count) * 512;
  }
  if (estimate > 10 * 1024 * 1024) throw new InputError("数据较多，网页JSON导出已受限以保护内存；请使用完整备份工具，数据未被删除或截断");
}
