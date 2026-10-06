/** Shared, versioned boundary for the UI, vision provider and future Skill adapter. */
export type Analysis = {
  version: 1;
  origin: "ai" | "manual";
  question: string;
  coreConcept: string;
  stickingPoint: string;
  errorReason: string;
  method: string;
  reviewTip: string;
};
export type Candidate = { id: string; name: string; path: string };
export type Recommendation = { nodeId: string; reason: string };
export const analysisFields = [
  ["question", "题目识别结果"], ["coreConcept", "核心考点"],
  ["stickingPoint", "我的卡点"], ["errorReason", "错误原因"],
  ["method", "关键公式 / 方法"], ["reviewTip", "下次遇到这类题"],
] as const;
export const emptyAnalysis: Analysis = { version: 1, origin: "manual", question: "", coreConcept: "", stickingPoint: "", errorReason: "", method: "", reviewTip: "" };

export class InputError extends Error {}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError("请求格式不正确");
  return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, max = 12000, required = false): string {
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string" || value.length > max) throw new InputError(`${label}格式不正确或过长`);
  const result = value.trim();
  if (required && !result) throw new InputError(`请填写${label}`);
  return result;
}
export function parseAnalysis(value: unknown): Analysis {
  const raw = record(value);
  return Object.fromEntries([["version", 1], ["origin", raw.origin === "ai" ? "ai" : "manual"], ...analysisFields.map(([key, label]) => [key, text(raw[key], label)])]) as Analysis;
}
export function readAnalysis(value: string | null): Analysis {
  if (!value) return { ...emptyAnalysis };
  try {
    const raw = record(JSON.parse(value));
    return parseAnalysis({ ...raw, coreConcept: raw.coreConcept || raw.knowledgePoint, reviewTip: raw.reviewTip || raw.suggestion });
  }
  catch { return { ...emptyAnalysis, reviewTip: value }; }
}
export function filterRecommendations(value: unknown, candidates: Candidate[]): Recommendation[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(candidates.map(n => n.id));
  const seen = new Set<string>();
  return value.flatMap(item => {
    if (!item || typeof item !== "object" || typeof item.nodeId !== "string" || !allowed.has(item.nodeId) || seen.has(item.nodeId)) return [];
    seen.add(item.nodeId);
    return [{ nodeId: item.nodeId, reason: typeof item.reason === "string" ? item.reason.slice(0, 300) : "请核对教材路径后选择" }];
  }).slice(0, 3);
}
export function parseNodeIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3 || value.some(v => typeof v !== "string" || !v || v.length > 100)) {
    throw new InputError("请确认关联 1～3 个已有知识点");
  }
  return [...new Set(value)] as string[];
}
export function nodePath(node: { id: string; name: string; parentId: string | null; chapter?: { name: string } | null }, all: { id: string; name: string; parentId: string | null }[], subject: string) {
  const names = [node.name];
  const visited = new Set([node.id]);
  let parentId = node.parentId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = all.find(n => n.id === parentId);
    if (!parent) break;
    names.unshift(parent.name); parentId = parent.parentId;
  }
  if (node.chapter && !names.includes(node.chapter.name)) names.unshift(node.chapter.name);
  return [subject, ...names].join(" / ");
}
