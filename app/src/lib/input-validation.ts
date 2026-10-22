import { InputError, text } from "./mistake-contract";
export function integer(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new InputError(`${label}超出允许范围`);
  return value;
}
export function dateValue(value: unknown, label: string) {
  const input = text(value, label, 40, true);
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(input)) throw new InputError(`${label}格式无效`);
  const result = new Date(input);
  if (!Number.isFinite(result.getTime()) || new Date(Date.UTC(Number(input.slice(0,4)), Number(input.slice(5,7)) - 1, Number(input.slice(8,10)))).toISOString().slice(0, 10) !== input.slice(0, 10)) throw new InputError(`${label}日期无效`);
  return result;
}
export function ids(value: unknown, label = "关联知识点", max = 100) {
  if (!Array.isArray(value) || value.length > max) throw new InputError(`${label}格式无效或数量过多`);
  const result = value.map(v => text(v, label, 128, true));
  if (new Set(result).size !== result.length) throw new InputError(`${label}不能重复`);
  return result;
}
export function choice(value: unknown, label: string, allowed: readonly string[]) {
  if (typeof value !== "string" || !allowed.includes(value)) throw new InputError(`${label}无效`);
  return value;
}
export const nodeStatuses = ["unlearned", "learning", "mastered", "keypoint", "frequent_mistake"];

export async function existingNodes(value: unknown) {
  const selected = ids(value);
  const { prisma } = await import("./prisma");
  if (await prisma.knowledgeNode.count({ where: { id: { in: selected } } }) !== selected.length) throw new InputError("关联知识点不存在");
  return selected;
}
