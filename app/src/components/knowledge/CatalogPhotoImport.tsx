"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MultiImageIntake from "@/components/wrong-questions/MultiImageIntake";
import type { CatalogEntry } from "@/lib/textbook-catalog";
type Plan = { created: number; reused: number; archived: number; total: number; revision: string };
type Job = { id: string; status: string; completedPages: number; totalPages: number; images: string[]; entries: CatalogEntry[]; warnings: string[]; error: string | null };
type Preview = { path: string; page: number | null; selected: boolean };
export default function CatalogPhotoImport({ subjectId, title, part }: { subjectId: string; title: string | null; part?: string }) {
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [open, setOpen] = useState(false);
  const [book, setBook] = useState(title || "");
  const [images, setImages] = useState<string[]>([]);
  const [entries, setEntries] = useState<Preview[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [requestBusy, setBusy] = useState("");
  const [imageBusy, setImageBusy] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const jobRef = useRef<Job | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [pollVersion, setPollVersion] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const busy = requestBusy || (job && ["queued", "running"].includes(job.status) ? `后台识别中：已完成 ${job.completedPages}/${job.totalPages} 页` : "");
  const lock = useRef(false);
  const router = useRouter();
  const key = `knowflow-catalog-${subjectId}${part ? `-${part}` : ""}`;
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let draft: { images?: string[]; entries?: Preview[]; book?: string; warnings?: string[]; mode?: string; jobId?: string; completedPages?: number } | null = null;
    const restore = setTimeout(() => {
    try {
      draft = JSON.parse(localStorage.getItem(key) || "null");
      if (draft && Array.isArray(draft.images) && draft.images.length <= 6 && draft.images.every(v => typeof v === "string" && /^\/uploads\/[a-zA-Z0-9_.-]+\.(jpg|jpeg|png|webp)$/i.test(v)) && Array.isArray(draft.entries) && draft.entries.length <= 600 && draft.entries.every(v => v && typeof v.path === "string" && typeof v.selected === "boolean" && (v.page === null || Number.isInteger(v.page)))) {
        setImages(draft.images); setEntries(draft.entries); setBook(typeof draft.book === "string" ? draft.book : title || "");
        setMode(draft.mode === "append" ? "append" : "replace"); setWarnings(Array.isArray(draft.warnings) ? draft.warnings : []);
        if (draft.images.length || draft.entries.length) setOpen(true);
      } else draft = null;
    } catch { draft = null; }
    async function poll() {
      let retryRead = false;
      try {
        const response = await fetch(`/api/subjects/${subjectId}/catalog?part=${encodeURIComponent(part || "")}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error();
        const next: Job | null = await response.json();
        if (!alive) return;
        if (next && !["saved", "discarded"].includes(next.status)) {
          const previous = jobRef.current;
          jobRef.current = next; setJob(next); setOpen(true);
          setImages(next.images);
          if (!previous || previous.completedPages !== next.completedPages || previous.status !== next.status) {
            const restored = draft?.jobId === next.id && draft.completedPages === next.completedPages && next.status === "ready" ? draft.entries : null;
            const preview = restored || next.entries.map(e => ({ path: e.path.join(" / "), page: e.page, selected: true }));
            setEntries(preview); setWarnings(next.warnings);
            try { const raw = JSON.parse(localStorage.getItem(key) || "{}"); localStorage.setItem(key, JSON.stringify({ ...raw, images: next.images, entries: preview, warnings: next.warnings, jobId: next.id, completedPages: next.completedPages })); } catch { /* Server retains the recognized preview. */ }
            if (next.status === "ready") { setMessage("识别已完成，目录尚未保存。请核对预览，再预览保存影响并确认。"); previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }
          }
        } else if (next && ["saved", "discarded"].includes(next.status)) {
          jobRef.current = null; setJob(null);
          if (draft?.jobId === next.id) { setImages([]); setEntries([]); try { localStorage.removeItem(key); } catch {} }
        }
      } catch { retryRead = true; if (alive && jobRef.current) setMessage("暂时无法读取进度，后台任务仍保留；恢复网络后继续检查。"); }
      finally {
        if (alive) { setLoaded(true); if (retryRead || (jobRef.current && ["queued", "running"].includes(jobRef.current.status))) timer = setTimeout(() => void poll(), 2500); }
      }
    }
    void poll();
    }, 0);
    return () => { alive = false; clearTimeout(restore); clearTimeout(timer); };
  }, [subjectId, part, key, title, pollVersion]);
  function retain(nextImages: string[], nextEntries: Preview[], nextBook = book, nextWarnings = warnings, nextMode = mode) {
    setPlan(null);
    try { localStorage.setItem(key, JSON.stringify({ mode: nextMode, images: nextImages, entries: nextEntries, book: nextBook, warnings: nextWarnings, jobId: jobRef.current?.id, completedPages: jobRef.current?.completedPages })); }
    catch { setMessage("目录草稿存储失败，当前预览仍可使用；请勿刷新，先完成确认。"); }
  }
  async function submit(save: boolean, commit = false) {
    if (lock.current || imageBusy || pending || !loaded || (save && job && job.status !== "ready")) return;
    lock.current = true; setBusy(save ? commit ? "正在保存目录…" : "正在检查保存范围…" : "正在识别目录…"); setMessage("");
    try {
      const response = await fetch(`/api/subjects/${subjectId}/catalog`, { method: save ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(save ? { textbookTitle: book, part, jobId: job?.id, mode, dryRun: !commit, confirmed: commit, replaceConfirmed: commit && mode === "replace", revision: commit ? plan?.revision : undefined, entries: entries.filter(e => e.selected).map(e => ({ path: e.path.split(" / ").map(v => v.trim()), page: e.page })) } : { images, part, background: true, ...(job?.status === "failed" ? { retryJobId: job.id } : {}) }) });
      const data = await response.json(); if (!response.ok) { if (response.status === 409) setPlan(null); throw new Error(data.error); }
      if (!save && data.id) { jobRef.current = data; setJob(data); setPollVersion(v => v + 1); setMessage("后台任务已建立，可以离开页面；返回当前部分会恢复进度和预览。"); return; }
      if (save && !commit) { setPlan(data); return; }
      if (save) {
        setPlan(null); jobRef.current = null; setJob(null);
        setEntries([]); setImages([]); setWarnings([]); setMessage(`目录已保存：新增 ${data.created}，复用 ${data.reused}，移入历史 ${data.archived} 个节点；错题和笔记关联保留。`);
        try { localStorage.removeItem(key); } catch { setMessage("目录已保存，但本地草稿未清除；请勿重复恢复旧草稿。"); }
        router.refresh();
      } else {
        const next = (data.entries as CatalogEntry[]).map(e => ({ path: e.path.join(" / "), page: e.page, selected: true }));
        setEntries(next); setWarnings(data.warnings); retain(images, next, book, data.warnings);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "操作失败，图片与预览保留，请重试。"); }
    finally { lock.current = false; setBusy(""); }
  }
  return <section className="wb-stack"><button className="btn btn-secondary" aria-expanded={open} onClick={() => setOpen(!open)}>拍照识别教材目录</button>{open && <div className="wb-panel wb-stack">
    <h2>拍照识别教材目录</h2><p className="wb-muted">上传目录页 → 核对章节和页码 → 预览保存范围。完整重录选“替换”，补充缺页选“追加”。</p>
    <button className="btn btn-secondary" disabled={Boolean(busy || imageBusy)} onClick={() => {
      try { const raw = localStorage.getItem(key); if (!raw) { setMessage("没有可恢复的目录预览草稿。"); return; } const d = JSON.parse(raw); if (!Array.isArray(d.images) || d.images.length > 6 || d.images.some((v: unknown) => typeof v !== "string" || !/^\/uploads\/[a-zA-Z0-9_.-]+\.(jpg|jpeg|png|webp)$/i.test(v)) || !Array.isArray(d.entries) || d.entries.length > 600 || d.entries.some((v: Preview) => !v || typeof v.path !== "string" || typeof v.selected !== "boolean" || (v.page !== null && (!Number.isInteger(v.page) || v.page < 1 || v.page > 10000))) || (d.book && typeof d.book !== "string") || !Array.isArray(d.warnings) || d.warnings.some((v: unknown) => typeof v !== "string")) throw new Error(); setPlan(null); setMode(d.mode === "replace" ? "replace" : "append"); setImages(d.images); setEntries(d.entries); setBook(d.book || title || ""); setWarnings(d.warnings || []); setMessage("已恢复目录预览，请核对后继续。"); } catch { setMessage("目录草稿无法读取，请重新上传；已有数据库目录不受影响。"); }
    }}>恢复上次目录预览</button>
    <label className="wb-field">保存方式<select value={mode} disabled={Boolean(busy)} onChange={e => { const nextMode = e.target.value as "replace" | "append"; setMode(nextMode); retain(images, entries, book, warnings, nextMode); }}><option value="replace">替换当前部分目录</option><option value="append">追加目录页</option></select></label>
    <p className="wb-small wb-muted">{mode === "replace" ? "请录入当前部分的完整目录，其他部分不受影响。未匹配的旧节点会移到历史目录，保留原有学习内容；仅上传部分页时请用追加。" : "保留当前目录，只补充缺少的章节并更新已识别的起始页码。"}</p>
    <label className="wb-field">主教材名称<input value={book} disabled={Boolean(busy)} maxLength={150} onChange={e => { setBook(e.target.value); retain(images, entries, e.target.value); }} placeholder="填写本次目录所属教材" /></label>
    <fieldset disabled={Boolean(busy || job) || images.length >= 6} className="wb-reset-fieldset"><MultiImageIntake maxPages={6 - images.length} storageId={`${key}-image`} label="目录页" onPending={setPending} onBusy={setImageBusy} onUploaded={urls => { const next = [...new Set([...images, ...urls])]; jobRef.current = null; setJob(null); setImages(next); setEntries([]); retain(next, []); }} /></fieldset>
    <p className="wb-muted wb-small">每批最多 6 页，后台逐页识别并保存进度。照片会发送给已配置的图片 AI；识别不会自动改动教材目录。</p>
    {images.map((url, i) => <div key={url} className="wb-between"><a href={url} target="_blank" rel="noreferrer">已上传目录第 {i + 1} 页 · 查看照片</a><button className="btn btn-secondary" disabled={Boolean(busy || imageBusy || job)} onClick={() => { const next = images.filter(v => v !== url); jobRef.current = null; setJob(null); setImages(next); setEntries([]); retain(next, []); }}>移出本批</button></div>)}
    {pending && <p className="wb-notice">请先上传或丢弃当前预览图片，再识别目录。</p>}
    <button className="btn btn-primary" disabled={job?.status === "ready" || !loaded || !images.length || images.length > 6 || Boolean(busy || imageBusy) || pending} onClick={() => void submit(false)}>{job?.status === "failed" ? "继续识别未完成页" : "识别目录"}{images.length ? `（${images.length} 页）` : ""}</button>
    {job && <button className="btn btn-secondary" disabled={Boolean(requestBusy)} onClick={async () => {
      if (lock.current) return; lock.current = true;
      try {
        const response = await fetch(`/api/subjects/${subjectId}/catalog?part=${encodeURIComponent(part || "")}&jobId=${encodeURIComponent(job.id)}`, { method: "DELETE" });
        if (!response.ok) throw new Error("暂时无法放弃识别，请重试");
        jobRef.current = null; setJob(null); setImages([]); setEntries([]); setWarnings([]); setPlan(null); setMessage("已放弃本次识别，可以重新选图；原教材目录不受影响。"); localStorage.removeItem(key);
      } catch (e) { setMessage(e instanceof Error ? e.message : "操作失败"); } finally { lock.current = false; }
    }}>放弃本次识别，重新选图</button>}
    {job && <div className="wb-notice" role="status"><strong>{job.status === "ready" ? "识别完成 · 尚未保存目录" : job.status === "failed" ? "识别暂停 · 已完成页保留" : `后台识别 · 已完成 ${job.completedPages}/${job.totalPages} 页`}</strong><p>{job.status === "ready" ? "核对下方章节和页码，再点击预览保存影响并确认保存。" : "可以离开或刷新页面，返回当前教材部分会恢复进度。"}</p>{job.error && <p>{job.error}</p>}</div>}
    <div ref={previewRef} />
    {warnings.map((w, i) => <p key={i} className="wb-notice">需核对：{w}</p>)}
    {entries.length > 0 && <><h3>目录层级预览</h3><ol className="wb-stack" style={{ gap: 4, listStyle: "none", padding: 0 }}>{entries.filter(e => e.selected).map((entry, i) => <li key={i} style={{ paddingLeft: Math.min(entry.path.split(" / ").length - 1, 5) * 12, overflowWrap: "anywhere" }}><span>{entry.path.split(" / ").at(-1)}</span><small className="wb-muted"> · {entry.page == null ? "页码待补" : `第 ${entry.page} 页`}</small></li>)}</ol><details><summary>校对标题、层级与页码</summary><p className="wb-small wb-muted">用“ / ”分隔章节层级，例如：第一章 / 第一节。重复的完整路径不会重复创建。</p>{entries.map((entry, i) => <div key={i} className="wb-stack"><label className="wb-choice"><input type="checkbox" checked={entry.selected} disabled={Boolean(busy)} onChange={e => { const next = entries.map((v, j) => j === i ? { ...v, selected: e.target.checked } : v); setEntries(next); retain(images, next); }} /><span>目录项 {i + 1}</span></label><label className="wb-field">章节路径<input value={entry.path} disabled={Boolean(busy)} onChange={e => { const next = entries.map((v, j) => j === i ? { ...v, path: e.target.value } : v); setEntries(next); retain(images, next); }} /></label><label className="wb-field">起始页码（可空）<input type="number" min="1" max="10000" value={entry.page ?? ""} disabled={Boolean(busy)} onChange={e => { const next = entries.map((v, j) => j === i ? { ...v, page: e.target.value ? Number(e.target.value) : null } : v); setEntries(next); retain(images, next); }} /></label></div>)}</details><button className="btn btn-primary" disabled={(job !== null && job.status !== "ready") || !book.trim() || !entries.some(e => e.selected) || Boolean(busy || imageBusy) || pending} onClick={() => void submit(true)}>预览保存影响</button>{plan && <div className="wb-notice"><p>将新增 {plan.created}、复用 {plan.reused}、移入历史 {plan.archived} 个节点。历史节点仍保留错题和笔记。</p><button className="btn btn-primary" disabled={Boolean(busy || imageBusy) || pending} onClick={() => void submit(true, true)}>{mode === "replace" ? "确认替换，保留旧目录学习记录" : "确认追加目录"}</button></div>}</>}
    {busy && <p role="status">{busy}</p>}{message && <p role="status" className="wb-notice">{message}</p>}
  </div>}</section>;
}
