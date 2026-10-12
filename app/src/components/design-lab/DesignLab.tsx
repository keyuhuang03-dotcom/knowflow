"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Check, Copy, RotateCcw, SlidersHorizontal } from "lucide-react";
import GlassCard, { useGlassRefraction } from "./GlassCard";
import { controls, defaultGlass, glassCSS, type GlassVariant } from "./glass";
import styles from "./DesignLab.module.css";
const variants = [
  { id: "A", name: "基础毛玻璃", subtitle: "柔化背景，保留安静", detail: "均匀透明度与背景模糊，边界平整。作为比较基准。" },
  { id: "B", name: "精致玻璃", subtitle: "让光停在边缘", detail: "透明渐变、细微高光与接触阴影，轻盈且有厚度。" },
  { id: "C", name: "Liquid Glass", subtitle: "一点点光学变化", detail: "沿用 B 的材质，只轻微偏移背景边缘，文字不参与折射。" },
] as const;
const backgrounds = [{ id: "morning", name: "晨间柔光" }, { id: "lime", name: "青柠微光" }, { id: "cream", name: "奶油日光" }, { id: "plain", name: "纯净奶白" }] as const;
export default function DesignLab() {
  const [settings, setSettings] = useState({ ...defaultGlass });
  const [variant, setVariant] = useState<GlassVariant>("B");
  const [background, setBackground] = useState("morning");
  const [fallback, setFallback] = useState(false);
  const [probe, setProbe] = useState(false);
  const [status, setStatus] = useState("");
  const exportRef = useRef<HTMLTextAreaElement>(null);
  const refraction = useGlassRefraction();
  const css = glassCSS(settings, variant);
  async function copy() {
    try { await navigator.clipboard.writeText(css); setStatus("当前参数已复制"); }
    catch { exportRef.current?.focus(); exportRef.current?.select(); setStatus("无法自动复制，已选中参数，请手动复制。"); }
  }
  return <div className={styles.lab} data-background={background}>
    <div className={styles.topline}><Link href="/knowledge">← 返回知识库</Link><span>知序 KnowFlow <span className={styles.labTag}>DESIGN LAB</span></span></div>
    <header className={styles.header}><p className={styles.eyebrow}>材质研究 / LIQUID GLASS</p><h1>清透一点，<br className={styles.mobileBreak} />让知识更近一点。</h1><p>同一张学科卡片，三种玻璃语言。先看边缘，再看光如何穿过。</p></header>
    <section className={styles.environment} aria-label="背景与兼容模式"><div><span className={styles.label}>自然环境光</span><div className={styles.segment}>{backgrounds.map(b => <button key={b.id} aria-pressed={background === b.id} onClick={() => setBackground(b.id)}><i data-swatch={b.id} />{b.name}</button>)}</div></div><div className={styles.switches}><label><input type="checkbox" checked={probe} onChange={e => setProbe(e.target.checked)} />显示通透观察标记</label><label><input type="checkbox" checked={fallback} onChange={e => setFallback(e.target.checked)} />C 使用兼容模式</label></div></section>
    <div className={styles.comparison}>{variants.map(v => <section key={v.id} className={styles.sample} aria-labelledby={`variant-${v.id}`}>
      <header className={styles.sampleHeader}><span className={styles.letter}>{v.id}</span><div><h2 id={`variant-${v.id}`}>{v.name}</h2><p>{v.subtitle}</p></div>{v.id === "B" && <span className={styles.recommended}>推荐</span>}</header>
      <div className={styles.stage}>
        {probe && <div aria-hidden="true" className={styles.probe}>知序<span />KnowFlow</div>}
        <GlassCard variant={v.id} settings={settings} forceFallback={fallback}>
          <div className={styles.cardTop}><span className={styles.bookIcon}><BookOpen size={25} strokeWidth={1.4} /></span><span className={styles.example}>学科卡片 · 示例</span></div>
          <h3 className={styles.subject}>数学</h3><p className={styles.textbook}>高等数学 · 主教材</p><p className={styles.chapter}>从一个知识点，连接每一次理解。</p>
          <div className={styles.nodes}><span>极限与连续</span><span>导数与微分</span></div>
          <div className={styles.cardFooter}><span><strong>16</strong> 个知识节点</span><ArrowUpRight size={20} strokeWidth={1.4} /></div>
        </GlassCard>
      </div>
      <p className={styles.description}>{v.detail}</p>
      <p className={styles.mode}>{v.id === "C" ? refraction && !fallback && settings.refraction > 0 ? "当前：轻微 SVG 背景折射" : "当前：B 材质兼容显示，折射关闭" : v.id === "B" ? "CSS 渐变 · 边缘高光 · 双层阴影" : "CSS backdrop blur"}</p>
      <button className={styles.select} aria-pressed={variant === v.id} onClick={() => { setVariant(v.id); setStatus(""); }}>{variant === v.id ? <Check size={16} /> : <span className={styles.emptyCircle} />}{variant === v.id ? "已选定此方案" : "选择此方案"}</button>
    </section>)}</div>
    <section className={styles.controls} aria-labelledby="controls-title"><div className={styles.controlHeading}><div><SlidersHorizontal size={18} /><h2 id="controls-title">调一点，刚刚好</h2><span>三张卡片同步更新</span></div><button onClick={() => { setSettings({ ...defaultGlass }); setStatus(""); }}><RotateCcw size={14} />恢复默认</button></div><div className={styles.sliders}>{controls.map(c => <label key={c.key}><span>{c.label}<output htmlFor={`glass-${c.key}`}>{settings[c.key]}<small>{c.unit}</small></output></span><input id={`glass-${c.key}`} type="range" min={c.min} max={c.max} step="1" value={settings[c.key]} onChange={e => { setSettings(s => ({ ...s, [c.key]: Number(e.target.value) })); setStatus(""); }} /></label>)}</div></section>
    <section className={styles.bottom}><div className={styles.note}><span className={styles.label}>知序的材质建议</span><h2>把 B 留给日常，<br />把 C 留给细节。</h2><p>清晰的文字、安静的光，比夸张的扭曲更适合长时间学习。建议先以 B 为基准，降低模糊与阴影，再决定是否需要折射。</p><p className={styles.compatibility}>C 在桌面 Chromium 尝试启用；Safari、触控设备或兼容模式使用 B。系统要求减少透明度时使用实色表面。此状态是保守兼容策略，不能代替真机视觉验收。</p></div><div className={styles.export}><div className={styles.exportHeading}><h2>带走这组参数 <span>方案 {variant}</span></h2><button onClick={copy}><Copy size={15} />复制 CSS 参数</button></div><textarea ref={exportRef} aria-label="当前方案 CSS 参数" readOnly value={css} spellCheck={false} /><p role="status">{status || "参数与 GlassCard 配套使用；选中内容也可手动复制。"}</p></div></section>
    <footer className={styles.footer}><span>KNOWFLOW / MATERIAL STUDY</span><span>仅视觉实验 · 不会改变你的知识库</span></footer>
  </div>;
}
