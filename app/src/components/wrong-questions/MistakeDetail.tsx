"use client";
/* eslint-disable @next/next/no-img-element -- Keep uploaded originals accessible without an optimizer. */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Analysis, Candidate } from "@/lib/mistake-contract";
import AnalysisFields from "./AnalysisFields";
type Item = { id: string; title: string; content: string; imageUrl: string | null; source: string | null; userWork: string | null; userWorkImageUrl: string | null; userNote: string | null; reviewStatus: string; reviewedAt: string | null; subjectId: string; skillRecordId: string | null; analysis: Analysis; nodes: Candidate[] };
type SkillView = { summary: string; errors: { evidence: string; cause: string; repair: string; role: string }[]; formulas: { expression: string; conditions: string[]; why_here: string }[]; triggerConditions: string[]; correctReasoning: string[]; transferQuestions: string[]; mastery: { key: string; name: string; score: number | null }[]; diagnosisCard: string };
export default function MistakeDetail({ item, candidates, skill, skillError }: { item: Item; candidates: Candidate[]; skill: SkillView | null; skillError: string }) {
  const [editing, setEditing] = useState(false);
  const [redo, setRedo] = useState(false);
  const [note, setNote] = useState(item.userNote || "");
  const [analysis, setAnalysis] = useState(item.analysis);
  const [title, setTitle] = useState(item.title);
  const [source, setSource] = useState(item.source || "");
  const [work, setWork] = useState(item.userWork || "");
  const [nodeIds, setNodeIds] = useState(item.nodes.map(n => n.id));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [correction, setCorrection] = useState("");
  const router = useRouter();
  async function runSkillAction(action: "create" | "revise") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/mistakes/${item.id}/skill`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, correction }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setCorrection(""); setMessage(result.wordReady ? "完整诊断与 Word 复习卡已生成" : "完整诊断已保存；Word 导出暂不可用，请检查 Python 文档依赖"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "完整诊断失败，请重试"); }
    finally { setBusy(false); }
  }
  async function save(data: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/mistakes/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setEditing(false); setMessage("已保存"); if (data.reviewStatus) setRedo(false); router.refresh();
    } catch(e) { setMessage(e instanceof Error ? e.message : "保存失败，请重试"); } finally { setBusy(false); }
  }
  return <div className="wb-page"><Link className="wb-back" href={item.nodes[0] ? `/knowledge/nodes/${item.nodes[0].id}` : `/knowledge/${item.subjectId}`}>← 返回知识节点</Link>
    <header className="wb-header"><div><p className="wb-eyebrow">错题详情 · 已保存</p><h1>{item.title}</h1><div className="wb-linked-paths">{item.nodes.map(n => <Link key={n.id} href={`/knowledge/nodes/${n.id}`}>{n.path} ↗</Link>)}</div></div><button className="btn btn-secondary" disabled={busy} onClick={() => { setEditing(!editing); setRedo(false); setAnalysis(item.analysis); setTitle(item.title); setSource(item.source || ""); setWork(item.userWork || ""); setNodeIds(item.nodes.map(n => n.id)); }}>{editing ? "取消编辑" : "编辑错题"}</button></header>
    <div className="wb-two-columns"><section className="wb-panel wb-stack wb-fit"><div className="wb-between"><h2>原题</h2><span className="wb-badge">{item.reviewStatus === "mastered" ? "已复习" : "待复习"}</span></div>{item.imageUrl ? <a href={item.imageUrl} target="_blank" rel="noreferrer" aria-label="打开原题大图"><img className="wb-original" src={item.imageUrl} alt="原题照片" /></a> : <p className="wb-prewrap">{item.content}</p>}
      {editing ? <><label className="wb-field">题目名称<input maxLength={180} value={title} onChange={e => setTitle(e.target.value)} /></label><label className="wb-field">来源<input maxLength={500} value={source} onChange={e => setSource(e.target.value)} /></label><label className="wb-field">我的解题过程<textarea rows={5} maxLength={12000} value={work} disabled={Boolean(item.skillRecordId)} onChange={e => setWork(e.target.value)} /></label>{item.skillRecordId && <p className="wb-muted wb-small">原始过程已随完整诊断归档。补充或纠正请使用右侧的诊断修订。</p>}</> : <><p className="wb-muted">来源：{item.source || "未填写"}</p>{!redo && <><h3>我的原始解题过程</h3><p className="wb-prewrap">{item.userWork || "尚未补充"}</p>{item.userWorkImageUrl && <img className="wb-original" src={item.userWorkImageUrl} alt="原始解题过程" />}</>}</>}
      <p className="wb-muted wb-small">最近复习：{item.reviewedAt ? new Date(item.reviewedAt).toLocaleString("zh-CN") : "尚未复习"}</p>
      {!editing && <button className="btn btn-secondary" onClick={() => setRedo(!redo)}>{redo ? "结束练习，查看卡片" : "重新做题"}</button>}
    </section><section className="wb-panel wb-stack wb-review-card"><div className="wb-between"><h2>{redo ? "先试着独立完成" : item.analysis.origin === "ai" ? "AI 复习卡片" : "复习卡片"}</h2><span className="wb-badge">{item.analysis.origin === "ai" ? "AI 辅助整理 · 可校对" : "手动整理 · 可补充"}</span></div>
      {redo ? <div className="wb-empty"><p>复习卡片已收起。回到原题，试着重新写出你的思路。</p><button className="btn btn-primary" onClick={() => setRedo(false)}>查看复习卡片</button></div> : <AnalysisFields value={editing ? analysis : item.analysis} onChange={editing ? setAnalysis : undefined} />}
      {!redo && !editing && <div className="wb-stack"><hr /><h3>Skill 完整诊断</h3>
        {!item.skillRecordId ? <><p className="wb-muted">根据你的真实解题过程生成逐步证据、子技能掌握记录和可打印复习卡。生成后请核对 AI 判断。</p><button className="btn btn-secondary" disabled={busy || !Boolean(item.userWork?.trim() || item.userWorkImageUrl)} onClick={() => void runSkillAction("create")}>生成完整诊断</button>{!item.userWork?.trim() && !item.userWorkImageUrl && <p className="wb-muted wb-small">请先编辑错题，补充解题文字或过程图片。</p>}</>
          : skill ? <><p className="wb-muted wb-small">Skill 记录 {item.skillRecordId} · AI 判断需人工核对</p><p className="wb-prewrap">{skill.summary}</p>
            {skill.errors.length > 0 && <><h3>逐步错误证据</h3>{skill.errors.map((error, i) => <div className="wb-skill-evidence" key={i}><strong>{error.role === "primary" ? "最早卡点" : "后续线索"}：</strong>“{error.evidence}”<p>{error.cause}</p><p>修复：{error.repair}</p></div>)}</>}
            {skill.formulas.length > 0 && <><h3>公式与适用条件</h3>{skill.formulas.map((formula, i) => <div key={i}><p className="wb-prewrap">{formula.expression}</p><p className="wb-muted wb-small">{formula.conditions.join("；")} · {formula.why_here}</p></div>)}</>}
            {skill.triggerConditions.length > 0 && <><h3>看到什么，应想到什么</h3>{skill.triggerConditions.map((line, i) => <p className="wb-prewrap" key={i}>{line}</p>)}</>}
            {skill.correctReasoning.length > 0 && <><h3>正确思路</h3>{skill.correctReasoning.map((line, i) => <p className="wb-prewrap" key={i}>{i + 1}. {line}</p>)}</>}
            {skill.transferQuestions.length > 0 && <><h3>简短变式</h3>{skill.transferQuestions.map((line, i) => <p className="wb-prewrap" key={i}>{line}</p>)}</>}
            {skill.mastery.length > 0 && <><h3>子技能证据</h3>{skill.mastery.map(node => <p className="wb-muted wb-small" key={node.key}>{node.name}：{node.score === null ? "尚无足够证据" : `证据分数 ${node.score}`}</p>)}</>}
            <div className="wb-actions"><a className="btn btn-secondary" href={`/api/mistakes/${item.id}/skill/word`}>下载 Word 复习卡</a><details><summary>查看完整诊断卡与修订来源</summary><pre className="wb-skill-raw">{skill.diagnosisCard}</pre></details></div>
            <label className="wb-field">纠正或补充诊断<textarea rows={3} maxLength={4000} value={correction} onChange={e => setCorrection(e.target.value)} placeholder="写下真实补充，例如：我在第二步其实先约去了 x，不是不会公式。" /></label><button className="btn btn-secondary" disabled={busy || !correction.trim()} onClick={() => void runSkillAction("revise")}>提交纠正并重新诊断</button>
          </> : <p className="wb-error">{skillError || "Skill 诊断文件暂时无法读取，请检查数据目录。"}</p>}
      </div>}
      {editing && <><h3>关联知识点（1～3 个）</h3>{item.skillRecordId && <p className="wb-muted wb-small">完整诊断已按这些教材节点归档；如需更正归属，请在右侧说明具体原因。</p>}<div className="wb-candidate-list">{candidates.map(n => <label className="wb-choice" key={n.id}><input type="checkbox" disabled={Boolean(item.skillRecordId)} checked={nodeIds.includes(n.id)} onChange={() => { if (nodeIds.includes(n.id)) setNodeIds(nodeIds.filter(id => id !== n.id)); else if (nodeIds.length < 3) setNodeIds([...nodeIds, n.id]); else setMessage("最多关联三个知识点"); }} /><div>{n.name}<p className="wb-muted wb-small">{n.path}</p></div></label>)}</div><button className="btn btn-primary" disabled={busy || !title.trim() || !nodeIds.length} onClick={() => save({ title, source, userWork: work, analysis, nodeIds, confirmed: true })}>确认关联并保存修改</button></>}
      {!redo && <><hr /><label className="wb-field">我的补充<textarea maxLength={12000} rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="写下自己的理解，或下次做题前的一句提醒。" /></label><div className="wb-actions"><button className="btn btn-secondary" disabled={busy} onClick={() => save({ userNote: note })}>保存补充</button>{!editing && <button className="btn btn-primary" disabled={busy} onClick={() => save({ userNote: note, reviewStatus: "mastered" })}>完成本次复习</button>}</div></>}
    </section></div><p role="status" className="wb-notice" hidden={!message}>{message}</p>
  </div>;
}
