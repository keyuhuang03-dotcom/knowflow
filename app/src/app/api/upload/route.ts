import { withAccess } from "@/lib/request-guard";
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { imageType, uploadRoot } from "@/lib/mistake-files";
import { readImagePages } from "@/lib/mistake-pages";
import { InputError, record, text } from "@/lib/mistake-contract";
import { saveCapturedMistake } from "@/lib/mistake-service";
export const runtime = "nodejs";
async function POSTHandler(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll("file");
    if (!files.length || files.length > 6 || files.some(file => !(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024)) throw new InputError("请选择 1～6 页图片，每页不超过10MB");
    const selected = files as File[];
    if (selected.reduce((sum, file) => sum + file.size, 0) > 24 * 1024 * 1024) throw new InputError("本批图片超过24MB，请进一步裁剪或减少页数");
    const capture = form.get("purpose") === "mistake" && form.has("capture");
    const metadata = capture ? record(JSON.parse(text(form.get("capture"), "录入信息", 40000, true))) : null;
    const id = metadata ? text(metadata.id, "记录标识", 100, true) : "";
    if (metadata && !/^[0-9a-f-]{36}$/i.test(id)) throw new InputError("记录标识不正确");
    const assets = [];
    for (const file of selected) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const image = imageType(buffer);
      const documentExt = selected.length === 1 && form.get("purpose") !== "mistake" ? (
        buffer.subarray(0, 5).toString() === "%PDF-" ? "pdf" :
        buffer.subarray(0, 8).equals(Buffer.from([208,207,17,224,161,177,26,225])) && /\.doc$/i.test(file.name) ? "doc" :
        buffer.subarray(0, 4).equals(Buffer.from([80,75,3,4])) && /\.docx$/i.test(file.name) ? "docx" : null
      ) : null;
      if (!image && !documentExt) throw new InputError("请使用 JPG、PNG 或 WebP 图片。HEIC 请先导出为 JPG；笔记另支持单份 PDF 和 Word 文件。");
      const ext = image ? { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[image] : documentExt!;
      const filename = `${metadata ? `${id}-${createHash("sha256").update(buffer).digest("hex").slice(0, 24)}` : randomUUID()}.${ext}`;
      assets.push({ buffer, filename, url: `/uploads/${filename}`, name: file.name, type: image || "application/octet-stream", size: file.size });
    }
    // Validate the entire batch before writing; acknowledge only after all pages + record + job exist.
    await mkdir(uploadRoot(), { recursive: true });
    for (const asset of assets) {
      try { await writeFile(path.join(uploadRoot(), asset.filename), asset.buffer, { flag: "wx" }); }
      catch (error) { if (!metadata || !(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error; }
    }
    const urls = assets.map(a => a.url);
    const saved = metadata ? await saveCapturedMistake({ ...metadata, imageUrl: urls[0], imageUrls: urls, userWorkImageUrl: metadata.sameImageWork ? urls[0] : metadata.userWorkImageUrl }) : null;
    const savedUrls = saved ? readImagePages(saved.imageUrls, saved.imageUrl) : urls;
    return NextResponse.json({ mistakeId: saved?.id, url: savedUrls[0], urls: savedUrls, name: assets[0].name, type: assets[0].type, size: assets.reduce((sum, a) => sum + a.size, 0) });
  } catch (error) { return NextResponse.json({ error: error instanceof InputError ? error.message : "上传或保存失败，全部页面草稿仍可重试。" }, { status: error instanceof InputError || error instanceof SyntaxError ? 400 : 500 }); }
}

export const POST = withAccess(POSTHandler);
