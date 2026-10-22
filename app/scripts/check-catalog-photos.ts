// Read-only recognition check. Writes a private JSON report, never changes the database.
import { loadEnvConfig } from '@next/env';
import OpenAI from 'openai';
import { readFileSync, writeFileSync } from 'node:fs';
import { catalogRecognitionPrompt, decodeCatalogRecognition } from '../src/lib/catalog-recognition';
async function main() {
 const [output,...files]=process.argv.slice(2);
 if(!output || files.length<1 || files.length>6)throw new Error('Usage: output.json image1.jpg ... image6.jpg');
 loadEnvConfig(process.cwd());
 const baseURL=process.env.MISTAKE_AI_BASE_URL || 'https://api.openai.com/v1';
 const client=new OpenAI({apiKey:process.env.MISTAKE_AI_API_KEY,baseURL,timeout:90000,maxRetries:0});
 const start=Date.now();
 const response=await client.chat.completions.create({model:process.env.MISTAKE_AI_MODEL!,max_tokens:12000,response_format:{type:'json_object'},...(new URL(baseURL).hostname==='api.deepseek.com'?{reasoning_effort:'none' as const}:{}),messages:[{role:'system',content:catalogRecognitionPrompt},{role:'user',content:files.flatMap((f,i)=>[{type:'text' as const,text:`目录照片第 ${i+1}/${files.length} 页，按此顺序衔接。`},{type:'image_url' as const,image_url:{url:`data:image/jpeg;base64,${readFileSync(f).toString('base64')}`,detail:'high' as const}}])}]});
 if(response.choices[0]?.finish_reason==='length')throw new Error('Truncated output');
 const raw=JSON.parse(response.choices[0]?.message.content || '{}');
 const entries=decodeCatalogRecognition(raw);
 writeFileSync(output,JSON.stringify({entries,warnings:raw.warnings,elapsedSeconds:(Date.now()-start)/1000},null,2),{mode:0o600});
 console.log(JSON.stringify({count:entries.length,chapters:entries.filter(e=>e.path.length===1),warnings:raw.warnings,seconds:(Date.now()-start)/1000},null,2));
}
main().catch(()=>{console.error('Recognition check failed. No settings or secrets logged.');process.exitCode=1;});
