/**
 * Background removal helper — wraps @imgly/background-removal.
 *
 * Model: isnet_quint8  (8-bit quantised — ~half the RAM of isnet_fp16,
 *   critical for avoiding iOS WKWebView jetsam kills on lower-RAM devices).
 *
 * Input images are downscaled to ≤ MAX_INFERENCE_PX before inference.
 * The model internally works at a fixed resolution (512–1024 px) anyway, so
 * passing a 3000 px source just wastes memory on the decode + tensor alloc.
 *
 * ── Why configureOrt() exists ────────────────────────────────────────────────
 * @imgly/background-removal runs ONNX inference on the main JS thread by
 * default, freezing the entire UI while the model thinks. ONNX Runtime Web has
 * a wasm.proxy = true flag that moves inference into a Web Worker, but imgly
 * internally sets it back to false right before creating the session (it only
 * enables the proxy when WebGPU is available, which it isn't on iOS Safari /
 * WKWebView).
 *
 * Three-part fix:
 *  1. Object.defineProperty with a no-op setter so imgly's proxy = false write
 *     is silently ignored and the value stays true.
 *  2. numThreads = 1 — iOS Safari has no SharedArrayBuffer, so WASM
 *     multithreading causes a silent crash; single-threaded avoids it.
 *  3. Dynamic import("onnxruntime-web") instead of a top-level import —
 *     importing at module parse time triggers Vite's dep pre-bundling
 *     mid-session, causing a full-page reload that corrupts React's dispatcher.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";

/** Maximum edge length fed to the model. Larger inputs are downscaled first. */
const MAX_INFERENCE_PX = 1024;

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
 * Downscale a data-URL to at most MAX_INFERENCE_PX on the longest edge.
 * Returns a JPEG data-URL. If the image is already small enough, returns as-is.
 */
async function resizeForInference(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      if (Math.max(w, h) <= MAX_INFERENCE_PX) {
        // Already within budget — return unchanged to avoid a lossy re-encode
        resolve(dataUrl);
        return;
      }
      const scale = MAX_INFERENCE_PX / Math.max(w, h);
      const tw = Math.round(w * scale);
      const th = Math.round(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = tw;
      canvas.height = th;
      canvas.getContext("2d")!.drawImage(img, 0, 0, tw, th);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("resizeForInference: failed to load image"));
    img.src = dataUrl;
  });
}

/**
 * Remove the background from a JPEG/PNG data-URL.
 * Returns a transparent PNG data-URL.
 * Input is automatically downscaled to ≤ MAX_INFERENCE_PX before inference
 * to keep peak memory well within iOS WKWebView limits.
 * Throws on network error or unreadable image — callers must catch and fall back.
 */
export async function removeBackground(dataUrl: string): Promise<string> {
  await configureOrt();
  const smallDataUrl = await resizeForInference(dataUrl);
  const sourceBlob   = await dataUrlToBlob(smallDataUrl);
  const resultBlob   = await imglyRemoveBackground(sourceBlob, {
    model: "isnet_quint8", // half the RAM of isnet_fp16 — required to avoid iOS WKWebView jetsam kills
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
