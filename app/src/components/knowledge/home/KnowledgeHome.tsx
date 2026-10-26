"use client";
/* eslint-disable @next/next/no-img-element -- Independent local reference-inspired SVG illustrations. */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Camera, Landmark, Monitor, MoreHorizontal, Plus, Sigma, X } from "lucide-react";
import type { Catalog } from "@/lib/knowledge-data";
import KnowFlowTopbar from "@/components/ui/KnowFlowTopbar";
import GlassCard from "@/components/design-lab/GlassCard";
import styles from "./KnowledgeHome.module.css";
function appearance(name: string) {
  if (/数学/.test(name)) return { key: "math", Icon: Sigma, rank: 0 };
  if (/英语/.test(name)) return { key: "english", Icon: null, rank: 1 };
  if (/408|计算机/.test(name)) return { key: "computer", Icon: Monitor, rank: 2 };
  if (/政治/.test(name)) return { key: "politics", Icon: Landmark, rank: 3 };
  return { key: "other", Icon: BookOpen, rank: 4 };
}
export default function KnowledgeHome({ subjects, openBookPicker = false }: { subjects: Catalog; openBookPicker?: boolean }) {
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => { if (openBookPicker && !dialog.current?.open) dialog.current?.showModal(); }, [openBookPicker]);
  const term = query.trim().toLowerCase();
  const ordered = [...subjects].sort((a,b) => appearance(a.name).rank - appearance(b.name).rank);
  const visible = ordered.filter(s => !term || `${s.name} ${s.parts.map(p => `${p.name} ${p.textbookTitle || ""}`).join(" ")} ${s.textbookTitle || ""}`.toLowerCase().includes(term) || s.nodes.some(n => n.path.toLowerCase().includes(term)));
  const matches = term ? subjects.flatMap(s => s.nodes.filter(n => n.path.toLowerCase().includes(term)).map(n => ({ ...n, subject: s.name }))).slice(0,8) : [];
  return <div className={styles.page}>
    <KnowFlowTopbar query={query} onQueryChange={setQuery} placeholder="搜索知识点、科目、教材…">{matches.length > 0 && <div className={styles.searchResults}>{matches.map(n => <Link href={`/knowledge/nodes/${n.id}`} key={n.id}><strong>{n.name}</strong><span>{n.path}</span></Link>)}</div>}</KnowFlowTopbar>
    <header className={styles.header}><div><p className={styles.eyebrow}>学习，从关联开始</p><h1>我的知识库</h1><p className={styles.subtitle}>以教材为骨架，把每一次理解留在知识点里。</p></div><img className={styles.heroArt} src="/knowflow/mascot-books.svg" alt="吉祥物趴在书本上" /><button className={styles.addBook} onClick={() => dialog.current?.showModal()}><Plus size={23} />添加教材</button></header>
    <div className={styles.grid}>{visible.map(s => {
      const { key, Icon } = appearance(s.name); const mastered = s.nodes.filter(n => n.status === "mastered").length; const total = s.nodes.length; const percent = total ? Math.round(mastered / total * 100) : 0;
      const partBookCount = s.parts.filter(p => p.textbookTitle).length;
      const bookLabel = s.parts.length ? (partBookCount ? `已设置 ${partBookCount}/${s.parts.length} 部分教材` : "尚未添加教材") : s.textbookTitle ? "已有教材" : "尚未添加教材";
      const bookSummary = s.parts.length ? s.parts.filter(p => p.textbookTitle).map(p => p.name).join(" · ") : s.textbookTitle;
      const hasBook = s.parts.length ? partBookCount > 0 : Boolean(s.textbookTitle);
      return <GlassCard key={s.id} variant="B" className={`${styles.card} ${!hasBook ? styles.emptyBook : ""} ${styles[key] || ""}`} settings={{ transparency: 72, blur: 12, highlight: 90, refraction: 0, shadow: 18 }}><div className={styles.cardContent} data-subject-card={s.id}>
        <details className={styles.cardMenu}><summary aria-label={`${s.name}更多操作`}><MoreHorizontal size={22} /></summary><Link href={`/knowledge/${s.id}`}>管理教材与目录</Link></details>
        <Link href={`/knowledge/${s.id}`} className={styles.cardLink} aria-label={`进入${s.name}知识库`}><span className={styles.subjectIcon}>{Icon ? <Icon size={34} strokeWidth={1.8} /> : <span>A</span>}</span><div className={styles.subjectHeading}><h2>{s.name}</h2><span className={hasBook ? styles.hasBook : styles.noBook}>{bookLabel}</span></div>{bookSummary && <p className={styles.bookTitle}>{bookSummary}</p>}<p className={styles.cardDescription}>以教材目录构建知识骨架，梳理知识点。</p>
        {key !== "other" && <img className={styles.subjectArt} src={`/knowflow/${key}.svg`} alt="" />}
        <div className={`${styles.cardFooter} ${!total ? styles.noNodes : ""}`}><span>已掌握 <strong>{mastered} / {total}</strong> 个知识点</span>{!total && <span className={styles.catalogPending}>目录待录入</span>}<progress max="100" value={percent} aria-label={`${s.name}已掌握 ${mastered} / ${total} 个知识点`} /><span className={styles.arrow}><ArrowRight size={21} /></span></div></Link>
      </div></GlassCard>;
    })}</div>
    {!visible.length && <p className={styles.empty}>{subjects.length ? "没有匹配的科目或知识点，请换个关键词。" : "还没有科目，请先建立科目与知识目录。"}</p>}
    <GlassCard variant="B" className={styles.quick}><div className={styles.quickContent}><span className={styles.camera}><Camera size={34} strokeWidth={1.8} /></span><div><h2>拍下错题，沉淀知识点</h2><p>让每一次错题、笔记和灵感都找到它的位置。</p></div><Link href="/wrong-questions/new"><Plus size={24} />添加错题<ArrowRight size={22} /></Link></div></GlassCard>
    <dialog ref={dialog} className={styles.dialog} onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}><div><h2>选择教材所属科目</h2><button aria-label="关闭教材选择" onClick={() => dialog.current?.close()}><X /></button></div><p>选择科目后，可拍照识别教材目录，核对后确认添加。</p>{ordered.map(s => <Link key={s.id} href={`/knowledge/${s.id}${openBookPicker ? "?catalog=1" : ""}`}>{s.name}<ArrowRight size={18} /></Link>)}{!ordered.length && <p>当前暂无科目。</p>}</dialog>
  </div>;
}
