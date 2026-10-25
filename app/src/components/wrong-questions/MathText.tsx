import katex from "katex";

/** KaTeX escapes input; trust remains disabled, including HTML/link extensions. */
export default function MathText({ children, inline = false }: { children: string; inline?: boolean }) {
  const parts = children.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g);
  const Tag = inline ? "span" : "div";
  return <Tag className="wb-prewrap wb-math-text">{parts.map((part, i) => {
    const block = part.startsWith("$$") || part.startsWith("\\[");
    const math = block || part.startsWith("$") || part.startsWith("\\(");
    if (!math) return <span key={i}>{part}</span>;
    const formula = part.slice(block || part.startsWith("\\(") ? 2 : 1, block || part.startsWith("\\(") ? -2 : -1);
    try { return <span key={i} className={block ? "wb-math-block" : "wb-math-inline"} dangerouslySetInnerHTML={{ __html: katex.renderToString(formula, { displayMode: block, throwOnError: true, trust: false, strict: "ignore", maxExpand: 100, maxSize: 10, output: "mathml" }) }} />; }
    catch { return <span key={i}>{part}</span>; }
  })}</Tag>;
}
