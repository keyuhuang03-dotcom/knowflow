"use client";
import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { Bell, ChevronDown, Command, Search, X } from "lucide-react";
import styles from "@/components/knowledge/home/KnowledgeHome.module.css";
export default function KnowFlowTopbar({ query, onQueryChange, placeholder, children }: { query: string; onQueryChange: (value: string) => void; placeholder: string; children?: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focus = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); } };
    window.addEventListener("keydown", focus); return () => window.removeEventListener("keydown", focus);
  }, []);
  return <div className={styles.topbar}><div className={styles.searchArea}><label className={styles.search}><Search size={23} /><input data-kf-search className={styles.searchInput} ref={input} value={query} onChange={e => onQueryChange(e.target.value)} onKeyDown={e => { if (e.key === "Escape") onQueryChange(""); }} placeholder={placeholder} aria-label={placeholder.replace(/…$/, "")} />{query ? <button aria-label="清除搜索" onClick={() => onQueryChange("")}><X size={18} /></button> : <kbd><Command size={14} /> K</kbd>}</label>{children}</div><div className={styles.account}><span title="通知暂未接入" className={styles.notification}><Bell size={25} /></span><Link href="/settings"><span className={styles.avatar}>研</span><strong>考研工作台</strong><ChevronDown size={18} /></Link></div></div>;
}
