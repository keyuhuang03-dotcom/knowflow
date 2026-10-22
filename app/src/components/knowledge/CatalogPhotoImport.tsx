"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MultiImageIntake from "@/components/wrong-questions/MultiImageIntake";
import type { CatalogEntry } from "@/lib/textbook-catalog";
type Plan = { created: number; reused: number; archived: number; total: number; revision: string };
type Preview = { path: string; page: number | null; selected: boolean };
export default function CatalogPhotoImport({ subjectId, title, part }: { subjectId: string; title: string | null; part?: string }) {
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [open, setOpen] = useState(false);
  const [book, setBook] = useState(title || "");
  const [images, setImages] = useState<string[]>([]);
  const [entries, setEntries] = useState<Preview[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [imageBusy, setImageBusy] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const router = useRouter();
  const key = `knowflow-catalog-${subjectId}${part ? `-${part}` : ""}`;
  function retain(nextImages: string[], nextEntries: Preview[], nextBook = book, nextWarnings = warnings, nextMode = mode) {
    setPlan(null);
    try { localStorage.setItem(key, JSON.stringify({ mode: nextMode, images: nextImages, entries: nextEntries, book: nextBook, warnings: nextWarnings })); }
    catch { setMessage("目录草稿存储失败，当前预览仍可使用；请勿刷新，先完成确认。"); }
  }
  async function submit(save: boolean, commit = false) {
    if (lock.current || imageBusy || pending) return;
    lock.current = true; setBusy(save ? commit ? "正在保存目录…" : "正在检查保存范围…" : "正在识别目录…"); setMessage("");
    try {
      const response = await fetch(`/api/subjects/${subjectId}/catalog`, { method: save ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(save ? { textbookTitle: book, part, mode, dryRun: !commit, confirmed: commit, replaceConfirmed: commit && mode === "replace", revision: commit ? plan?.revision : undefined, entries: entries.filter(e => e.selected).map(e => ({ path: e.path.split(" / ").map(v => v.trim()), page: e.page })) } : { images }) });
      const data = await response.json(); if (!response.ok) { if (response.status === 409) setPlan(null); throw new Error(data.error); }
      if (save && !commit) { setPlan(data); return; }
      if (save) {
        setPlan(null);
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
      try { const raw = localStorage.getItem(key); if (!raw) { setMessage("没有可恢复的目录预览草稿。"); return; } const d = JSON.parse(raw); if (!Array.isArray(d.images) || d.images.length > 6 || d.images.some((v: unknown) => typeof v !== "string" || !/^\/uploads\/[a-zA-Z0-9_.-]+\.(jpg|jpeg|png|webp)$/i.test(v)) || !Array.isArray(d.entries) || d.entries.length > 200 || d.entries.some((v: Preview) => !v || typeof v.path !== "string" || typeof v.selected !== "boolean" || (v.page !== null && (!Number.isInteger(v.page) || v.page < 1 || v.page > 10000))) || (d.book && typeof d.book !== "string") || !Array.isArray(d.warnings) || d.warnings.some((v: unknown) => typeof v !== "string")) throw new Error(); setPlan(null); setMode(d.mode === "replace" ? "replace" : "append"); setImages(d.images); setEntries(d.entries); setBook(d.book || title || ""); setWarnings(d.warnings || []); setMessage("已恢复目录预览，请核对后继续。"); } catch { setMessage("目录草稿无法读取，请重新上传；已有数据库目录不受影响。"); }
    }}>恢复上次目录预览</button>
    <label className="wb-field">保存方式<select value={mode} disabled={Boolean(busy)} onChange={e => { const nextMode = e.target.value as "replace" | "append"; setMode(nextMode); retain(images, entries, book, warnings, nextMode); }}><option value="replace">替换当前部分目录</option><option value="append">追加目录页</option></select></label>
    <p className="wb-small wb-muted">{mode === "replace" ? "请录入当前部分的完整目录，其他部分不受影响。未匹配的旧节点会移到历史目录，保留原有学习内容；仅上传部分页时请用追加。" : "保留当前目录，只补充缺少的章节并更新已识别的起始页码。"}</p>
    <label className="wb-field">主教材名称<input value={book} disabled={Boolean(busy)} maxLength={150} onChange={e => { setBook(e.target.value); retain(images, entries, e.target.value); }} placeholder="填写本次目录所属教材" /></label>
    <fieldset disabled={Boolean(busy) || images.length >= 6} className="wb-reset-fieldset"><MultiImageIntake maxPages={6 - images.length} storageId={`${key}-image`} label="目录页" onPending={setPending} onBusy={setImageBusy} onUploaded={urls => { const next = [...new Set([...images, ...urls])]; setImages(next); setEntries([]); retain(next, []); }} /></fieldset>
    <p className="wb-muted wb-small">每批最多 6 页。照片会发送给已配置的图片 AI；识别不会自动改动教材目录。</p>
    {images.map((url, i) => <div key={url} className="wb-between"><a href={url} target="_blank" rel="noreferrer">已上传目录第 {i + 1} 页 · 查看照片</a><button className="btn btn-secondary" disabled={Boolean(busy || imageBusy)} onClick={() => { const next = images.filter(v => v !== url); setImages(next); setEntries([]); retain(next, []); }}>移出本批</button></div>)}
    {pending && <p className="wb-notice">请先上传或丢弃当前预览图片，再识别目录。</p>}
    <button className="btn btn-primary" disabled={!images.length || images.length > 6 || Boolean(busy || imageBusy) || pending} onClick={() => void submit(false)}>识别目录{images.length ? `（${images.length} 页）` : ""}</button>
    {warnings.map((w, i) => <p key={i} className="wb-notice">需核对：{w}</p>)}
    {entries.length > 0 && <><h3>目录层级预览</h3><ol className="wb-stack" style={{ gap: 4, listStyle: "none", padding: 0 }}>{entries.filter(e => e.selected).map((entry, i) => <li key={i} style={{ paddingLeft: Math.min(entry.path.split(" / ").length - 1, 5) * 12, overflowWrap: "anywhere" }}><span>{entry.path.split(" / ").at(-1)}</span><small className="wb-muted"> · {entry.page == null ? "页码待补" : `第 ${entry.page} 页`}</small></li>)}</ol><details><summary>校对标题、层级与页码</summary><p className="wb-small wb-muted">用“ / ”分隔章节层级，例如：第一章 / 第一节。重复的完整路径不会重复创建。</p>{entries.map((entry, i) => <div key={i} className="wb-stack"><label className="wb-choice"><input type="checkbox" checked={entry.selected} disabled={Boolean(busy)} onChange={e => { const next = entries.map((v, j) => j === i ? { ...v, selected: e.target.checked } : v); setEntries(next); retain(images, next); }} /><span>目录项 {i + 1}</span></label><label className="wb-field">章节路径<input value={entry.path} disabled={Boolean(busy)} onChange={e => { const next = entries.map((v, j) => j === i ? { ...v, path: e.target.value } : v); setEntries(next); retain(images, next); }} /></label><label className="wb-field">起始页码（可空）<input type="number" min="1" max="10000" value={entry.page ?? ""} disabled={Boolean(busy)} onChange={e => { const next = entries.map((v, j) => j === i ? { ...v, page: e.target.value ? Number(e.target.value) : null } : v); setEntries(next); retain(images, next); }} /></label></div>)}</details><button className="btn btn-primary" disabled={!book.trim() || !entries.some(e => e.selected) || Boolean(busy || imageBusy) || pending} onClick={() => void submit(true)}>预览保存影响</button>{plan && <div className="wb-notice"><p>将新增 {plan.created}、复用 {plan.reused}、移入历史 {plan.archived} 个节点。历史节点仍保留错题和笔记。</p><button className="btn btn-primary" disabled={Boolean(busy || imageBusy) || pending} onClick={() => void submit(true, true)}>{mode === "replace" ? "确认替换，保留旧目录学习记录" : "确认追加目录"}</button></div>}</>}
    {busy && <p role="status">{busy}</p>}{message && <p role="status" className="wb-notice">{message}</p>}
  </div>}</section>;
}
