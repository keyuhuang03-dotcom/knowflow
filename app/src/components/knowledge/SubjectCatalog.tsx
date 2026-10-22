"use client";
import { useState } from "react";
import Link from "next/link";
import type { Catalog } from "@/lib/knowledge-data";
import styles from "./SubjectCatalog.module.css";
type Node = Catalog[number]["nodes"][number];
export default function SubjectCatalog({ subject }: { subject: Catalog[number] }) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("教材目录");
  const history = tab === "历史目录";
  const active = subject.nodes.filter(n => !n.catalogArchived);
  const source = subject.nodes.filter(n => Boolean(n.catalogArchived) === history && (tab !== "教材目录" || n.catalogImported));
  const needle = query.trim().toLowerCase();
  const byId = new Map(source.map(n => [n.id, n]));
  const matches = source.filter(n => (!needle || n.path.toLowerCase().includes(needle)) && (tab !== "重点复习" || n.status === "keypoint"));
  const visible = new Set(matches.map(n => n.id));
  for (const n of matches) {
    let parent = n.parentId; const seen = new Set<string>([n.id]);
    while (parent && byId.has(parent) && !seen.has(parent)) { seen.add(parent); visible.add(parent); parent = byId.get(parent)!.parentId; }
  }
  const nodes = source.filter(n => visible.has(n.id));
  const children = new Map<string, Node[]>();
  for (const n of nodes) if (n.parentId && visible.has(n.parentId)) children.set(n.parentId, [...(children.get(n.parentId) || []), n]);
  const roots = nodes.filter(n => !n.parentId || !visible.has(n.parentId));
  // Historical Chapter rows remain useful for old flat catalogs; imported trees use parentId.
  const legacy = new Map<string, Node[]>();
  const treeRoots = roots.filter(n => { if (!n.chapter) return true; legacy.set(n.chapter, [...(legacy.get(n.chapter) || []), n]); return false; });
  const expanded = Boolean(needle) || tab === "重点复习";
  const recent = active.filter(n => n.lastReviewAt).sort((a,b) => b.lastReviewAt!.localeCompare(a.lastReviewAt!)).slice(0,4);
  const focus = active.filter(n => n.status === "keypoint").slice(0,4);
  function firstChildPage(n: Node, seen = new Set<string>()): number | null {
    if (seen.has(n.id)) return null;
    seen.add(n.id);
    for (const child of source.filter(c => c.parentId === n.id)) {
      const page = child.pageStart ?? firstChildPage(child, seen);
      if (page != null) return page;
    }
    return null;
  }
  function renderNode(n: Node, ancestors = new Set<string>()) {
    if (ancestors.has(n.id)) return null;
    const next = new Set([...ancestors, n.id]); const descendants = children.get(n.id) || [];
    const childPage = n.pageStart == null ? firstChildPage(n) : null;
    const page = <span className={styles.page} title={childPage != null ? "章标题未单独标页码，此处显示首个子项页码" : undefined}>{n.pageStart != null ? `第 ${n.pageStart} 页` : childPage != null ? `第 ${childPage} 页` : "页码待核对"}</span>;
    const meta = tab === "个人知识目录" ? <small className="wb-muted">错题 {n.mistakeCount} · 笔记 {n.noteCount} · 方法 {n.methodCount}</small> : null;
    return <li key={n.id}>
      {descendants.length ? <details open={expanded ? true : undefined}>
        <summary><span className={styles.title}>{n.name}{n.status === "keypoint" && <small className="wb-badge">重点</small>}</span>{page}</summary>
        <div className={styles.nodeLink}><Link href={`/knowledge/nodes/${n.id}`}>查看本章知识与学习记录 →</Link>{meta}</div>
        <ul>{descendants.map(child => renderNode(child, next))}</ul>
      </details> : <Link className={styles.leaf} href={`/knowledge/nodes/${n.id}`}><span className={styles.title}>{n.name}{meta}</span>{page}<span aria-hidden>→</span></Link>}
    </li>;
  }
  return <>
    <div className="wb-tabs" aria-label="目录筛选">{["教材目录", "个人知识目录", "重点复习", "历史目录"].map(t => <button key={t} aria-pressed={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>)}</div>
    <label className="wb-search"><span className="sr-only">搜索知识点</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索章节、小标题或完整路径…" /></label>
    <div className="wb-columns"><section className="wb-panel">
      <div className="wb-between"><h2>{tab}</h2><span className="wb-muted">{needle ? `${matches.length} 个匹配项` : `${treeRoots.length + legacy.size} 个章节 · ${nodes.length} 个节点`}</span></div>
      {tab === "教材目录" && active.some(n => !n.catalogImported) && <p className="wb-notice">尚未从教材目录确认的旧知识点保留在“个人知识目录”，不会当作本书章节展示。请拍照识别并确认保存实际目录。</p>}
      {history && <p className="wb-notice">旧目录仅在这里保留，原有错题、笔记和学习记录仍可查看；不会用于新错题的自动推荐。</p>}
      <ul className={styles.tree} key={`${tab}:${query}`}>{treeRoots.map(n => renderNode(n))}{[...legacy].map(([name, items]) => <li key={`chapter:${name}`}><details open={expanded ? true : undefined}><summary>{name}</summary><ul>{items.map(n => renderNode(n))}</ul></details></li>)}</ul>
      {!nodes.length && <div className="wb-empty">{query ? "没有匹配的知识点，换个关键词试试。" : history ? "没有历史目录。" : tab === "重点复习" ? "还没有重点复习节点。可在知识点详情中标记。" : "还没有教材目录，请先拍照识别并核对保存。"}</div>}
    </section><aside className="wb-stack">
      <section className="wb-panel"><h2>最近复习</h2>{recent.map(n => <Link className="wb-aside-link" key={n.id} href={`/knowledge/nodes/${n.id}`}>{n.name}<span>→</span></Link>)}{!recent.length && <p className="wb-muted">还没有复习记录，先从一个知识点开始。</p>}</section>
      <section className="wb-panel"><h2>重点复习</h2>{focus.map(n => <Link className="wb-aside-link" key={n.id} href={`/knowledge/nodes/${n.id}`}>{n.name}<span>{n.mistakeCount} 道错题</span></Link>)}{!focus.length && <p className="wb-muted">值得多看一遍的知识点，可以在详情页标记。</p>}</section>
    </aside></div>
  </>;
}
