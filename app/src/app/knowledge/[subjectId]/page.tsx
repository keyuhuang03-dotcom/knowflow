import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/knowledge-data";
import SubjectCatalog from "@/components/knowledge/SubjectCatalog";
import CatalogPhotoImport from "@/components/knowledge/CatalogPhotoImport";
import TextbookForm from "@/components/knowledge/TextbookForm";
import styles from "./page.module.css";
export const dynamic = "force-dynamic";
export default async function SubjectPage({ params, searchParams }: { params: Promise<{ subjectId: string }>; searchParams: Promise<{part?:string}> }) {
  const [subject] = await getCatalog((await params).subjectId, true);
  if (!subject) notFound();
  const requested = (await searchParams).part;
  const legacy = requested === "unassigned";
  const part = subject.parts.find(p => p.id === requested) || subject.parts[0];
  const scoped = subject.parts.length ? {...subject, textbookTitle: legacy ? null : part.textbookTitle, nodes: subject.nodes.filter(n => legacy ? !n.subjectPart : n.subjectPart === part.id)} : subject;
  const scopeKey = legacy ? "unassigned" : part?.id || "all";
  return <div className="wb-page"><Link className="wb-back" href="/knowledge">← 我的知识库</Link>
    <header className={`wb-header ${styles.header}`}><div><p className="wb-eyebrow">科目知识库</p><h1>{subject.name}</h1><p className="wb-muted">{part && !legacy ? part.name + " · " : ""}主教材：{scoped.textbookTitle || "待确认"}</p></div><div className={styles.headerActions}><Link className="btn btn-primary" href={`/wrong-questions/new?subject=${subject.id}`}>＋ 添加错题</Link>{!legacy && <TextbookForm key={`book-${scopeKey}`} subjectId={subject.id} part={part?.id} title={scoped.textbookTitle} />}</div></header>
    <div className={styles.catalogTools}>
    {subject.parts.length > 0 && <nav className="wb-actions" aria-label="科目部分">{subject.parts.map(p => <Link key={p.id} className={`btn ${!legacy && p.id === part.id ? "btn-primary" : "btn-secondary"}`} aria-current={!legacy && p.id === part.id ? "page" : undefined} href={`/knowledge/${subject.id}?part=${p.id}`}>{p.name}</Link>)}{subject.nodes.some(n => !n.subjectPart) && <Link className="btn btn-secondary" href={`/knowledge/${subject.id}?part=unassigned`}>未分区旧记录</Link>}</nav>}
    {legacy ? <p className="wb-notice">这些旧记录尚未确认所属部分，保留原有关联。切换到具体部分录入教材，不会覆盖这里的历史内容。</p> : <><CatalogPhotoImport key={`import-${scopeKey}`} subjectId={subject.id} part={part?.id} title={scoped.textbookTitle} /></>}
    </div>
    <SubjectCatalog key={scopeKey} subject={scoped} />
  </div>;
}
