/* eslint-disable @next/next/no-img-element -- Reuse the local brand illustration. */
import Link from "next/link";
import { ArrowRight, BookOpen, Camera, Clock, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatMinutes } from "@/lib/utils";
export const dynamic = "force-dynamic";
export const metadata = { title: "首页 · 知序 KnowFlow" };
export default async function HomePage() {
  const [nodes, mastered, mistakes, duration, sessions, recentMistakes] = await Promise.all([
    prisma.knowledgeNode.count(), prisma.knowledgeNode.count({ where: { status: "mastered" } }),
    prisma.mistakeItem.count(), prisma.studySession.aggregate({ _sum: { durationMinutes: true } }),
    prisma.studySession.findMany({ orderBy: { date: "desc" }, take: 5, include: { subject: true } }),
    prisma.mistakeItem.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { subject: true } }),
  ]);
  const activities = [...sessions.map(s => ({ id: `session-${s.id}`, title: `${s.subject.name} · 学习 ${formatMinutes(s.durationMinutes)}`, date: s.date, href: "/study-tracker" })), ...recentMistakes.map(m => ({ id: `mistake-${m.id}`, title: `${(m.subject?.name || "科目未确定")} · ${m.title}`, date: m.createdAt, href: `/wrong-questions/${m.id}` }))].sort((a,b) => b.date.getTime() - a.date.getTime()).slice(0,6);
  return <div className="wb-page"><header className="wb-header"><div><p className="wb-eyebrow">日拱一卒，把知识变成自己的秩序</p><h1>每一次理解，都在积累。</h1><p className="wb-muted">从熟悉的知识点出发，继续今天的学习。</p></div><img src="/knowflow/mascot-books.svg" alt="" width="140" height="108" className="kf-home-mascot" /></header>
    <section className="kf-overview" aria-label="学习概览"><Link className="card p-5" href="/knowledge"><BookOpen size={21} /><span>知识骨架</span><strong>{nodes}<small> 个知识点</small></strong><p>已掌握 {mastered} 个</p></Link><Link className="card p-5" href="/wrong-questions"><Camera size={21} /><span>我的错题</span><strong>{mistakes}<small> 道</small></strong><p>回看错题与复习线索</p></Link><Link className="card p-5" href="/study-tracker"><Clock size={21} /><span>累计学习</span><strong>{formatMinutes(duration._sum.durationMinutes || 0)}</strong><p>来自已保存的学习记录</p></Link></section>
    <section className="card kf-home-shortcuts"><Link className="btn btn-primary gap-2" href="/wrong-questions/new"><Camera size={18} />添加错题</Link><Link className="btn btn-secondary gap-2" href="/knowledge"><BookOpen size={18} />进入知识库</Link><Link className="btn btn-secondary gap-2" href="/study-tracker"><TrendingUp size={18} />记录学习</Link></section>
    <section className="card p-5"><div className="wb-between"><h2 className="font-semibold">最近活动</h2><span className="wb-muted wb-small">学习记录与错题</span></div>{activities.length ? <div className="kf-activity-list">{activities.map(a => <Link href={a.href} key={a.id}><div><strong>{a.title}</strong><time dateTime={a.date.toISOString()}>{a.date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div><ArrowRight size={18} /></Link>)}</div> : <p className="wb-muted py-5">还没有学习活动。从知识库或添加一道错题开始。</p>}</section>
  </div>;
}
