import { notFound } from "next/navigation";
import { getCatalog } from "@/lib/knowledge-data";
import MistakeWizard from "@/components/wrong-questions/MistakeWizard";
export const dynamic = "force-dynamic";
export default async function NewMistakePage({ params, searchParams }: { params: Promise<{ step?: string[] }>; searchParams: Promise<{ subject?: string; node?: string; manual?: string }> }) {
  const { step } = await params;
  if (step && (step.length !== 1 || !["analysis", "confirm"].includes(step[0]))) notFound();
  const query = await searchParams;
  return <MistakeWizard subjects={await getCatalog()} step={step?.[0] || "upload"} initialSubject={query.subject || ""} initialNode={query.node || ""} legacy={query.manual === "1"} />;
}
