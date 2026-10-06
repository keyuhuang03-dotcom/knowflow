"use client";
import { analysisFields, type Analysis } from "@/lib/mistake-contract";
export default function AnalysisFields({ value, onChange }: { value: Analysis; onChange?: (value: Analysis) => void }) {
  return <div className="wb-stack">{analysisFields.map(([key, label]) => onChange ? <label className="wb-field" key={key}>{label}<textarea rows={key === "question" ? 4 : 2} maxLength={12000} value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })} placeholder="待补充 / 待核对" /></label> : <section className="wb-analysis-section" key={key}><h3>{label}</h3><p className="wb-prewrap">{value[key] || "待补充"}</p></section>)}</div>;
}
