"use client";
/* eslint-disable @next/next/no-img-element -- Local blob preview. */
import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { pendingImages, prepareImage } from "@/lib/mistake-image";
type Result = { mistakeId?: string; url: string; urls?: string[] };
export default function MultiImageIntake({ storageId, label, onUploaded, onPending, onBusy, uploadMetadata, maxPages = 6 }: { storageId: string; label: string; onUploaded: (urls: string[], result: Result) => void | Promise<void>; onPending: (pending: boolean) => void; onBusy: (message: string) => void; uploadMetadata?: () => Record<string, unknown>; maxPages?: number }) {
  const [pages, setPages] = useState<Blob[]>([]);
  const [active, setActive] = useState(0);
  const [edges, setEdges] = useState([0, 0, 0, 0]);
  const [cropOpen, setCropOpen] = useState(false);
  const [busy, setBusy] = useState("正在恢复图片草稿…");
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const previewRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; edges: number[]; sides: number[]; width: number; height: number } | null>(null);
  function startCrop(event: PointerEvent<HTMLButtonElement>, sides: number[]) {
    if (!event.isPrimary || event.button !== 0 || busy) return;
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, edges: [...edges], sides, width: rect.width, height: rect.height };
  }
  function moveCrop(event: PointerEvent<HTMLButtonElement>) {
    const origin = drag.current;
    if (!origin || origin.id !== event.pointerId) return;
    const next = [...origin.edges];
    for (const side of origin.sides) {
      const delta = side % 2 === 0 ? (event.clientX - origin.x) / origin.width : (event.clientY - origin.y) / origin.height;
      next[side] = Math.max(0, Math.min(95 - origin.edges[(side + 2) % 4], origin.edges[side] + delta * (side < 2 ? 100 : -100)));
    }
    setEdges(next);
  }
  function keyCrop(event: KeyboardEvent<HTMLButtonElement>, sides: number[]) {
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault();
    setEdges(previous => previous.map((value, side) => sides.includes(side) ? Math.max(0, Math.min(95 - previous[(side + 2) % 4], value + direction[side % 2] * (side < 2 ? 1 : -1) * (event.shiftKey ? 5 : 1))) : value));
  }
  const lock = useRef(false);
  const callbacks = useRef({ onUploaded, onPending, onBusy, uploadMetadata });
  useEffect(() => { callbacks.current = { onUploaded, onPending, onBusy, uploadMetadata }; });
  useEffect(() => {
    let alive = true; callbacks.current.onPending(true);
    void pendingImages(storageId, "read").then(restored => { if (alive) { setPages(restored); callbacks.current.onPending(Boolean(restored.length)); if (restored.length) setMessage(`已恢复 ${restored.length} 页，请核对顺序后上传。`); } }).catch(() => { if (alive) { setWarning("图片草稿无法读取，请重新选择；已有服务器记录不受影响。"); callbacks.current.onPending(false); } }).finally(() => { if (alive) setBusy(""); });
    return () => { alive = false; };
  }, [storageId]);
  const current = pages[active];
  useEffect(() => {
    if (!current) return;
    const url = URL.createObjectURL(current); if (previewRef.current) previewRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [current]);
  async function retain(next: Blob[], index = 0) {
    setPages(next); setActive(Math.max(0, Math.min(index, next.length - 1))); setEdges([0, 0, 0, 0]); callbacks.current.onPending(Boolean(next.length));
    try { await pendingImages(storageId, next.length ? "write" : "delete", next); setWarning(""); }
    catch { setWarning("多页草稿存储失败，当前页面仍可上传；刷新可能恢复旧草稿或丢失当前修改，请先完成上传。"); }
  }
  async function select(files: File[]) {
    if (!files.length || lock.current) return;
    if (files.length + pages.length > maxPages) { setMessage(`本批最多 ${maxPages} 页，当前已有 ${pages.length} 页。请减少选择数量。`); return; }
    lock.current = true; setBusy("正在处理图片…"); callbacks.current.onBusy("正在处理图片…"); setMessage("");
    const next = [...pages]; const failures: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setBusy(`正在处理第 ${i + 1}/${files.length} 张…`);
        try { const blob = await prepareImage(files[i]); if (next.reduce((sum, b) => sum + b.size, blob.size) > 24 * 1024 * 1024) throw new Error("本批处理后的图片超过24MB，请减少页数或继续裁剪"); next.push(blob); }
        catch (e) { failures.push(`${files[i].name}：${e instanceof Error ? e.message : "图片处理失败，请重新选择"}`); }
      }
      await retain(next, pages.length < next.length ? pages.length : active); setMessage(failures.length ? `以下图片未加入，其他页已保留：${failures.join("；")}` : `共 ${next.length} 页，按题干与过程的阅读顺序排列。`);
    } finally { lock.current = false; setBusy(""); callbacks.current.onBusy(""); }
  }
  async function edit(rotation = 0) {
    if (!current || lock.current) return;
    lock.current = true; setBusy("正在处理当前页…"); callbacks.current.onBusy("正在处理图片…");
    try { const blob = await prepareImage(current, rotation, rotation ? [0, 0, 0, 0] : edges); await retain(pages.map((v, i) => i === active ? blob : v), active); }
    catch (e) { setMessage(e instanceof Error ? e.message : "当前页处理失败，原页面保留"); }
    finally { lock.current = false; setBusy(""); callbacks.current.onBusy(""); }
  }
  async function upload() {
    if (!pages.length || lock.current) return;
    lock.current = true; setBusy(`正在上传全部 ${pages.length} 页…`); callbacks.current.onBusy("正在上传全部页面…"); setMessage("");
    try {
      const form = new FormData(); pages.forEach((blob, i) => form.append("file", blob, `page-${i + 1}.jpg`)); form.append("purpose", "mistake");
      if (callbacks.current.uploadMetadata) form.append("capture", JSON.stringify(callbacks.current.uploadMetadata()));
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 60000);
      let response: Response;
      try { response = await fetch("/api/upload", { method: "POST", body: form, signal: controller.signal }); } finally { clearTimeout(timer); }
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "上传失败");
      const urls = result.urls || [result.url]; if (urls.length !== pages.length) throw new Error("服务器返回的页数与预览不一致，请检查是否重复选择同一张图片后重试。");
      await callbacks.current.onUploaded(urls, result);
      try { await pendingImages(storageId, "delete"); } catch { setWarning("服务器已保存，但本地草稿未清除；下次恢复时请核对，避免重新录入。"); }
      setPages([]); setActive(0); callbacks.current.onPending(false); setMessage(uploadMetadata ? "全部页面与错题已保存，后台继续整理。" : "全部目录页面已上传，可以识别。");
    } catch (e) { setMessage(`${e instanceof Error && e.name !== "AbortError" ? e.message : "上传超时或网络中断"}。全部页面和输入仍保留，恢复网络后重试。`); }
    finally { lock.current = false; setBusy(""); callbacks.current.onBusy(""); }
  }
  async function changePages(next: Blob[], index = 0) {
    if (lock.current) return;
    lock.current = true; setBusy("正在保存页面草稿…"); callbacks.current.onBusy("正在保存页面草稿…");
    try { await retain(next, index); } finally { lock.current = false; setBusy(""); callbacks.current.onBusy(""); }
  }
  function move(direction: number) { const target = active + direction; if (target < 0 || target >= pages.length) return; const next = [...pages]; [next[active], next[target]] = [next[target], next[active]]; void changePages(next, target); }
  const cropping = edges.some(Boolean);
  return <div className="wb-stack"><fieldset disabled={Boolean(busy)} className="wb-reset-fieldset wb-stack">
    <div className="wb-actions"><label className="btn btn-secondary">{label} · 相册多选<input className="sr-only" type="file" accept="image/*" multiple disabled={pages.length >= maxPages || cropping} onChange={e => { void select(Array.from(e.target.files || [])); e.target.value = ""; }} /></label><label className="btn btn-secondary">拍下一页<input className="sr-only" type="file" accept="image/*" capture="environment" disabled={pages.length >= maxPages || cropping} onChange={e => { void select(Array.from(e.target.files || [])); e.target.value = ""; }} /></label></div>
    <p className="wb-small wb-muted">本批最多 {maxPages} 页，可相册多选或连续拍照；最长边2400px，每页可单独旋转、裁剪。</p>
    {pages.length > 0 && <><div className="wb-actions" aria-label="页面顺序">{pages.map((_, i) => <button type="button" key={i} className={i === active ? "btn btn-primary" : "btn btn-secondary"} aria-pressed={i === active} disabled={cropping} onClick={() => { setActive(i); setEdges([0, 0, 0, 0]); }}>第 {i + 1} 页</button>)}</div>
    <div className="wb-actions"><button type="button" className="btn btn-secondary" aria-expanded={cropOpen} onClick={() => { setCropOpen(!cropOpen); setEdges([0, 0, 0, 0]); }}>{cropOpen ? "收起裁剪" : "裁剪当前页"}</button><button type="button" className="btn btn-secondary" disabled={cropping} onClick={() => void edit(90)}>旋转 90°</button><button type="button" className="btn btn-secondary" disabled={active === 0 || cropping} onClick={() => move(-1)}>前移一页</button><button type="button" className="btn btn-secondary" disabled={active === pages.length - 1 || cropping} onClick={() => move(1)}>后移一页</button><button type="button" className="btn btn-secondary" disabled={cropping} onClick={() => void changePages(pages.filter((_, i) => i !== active), Math.max(0, active - 1))}>移除当前页</button></div>
    <div className={`wb-crop-preview${cropOpen ? " is-cropping" : ""}`}><img ref={previewRef} draggable={false} alt={`第${active + 1}页及裁剪范围`} />{cropOpen && <div className="wb-crop-shade" style={{ clipPath: `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${edges[0]}% ${edges[1]}%, ${edges[0]}% ${100 - edges[3]}%, ${100 - edges[2]}% ${100 - edges[3]}%, ${100 - edges[2]}% ${edges[1]}%, ${edges[0]}% ${edges[1]}%)` }} />}{cropOpen && <div className="wb-crop-selection" style={{ left: `${edges[0]}%`, top: `${edges[1]}%`, right: `${edges[2]}%`, bottom: `${edges[3]}%` }} >
      {([{ name: "左边", position: "left", sides: [0] }, { name: "上边", position: "top", sides: [1] }, { name: "右边", position: "right", sides: [2] }, { name: "下边", position: "bottom", sides: [3] }, { name: "左上角", position: "tl", sides: [0, 1] }, { name: "右上角", position: "tr", sides: [2, 1] }, { name: "左下角", position: "bl", sides: [0, 3] }, { name: "右下角", position: "br", sides: [2, 3] }]).map(handle => <button key={handle.position} type="button" className={`wb-crop-handle wb-crop-${handle.position}`} aria-label={`拖动裁剪框${handle.name}`} onPointerDown={event => startCrop(event, handle.sides)} onPointerMove={moveCrop} onPointerUp={event => { if (drag.current?.id === event.pointerId) { moveCrop(event); drag.current = null; } }} onPointerCancel={event => { if (drag.current?.id === event.pointerId) { setEdges(drag.current.edges); drag.current = null; } }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={event => keyCrop(event, handle.sides)} />)}
    </div>}</div>
    <p className="wb-small">当前第 {active + 1}/{pages.length} 页 · 共约 {Math.ceil(pages.reduce((sum, b) => sum + b.size, 0) / 1024)} KB</p>
    {cropOpen && <div className="wb-stack"><p className="wb-small wb-muted">拖动照片四边或四角框选题目，再点应用裁剪。也可聚焦边框后用方向键微调。</p><div className="wb-actions"><button type="button" className="btn btn-primary" disabled={!cropping} onClick={() => void edit()}>应用裁剪</button><button type="button" className="btn btn-secondary" onClick={() => setEdges([0, 0, 0, 0])}>重置裁剪框</button></div></div>}
    {cropping && <p className="wb-notice">请先应用裁剪或重置裁剪框，再切换页面或上传。</p>}
    <div className="wb-actions"><button type="button" className="btn btn-primary" disabled={cropping} onClick={() => void upload()}>上传全部 {pages.length} 页 / 重试</button><button type="button" className="btn btn-secondary" onClick={() => void changePages([])}>丢弃本批全部页面</button></div></>}
    </fieldset>{busy && <p role="status">{busy}</p>}{message && <p role="status" className="wb-notice">{message}</p>}{warning && <p role="alert" className="wb-error">{warning}</p>}</div>;
}
