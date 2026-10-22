"use client";
import type { ReactNode } from "react";
import type { Analysis } from "@/lib/mistake-contract";
import AnalysisFields from "./AnalysisFields";
import MathText from "./MathText";
import styles from "./ReviewCard.module.css";

export default function ReviewCard({ analysis, children }: { analysis: Analysis; children?: ReactNode }) {
  const pending = analysis.cardPending;
  const uncertain = analysis.recognition === "uncertain";
  return <div className={styles.card}>
    <MathText>{analysis.question || "请查看原图。"}</MathText>
    <p className={styles.status}>{pending ? "整理中 · 题目已保存" : uncertain ? "题干待核对 · 暂不展示解法" : "标准解答 · 可校对"}</p>
    {pending || uncertain ? <div className="wb-notice"><MathText>{analysis.uncertainty || "关键条件尚未可靠识别，请对照原图。"}</MathText></div> : <>
      {analysis.standardSolution ? <section><h3>标准解答</h3><MathText>{analysis.standardSolution}</MathText>{analysis.finalAnswer && <><h3>答案</h3><MathText>{analysis.finalAnswer}</MathText></>}</section> : <p className="wb-muted">这是历史卡片，尚无完整标准解答。可点击重新整理生成。</p>}
      <details><summary>方法与提醒</summary><MathText>{analysis.method}</MathText><MathText>{analysis.reviewTip}</MathText><MathText>{analysis.nextCheck || ""}</MathText></details>
    </>}
    <details className={styles.more}><summary>{analysis.uncertainty && !pending && !uncertain ? "更多详情 · 有待核对项" : "更多详情"}</summary>
      {analysis.uncertainty && !pending && !uncertain && <section><h3>待核对说明</h3><MathText>{analysis.uncertainty}</MathText></section>}
      {(analysis.stickingPoint || analysis.errorReason) && <details><summary>历史卡点与错因（旧版 AI 判断）</summary><MathText>{analysis.stickingPoint}</MathText><MathText>{analysis.errorReason}</MathText></details>}
      {analysis.recognizedWork && <section><h3>手写识别 · 可校对</h3><MathText>{analysis.recognizedWork}</MathText></section>}
      <details><summary>详细分析与题干</summary><AnalysisFields value={analysis} /></details>
      {children}
    </details>
  </div>;
}
