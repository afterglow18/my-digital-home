/**
 * Background removal helper — wraps @imgly/background-removal.
 *
 * Uses the isnet_fp16 model streamed from the imgly CDN (~15 MB, cached after first use).
 * Model names valid in v1.7: "isnet" | "isnet_fp16" | "isnet_quint8"  (NOT "small"/"medium")
 * publicPath is omitted → SDK uses its built-in CDN path automatically.
 *
 * ── Why configureOrt() exists ────────────────────────────────────────────────
 * @imgly/background-removal runs ONNX inference on the main JS thread by default,
 * freezing the entire UI while the model thinks. ONNX Runtime Web has a
 * wasm.proxy = true flag that moves inference into a Web Worker, but imgly
 * internally sets it back to false right before creating the session (it only
 * enables the proxy when WebGPU is available, which it isn't on iOS Safari/WKWebView).
 *
 * Three-part fix:
 *  1. Object.defineProperty with a no-op setter so imgly's proxy = false write
 *     is silently ignored and the value stays true.
 *  2. numThreads = 1 — iOS Safari has no SharedArrayBuffer, so WASM multithreading
 *     causes a silent crash; single-threaded avoids it.
 *  3. Dynamic import("onnxruntime-web") instead of a top-level import — importing
 *     at module parse time triggers Vite's dep pre-bundling mid-session, causing a
 *     full-page reload that corrupts React's internal dispatcher.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";

let ortReady = false;

async function configureOrt(): Promise<void> {
  if (ortReady) return;
  ortReady = true; // set before await so concurrent callers don't double-configure

  const ort = await import("onnxruntime-web");

  // Lock proxy = true so imgly cannot set it back to false
  Object.defineProperty(ort.env.wasm, "proxy", {
    get: () => true,
    set: () => {},      // silent no-op — blocks imgly's internal proxy = false
    configurable: true, // allow re-definition if needed in tests
  });

  // iOS Safari has no SharedArrayBuffer → multithreaded WASM silently crashes
  ort.env.wasm.numThreads = 1;
}

/**
 * Remove the background from a JPEG/PNG data-URL.
 * Returns a transparent PNG data-URL.
 * Inference runs in a Web Worker — the main thread stays responsive.
 * Throws on network error or unreadable image — callers must catch and fall back.
 */
export async function removeBackground(dataUrl: string): Promise<string> {
  await configureOrt();
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
