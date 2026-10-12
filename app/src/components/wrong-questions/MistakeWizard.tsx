"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { v4 as uuid } from "uuid";
import type { Catalog } from "@/lib/knowledge-data";
import { emptyAnalysis } from "@/lib/mistake-contract";
import { persistDraft, restoreDraft, storageKey, type Draft } from "@/lib/mistake-draft";
import ImageIntake from "./ImageIntake";
import MultiImageIntake from "./MultiImageIntake";
import LegacyMistakeWizard from "./LegacyMistakeWizard";
import ProcessingStatus from "./ProcessingStatus";
const subscribe = () => () => {};
type Props = { subjects: Catalog; step: string; initialSubject: string; initialNode: string; legacy?: boolean };
export default function MistakeWizard(props: Props) {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  if (props.legacy) return <LegacyMistakeWizard {...props} />;
  return ready ? <Capture {...props} /> : <p role="status">正在读取图片草稿…</p>;
}
function Capture({ subjects, initialSubject, initialNode }: Props) {
  function blank(): Draft {
    const subject = subjects.find(s => s.id === initialSubject);
    return { id: uuid(), subjectId: subject?.id || "", title: "", source: "", userWork: "", imageUrl: "", userWorkImageUrl: "", analysis: { ...emptyAnalysis }, recommendations: [], selected: subject?.nodes.some(n => n.id === initialNode) ? [initialNode] : [], status: "idle" };
  }
  const [draft, setDraft] = useState<Draft>(() => {
    try { return restoreDraft(localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey), subjects) || blank(); } catch { return blank(); }
  });
  const ref = useRef(draft);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [savedId, setSavedId] = useState("");
  const [workPending, setWorkPending] = useState(false);
  const [sameImageWork, setSameImageWork] = useState(Boolean(draft.sameImageWork));
  useEffect(() => {
    try { persistDraft(localStorage, ref.current); } catch { queueMicrotask(() => setNotice("浏览器草稿存储失败，请完成上传后再离开。")); }
  }, []);
  function update(change: Partial<Draft>) {
    const next = { ...ref.current, ...change }; ref.current = next; setDraft(next);
    try { persistDraft(localStorage, next); } catch { setNotice("浏览器草稿存储失败，请先完成上传，勿刷新。"); }
  }
  function metadata() { if (workPending) throw new Error("请先上传或丢弃待上传的过程照片，再上传原题"); const d = ref.current; return { id: d.id, subjectId: d.subjectId, title: d.title, source: d.source, userWork: d.userWork, userWorkImageUrl: d.userWorkImageUrl, nodeIds: d.selected, sameImageWork }; }
  function saved(id: string) {
    setSavedId(id);
    try { localStorage.removeItem(storageKey); sessionStorage.removeItem(storageKey); } catch { setNotice("服务器已保存；本地草稿未清除，下次恢复时可继续查看同一记录。"); }
  }
  async function archiveExisting() {
    setBusy("正在保存已上传照片…");
    try {
      const response = await fetch("/api/mistakes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...metadata(), imageUrl: draft.imageUrl, mode: "capture", userWorkImageUrl: sameImageWork ? draft.imageUrl : draft.userWorkImageUrl }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error); saved(result.id);
    } catch (e) { setNotice(e instanceof Error ? e.message : "保存失败，原图和草稿仍可重试"); }
    finally { setBusy(""); }
  }
  if (savedId) return <div className="wb-page"><header className="wb-header"><div><p className="wb-eyebrow">把学习留给复习</p><h1>照片已保存</h1></div></header><ProcessingStatus id={savedId} /><div className="wb-actions"><Link className="btn btn-primary" href={`/wrong-questions/${savedId}`}>查看整理结果</Link><Link className="btn btn-secondary" href="/wrong-questions">返回我的错题</Link><button className="btn btn-secondary" onClick={() => { const next = blank(); ref.current = next; setDraft(next); setSavedId(""); setSameImageWork(false); }}>再拍一道</button></div>{notice && <p role="status">{notice}</p>}</div>;
  return <div className="wb-page"><Link className="wb-back" href="/wrong-questions">← 我的错题</Link><header className="wb-header"><div><p className="wb-eyebrow">拍照 → 自动整理 → 回看</p><h1>拍下这次卡点</h1><p className="wb-muted">同一道题的题干与过程可上传多页，全部上传成功即保存，不用等待 AI。</p></div></header><section className="wb-panel wb-stack"><fieldset className="wb-reset-fieldset wb-stack" disabled={Boolean(busy)}>
    <MultiImageIntake key={draft.id} storageId={`${draft.id}:imageUrl`} label="题干与过程" onBusy={setBusy} onPending={() => {}} uploadMetadata={metadata} onUploaded={async (_urls, result) => { if (!result?.mistakeId) throw new Error("服务器尚未确认保存，请重试"); saved(result.mistakeId); }} />
    <label className="wb-field">科目（可选）<select value={draft.subjectId} onChange={e => update({ subjectId: e.target.value, selected: [] })}><option value="">未确定，交给 AI 整理</option>{subjects.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
    <label className="wb-choice"><input type="checkbox" checked={sameImageWork} onChange={e => { setSameImageWork(e.target.checked); update({ sameImageWork: e.target.checked }); }} /><span>原题照片里也包含我的解题过程</span></label>
    <label className="wb-field">我卡在这里（可选）<textarea rows={2} maxLength={12000} value={draft.userWork} onChange={e => update({ userWork: e.target.value })} placeholder="一句话就好，也可以完全不填" /></label>
    <details className="wb-stack"><summary>补充来源、名称或单独的过程照片（可选）</summary><label className="wb-field">题目名称<input maxLength={180} value={draft.title} onChange={e => update({ title: e.target.value })} /></label><label className="wb-field">来源<input maxLength={500} value={draft.source} onChange={e => update({ source: e.target.value })} /></label><ImageIntake storageId={`${draft.id}:userWorkImageUrl`} label="解题过程" onBusy={setBusy} onPending={setWorkPending} onUploaded={url => update({ userWorkImageUrl: url })} />{draft.userWorkImageUrl && <p className="wb-muted">过程照片已上传，将随原题一起保存。</p>}</details>
    {draft.imageUrl && <button className="btn btn-primary" disabled={Boolean(busy)} onClick={() => void archiveExisting()}>恢复旧草稿：保存已上传原图并整理</button>}
    </fieldset><p className="wb-muted wb-small">请等到“照片已保存”再离开。AI 看不清的步骤会保留为待补充。上传前的处理图片会尝试暂存在此浏览器；换设备不能恢复。</p>
    <p className="wb-muted wb-small">照片、过程和已有教材目录会发送给已配置的图片 AI 服务。</p>
    <Link className="wb-text-link" href="/wrong-questions/new?manual=1">使用原有手动分析与确认流程</Link>
  </section>{notice && <p className="wb-error" role="alert">{notice}</p>}</div>;
}
