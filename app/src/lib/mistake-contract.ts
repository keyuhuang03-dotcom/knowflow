import { subjectParts } from "./subject-parts";
/** Shared, versioned boundary for the UI, vision provider and future Skill adapter. */
export type Analysis = {
  version: 1;
  origin: "ai" | "manual";
  diagnosisStatus?: "unconfirmed" | "confirmed";
  recognition?: "clear" | "uncertain";
  uncertainty?: string;
  nextCheck?: string;
  recognizedWork?: string;
  cardPending?: boolean;
  standardSolution?: string;
  finalAnswer?: string;
  errorOptions?: string[];
  selfReport?: SelfReport;
  question: string;
  coreConcept: string;
  stickingPoint: string;
  errorReason: string;
  method: string;
  reviewTip: string;
};
export type SelfReport = { stickingPoint: string; causes: string[]; customCause: string };
export const commonErrorOptions = ["概念理解不清", "公式或条件记错", "没有想到解题方法", "计算或符号错误", "审题遗漏", "还不确定"];
export function parseSelfReport(value: unknown): SelfReport {
  const raw = record(value);
  if (!Array.isArray(raw.causes) || raw.causes.length > 12) throw new InputError("错因选项格式不正确");
  return { stickingPoint: text(raw.stickingPoint, "我的卡点", 4000), causes: [...new Set(raw.causes.map(v => text(v, "错因", 100, true)))], customCause: text(raw.customCause, "自填错因", 1000) };
}
/** Merge only the latest user-owned reflection; background AI must never replace it. */
export function preserveSelfReport(next: Analysis, previous: string | null): Analysis {
  const saved = readAnalysis(previous).selfReport;
  return { ...next, selfReport: saved };
}
export type Candidate = { id: string; name: string; path: string };
export type Recommendation = { nodeId: string; reason: string };
export const analysisFields = [
  ["question", "题目识别结果"], ["coreConcept", "核心考点"],
  ["stickingPoint", "可能卡点 / 已确认卡点"], ["errorReason", "可能错因 / 已确认错因"],
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
  return Object.fromEntries([["version", 1], ["standardSolution", text(raw.standardSolution, "标准解答")], ["finalAnswer", text(raw.finalAnswer, "最终答案")], ["errorOptions", Array.isArray(raw.errorOptions) ? [...new Set(raw.errorOptions.filter((v): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 100).map(v => v.trim()))].slice(0, 6) : []], ["selfReport", raw.selfReport === undefined ? undefined : parseSelfReport(raw.selfReport)], ["cardPending", raw.cardPending === true], ["recognizedWork", text(raw.recognizedWork, "识别过程", 4000)], ["diagnosisStatus", raw.diagnosisStatus === "confirmed" ? "confirmed" : "unconfirmed"], ["recognition", raw.recognition === "clear" ? "clear" : "uncertain"], ["uncertainty", text(raw.uncertainty, "待核对信息")], ["nextCheck", text(raw.nextCheck, "下次先检查什么")], ["origin", raw.origin === "ai" ? "ai" : "manual"], ...analysisFields.map(([key, label]) => [key, text(raw[key], label)])]) as Analysis;
}
/** A question photo alone cannot establish why this particular student was wrong. */
export function requireStudentWorkEvidence(analysis: Analysis, hasStudentWork: boolean): Analysis {
  if (hasStudentWork) return analysis;
  return {
    ...analysis,
    stickingPoint: "缺少解题过程，无法定位个人卡点，待补充。",
    errorReason: "缺少解题过程，无法判断错误原因，待补充。",
  };
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
export function nodePath(node: { id: string; name: string; parentId: string | null; subjectPart?: string | null; chapter?: { name: string } | null }, all: { id: string; name: string; parentId: string | null }[], subject: string) {
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
  const partName = Object.values(subjectParts).flat().find(p => p.id === node.subjectPart)?.name;
  return [subject, ...(partName && !subject.includes(partName) ? [partName] : []), ...names].join(" / ");
}

export function reflectionSummary(value: string | null, legacyReason: string | null): string {
  const report = readAnalysis(value).selfReport;
  if (!report) return legacyReason || "";
  return [...report.causes, report.customCause, report.stickingPoint].filter(Boolean).join("；");
}
