"use client";
import MathText from "./MathText";
import { commonErrorOptions, type Analysis, type SelfReport } from "@/lib/mistake-contract";
export default function MistakeReflection({ analysis, value, onChange, onSave, busy }: { analysis: Analysis; value: SelfReport; onChange: (value: SelfReport) => void; onSave: () => void; busy: boolean }) {
  const options = [...new Set([...commonErrorOptions, ...(analysis.errorOptions || []), ...value.causes])];
  return <section className="wb-stack" aria-label="我的卡点与错因">
    <label className="wb-field">我的卡点（可选）<textarea disabled={busy} rows={2} maxLength={4000} value={value.stickingPoint} onChange={e => { onChange({ ...value, stickingPoint: e.target.value }); }} placeholder="例如：不知道换元后上下限怎么变" /></label>
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><legend>这次的错因（可多选，也可不选）</legend>
      <p className="wb-muted wb-small">选项仅供自查，由你决定；AI 不判断你的作答。</p>
      <div className="kf-reflection-options">{options.map(option => <label className={`wb-choice${option.length > 18 || /[$\\]/.test(option) ? " kf-choice-wide" : ""}`} key={option}><input type="checkbox" checked={value.causes.includes(option)} onChange={e => { onChange({ ...value, causes: e.target.checked ? [...value.causes, option] : value.causes.filter(v => v !== option) }); }} /><MathText inline>{option}</MathText></label>)}</div>
    </fieldset>
    <label className="wb-field">自填错因（可选）<textarea disabled={busy} rows={2} maxLength={1000} value={value.customCause} onChange={e => { onChange({ ...value, customCause: e.target.value }); }} placeholder="用自己的话记下原因" /></label>
    <div><button className="btn btn-secondary" disabled={busy} type="button" onClick={onSave}>{busy ? "保存中…" : "保存卡点与错因"}</button></div>
  </section>;
}
