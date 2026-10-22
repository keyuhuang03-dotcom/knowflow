"use client";
/* eslint-disable @next/next/no-img-element -- Existing local brand SVG. */
import { useState, type FormEvent } from "react";
import styles from "./Login.module.css";
export default function LoginForm() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: data.get("username"), password: data.get("password"), next: new URLSearchParams(location.search).get("next") }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "登录失败，请重试"); location.assign(result.next);
    } catch (e) { setError(e instanceof Error ? e.message : "网络异常，请重试"); setBusy(false); }
  }
  return <section className={styles.page}><div className={styles.card}><div className={styles.brand}><img src="/knowflow/mascot-logo.svg" alt="知序吉祥物" /><div><strong>知序</strong><span>KnowFlow</span></div></div><p className={styles.eyebrow}>学习，从关联开始</p><h1>回到你的知识世界</h1><p className={styles.description}>日拱一卒，把知识变成自己的秩序。</p><form onSubmit={submit}><label>账号<input name="username" autoComplete="username" maxLength={100} required disabled={busy} /></label><label>密码<input name="password" type="password" autoComplete="current-password" maxLength={256} required disabled={busy} /></label>{error && <p role="alert" className={styles.error}>{error}</p>}<button disabled={busy}>{busy ? "正在登录…" : "进入知序"}</button></form><p className={styles.note}>私人学习空间 · 登录后继续整理与复习</p></div></section>;
}
