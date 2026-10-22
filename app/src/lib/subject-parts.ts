import { InputError } from './mistake-contract';
export const subjectParts: Record<string, { id: string; name: string }[]> = {
  math: [{id:'calculus',name:'高等数学'},{id:'linear-algebra',name:'线性代数'},{id:'probability',name:'概率论与数理统计'}],
  cs: [{id:'data-structures',name:'数据结构'},{id:'computer-organization',name:'计算机组成原理'},{id:'operating-systems',name:'操作系统'},{id:'computer-networks',name:'计算机网络'}],
};
export function validateSubjectPart(subjectId: string, part: unknown) {
  if (part === undefined || part === null || part === '') return null;
  if (typeof part !== 'string' || !subjectParts[subjectId]?.some(p => p.id === part)) throw new InputError('科目部分无效，请重新选择');
  return part;
}
export function partBooks(value: string | null | undefined): Record<string,string> {
  try {const v=JSON.parse(value || '{}');return v && typeof v==='object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([,v])=>typeof v==='string')) as Record<string,string> : {};}catch{return {};}
}
