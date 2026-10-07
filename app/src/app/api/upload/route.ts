import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { imageType, uploadRoot } from "@/lib/mistake-files";

export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "请选择不超过 10MB 的图片" }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const image = imageType(buffer);
    // Preserve the existing notes upload contract; mistake intake remains image-only.
    const documentExt = form.get("purpose") !== "mistake" ? (
      buffer.subarray(0, 5).toString() === "%PDF-" ? "pdf" :
      buffer.subarray(0, 8).equals(Buffer.from([208,207,17,224,161,177,26,225])) && /\.doc$/i.test(file.name) ? "doc" :
      buffer.subarray(0, 4).equals(Buffer.from([80,75,3,4])) && /\.docx$/i.test(file.name) ? "docx" : null
    ) : null;
    if (!image && !documentExt) return NextResponse.json({ error: "请使用 JPG、PNG 或 WebP 图片。HEIC 请先导出为 JPG；笔记另支持 PDF 和 Word 文件。" }, { status: 400 });
    const ext = image ? { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[image] : documentExt!;
    const type = image || "application/octet-stream";
    const filename = `${randomUUID()}.${ext}`;
    await mkdir(uploadRoot(), { recursive: true });
    await writeFile(path.join(uploadRoot(), filename), buffer, { flag: "wx" });
    return NextResponse.json({ url: `/uploads/${filename}`, name: file.name, type, size: file.size });
  } catch { return NextResponse.json({ error: "上传失败，请重新选择图片" }, { status: 500 }); }
}
