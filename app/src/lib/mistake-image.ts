/** Bound both decoded input and canvas output for mobile memory. */
export function imageSize(width: number, height: number, limit = 2400) {
  if (!width || !height || width * height > 50_000_000) throw new Error("图片像素过大或无效，请先在相册裁剪，或截图后重新选择。");
  const scale = Math.min(1, limit / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export function cropRect(width: number, height: number, edges: number[]) {
  const [left, top, right, bottom] = edges;
  if (edges.length !== 4 || edges.some(n => !Number.isFinite(n) || n < 0 || n > 95) || left + right > 95 || top + bottom > 95) throw new Error("裁剪范围无效");
  return { x: width * left / 100, y: height * top / 100, width: Math.max(1, Math.round(width * (100 - left - right) / 100)), height: Math.max(1, Math.round(height * (100 - top - bottom) / 100)) };
}
export async function prepareImage(blob: Blob, rotation = 0, edges = [0, 0, 0, 0]): Promise<Blob> {
  if (!blob.size || blob.size > 25 * 1024 * 1024) throw new Error("请选择小于 25MB 的图片；大图请先在相册裁剪或截图。");
  // Reject HEIC and other formats explicitly instead of relying on inconsistent browser decoders.
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v);
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!jpeg && !png && !webp) throw new Error("请使用 JPG、PNG 或 WebP。HEIC/实况照片请在相册导出为 JPG，或截图后选择；后续拍照可将相机格式设为“兼容性最佳”。");
  const url = URL.createObjectURL(blob);
  const img = new Image();
  try {
    // Modern Safari's image decoder applies EXIF orientation. Do not rotate EXIF twice.
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("无法读取图片，请重新导出 JPG 或截图后选择。")); img.src = url; });
    const size = imageSize(img.naturalWidth, img.naturalHeight);
    const crop = cropRect(img.naturalWidth, img.naturalHeight, edges);
    const scale = size.width / img.naturalWidth;
    const w = Math.max(1, Math.round(crop.width * scale)), h = Math.max(1, Math.round(crop.height * scale));
    const canvas = document.createElement("canvas");
    const swapped = rotation % 180 !== 0;
    canvas.width = swapped ? h : w; canvas.height = swapped ? w : h;
    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("图片处理内存不足，请先在相册裁剪后重试。");
      ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(rotation * Math.PI / 180);
      ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, -w / 2, -h / 2, w, h);
      const result = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("压缩失败，请缩小图片后重试。")), "image/jpeg", 0.9));
      if (result.size > 10 * 1024 * 1024) throw new Error("压缩后仍超过 10MB，请进一步裁剪。");
      return result;
    } finally { canvas.width = 0; canvas.height = 0; }
  } finally { img.src = ""; URL.revokeObjectURL(url); }
}

async function storedImage(key: string, action: "read" | "write" | "delete", blob?: Blob | Blob[]): Promise<unknown> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("knowflow-intake", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("images");
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("images", action === "read" ? "readonly" : "readwrite");
      const store = tx.objectStore("images");
      const request = action === "read" ? store.get(key) : action === "write" ? store.put(blob, key) : store.delete(key);
      tx.oncomplete = () => resolve(action === "read" ? request.result : undefined);
      tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function pendingImage(key: string, action: "read" | "write" | "delete", blob?: Blob): Promise<Blob | undefined> {
  const value = await storedImage(key, action, blob);
  if (action === "read" && value !== undefined && !(value instanceof Blob)) throw new Error("图片草稿格式不正确");
  return value as Blob | undefined;
}
export async function pendingImages(key: string, action: "read" | "write" | "delete", blobs?: Blob[]): Promise<Blob[]> {
  const value = await storedImage(key, action, blobs);
  if (action !== "read" || value === undefined) return [];
  const pages = value instanceof Blob ? [value] : value; // restore the former single-photo draft
  if (!Array.isArray(pages) || pages.length > 6 || pages.some(v => !(v instanceof Blob)) || pages.reduce((sum, b) => sum + b.size, 0) > 24 * 1024 * 1024) throw new Error("多页草稿格式不正确");
  return pages;
}
