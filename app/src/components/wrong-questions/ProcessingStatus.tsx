"use client";
import { useEffect, useRef, useState } from "react";
const labels: Record<string, string> = { queued: "照片已保存 · 等待后台整理", processing: "照片已保存 · 正在整理", complete: "记录已保存", needs_information: "已整理 · 部分信息待补充", failed: "照片已保存 · 整理暂未完成" };
export default function ProcessingStatus({ id, initialStatus = "queued", onComplete, allowReanalyze = false }: { id: string; initialStatus?: string; onComplete?: () => void; allowReanalyze?: boolean }) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [pollVersion, setPollVersion] = useState(0);
  const last = useRef(initialStatus);
  const callback = useRef(onComplete);
  useEffect(() => { callback.current = onComplete; }, [onComplete]);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      let keepPolling = true;
      try {
        const response = await fetch(`/api/mistakes/${id}/processing`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!alive) return;
        const wasActive = ["queued", "processing"].includes(last.current);
        setStatus(data.status); setError(data.error || ""); last.current = data.status;
        keepPolling = ["queued", "processing"].includes(data.status);
        if (wasActive && !keepPolling) callback.current?.();
      } catch { if (alive) setError("暂时无法获取进度，记录不会因此丢失。恢复网络后会继续检查。"); }
      if (alive && keepPolling) timer = setTimeout(poll, 3000);
    }
    void poll();
    return () => { alive = false; controller.abort(); clearTimeout(timer); };
  }, [id, initialStatus, pollVersion]);
  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try {
      const response = await fetch(`/api/mistakes/${id}/processing`, { method: "POST" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setStatus("queued"); last.current = "queued"; setError(""); setPollVersion(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "重试失败，请稍后再试"); }
    finally { setRetrying(false); }
  }
  return <section className="wb-notice wb-stack" aria-label="整理状态"><strong role="status">{labels[status] || "记录已保存"}</strong>{["queued", "processing"].includes(status) && <p>可以离开页面。后台继续整理，之后从“我的错题”查看。</p>}{status === "needs_information" && <p>可辨认的内容已整理，无法判断的部分保留为待补充。你可以稍后编辑或补充卡点。</p>}{error && <p role="status">{error}</p>}{(["failed", "needs_information"].includes(status) || (allowReanalyze && status === "complete")) && <button className="btn btn-secondary" disabled={retrying} onClick={() => void retry()}>{retrying ? "正在提交…" : "重新整理"}</button>}</section>;
}
