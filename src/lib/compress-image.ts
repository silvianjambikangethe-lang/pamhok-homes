// Client-side only — downscales/re-encodes a photo before upload so a
// real phone camera photo (often 5-10MB+) doesn't blow past Vercel's
// serverless function request body limit (4.5MB total, hard platform
// ceiling, not something route code can raise). Confirmed live
// (2026-09-13): real ID uploads were failing with a 413 rejected before
// ever reaching the upload-id route, while small test images worked —
// two full-resolution photos (front + back) in one multipart request
// were the actual cause, not Dojah or storage.
//
// PDFs pass through untouched (canvas can't compress them, and the
// upload-id route already sends PDFs straight to manual review, so
// there's no automated check depending on their size here).
export async function compressImageForUpload(
  file: File,
  maxDimension = 1800,
  quality = 0.82,
): Promise<File> {
  if (file.type === "application/pdf") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    // Never let a compression failure block a legitimate upload — worst
    // case is the original (possibly large) file goes through as before.
    return file;
  }
}
