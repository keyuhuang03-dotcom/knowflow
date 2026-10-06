import Link from "next/link";
import { ArrowUpRight, BookOpen, Plus } from "lucide-react";
import { getCatalog } from "@/lib/knowledge-data";
export const dynamic = "force-dynamic";
export default async function KnowledgePage() {
  const subjects = await getCatalog();
  return <div className="wb-page">
    <header className="wb-header"><div><p className="wb-eyebrow">学习，从关联开始</p><h1>我的知识库</h1><p className="wb-muted">以教材为骨架，把每一次理解留在知识点里。</p></div><Link className="btn btn-primary gap-2" href="/wrong-questions/new"><Plus size={17} />添加错题</Link></header>
    <div className="wb-subject-grid">{subjects.map((s, i) => <Link className={`wb-subject wb-subject-${i % 4}`} key={s.id} href={`/knowledge/${s.id}`}>
      <div className="wb-between"><BookOpen size={25} strokeWidth={1.5} /><ArrowUpRight size={21} /></div>
      <h2>{s.name}</h2><p>{s.textbookTitle || "尚未确认主教材"}</p>
      <p className="wb-muted">{s.textbookTitle ? "教材目录与个人学习内容" : "核对现有目录，添加一本主教材"}</p>
      <div className="wb-subject-footer"><span>{s.nodes.length} 个知识节点</span><span>进入知识库 →</span></div>
    </Link>)}</div>
    {!subjects.length && <div className="wb-empty">还没有科目。请按开发文档初始化空数据库，再开始建立知识库。</div>}
    <div className="wb-footnote"><BookOpen size={18} /><p>拍下错题，确认知识点。下次复习时，从熟悉的教材目录重新找到它。</p></div>
  </div>;
}
