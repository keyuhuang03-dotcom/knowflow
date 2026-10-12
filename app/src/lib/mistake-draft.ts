import { filterRecommendations, parseAnalysis, type Analysis, type Candidate, type Recommendation } from "./mistake-contract";
export const storageKey = "kaoyan.mistake.draft.v1";
export type Draft = { id: string; sameImageWork?: boolean; imageUrls?: string[]; subjectId: string; title: string; source: string; userWork: string; imageUrl: string; userWorkImageUrl: string; analysis: Analysis; recommendations: Recommendation[]; selected: string[]; status: "idle" | "complete" | "manual" };
export function restoreDraft(serialized: string | null, subjects: { id: string; nodes: Candidate[] }[]): Draft | null {
  try {
    const raw = JSON.parse(serialized || "null");
    const subject = subjects.find(s => s.id === raw?.subjectId);
    if ((!subject && raw?.subjectId !== "") || typeof raw.id !== "string" || !/^[0-9a-f-]{36}$/i.test(raw.id) || !["idle", "manual", "complete"].includes(raw.status) || !Array.isArray(raw.selected) || !Array.isArray(raw.recommendations) || ![raw.title, raw.imageUrl, raw.source, raw.userWork, raw.userWorkImageUrl].every(v => typeof v === "string")) return null;
    return { ...raw, analysis: parseAnalysis(raw.analysis), selected: [...new Set<string>(raw.selected.filter((id: unknown) => (subject?.nodes || []).some(n => n.id === id)))].slice(0, 3), recommendations: filterRecommendations(raw.recommendations, (subject?.nodes || [])) };
  } catch { return null; }
}
export function persistDraft(storage: Pick<Storage, "setItem">, draft: Draft) {
  // Propagate quota/private-mode failures: the caller must retain memory state and warn.
  storage.setItem(storageKey, JSON.stringify(draft));
}
