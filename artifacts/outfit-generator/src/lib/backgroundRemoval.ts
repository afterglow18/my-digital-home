/**
 * Background removal helper — wraps @imgly/background-removal.
 *
 * Uses the isnet_fp16 model streamed from the imgly CDN (~15 MB, cached after first use).
 * Model names valid in v1.7: "isnet" | "isnet_fp16" | "isnet_quint8"  (NOT "small"/"medium")
 * publicPath is omitted → SDK uses its built-in CDN path automatically.
 */
import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";

/**
 * Remove the background from a JPEG/PNG data-URL.
 * Returns a transparent PNG data-URL.
 * Throws on network error or unreadable image — callers must catch and fall back.
 */
export async function removeBackground(dataUrl: string): Promise<string> {
  const sourceBlob = await dataUrlToBlob(dataUrl);
  const resultBlob = await imglyRemoveBackground(sourceBlob, {
    model: "isnet_fp16",
    output: { format: "image/png", quality: 0.9 },
  });
  return blobToDataUrl(resultBlob);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
