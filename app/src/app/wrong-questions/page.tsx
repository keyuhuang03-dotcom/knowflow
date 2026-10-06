import Link from "next/link";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export default async function WrongQuestionsPage() {
  const items = await prisma.mistakeItem.findMany({ include: { subject: true }, orderBy: { createdAt: "desc" } });
  return <div className="wb-page"><header className="wb-header"><div><p className="wb-eyebrow">积累与回看</p><h1>我的错题</h1><p className="wb-muted">每一道错题，都能回到它的知识点。</p></div><Link className="btn btn-primary" href="/wrong-questions/new">＋ 添加错题</Link></header><div className="wb-stack">{items.map(m => <Link className="wb-panel wb-mistake" href={`/wrong-questions/${m.id}`} key={m.id}><div className="wb-between"><h2>{m.title}</h2><span>→</span></div><p className="wb-muted">{m.subject.name} · {m.source || "未填写来源"}</p><p>{m.errorReason || "错因待补充"}</p></Link>)}</div>{!items.length && <div className="wb-empty">还没有错题。拍下第一道题，开始积累自己的复习卡片。</div>}</div>;
}
