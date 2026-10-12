import type { CSSProperties } from "react";
export type GlassVariant = "A" | "B" | "C";
export type GlassSettings = { transparency: number; blur: number; highlight: number; refraction: number; shadow: number };
export const defaultGlass: GlassSettings = { transparency: 78, blur: 16, highlight: 70, refraction: 3, shadow: 24 };
export const controls = [
  { key: "transparency", label: "透明度", min: 35, max: 95, unit: "%" },
  { key: "blur", label: "模糊强度", min: 0, max: 32, unit: "px" },
  { key: "highlight", label: "边缘高光", min: 0, max: 100, unit: "%" },
  { key: "refraction", label: "折射强度 · 仅 C", min: 0, max: 8, unit: "px" },
  { key: "shadow", label: "阴影强度", min: 0, max: 60, unit: "%" },
] as const;
export function glassVariables(settings: GlassSettings): CSSProperties & Record<string, string> {
  return {
    "--glass-tint": ((100 - settings.transparency) / 100).toFixed(2),
    "--glass-blur": `${settings.blur}px`,
    "--glass-highlight": (settings.highlight / 100).toFixed(2),
    "--glass-refraction": `${settings.refraction}px`,
    "--glass-shadow": (settings.shadow / 100).toFixed(2),
  };
}
export function glassCSS(settings: GlassSettings, variant: GlassVariant) {
  return `/* KnowFlow · 方案 ${variant}\n * 用于 GlassCard；保留组件配套 CSS 与 SVG。\n * C 的 SVG scale 由 settings.refraction 驱动，单独粘贴 CSS 不会产生折射。\n * settings: ${JSON.stringify(settings)}\n */\n.knowflow-glass {\n${Object.entries(glassVariables(settings)).map(([key, value]) => `  ${key}: ${value};`).join("\n")}\n}\n/* <GlassCard variant="${variant}" settings={settings}>…</GlassCard> */`;
}
