import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/knowledge-data";
import SubjectCatalog from "@/components/knowledge/SubjectCatalog";
import CatalogPhotoImport from "@/components/knowledge/CatalogPhotoImport";
import TextbookForm from "@/components/knowledge/TextbookForm";
export const dynamic = "force-dynamic";
export default async function SubjectPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const [subject] = await getCatalog((await params).subjectId);
  if (!subject) notFound();
  return <div className="wb-page"><Link className="wb-back" href="/knowledge">← 我的知识库</Link>
    <header className="wb-header"><div><p className="wb-eyebrow">科目知识库</p><h1>{subject.name}</h1><p className="wb-muted">主教材：{subject.textbookTitle || "待确认"}</p></div><Link className="btn btn-primary" href={`/wrong-questions/new?subject=${subject.id}`}>＋ 添加错题</Link></header>
    <TextbookForm subjectId={subject.id} title={subject.textbookTitle} /><CatalogPhotoImport subjectId={subject.id} title={subject.textbookTitle} /><SubjectCatalog subject={subject} />
  </div>;
}
