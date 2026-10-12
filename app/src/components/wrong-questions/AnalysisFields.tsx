"use client";
import { analysisFields, type Analysis } from "@/lib/mistake-contract";
import MathText from "./MathText";
export default function AnalysisFields({ value, onChange }: { value: Analysis; onChange?: (value: Analysis) => void }) {
  return <div className="wb-stack">
    <p className="wb-notice">{value.diagnosisStatus === "confirmed" ? "卡点与错因已由你确认。" : "卡点与错因尚未确认，仅供核对；历史记录也不会自动视为已确认。"}</p>
    {value.recognition !== "clear" && <p className="wb-notice">题干识别尚待核对。{value.uncertainty || "请对照原图检查公式、条件与符号；信息不足时补拍清晰图片或手动补充。"}</p>}
    {analysisFields.map(([key, label]) => onChange ? <label className="wb-field" key={key}>{label}<textarea rows={key === "question" ? 4 : 2} maxLength={12000} value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value, diagnosisStatus: "unconfirmed" })} placeholder="待补充 / 待核对" /></label> : <section className="wb-analysis-section" key={key}><h3>{label}</h3><MathText>{value[key] || "待补充"}</MathText></section>)}
    {onChange && <><label className="wb-field">下次先检查什么<textarea rows={2} maxLength={12000} value={value.nextCheck || ""} onChange={e => onChange({ ...value, nextCheck: e.target.value })} placeholder="例如：先检查分母是否为零、公式的适用条件" /></label><label className="wb-choice"><input type="checkbox" checked={value.diagnosisStatus === "confirmed"} onChange={e => onChange({ ...value, diagnosisStatus: e.target.checked ? "confirmed" : "unconfirmed" })} /><span>我已对照自己的实际过程，确认上述卡点与错因（可不勾选）</span></label></>}
  </div>;
}
