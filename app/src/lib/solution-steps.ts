/** Split explicit numbered prose only; never split numbers inside TeX. */
export function solutionSteps(text: string): string[] {
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g);
  const markers: number[] = [];
  const marked = parts.map((part, i) => i % 2 ? part : part.replace(/(^|\n|(?<=[。；])\s*)(\d+)[.、]\s+/g, (_, space, n) => {
    markers.push(Number(n));
    return `${space}\u0000`;
  })).join("");
  if (markers.length < 2 || markers.some((n, i) => n !== i + 1) || marked.split("\u0000")[0].trim()) return [text];
  return marked.split("\u0000").slice(1).map(s => s.trim());
}
