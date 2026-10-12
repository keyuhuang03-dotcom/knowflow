import { InputError } from "./mistake-contract";
export const MAX_IMAGE_PAGES = 6;
const uploadedImage = /^\/uploads\/[a-zA-Z0-9_.-]+\.(jpg|jpeg|png|webp)$/i;
export function parseImagePages(value: unknown, first?: string | null): string[] {
  if (value === undefined || value === null) return first ? [first] : [];
  if (!Array.isArray(value) || !value.length || value.length > MAX_IMAGE_PAGES || value.some(v => typeof v !== "string" || !uploadedImage.test(v))) throw new InputError("请选择 1～6 页已上传的 JPG、PNG 或 WebP 图片");
  if (first && value[0] !== first) throw new InputError("原题首页与图片顺序不一致");
  if (new Set(value).size !== value.length) throw new InputError("本批存在重复页面，请移除重复图片后重试");
  return value;
}
export function readImagePages(serialized: string | null | undefined, first: string | null | undefined): string[] {
  try { return serialized ? parseImagePages(JSON.parse(serialized), first) : first ? [first] : []; }
  catch { return first ? [first] : []; }
}
