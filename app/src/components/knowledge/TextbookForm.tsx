"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function TextbookForm({ subjectId, title, part }: { subjectId: string; title: string | null; part?: string }) {
  const [value, setValue] = useState(title || "");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  if (!open) return <button className="btn btn-secondary" onClick={() => setOpen(true)}>管理教材</button>;
  return <form className="wb-panel wb-stack" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(`/api/subjects/${subjectId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ textbookTitle: value, part, confirmed: true }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setOpen(false); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "保存失败，请重试"); } finally { setBusy(false); }
  }}>
    <label className="wb-field">主教材名称<input required maxLength={150} value={value} onChange={e => setValue(e.target.value)} placeholder="例如：张宇高等数学18讲" /></label>
    <p className="wb-muted">教材名称只用于当前部分。请通过拍照识别录入本书实际目录，保存名称不会把旧知识点变成教材目录。</p>
    <div className="wb-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "保存中…" : "保存教材名称"}</button><button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>取消</button></div>
    {error && <p role="alert" className="wb-error">{error}</p>}
  </form>;
}
