import { getCatalog } from "@/lib/knowledge-data";
import KnowledgeHome from "@/components/knowledge/home/KnowledgeHome";
export const metadata = { title: "我的知识库 · 知序 KnowFlow" };
export const dynamic = "force-dynamic";
export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ addBook?: string }> }) {
  return <KnowledgeHome subjects={await getCatalog()} openBookPicker={(await searchParams).addBook === "1"} />;
}
