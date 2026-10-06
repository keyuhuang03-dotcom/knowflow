"use client";
/* eslint-disable @next/next/no-img-element -- Uploaded originals are displayed without remote image optimization. */
import { useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Upload, Sparkles, Check } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { Catalog } from "@/lib/knowledge-data";
import { emptyAnalysis, parseAnalysis, type Analysis, type Recommendation } from "@/lib/mistake-contract";
import AnalysisFields from "./AnalysisFields";
const storageKey = "kaoyan.mistake.draft.v1";
type Draft = { id: string; subjectId: string; title: string; source: string; userWork: string; imageUrl: string; userWorkImageUrl: string; analysis: Analysis; recommendations: Recommendation[]; selected: string[]; status: "idle" | "complete" | "manual" };
const subscribe = () => () => {};
export default function MistakeWizard(props: { subjects: Catalog; step: string; initialSubject: string; initialNode: string }) {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  return ready ? <Wizard {...props} /> : <div className="wb-empty" role="status">正在读取错题草稿…</div>;
}
function Wizard({ subjects, initialSubject, initialNode }: { subjects: Catalog; step: string; initialSubject: string; initialNode: string }) {
  function blank(): Draft {
    const subject = subjects.find(s => s.id === initialSubject) || subjects[0];
    return { id: uuidv4(), subjectId: subject?.id || "", title: "", source: "", userWork: "", imageUrl: "", userWorkImageUrl: "", analysis: { ...emptyAnalysis }, recommendations: [], selected: subject?.nodes.some(n => n.id === initialNode) ? [initialNode] : [], status: "idle" };
  }
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const raw = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (raw && typeof raw.id === "string" && subjects.some(s => s.id === raw.subjectId) && ["idle", "manual", "complete"].includes(raw.status) && Array.isArray(raw.selected) && Array.isArray(raw.recommendations) && [raw.title, raw.imageUrl, raw.source, raw.userWork, raw.userWorkImageUrl].every(v => typeof v === "string")) return { ...raw, analysis: parseAnalysis(raw.analysis) };
    } catch { /* A missing or invalid local draft starts a clean record. */ }
    return blank();
  });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [query, setQuery] = useState("");
  const inFlight = useRef(false);
  const router = useRouter();
  const subject = subjects.find(s => s.id === draft.subjectId);
  const pathname = usePathname();
  const currentStep = pathname.endsWith("/confirm") ? "confirm" : pathname.endsWith("/analysis") ? "analysis" : "upload";
  const activeStep = !draft.imageUrl || draft.status === "idle" && currentStep === "confirm" ? "upload" : currentStep;
  const update = (change: Partial<Draft>) => {
    const next = { ...draft, ...change };
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { setStorageError(true); }
    setDraft(next);
  };
  function inputChange(change: Partial<Draft>) { update({ ...change, status: "idle", analysis: { ...emptyAnalysis }, recommendations: [], selected: [] }); }
  function go(next: string) { window.history.pushState(null, "", `/wrong-questions/new${next === "upload" ? "" : `/${next}`}`); }
  async function upload(file: File | undefined, field: "imageUrl" | "userWorkImageUrl") {
    if (!file || inFlight.current) return;
    if (file.size > 10 * 1024 * 1024) { setError("图片超过 10MB，请压缩后重新上传。"); return; }
    inFlight.current = true; setBusy("上传图片中…"); setError("");
    try {
      const form = new FormData(); form.append("file", file); form.append("purpose", "mistake");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const result = await res.json(); if (!res.ok) throw new Error(result.error);
      inputChange({ [field]: result.url });
    } catch(e) { setError(e instanceof Error ? e.message : "上传失败，请重试"); }
    finally { inFlight.current = false; setBusy(""); }
  }
  async function analyze() {
    if (inFlight.current) return;
    if (!subject?.textbookTitle || !subject.nodes.length) { setError("请先在科目知识库确认主教材与知识目录。"); return; }
    if (!draft.imageUrl) { setError("请先上传或拍摄原题。"); return; }
    inFlight.current = true; setBusy("正在识别题目和复习线索…"); setError(""); go("analysis");
    try {
      const res = await fetch("/api/ai/analyze-mistake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft), signal: AbortSignal.timeout(55000) });
      const result = await res.json(); if (!res.ok) throw new Error(result.error);
      update({ analysis: result.analysis, recommendations: result.recommendations, selected: [], status: "complete" });
    } catch(e) { setError(e instanceof Error ? e.message : "分析失败，请重试或手动补充。"); }
    finally { inFlight.current = false; setBusy(""); }
  }
  async function save() {
    if (inFlight.current) return;
    if (!draft.selected.length) { setError("请勾选至少一个知识点，再确认保存。"); return; }
    inFlight.current = true; setBusy("正在保存并关联…"); setError("");
    try {
      const res = await fetch("/api/mistakes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, title: draft.title || draft.analysis.coreConcept.slice(0, 100) || "错题记录", nodeIds: draft.selected, confirmed: true }) });
      const result = await res.json(); if (!res.ok) throw new Error(result.error);
      try { sessionStorage.removeItem(storageKey); } catch { /* Saving on the server succeeded. */ }
      router.push(`/wrong-questions/${result.id}`); router.refresh();
    } catch(e) { setError(e instanceof Error ? e.message : "保存失败，草稿已保留，请重试。"); inFlight.current = false; setBusy(""); }
  }
  function toggle(id: string) {
    if (draft.selected.includes(id)) update({ selected: draft.selected.filter(n => n !== id) });
    else if (draft.selected.length < 3) update({ selected: [...draft.selected, id] });
    else setError("最多关联三个知识点，请先取消一个已选节点。");
  }
  const recommendations = draft.recommendations.filter(r => subject?.nodes.some(n => n.id === r.nodeId));
  const steps = [["upload", "添加错题"], ["analysis", "分析与校对"], ["confirm", "确认知识点"]];
  return <div className="wb-page">
    <Link className="wb-back" href={subject ? `/knowledge/${subject.id}` : "/knowledge"}>← 返回知识库</Link>
    <div className="wb-steps">{steps.map(([id, label], i) => <span key={id} aria-current={activeStep === id ? "step" : undefined} className={activeStep === id ? "active" : ""}><b>{i + 1}</b>{label}</span>)}</div>
    <header className="wb-header"><div><p className="wb-eyebrow">把这次学习，留给下次复习</p><h1>{activeStep === "upload" ? "添加错题" : activeStep === "analysis" ? "错题分析与校对" : "关联知识点"}</h1><p className="wb-muted">{activeStep === "upload" ? "拍照即可开始，无需手动抄题。" : activeStep === "analysis" ? "保留原题，核对值得沉淀的信息。" : `从《${subject?.textbookTitle || "主教材"}》现有目录中选择，确认后才会保存。`}</p></div></header>
    {storageError && <p className="wb-notice">浏览器无法暂存草稿，请勿刷新或关闭页面。</p>}
    {error && <p className="wb-error" role="alert">{error}</p>}
    {busy && <p className="wb-notice" role="status">{busy}</p>}
    <fieldset disabled={Boolean(busy)} className="wb-reset-fieldset">
    {activeStep === "upload" ? <div className="wb-columns"><section className="wb-panel wb-stack">
      <label className="wb-field">所属科目<select value={draft.subjectId} onChange={e => inputChange({ subjectId: e.target.value })}>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      {(!subject?.textbookTitle || !subject.nodes.length) && <p className="wb-notice">请先<Link className="wb-text-link" href={`/knowledge/${subject?.id || ""}`}>确认主教材与知识目录</Link>，再开始分析。</p>}
      <div className="wb-upload">{draft.imageUrl ? <img src={draft.imageUrl} alt="已上传的原题" className="wb-original" /> : <><Upload size={34} strokeWidth={1.4} /><h2>放入一道值得再看的题</h2><p className="wb-muted">JPG、PNG、WebP · 最大 10MB</p></>}
        <div className="wb-actions"><label className="btn btn-primary gap-2"><Upload size={16} />{draft.imageUrl ? "更换图片" : "上传图片"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { void upload(e.target.files?.[0], "imageUrl"); e.target.value = ""; }} /></label><label className="btn btn-secondary gap-2"><Camera size={16} />拍照<input className="sr-only" type="file" accept="image/*" capture="environment" onChange={e => { void upload(e.target.files?.[0], "imageUrl"); e.target.value = ""; }} /></label></div>
      </div>
      <label className="wb-field">题目名称 <span>可选</span><input maxLength={180} value={draft.title} onChange={e => update({ title: e.target.value })} placeholder="给这道题一个方便找回的名字" /></label>
      <label className="wb-field">题目来源 <span>可选</span><input maxLength={500} value={draft.source} onChange={e => inputChange({ source: e.target.value })} placeholder="书籍 / 试卷 · 章节 · 页码 / 题号" /></label>
      <label className="wb-field">我的解题过程 <span>可选</span><textarea rows={4} maxLength={12000} value={draft.userWork} onChange={e => inputChange({ userWork: e.target.value })} placeholder="写下你的思路、卡住的地方，或上传解题过程照片。" /></label>
      <label className="btn btn-secondary">{draft.userWorkImageUrl ? "更换解题过程图片" : "补充解题过程图片"}<input className="sr-only" type="file" accept="image/*" onChange={e => { void upload(e.target.files?.[0], "userWorkImageUrl"); e.target.value = ""; }} /></label>
      {draft.userWorkImageUrl && <div><img src={draft.userWorkImageUrl} className="wb-original" alt="我的解题过程" /><button className="wb-text-button" onClick={() => inputChange({ userWorkImageUrl: "" })}>移除解题图片</button></div>}
      <div className="wb-actions"><button className="btn btn-primary gap-2" disabled={!draft.imageUrl} onClick={analyze}><Sparkles size={17} />开始 AI 分析</button><Link className="btn btn-secondary" href="/knowledge">取消并保留草稿</Link></div>
    </section><aside className="wb-panel wb-stack wb-fit"><h2>只需多做这一步</h2><p className="wb-muted">原题照片会始终保留。AI 帮你提取考点与复习线索，你来决定它属于哪个知识点。</p><hr /><p className="wb-muted">分析时，题目、解题过程与当前知识目录会发送给已配置的 AI 服务。请避免上传姓名等无关信息。</p><p className="wb-small wb-muted">当前浏览器标签页会暂存草稿，刷新后可继续。</p><button className="wb-text-button" onClick={() => { if (window.confirm("丢弃当前未保存的草稿并重新开始？")) { update(blank()); setError(""); } }}>清空草稿，重新开始</button></aside></div> : activeStep === "analysis" ? <>
      <div className="wb-two-columns"><section className="wb-panel wb-stack wb-fit"><h2>原题</h2><img src={draft.imageUrl} alt="原题图片" className="wb-original" /><p className="wb-muted">{draft.source || "未填写来源"}</p>{draft.userWork && <p className="wb-prewrap">我的过程：{draft.userWork}</p>}{draft.userWorkImageUrl && <img src={draft.userWorkImageUrl} className="wb-original" alt="我的解题过程" />}</section>
      <section className="wb-panel wb-stack"><div className="wb-between"><h2>复习线索</h2><span className="wb-badge">{draft.status === "complete" ? "AI 分析完成 · 请校对" : draft.status === "manual" ? "手动整理" : "等待分析"}</span></div>
      {draft.status === "idle" && <p className="wb-muted">若分析暂不可用，可以保留原图，手动补充复习信息并选择知识点。</p>}
      <AnalysisFields value={draft.analysis} onChange={value => update({ analysis: value, recommendations: [], status: draft.status === "idle" ? "manual" : draft.status })} />
      <p className="wb-muted wb-small">修改分析内容后，请自行核对关联位置；原 AI 推荐会清除。</p>
      <div className="wb-actions"><button className="btn btn-secondary" onClick={analyze}>重新分析</button>{draft.status === "idle" && <button className="btn btn-secondary" onClick={() => update({ status: "manual" })}>改为手动整理</button>}</div>
      </section></div><div className="wb-bottom-actions"><button className="btn btn-secondary" onClick={() => go("upload")}>返回修改</button><button className="btn btn-primary" disabled={draft.status === "idle"} onClick={() => { setError(""); go("confirm"); }}>继续关联知识点 →</button></div>
    </> : <section className="wb-panel wb-stack">
      <div className="wb-between"><h2>{recommendations.length ? "AI 推荐" : "选择已有知识点"}</h2><span className="wb-badge">已选择 {draft.selected.length} / 3</span></div>
      {!recommendations.length && <p className="wb-notice">暂无可用的 AI 推荐，请搜索或从下方目录手动选择。不会自动新增知识点。</p>}
      {recommendations.map(r => { const n = subject!.nodes.find(n => n.id === r.nodeId)!; return <label className="wb-choice" key={n.id}><input type="checkbox" checked={draft.selected.includes(n.id)} onChange={() => toggle(n.id)} /><div><strong>{n.name}</strong><p className="wb-muted">{n.path}</p><p className="wb-small">推荐依据：{r.reason}</p></div></label>; })}
      <label className="wb-field">搜索其他知识点<input value={query} onChange={e => setQuery(e.target.value)} placeholder="输入知识点或路径" /></label>
      <div className="wb-candidate-list">{subject?.nodes.filter(n => n.path.toLowerCase().includes(query.toLowerCase())).map(n => <label className="wb-choice" key={n.id}><input type="checkbox" checked={draft.selected.includes(n.id)} onChange={() => toggle(n.id)} /><div><strong>{n.name}</strong><p className="wb-muted wb-small">{n.path}</p></div></label>)}</div>
      {subject?.nodes.every(n => !n.path.toLowerCase().includes(query.toLowerCase())) && <p className="wb-muted">没有匹配的已有节点，请换个关键词。</p>}
      <div className="wb-selected">已选：{draft.selected.map(id => subject?.nodes.find(n => n.id === id)?.name).filter(Boolean).join("、") || "尚未选择"}</div>
      <p className="wb-muted wb-small">确认后，原题和复习卡片会同时出现在所选的知识节点中。</p>
      <div className="wb-bottom-actions"><button className="btn btn-secondary" onClick={() => go("analysis")}>返回校对</button><button className="btn btn-primary gap-2" disabled={!draft.selected.length} onClick={save}><Check size={17} />确认关联并保存</button></div>
    </section>}
    </fieldset>
  </div>;
}
