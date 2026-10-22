import { mkdirSync, openSync, closeSync } from 'node:fs';
import path from 'node:path';
const url=process.env.DATABASE_URL || '';
if(!url.startsWith('file:'))throw new Error('A persistent SQLite file path is required');
const value=url.slice(5).split('?')[0];
const file=path.isAbsolute(value)?value:path.resolve(process.cwd(),'prisma',value);
mkdirSync(path.dirname(file),{recursive:true,mode:0o700});closeSync(openSync(file,'a',0o600));
for(const dir of [process.env.UPLOAD_ROOT,process.env.MISTAKE_SKILL_DATA_ROOT,process.env.BACKUP_ROOT])if(dir)mkdirSync(dir,{recursive:true,mode:0o700});
