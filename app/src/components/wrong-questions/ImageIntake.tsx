"use client";
/* eslint-disable @next/next/no-img-element -- Local blob previews. */
import { useEffect, useRef, useState } from "react";
import { pendingImage, prepareImage } from "@/lib/mistake-image";

export default function ImageIntake({ storageId, label, onUploaded, onPending, onBusy, uploadMetadata }: { storageId: string; label: string; onUploaded: (url: string, result?: { mistakeId?: string }) => void | Promise<void>; onPending: (pending: boolean) => void; onBusy: (message: string) => void; uploadMetadata?: () => Record<string, unknown> }) {
  const [blob, setBlob] = useState<Blob>();
  const previewRef = useRef<HTMLImageElement>(null);
  const [edges, setEdges] = useState([0, 0, 0, 0]);
  const [cropOpen, setCropOpen] = useState(false);
  const [busy, setBusy] = useState("正在恢复图片草稿…");
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const lock = useRef(false);
  const callbacks = useRef({ onPending, onUploaded, onBusy, uploadMetadata });
  useEffect(() => { callbacks.current = { onPending, onUploaded, onBusy, uploadMetadata }; });
  useEffect(() => {
    let alive = true;
    callbacks.current.onPending(true);
    pendingImage(storageId, "read").then(b => { if (alive) { setBusy(""); setBlob(b); callbacks.current.onPending(Boolean(b)); if (b) setMessage("已恢复待上传图片，请核对后上传。"); } }).catch(() => { if (alive) { setBusy(""); setWarning("浏览器无法读取图片草稿；请重新选择图片。请勿依赖刷新恢复。"); callbacks.current.onPending(false); } });
    return () => { alive = false; };
  }, [storageId]);
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob); if (previewRef.current) previewRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  async function retain(next: Blob) {
    setBlob(next); setEdges([0, 0, 0, 0]); callbacks.current.onPending(true);
    try { await pendingImage(storageId, "write", next); setWarning(""); }
    catch { setWarning("图片草稿存储失败，当前图片仍可上传；刷新或关闭页面可能丢失，请先上传。"); }
  }
  async function process(file?: Blob, rotation = 0, crop = [0, 0, 0, 0]) {
    if (!file || lock.current) return;
    lock.current = true; callbacks.current.onPending(true); setBusy("正在处理图片…"); callbacks.current.onBusy("正在处理图片…"); setMessage("");
    try { await retain(await prepareImage(file, rotation, crop)); }
    catch (e) { setMessage(e instanceof Error ? e.message : "图片处理失败，请重试"); callbacks.current.onPending(Boolean(blob)); }
    finally { lock.current = false; setBusy(""); callbacks.current.onBusy(""); }
  }
  async function upload() {
    if (!blob || lock.current) return;
    lock.current = true; setBusy("正在上传…"); callbacks.current.onBusy("正在上传图片…"); setMessage("");
    try {
      const form = new FormData(); form.append("file", blob, "question.jpg"); form.append("purpose", "mistake");
      if (callbacks.current.uploadMetadata) form.append("capture", JSON.stringify(callbacks.current.uploadMetadata()));
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 45000);
      let response: Response;
      try { response = await fetch("/api/upload", { method: "POST", body: form, signal: controller.signal }); } finally { clearTimeout(timer); }
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "上传失败");
      await callbacks.current.onUploaded(result.url, result);
      try { await pendingImage(storageId, "delete"); } catch { setWarning("已上传，但本地图片草稿未清除；下次恢复时可丢弃重复图片。"); }
      setBlob(undefined); callbacks.current.onPending(false); setMessage(uploadMetadata ? "照片和错题已保存，后台继续整理。" : "上传完成");
    } catch (error) { setMessage(`${error instanceof Error && error.name !== "AbortError" ? error.message + "。" : "上传失败或超时。"}图片与输入已保留，恢复网络后点击“上传 / 重试”。`); }
    finally { lock.current = false; setBusy(""); callbacks.current.onBusy(""); }
  }
  return <div className="wb-stack"><fieldset disabled={Boolean(busy)} className="wb-reset-fieldset wb-stack">
    <div className="wb-actions"><label className="btn btn-secondary">{label} · 相册<input className="sr-only" type="file" accept="image/*" onChange={e => { void process(e.target.files?.[0]); e.target.value = ""; }} /></label><label className="btn btn-secondary">拍照<input className="sr-only" type="file" accept="image/*" capture="environment" onChange={e => { void process(e.target.files?.[0]); e.target.value = ""; }} /></label></div>
    {blob && <><div className="wb-actions"><button type="button" className="btn btn-secondary" aria-expanded={cropOpen} aria-controls={`${storageId}-crop`} onClick={() => setCropOpen(!cropOpen)}>{cropOpen ? "收起裁剪" : "裁剪图片"}</button><button type="button" className="btn btn-secondary" onClick={() => void process(blob, 90)}>旋转 90°</button></div><div className="wb-crop-preview"><img ref={previewRef} alt="待上传图片与裁剪范围" /><div style={{ left: `${edges[0]}%`, top: `${edges[1]}%`, right: `${edges[2]}%`, bottom: `${edges[3]}%` }} /></div>
      <p className="wb-small wb-muted">处理后约 {Math.ceil(blob.size / 1024)} KB · 最长边不超过 2400px。请检查公式和小字；框内为保留区域。</p>
      <div id={`${storageId}-crop`} hidden={!cropOpen} style={cropOpen ? undefined : { display: "none" }} className="wb-stack"><p className="wb-small">拖动滑块裁去四周，绿色框内为保留区域。</p>{["左", "上", "右", "下"].map((name, i) => <label className="wb-field" key={name}>{name}侧裁去 {edges[i]}%<input type="range" min="0" max="40" value={edges[i]} onChange={e => setEdges(edges.map((v, j) => j === i ? Number(e.target.value) : v))} /></label>)}<div className="wb-actions"><button type="button" className="btn btn-primary" disabled={!edges.some(Boolean)} onClick={() => void process(blob, 0, edges)}>应用裁剪</button><button type="button" className="btn btn-secondary" onClick={() => setEdges([0, 0, 0, 0])}>重置裁剪框</button></div><p className="wb-small">应用后才能上传；已应用的裁剪若需还原，请重新选择原图。</p></div>
      {edges.some(Boolean) && <p role="status" className="wb-notice">裁剪尚未应用，请先点击“应用裁剪”，或重置裁剪框。</p>}
      <div className="wb-actions"><button className="btn btn-primary" disabled={edges.some(Boolean)} onClick={() => void upload()}>上传 / 重试</button><button className="btn btn-secondary" onClick={async () => { try { await pendingImage(storageId, "delete"); setBlob(undefined); setEdges([0,0,0,0]); callbacks.current.onPending(false); setMessage(""); setWarning(""); } catch { setWarning("清除失败，图片仍保留，请重试。"); } }}>丢弃待上传图片</button></div></>}
    </fieldset>{busy && <p role="status">{busy}</p>}{message && <p role="status" className="wb-notice">{message}</p>}{warning && <p role="alert" className="wb-error">{warning}</p>}</div>;
}
