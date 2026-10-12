"use client";
import { useId, useSyncExternalStore, type ReactNode } from "react";
import { defaultGlass, glassVariables, type GlassSettings, type GlassVariant } from "./glass";
import styles from "./GlassCard.module.css";

const preferences = ["(prefers-reduced-transparency: reduce)", "(prefers-contrast: more)", "(pointer: coarse)"];
function subscribe(callback: () => void) {
  const queries = preferences.map(q => matchMedia(q));
  queries.forEach(q => q.addEventListener("change", callback));
  return () => queries.forEach(q => q.removeEventListener("change", callback));
}
function canUseRefraction() {
  // CSS.supports checks syntax only. Conservatively enable desktop Chromium;
  // other engines and touch devices keep the B surface, even if syntax parses.
  return /(?:Chrome|Chromium)\//.test(navigator.userAgent) && !/Mobile|Android/.test(navigator.userAgent)
    && CSS.supports("backdrop-filter", 'url("#glass")')
    && preferences.every(q => !matchMedia(q).matches);
}
export function useGlassRefraction() { return useSyncExternalStore(subscribe, canUseRefraction, () => false); }

// Original, deterministic lens map: neutral center, opposing displacements at edges.
// Two channel images combine into an RG displacement map. No noise or animation.
function channelMap(axis: "x" | "y") {
  const colors = axis === "x" ? ["#ff0000", "#800000", "#000000"] : ["#00ff00", "#008000", "#000000"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><linearGradient id="g" x2="${axis === "x" ? "100%" : "0%"}" y2="${axis === "y" ? "100%" : "0%"}"><stop stop-color="${colors[0]}"/><stop offset=".14" stop-color="${colors[1]}"/><stop offset=".86" stop-color="${colors[1]}"/><stop offset="1" stop-color="${colors[2]}"/></linearGradient></defs><rect width="256" height="256" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
const xMap = channelMap("x"), yMap = channelMap("y");
export default function GlassCard({ children, variant = "B", settings, forceFallback = false, className = "" }: { children: ReactNode; variant?: GlassVariant; settings?: GlassSettings; forceFallback?: boolean; className?: string }) {
  const id = `glass-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const supported = useGlassRefraction();
  const values = settings ?? defaultGlass;
  const refracting = variant === "C" && supported && !forceFallback && values.refraction > 0;
  return <div className={`${styles.card} knowflow-glass ${className}`} data-variant={variant} data-refraction={refracting ? "active" : "off"} style={settings ? glassVariables(settings) : undefined}>
    {refracting && <svg className={styles.definitions} aria-hidden="true" focusable="false"><defs><filter id={id} x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feImage href={xMap} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="horizontal" />
      <feImage href={yMap} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="vertical" />
      <feBlend in="horizontal" in2="vertical" mode="screen" result="lens" />
      <feDisplacementMap in="SourceGraphic" in2="lens" scale={values.refraction} xChannelSelector="R" yChannelSelector="G" />
    </filter></defs></svg>}
    <div aria-hidden="true" className={styles.surface} style={refracting ? { backdropFilter: `blur(${values.blur}px) url("#${id}")`, WebkitBackdropFilter: `blur(${values.blur}px) url("#${id}")` } : undefined} />
    <div className={styles.content}>{children}</div>
  </div>;
}
