import { readFile } from "node:fs/promises";
import path from "node:path";
import { InputError } from "./mistake-contract";

export const uploadRoot = () => process.env.UPLOAD_ROOT?.trim() || path.join(process.cwd(), "public", "uploads");
export function imageType(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}
export async function readUploadedImage(url: unknown) {
  if (typeof url !== "string" || !/^\/uploads\/[a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i.test(url)) throw new InputError("请选择已上传的 JPG、PNG 或 WebP 图片");
  let bytes: Buffer;
  try { bytes = await readFile(path.join(uploadRoot(), path.basename(url))); }
  catch { throw new InputError("原图已不存在，请重新上传"); }
  const type = imageType(bytes);
  if (!type || bytes.length > 10 * 1024 * 1024) throw new InputError("图片格式不支持或超过 10MB");
  return { bytes, type, url };
}
