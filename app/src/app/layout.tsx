import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { validSession, SESSION_COOKIE } from "@/lib/auth";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import KnowFlowShell from "@/components/ui/KnowFlowShell";
import "./knowflow.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "知序 KnowFlow",
  description: "AI 驱动的个人考研学习工作台",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192-v2.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512-v2.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "知序 KnowFlow",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = (await headers()).get("x-knowflow-path");
  if (path !== "/login" && !validSession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/login");
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>
        <Sidebar />
        <KnowFlowShell>
          {children}
        </KnowFlowShell>
      </body>
    </html>
  );
}
