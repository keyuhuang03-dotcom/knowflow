"use client";
import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import KnowFlowTopbar from "./KnowFlowTopbar";
import styles from "@/components/knowledge/home/KnowledgeHome.module.css";
const destinations = [["我的知识库", "/knowledge"], ["我的错题", "/wrong-questions"], ["添加错题", "/wrong-questions/new"], ["学习记录", "/study-tracker"], ["设置", "/settings"], ["笔记中心", "/notes"], ["今日任务", "/tasks"], ["数据分析", "/analytics"], ["每日复盘", "/daily-review"], ["知识图谱", "/knowledge/graph"]];
function ShellSearch() {
  const [query, setQuery] = useState("");
  const matches = destinations.filter(([name]) => name.includes(query.trim()));
  return <KnowFlowTopbar query={query} onQueryChange={setQuery} placeholder="搜索页面、功能入口…">{query.trim() && <div className={styles.searchResults}>{matches.length ? matches.map(([name, href]) => <Link key={href} href={href} onClick={() => setQuery("")}>{name}</Link>) : <p className="p-3 text-sm">没有匹配的页面，可前往知识库搜索知识点。</p>}</div>}</KnowFlowTopbar>;
}
function FilingFooter() {
  return <footer style={{ padding: "20px 12px", textAlign: "center", fontSize: 12, color: "#66715c" }}>
    <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">浙ICP备2026086038号-1</a>
  </footer>;
}
export default function KnowFlowShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}<FilingFooter /></>;
  // The approved knowledge overview and the material lab keep their own surfaces.
  const standalone = pathname === "/knowledge" || pathname === "/design-lab";
  return <main className={`kf-main ${standalone ? "kf-standalone" : "kf-business"}`} data-page={pathname}>
    {!standalone && <div className="kf-topbar"><ShellSearch key={pathname} /></div>}
    {children}
    <FilingFooter />
  </main>;
}
