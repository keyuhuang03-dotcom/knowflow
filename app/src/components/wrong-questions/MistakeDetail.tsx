"use client";
/* eslint-disable @next/next/no-img-element -- Keep uploaded originals accessible without an optimizer. */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Analysis, Candidate } from "@/lib/mistake-contract";
import AnalysisFields from "./AnalysisFields";
type Item = { id: string; title: string; content: string; imageUrl: string | null; source: string | null; userWork: string | null; userWorkImageUrl: string | null; userNote: string | null; reviewStatus: string; reviewedAt: string | null; subjectId: string; analysis: Analysis; nodes: Candidate[] };
export default function MistakeDetail({ item, candidates }: { item: Item; candidates: Candidate[] }) {
  const [editing, setEditing] = useState(false);
  const [redo, setRedo] = useState(false);
  const [note, setNote] = useState(item.userNote || "");
  const [analysis, setAnalysis] = useState(item.analysis);
  const [title, setTitle] = useState(item.title);
  const [source, setSource] = useState(item.source || "");
  const [work, setWork] = useState(item.userWork || "");
  const [nodeIds, setNodeIds] = useState(item.nodes.map(n => n.id));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  async function save(data: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/mistakes/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setEditing(false); setMessage("已保存"); if (data.reviewStatus) setRedo(false); router.refresh();
    } catch(e) { setMessage(e instanceof Error ? e.message : "保存失败，请重试"); } finally { setBusy(false); }
  }
  return <div className="wb-page"><Link className="wb-back" href={item.nodes[0] ? `/knowledge/nodes/${item.nodes[0].id}` : `/knowledge/${item.subjectId}`}>← 返回知识节点</Link>
    <header className="wb-header"><div><p className="wb-eyebrow">错题详情 · 已保存</p><h1>{item.title}</h1><div className="wb-linked-paths">{item.nodes.map(n => <Link key={n.id} href={`/knowledge/nodes/${n.id}`}>{n.path} ↗</Link>)}</div></div><button className="btn btn-secondary" disabled={busy} onClick={() => { setEditing(!editing); setRedo(false); setAnalysis(item.analysis); setTitle(item.title); setSource(item.source || ""); setWork(item.userWork || ""); setNodeIds(item.nodes.map(n => n.id)); }}>{editing ? "取消编辑" : "编辑错题"}</button></header>
    <div className="wb-two-columns"><section className="wb-panel wb-stack wb-fit"><div className="wb-between"><h2>原题</h2><span className="wb-badge">{item.reviewStatus === "mastered" ? "已复习" : "待复习"}</span></div>{item.imageUrl ? <a href={item.imageUrl} target="_blank" rel="noreferrer" aria-label="打开原题大图"><img className="wb-original" src={item.imageUrl} alt="原题照片" /></a> : <p className="wb-prewrap">{item.content}</p>}
      {editing ? <><label className="wb-field">题目名称<input maxLength={180} value={title} onChange={e => setTitle(e.target.value)} /></label><label className="wb-field">来源<input maxLength={500} value={source} onChange={e => setSource(e.target.value)} /></label><label className="wb-field">我的解题过程<textarea rows={5} maxLength={12000} value={work} onChange={e => setWork(e.target.value)} /></label></> : <><p className="wb-muted">来源：{item.source || "未填写"}</p>{!redo && <><h3>我的原始解题过程</h3><p className="wb-prewrap">{item.userWork || "尚未补充"}</p>{item.userWorkImageUrl && <img className="wb-original" src={item.userWorkImageUrl} alt="原始解题过程" />}</>}</>}
      <p className="wb-muted wb-small">最近复习：{item.reviewedAt ? new Date(item.reviewedAt).toLocaleString("zh-CN") : "尚未复习"}</p>
      {!editing && <button className="btn btn-secondary" onClick={() => setRedo(!redo)}>{redo ? "结束练习，查看卡片" : "重新做题"}</button>}
    </section><section className="wb-panel wb-stack wb-review-card"><div className="wb-between"><h2>{redo ? "先试着独立完成" : item.analysis.origin === "ai" ? "AI 复习卡片" : "复习卡片"}</h2><span className="wb-badge">{item.analysis.origin === "ai" ? "AI 辅助整理 · 可校对" : "手动整理 · 可补充"}</span></div>
      {redo ? <div className="wb-empty"><p>复习卡片已收起。回到原题，试着重新写出你的思路。</p><button className="btn btn-primary" onClick={() => setRedo(false)}>查看复习卡片</button></div> : <AnalysisFields value={editing ? analysis : item.analysis} onChange={editing ? setAnalysis : undefined} />}
      {editing && <><h3>关联知识点（1～3 个）</h3><div className="wb-candidate-list">{candidates.map(n => <label className="wb-choice" key={n.id}><input type="checkbox" checked={nodeIds.includes(n.id)} onChange={() => { if (nodeIds.includes(n.id)) setNodeIds(nodeIds.filter(id => id !== n.id)); else if (nodeIds.length < 3) setNodeIds([...nodeIds, n.id]); else setMessage("最多关联三个知识点"); }} /><div>{n.name}<p className="wb-muted wb-small">{n.path}</p></div></label>)}</div><button className="btn btn-primary" disabled={busy || !title.trim() || !nodeIds.length} onClick={() => save({ title, source, userWork: work, analysis, nodeIds, confirmed: true })}>确认关联并保存修改</button></>}
      {!redo && <><hr /><label className="wb-field">我的补充<textarea maxLength={12000} rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="写下自己的理解，或下次做题前的一句提醒。" /></label><div className="wb-actions"><button className="btn btn-secondary" disabled={busy} onClick={() => save({ userNote: note })}>保存补充</button>{!editing && <button className="btn btn-primary" disabled={busy} onClick={() => save({ userNote: note, reviewStatus: "mastered" })}>完成本次复习</button>}</div></>}
    </section></div><p role="status" className="wb-notice" hidden={!message}>{message}</p>
  </div>;
}
