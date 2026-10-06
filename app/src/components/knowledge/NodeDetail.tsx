"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
type Props = {
  node: { id: string; name: string; subjectId: string; status: string; description: string | null; lastReviewAt: string | null; path: string };
  mistakes: { id: string; title: string; source: string | null; errorReason: string | null; reviewStatus: string; reviewedAt: string | null }[];
  notes: { id: string; title: string; content: string; tags: string | null }[];
};
export default function NodeDetail({ node, mistakes, notes }: Props) {
  const [tab, setTab] = useState("错题");
  const [description, setDescription] = useState(node.description || "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  async function update(data: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const res = await fetch(`/api/knowledge/${node.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("保存失败，请重试");
      setEditing(false); setMessage("已保存"); router.refresh();
    } catch(e) { setMessage(e instanceof Error ? e.message : "保存失败"); } finally { setBusy(false); }
  }
  const counts = [mistakes.length, notes.filter(n => n.tags !== "method").length, notes.filter(n => n.tags === "method").length];
  const lastReview = [node.lastReviewAt, ...mistakes.map(m => m.reviewedAt)].filter(Boolean).sort().at(-1);
  return <div className="wb-page"><Link className="wb-back" href={`/knowledge/${node.subjectId}`}>← 科目知识库</Link>
    <header className="wb-header"><div><p className="wb-eyebrow">我的知识节点</p><h1>{node.name}</h1><p className="wb-muted">{node.path}</p></div><button className="btn btn-secondary" disabled={busy} onClick={() => update({ status: node.status === "keypoint" ? "learning" : "keypoint" })}>{node.status === "keypoint" ? "★ 取消重点复习" : "☆ 标记重点复习"}</button></header>
    <div className="wb-counts">{["错题", "笔记", "我的方法"].map((t,i) => <button key={t} onClick={() => setTab(t)} className={tab === t ? "active" : ""}><span>{t}</span><strong>{counts[i]}</strong></button>)}</div>
    <div className="wb-columns"><section className="wb-panel">
      <div className="wb-between"><div className="wb-tabs">{["错题", "笔记", "我的方法"].map(t => <button key={t} aria-pressed={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>)}</div><Link className="btn btn-primary" href={`/wrong-questions/new?subject=${node.subjectId}&node=${node.id}`}>＋ 添加错题</Link></div>
      {tab === "错题" ? <div className="wb-stack">{mistakes.map(m => <Link className="wb-mistake" key={m.id} href={`/wrong-questions/${m.id}`}><div className="wb-between"><h3>{m.title}</h3><span aria-hidden>↗</span></div><p className="wb-muted">{m.source || "未填写来源"}</p><p>{m.errorReason || "错因待补充"}</p><p className="wb-muted wb-small">{m.reviewStatus === "mastered" ? "已复习" : "待重新练习"} · {m.reviewedAt ? new Date(m.reviewedAt).toLocaleDateString("zh-CN") : "尚未复习"}</p></Link>)}{!mistakes.length && <div className="wb-empty">还没有关联错题。拍下第一道题，把这次理解留在这里。</div>}</div> : <div className="wb-stack">{notes.filter(n => tab === "我的方法" ? n.tags === "method" : n.tags !== "method").map(n => <article key={n.id} className="wb-mistake"><h3>{n.title}</h3><p className="wb-prewrap">{n.content}</p></article>)}{!counts[tab === "笔记" ? 1 : 2] && <div className="wb-empty">这里还没有{tab}。你可以先在右侧记下自己的理解。</div>}</div>}
    </section><aside className="wb-stack"><section className="wb-panel wb-stack"><div className="wb-between"><h2>我的理解</h2><button className="wb-text-button" onClick={() => setEditing(!editing)}>{editing ? "收起" : "编辑"}</button></div>{editing ? <><label className="wb-field"><span className="sr-only">我的理解</span><textarea maxLength={12000} rows={8} value={description} onChange={e => setDescription(e.target.value)} /></label><button className="btn btn-primary" disabled={busy} onClick={() => update({ description })}>保存理解</button></> : <p className="wb-prewrap wb-muted">{node.description || "一类题做多了，有没有形成自己的思路？把它写下来。"}</p>}</section>
      <section className="wb-panel"><h2>复习状态</h2><dl className="wb-meta"><dt>最近复习</dt><dd>{lastReview ? new Date(lastReview).toLocaleDateString("zh-CN") : "尚未复习"}</dd><dt>待重新练习</dt><dd>{mistakes.filter(m => m.reviewStatus !== "mastered").length} 道</dd><dt>当前状态</dt><dd>{node.status === "keypoint" ? "重点复习" : "日常积累"}</dd></dl></section>
    </aside></div><p role="status">{message}</p>
  </div>;
}
