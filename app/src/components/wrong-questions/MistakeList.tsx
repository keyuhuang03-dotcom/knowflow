"use client";
/* eslint-disable @next/next/no-img-element -- Local brand SVG for the empty state. */
import MathText from "./MathText";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
type Item = { id: string; title: string; subjectId: string; subject: string; source: string; reason: string; status: string; processingStatus: string; nodes: string[] };
export default function MistakeList({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState("");
  const subjects = [...new Map(items.map(m => [m.subjectId || "__unknown__", m.subject])).entries()];
  const visible = items.filter(m => (!subject || (subject === "__unknown__" ? !m.subjectId : m.subjectId === subject)) && (!status || (status === "mastered" ? m.status === "mastered" : m.status !== "mastered")) && `${m.title} ${m.source} ${m.nodes.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="wb-page"><header className="wb-header"><div><p className="wb-eyebrow">积累与回看</p><h1>我的错题</h1><p className="wb-muted">每一道错题，都能回到它的知识点。</p></div><Link className="btn btn-primary gap-2" href="/wrong-questions/new"><Plus size={18} />添加错题</Link></header>
    {items.length > 0 && <div className="kf-filterbar"><label>查找错题<input value={query} onChange={e => setQuery(e.target.value)} placeholder="题目、来源或关联知识点" /></label><label>科目<select aria-label="科目" value={subject} onChange={e => setSubject(e.target.value)}><option value="">全部科目</option>{subjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>复习状态<select aria-label="复习状态" value={status} onChange={e => setStatus(e.target.value)}><option value="">全部状态</option><option value="pending">待复习</option><option value="mastered">已复习</option></select></label><span role="status">{visible.length} / {items.length} 道</span></div>}
    <div className="wb-stack">{visible.map(m => <Link className="wb-panel wb-mistake" href={`/wrong-questions/${m.id}`} key={m.id}><div className="wb-between"><h2><MathText inline>{m.title}</MathText></h2><ArrowRight size={18} /></div><p className="wb-muted">{m.subject} · {m.source || "未填写来源"}</p><p className="wb-small wb-muted">复习线索（请核对）：<MathText inline>{m.reason || "错因待补充"}</MathText></p><div className="kf-mistake-meta"><span>{({queued:"等待整理",processing:"正在整理",failed:"整理失败 · 可重试",needs_information:"信息待补充"} as Record<string,string>)[m.processingStatus] || "已整理"}</span><span>{m.status === "mastered" ? "已复习" : "待复习"}</span>{m.nodes.map(n => <span key={n}>{n}</span>)}</div></Link>)}</div>
    {!visible.length && <div className="wb-empty">{!items.length && <img src="/knowflow/mascot-study.svg" width="140" height="108" className="mx-auto mb-3" alt="" />}<p>{items.length ? "没有符合条件的错题，试试其他关键词或筛选。" : "还没有错题。拍下第一道题，开始积累自己的复习卡片。"}</p>{items.length > 0 && <button className="btn btn-secondary mt-4" onClick={() => { setQuery(""); setSubject(""); setStatus(""); }}>清除筛选</button>}</div>}
  </div>;
}
