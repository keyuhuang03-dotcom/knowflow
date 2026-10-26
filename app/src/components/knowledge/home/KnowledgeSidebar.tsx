"use client";
/* eslint-disable @next/next/no-img-element -- Small local SVG artwork. */
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, BookOpen, TriangleAlert, TrendingUp, Settings, Menu, X, ArrowRight, Camera, NotebookPen } from "lucide-react";
import styles from "./KnowledgeHome.module.css";
const items = [["/", "首页", House], ["/knowledge", "我的知识库", BookOpen], ["/wrong-questions", "我的错题", TriangleAlert], ["/study-tracker", "学习记录", TrendingUp], ["/settings", "设置", Settings]] as const;
export default function KnowledgeSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return <><button className={styles.mobileMenu} aria-label={open ? "关闭导航" : "打开导航"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>{open && <button className={styles.scrim} aria-label="关闭导航" onClick={() => setOpen(false)} />}
  <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}><Link href="/knowledge" className={styles.brand}><img src="/knowflow/mascot-logo.svg" alt="知序吉祥物" /><span><strong>知序</strong><small>KnowFlow</small></span></Link><p className={styles.motto}>日拱一卒，<br />把知识变成自己的秩序。</p><nav aria-label="主导航">{items.map(([href, label, Icon]) => <Link key={href} href={href} aria-current={(href === "/" ? pathname === "/" : pathname.startsWith(href)) ? "page" : undefined} onClick={() => setOpen(false)}><Icon size={25} strokeWidth={1.7} />{label}</Link>)}</nav><Link href="/wrong-questions" className={styles.sidebarFoot}><img src="/knowflow/mascot-study.svg" alt="" /><span>让知识，<br />自成体系。</span><span className={styles.sidebarFootButton} aria-hidden="true"><ArrowRight size={18} /></span></Link></aside><nav className="kf-mobile-nav" aria-label="手机导航">{([["/", "首页", House], ["/knowledge", "知识库", BookOpen], ["/wrong-questions/new", "拍照", Camera], ["/wrong-questions", "记录", NotebookPen]] as const).map(([href, label, Icon]) => <Link key={href} href={href} aria-current={(href === "/" ? pathname === "/" : href === "/wrong-questions" ? pathname.startsWith(href) && !pathname.startsWith("/wrong-questions/new") : pathname.startsWith(href)) ? "page" : undefined} onClick={() => setOpen(false)}><Icon size={22} strokeWidth={1.8} /><span>{label}</span></Link>)}</nav></>;
}
