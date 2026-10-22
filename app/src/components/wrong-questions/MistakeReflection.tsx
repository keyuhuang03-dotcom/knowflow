"use client";
import { useRef, useState } from "react";
import { commonErrorOptions, type Analysis } from "@/lib/mistake-contract";
export default function MistakeReflection({ id, analysis }: { id: string; analysis: Analysis }) {
  const [value, setValue] = useState(analysis.selfReport || { stickingPoint: "", causes: [] as string[], customCause: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const saving = useRef(false);
  const options = [...new Set([...commonErrorOptions, ...(analysis.errorOptions || []), ...value.causes])];
  async function save() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/mistakes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selfReport: value }) });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "保存失败"); }
      setMessage("已保存，不会重新调用 AI");
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败，请重试"); }
    finally { saving.current = false; setBusy(false); }
  }
  return <section className="wb-stack" aria-label="我的卡点与错因">
    <label className="wb-field">我的卡点（可选）<textarea disabled={busy} rows={2} maxLength={4000} value={value.stickingPoint} onChange={e => { setValue({ ...value, stickingPoint: e.target.value }); setMessage(""); }} placeholder="例如：不知道换元后上下限怎么变" /></label>
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><legend>这次的错因（可多选，也可不选）</legend>
      <p className="wb-muted wb-small">选项仅供自查，由你决定；AI 不判断你的作答。</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{options.map(option => <label className="wb-choice" key={option}><input type="checkbox" checked={value.causes.includes(option)} onChange={e => { setValue({ ...value, causes: e.target.checked ? [...value.causes, option] : value.causes.filter(v => v !== option) }); setMessage(""); }} /><span>{option}</span></label>)}</div>
    </fieldset>
    <label className="wb-field">自填错因（可选）<textarea disabled={busy} rows={2} maxLength={1000} value={value.customCause} onChange={e => { setValue({ ...value, customCause: e.target.value }); setMessage(""); }} placeholder="用自己的话记下原因" /></label>
    <div><button className="btn btn-secondary" disabled={busy} onClick={save}>{busy ? "保存中…" : "保存卡点与错因"}</button></div><p role="status" hidden={!message}>{message}</p>
  </section>;
}
