"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Camera, ChevronRight } from "lucide-react";
import type { RecentIntake } from "@/lib/recent-intakes";
import MathText from "@/components/wrong-questions/MathText";
export default function MobileIntakes({ initial }: { initial: RecentIntake[] }) {
  const [items, setItems] = useState(initial);
  const pending = items.some(item => item.pending);
  useEffect(() => {
    if (!pending) return;
    const screen = matchMedia("(max-width: 768px)");
    let disposed = false, controller: AbortController | undefined;
    async function refresh() {
      if (!screen.matches || document.visibilityState !== "visible" || controller) return;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 8000);
      try {
        const response = await fetch("/api/recent-intakes", { signal: controller.signal, cache: "no-store" });
        if (response.ok) { const next = await response.json(); if (!disposed && Array.isArray(next)) setItems(next); }
      } catch { /* Retain the last known status; the detail link stays usable. */ }
      finally { clearTimeout(timeout); controller = undefined; }
    }
    const timer = setInterval(() => void refresh(), 6000);
    document.addEventListener("visibilitychange", refresh);
    screen.addEventListener("change", refresh);
    return () => { disposed = true; clearInterval(timer); controller?.abort(); document.removeEventListener("visibilitychange", refresh); screen.removeEventListener("change", refresh); };
  }, [pending]);
  return <section className="kf-mobile-intakes" aria-label="最近录入"><div className="kf-mobile-section-heading"><h2>最近录入</h2><Link href="/wrong-questions">全部错题<ChevronRight size={15} /></Link></div>
    <div className="kf-mobile-intake-list">{items.map(item => <Link href={item.href} key={`${item.kind}-${item.id}`} className="kf-mobile-intake"><span className="kf-intake-icon">{item.kind === "catalog" ? <BookOpen size={20} /> : <Camera size={20} />}</span><span className="kf-intake-copy"><strong>{item.title}</strong><span><MathText inline>{item.detail}</MathText></span></span><span className={`kf-intake-status${item.pending ? " is-pending" : ""}`} role="status">{item.label}</span><ChevronRight size={16} /></Link>)}{!items.length && <p className="kf-intake-empty">拍下一道错题，或录入教材目录。保存后可以离开，AI 会继续整理。</p>}</div>
  </section>;
}
