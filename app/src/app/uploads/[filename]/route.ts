import { readUploadedImage, uploadRoot } from "@/lib/mistake-files";
import { readFile } from "node:fs/promises";
import path from "node:path";
// Serve newly uploaded files in production too; Next's public inventory is build-time.
export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await params;
    if (/^[a-zA-Z0-9_.-]+\.(?:pdf|doc|docx)$/i.test(filename)) {
      const bytes = await readFile(path.join(uploadRoot(), filename));
      return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${filename}"`, "X-Content-Type-Options": "nosniff" } });
    }
    const { bytes, type } = await readUploadedImage(`/uploads/${filename}`);
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("图片不存在", { status: 404 }); }
}
