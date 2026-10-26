// Compare screenshots from the isolated mobile browser harness.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
(async () => {
 const folder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/mobile-experience-20261026');
 const desktop = [];
 for (const width of [769,1440]) for (const page of ['home','knowledge']) {
  const a=await sharp(`${folder}/before-${page}-${width}.png`).raw().toBuffer({resolveWithObject:true});
  const b=await sharp(`${folder}/after-${page}-${width}.png`).raw().toBuffer({resolveWithObject:true});
  let maxChannelDifference=0;
  for(let i=0;i<a.data.length;i++) maxChannelDifference=Math.max(maxChannelDifference,Math.abs(a.data[i]-b.data[i]));
  // Composited glass may round a channel by 1/255 across Chromium frames.
  if(a.info.width!==b.info.width || a.info.height!==b.info.height || maxChannelDifference>1) throw Error(`Desktop changed: ${page} ${width}`);
  desktop.push({width,page,identical:a.data.equals(b.data),maxChannelDifference});
 }
 fs.writeFileSync(`${folder}/desktop-comparison.json`,JSON.stringify(desktop,null,2));
 for(const page of ['home','knowledge']) {
  const tiles=[];
  for(const [i,phase] of ['before','after'].entries()) {
   const buffer=await sharp(`${folder}/${phase}-${page}-390.png`).extract({left:0,top:0,width:390,height:844}).toBuffer();
   tiles.push({input:buffer,left:16+i*406,top:56});
  }
  const label=Buffer.from('<svg width="828" height="44"><style>text{font:16px sans-serif;fill:#354526}</style><text x="24" y="29">Before · 390px</text><text x="430" y="29">After · 390px</text></svg>');
  await sharp({create:{width:828,height:916,channels:3,background:'#f3f4ed'}}).composite([...tiles,{input:label,left:0,top:0}]).png().toFile(`${folder}/compare-${page}-390.png`);
 }
 console.log('PASS desktop screenshot comparison (maximum channel rounding 1/255); side-by-side viewport comparisons generated');
})().catch(e=>{console.error(e);process.exitCode=1;});
