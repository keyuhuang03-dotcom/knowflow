"use client";
import { usePathname } from "next/navigation";
import KnowledgeSidebar from "./knowledge/home/KnowledgeSidebar";
export default function Sidebar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return <KnowledgeSidebar key={pathname} />;
}
