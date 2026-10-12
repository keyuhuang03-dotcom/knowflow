"use client";
import type { Analysis } from "@/lib/mistake-contract";
import AnalysisFields from "./AnalysisFields";
import MathText from "./MathText";
export default function ReviewCard({ analysis }: { analysis: Analysis }) {
  if (analysis.cardPending) return <div className="wb-stack"><h3>已识别的题目</h3><MathText>{analysis.question}</MathText><p className="wb-notice">{analysis.uncertainty}</p></div>;
  if (analysis.recognition === "uncertain") return <div className="wb-stack"><h3>题干待核对</h3><MathText>{analysis.question || "请查看原图。"}</MathText><p className="wb-notice">{analysis.uncertainty || "关键条件尚未可靠识别，请对照原图。"} 暂不展示解法和错因，避免基于错误题干复习。</p><details><summary>查看已有整理内容（待校对）</summary><AnalysisFields value={analysis} /></details></div>;
  return <div className="wb-stack"><h3>题目</h3><MathText>{analysis.question || "请查看原图。"}</MathText><p className="wb-notice">先自己想：卡在哪里？什么条件提示用这个方法？</p>
    <span className="wb-badge">{analysis.diagnosisStatus === "confirmed" ? "卡点与错因 · 用户已确认" : "卡点与错因 · 未确认推测 / 待补充"}</span>
    {analysis.uncertainty && <p className="wb-notice">分析待核对：{analysis.uncertainty}</p>}
    <details><summary>这次卡在哪里 · 展开提示</summary><MathText>{analysis.stickingPoint || "尚未记录，请补充实际卡住的步骤。"}</MathText>{analysis.errorReason && analysis.errorReason !== analysis.stickingPoint && <MathText>{analysis.errorReason}</MathText>}</details>
    <details><summary>什么特征提示使用什么方法 · 展开提示</summary><MathText>{analysis.reviewTip || "待补充题目特征与方法的联系。"}</MathText><MathText>{analysis.method}</MathText></details>
    <details><summary>下次先检查什么 · 展开提示</summary><MathText>{analysis.nextCheck || "先核对题目条件与所用方法的适用范围，再检查自己的第一步。"}</MathText></details>
    {analysis.recognizedWork && <details><summary>从照片识别的手写内容 · 可校对</summary><MathText>{analysis.recognizedWork}</MathText></details>}
    <details><summary>详细分析与题干识别</summary><AnalysisFields value={analysis} /></details>
  </div>;
}
