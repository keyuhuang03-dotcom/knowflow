"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination -- Full navigation clears authenticated client state after logout. */
import { useState } from "react";
export default function LogoutButton() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <><button className="btn btn-secondary" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { const result = await fetch("/api/auth/logout", { method: "POST" }); if (result.status === 401 || result.ok) location.assign("/login"); else throw new Error(); } catch { setError("退出失败，请重试"); setBusy(false); } }}>退出登录</button>{error && <span role="alert">{error}</span>}</>;
}
