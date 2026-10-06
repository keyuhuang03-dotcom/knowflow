"use client";
import { useState } from "react";
import Link from "next/link";
import type { Catalog } from "@/lib/knowledge-data";
export default function SubjectCatalog({ subject }: { subject: Catalog[number] }) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("个人知识目录");
  const nodes = subject.nodes.filter(n => n.path.toLowerCase().includes(query.toLowerCase()) && (tab !== "重点复习" || n.status === "keypoint"));
  const groups = new Map<string, typeof nodes>();
  for (const node of nodes) {
    const group = node.chapter || node.path.split(" / ")[1] || "知识目录";
    groups.set(group, [...(groups.get(group) || []), node]);
  }
  const recent = subject.nodes.filter(n => n.lastReviewAt).sort((a,b) => b.lastReviewAt!.localeCompare(a.lastReviewAt!)).slice(0,4);
  const focus = subject.nodes.filter(n => n.status === "keypoint").slice(0,4);
  return <>
    <div className="wb-tabs" aria-label="目录筛选">{["个人知识目录", "教材目录", "重点复习"].map(t => <button key={t} aria-pressed={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>)}</div>
    <label className="wb-search"><span className="sr-only">搜索知识点</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索知识点或教材路径…" /></label>
    <div className="wb-columns"><section className="wb-panel">
      <div className="wb-between"><h2>{tab}</h2><span className="wb-muted">{nodes.length} 个节点</span></div>
      {[...groups].map(([name, items]) => <section className="wb-chapter" key={name}><h3>{name}</h3><div className="wb-tree">{items.map(n => <Link key={n.id} className="wb-node-row" href={`/knowledge/nodes/${n.id}`}>
        <div><strong>{n.name}</strong>{n.status === "keypoint" && <span className="wb-badge">重点复习</span>}<p className="wb-muted wb-small">{n.path}</p>{tab !== "教材目录" && <p className="wb-muted wb-small">错题 {n.mistakeCount} · 笔记 {n.noteCount} · 方法 {n.methodCount}</p>}</div><span className="wb-node-arrow" aria-hidden>→</span>
      </Link>)}</div></section>)}
      {!nodes.length && <div className="wb-empty">{query ? "没有匹配的知识点，换个关键词试试。" : tab === "重点复习" ? "还没有重点复习节点。可在知识点详情中标记。" : "还没有知识目录。可先在已有图谱编辑器中手动添加知识点。"}</div>}
      {!subject.nodes.length && <Link className="btn btn-secondary" href="/knowledge/graph">打开图谱编辑器</Link>}
    </section><aside className="wb-stack">
      <section className="wb-panel"><h2>最近复习</h2>{recent.map(n => <Link className="wb-aside-link" key={n.id} href={`/knowledge/nodes/${n.id}`}>{n.name}<span>→</span></Link>)}{!recent.length && <p className="wb-muted">还没有复习记录，先从一个知识点开始。</p>}</section>
      <section className="wb-panel"><h2>重点复习</h2>{focus.map(n => <Link className="wb-aside-link" key={n.id} href={`/knowledge/nodes/${n.id}`}>{n.name}<span>{n.mistakeCount} 道错题</span></Link>)}{!focus.length && <p className="wb-muted">值得多看一遍的知识点，可以在详情页标记。</p>}</section>
    </aside></div>
  </>;
}
