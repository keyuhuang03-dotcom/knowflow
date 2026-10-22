import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
const result=ts.transpileModule(readFileSync('next.config.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
writeFileSync(process.argv[2] || 'next.config.mjs',result.outputText);
