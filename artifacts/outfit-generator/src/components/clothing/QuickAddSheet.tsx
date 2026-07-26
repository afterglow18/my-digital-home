/**
 * QuickAddSheet
 *
 * Upload flow (single photo):
 *   pick ──► encoding ──► preview (Original | Cleaned ✨) ──► uploading ──► close
 *
 * Upload flow (multi-photo gallery):
 *   pick ──► uploading ──► close   (no comparison for bulk)
 *
 * IMPORTANT: No AnimatePresence around phase blocks — any exit-animation window
 * creates a blank screen between phase changes. The outer sheet still slides in
 * with motion.div.
 */
import React, { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Check, RotateCcw } from "lucide-react";
import { useCreateClothingItem, getListClothingQueryKey } from "@/hooks/useLocalWardrobe";
import type { ClothingItem } from "@/types/local";
import { useQueryClient } from "@tanstack/react-query";
import { encodeToPng } from "@/lib/processImage";
import {
  removeBackground,
  blobToDataUrl,
  dataUrlToBlob,
} from "@/lib/backgroundRemoval";

// ── Types ──────────────────────────────────────────────────────────────────────

type Category = "furniture" | "decor" | "organization" | "supplies";

const CATEGORY_LABELS: Record<Category, string> = {
  furniture:    "Furniture",
  decor:        "Décor",
  organization: "Organization",
  supplies:     "Supplies",
};

type Phase = "pick" | "encoding" | "preview" | "uploading";

interface UploadProgress { done: number; total: number; }

// ── Helpers (outside component — no stale closure risk) ───────────────────────

/**
 * Compress any image File/Blob to a JPEG ≤ 2048 px on the longest edge.
 * Rejects with a descriptive error if the image can't be loaded or the canvas
 * produces an empty result.
 */
async function encodeForUpload(input: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(input);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX   = 2048;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w     = Math.round(img.naturalWidth  * scale);
      const h     = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (b) => (b && b.size > 1000 ? resolve(b) : reject(new Error("blank image"))),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("failed to load image"));
    };
    img.src = objectUrl;
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  category:      Category;
  existingCount: number;
  onCreated?:    (item: ClothingItem) => void;
}

const PHOTO_TIPS = [
  "Photograph individual products or bundle multiple items together.",
  "Lay everything flat on a plain background.",
  "Take the photo from directly above.",
  "Keep all items fully in frame.",
] as const;

export function QuickAddSheet({ open, onOpenChange, category, existingCount, onCreated }: Props) {
  // ── Phase & error ──
  const [phase,    setPhase]    = useState<Phase>("pick");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Background removal state ──
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [originalUrl,  setOriginalUrl]  = useState<string | null>(null);
  const [cleanedBlob,  setCleanedBlob]  = useState<Blob | null>(null);
  const [cleanedUrl,   setCleanedUrl]   = useState<string | null>(null);
  const [bgProcessing, setBgProcessing] = useState(false);
  const [bgFailed,     setBgFailed]     = useState(false);
  const [selected,     setSelected]     = useState<"original" | "cleaned">("original");

  // Generation counter — prevents a slow first photo clobbering a fast second one
  const bgGenRef = useRef(0);

  // ── Multi-photo bulk progress ──
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const createItem  = useCreateClothingItem();
  const queryClient = useQueryClient();

  // ── Reset & close ──────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    bgGenRef.current += 1;    // cancels any in-flight removal
    setBgProcessing(false);   // MUST reset — close can happen mid-removal
    setPhase("pick");
    setErrorMsg(null);
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setSelected("original");
    setProgress(null);
    onOpenChange(false);
  }, [onOpenChange]);

  // ── Single-photo flow (with bg comparison) ────────────────────────────────
  const handleSingleFile = useCallback(async (file: File | Blob) => {
    setErrorMsg(null);
    const myGen = ++bgGenRef.current;

    // Reset comparison state
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setBgProcessing(false);
    setSelected("original");

    // Show encoding spinner immediately
    setPhase("encoding");

    let jpeg: Blob;
    try {
      jpeg = await encodeForUpload(file);
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      setErrorMsg(`Could not read the photo: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("pick");
      return;
    }
    if (bgGenRef.current !== myGen) return;

    // Show original, switch to comparison screen
    setOriginalBlob(jpeg);
    setOriginalUrl(URL.createObjectURL(jpeg));
    setPhase("preview");

    // Background removal — generation guard discards stale results
    setBgProcessing(true);
    try {
      const dataUrl    = await blobToDataUrl(jpeg);
      if (bgGenRef.current !== myGen) return;
      const resultUrl  = await removeBackground(dataUrl);
      if (bgGenRef.current !== myGen) return;
      const resultBlob    = await dataUrlToBlob(resultUrl);
      const resultObjUrl  = URL.createObjectURL(resultBlob);
      if (bgGenRef.current !== myGen) { URL.revokeObjectURL(resultObjUrl); return; }
      setCleanedBlob(resultBlob);
      setCleanedUrl(resultObjUrl);
      setSelected("cleaned");
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      console.warn("Background removal failed:", err);
      setBgFailed(true);
    } finally {
      if (bgGenRef.current === myGen) setBgProcessing(false);
    }
  }, []);

  // ── Save chosen version to IndexedDB ──────────────────────────────────────
  const handleSave = useCallback(async () => {
    const blob = selected === "cleaned" && cleanedBlob ? cleanedBlob : originalBlob;
    if (!blob) return;
    setPhase("uploading");

    try {
      const dataUrl  = await blobToDataUrl(blob);
      const label    = CATEGORY_LABELS[category];
      const autoName = existingCount === 0 ? label : `${label} ${existingCount + 1}`;

      await new Promise<void>((resolve, reject) => {
        createItem.mutate(
          { data: { name: autoName, category, imageObjectPath: dataUrl } },
          {
            onSuccess: (createdItem) => {
              queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
              if (onCreated) onCreated(createdItem);
              resolve();
            },
            onError: reject,
          },
        );
      });
      handleClose();
    } catch (err) {
      setErrorMsg(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("preview");
    }
  }, [selected, cleanedBlob, originalBlob, category, existingCount, createItem, queryClient, onCreated, handleClose]);

  // ── Multi-photo bulk flow (gallery multi-select) ──────────────────────────
  const handleBulkFiles = useCallback(async (files: File[]) => {
    setErrorMsg(null);
    setPhase("uploading");
    setProgress({ done: 0, total: files.length });

    let saved = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        const png = await encodeToPng(files[i]);
        const dataUrl  = await blobToDataUrl(png);
        const label    = CATEGORY_LABELS[category];
        const n        = existingCount + i + 1;
        const autoName = n === 1 ? label : `${label} ${n}`;

        await new Promise<void>((resolve, reject) => {
          createItem.mutate(
            { data: { name: autoName, category, imageObjectPath: dataUrl } },
            {
              onSuccess: (createdItem) => {
                queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
                if (onCreated) onCreated(createdItem);
                resolve();
              },
              onError: reject,
            },
          );
        });
        saved++;
      } catch (err) {
        console.error("Bulk save failed for file", i, err);
      }
      setProgress({ done: i + 1, total: files.length });
    }

    if (saved === 0) {
      setErrorMsg("Could not save the photos. Please try again.");
      setPhase("pick");
      setProgress(null);
    } else {
      handleClose();
      setProgress(null);
    }
  }, [category, existingCount, createItem, queryClient, onCreated, handleClose]);

  // ── Input handlers ────────────────────────────────────────────────────────
  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 1) handleSingleFile(files[0]);
    else if (files.length > 1) handleBulkFiles(files);
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 1) handleSingleFile(files[0]);
    else if (files.length > 1) handleBulkFiles(files);
  };

  if (!open) return null;

  const label = CATEGORY_LABELS[category];

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[70] flex flex-col max-w-md mx-auto bg-[#f9f4ee]"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 pb-3 bg-white border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <h2 className="font-display font-bold text-xl uppercase tracking-tight">
          Add {label}
        </h2>
        {(phase === "pick" || phase === "preview") && (
          <button
            onClick={handleClose}
            className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                       bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                       active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body — plain conditional divs, NO AnimatePresence (causes blank flash) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>

        {/* ── PICK ── */}
        {phase === "pick" && (
          <div className="flex flex-col p-5 gap-5">
            {errorMsg && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                {errorMsg}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                           border-4 border-black rounded-2xl
                           shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none
                           transition-all"
                style={{ background: "linear-gradient(to bottom, #6B7A52, #4F5E3C)" }}
              >
                <span className="text-4xl leading-none">📷</span>
                <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight text-white">
                  Take<br />Photo
                </span>
              </button>

              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                           border-4 border-black rounded-2xl bg-white
                           shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none
                           transition-all"
              >
                <span className="text-4xl leading-none">🖼️</span>
                <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight">
                  Upload<br />Photos
                </span>
                <span className="text-[10px] font-medium text-black/50 uppercase tracking-wider -mt-1">
                  select multiple
                </span>
              </button>
            </div>

            <div className="border-2 border-black rounded-2xl bg-white p-4
                            shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-display font-bold text-sm uppercase tracking-tight mb-3 flex items-center gap-2">
                <span>📸</span> PHOTO TIPS
              </p>
              <ul className="flex flex-col gap-2">
                {PHOTO_TIPS.map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-sm text-black/70 leading-snug">
                    <span
                      className="mt-0.5 w-4 h-4 border-2 border-black rounded-sm
                                 flex items-center justify-center flex-shrink-0"
                      style={{ background: "#4F5E3C" }}
                    >
                      <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── ENCODING — shown immediately after photo is picked ── */}
        {phase === "encoding" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
            <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                            flex items-center justify-center
                            shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
            </div>
            <p className="font-display font-bold text-2xl uppercase tracking-tight">Processing…</p>
            <p className="text-sm text-muted-foreground">Getting your photo ready.</p>
          </div>
        )}

        {/* ── PREVIEW — side-by-side comparison ── */}
        {phase === "preview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20 }}>
            {errorMsg && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                {errorMsg}
              </p>
            )}

            <p style={{ textAlign: "center", fontWeight: "bold", fontSize: 11,
                        textTransform: "uppercase", letterSpacing: 2, opacity: 0.4 }}>
              {bgProcessing ? "Removing background… this will take a moment" : bgFailed ? "Original only" : "Tap to choose"}
            </p>

            <div style={{ display: "flex", gap: 12 }}>
              {/* Original card */}
              <button
                onClick={() => setSelected("original")}
                style={{
                  flex: 1,
                  opacity: selected === "original" ? 1 : 0.5,
                  border: selected === "original" ? "4px solid black" : "4px solid rgba(0,0,0,0.2)",
                  borderRadius: 16, overflow: "hidden", background: "none", padding: 0,
                  cursor: "pointer",
                }}
              >
                <div style={{ background: "#111", minHeight: 176, position: "relative" }}>
                  {originalUrl && (
                    <img
                      src={originalUrl}
                      alt="Original"
                      style={{ width: "100%", objectFit: "contain", maxHeight: 176, display: "block" }}
                    />
                  )}
                  {selected === "original" && (
                    <div style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20,
                                  borderRadius: "50%", background: "black",
                                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Check size={12} color="white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p style={{ textAlign: "center", fontWeight: "bold", fontSize: 11,
                            textTransform: "uppercase", padding: "6px 0", margin: 0 }}>
                  Original
                </p>
              </button>

              {/* Cleaned card */}
              <button
                onClick={() => cleanedUrl && setSelected("cleaned")}
                disabled={!cleanedUrl}
                style={{
                  flex: 1,
                  opacity: selected === "cleaned" && cleanedUrl ? 1 : 0.5,
                  border: selected === "cleaned" && cleanedUrl ? "4px solid black" : "4px solid rgba(0,0,0,0.2)",
                  borderRadius: 16, overflow: "hidden", background: "none", padding: 0,
                  cursor: cleanedUrl ? "pointer" : "default",
                }}
              >
                {/* Checkerboard reveals transparency */}
                <div style={{
                  background: "repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 0 0 / 12px 12px",
                  minHeight: 176, position: "relative",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {cleanedUrl ? (
                    <>
                      <img
                        src={cleanedUrl}
                        alt="Background removed"
                        style={{ width: "100%", objectFit: "contain", maxHeight: 176, display: "block" }}
                      />
                      {selected === "cleaned" && (
                        <div style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20,
                                      borderRadius: "50%", background: "black",
                                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Check size={12} color="white" strokeWidth={3} />
                        </div>
                      )}
                    </>
                  ) : bgFailed ? (
                    <p style={{ fontSize: 12, fontWeight: "bold", textTransform: "uppercase",
                                opacity: 0.4, textAlign: "center", padding: "0 12px", margin: 0 }}>
                      Could not remove background
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <Loader2 size={32} style={{ opacity: 0.5 }} className="animate-spin" />
                      <p style={{ fontSize: 13, fontWeight: "bold", textTransform: "uppercase",
                                  opacity: 0.5, margin: 0 }}>Processing</p>
                    </div>
                  )}
                </div>
                <p style={{ textAlign: "center", fontWeight: "bold", fontSize: 11,
                            textTransform: "uppercase", padding: "6px 0", margin: 0 }}>
                  Cleaned ✨
                </p>
              </button>
            </div>

            {/* Action row */}
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setPhase("pick")}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                           border-2 border-black bg-white font-bold text-sm uppercase tracking-wide
                           shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Retake
              </button>
              <button
                onClick={handleSave}
                disabled={bgProcessing}
                className="flex-1 py-3 rounded-xl border-2 border-black font-black text-sm uppercase
                           tracking-wide text-white active:translate-x-0.5 active:translate-y-0.5
                           active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: bgProcessing ? "#4F5E3C" : "linear-gradient(to bottom, #6B7A52, #4F5E3C)",
                  boxShadow: bgProcessing ? "none" : "3px 3px 0 rgba(0,0,0,0.85)",
                }}
              >
                {bgProcessing ? "Processing…" : "✓ Save to Home"}
              </button>
            </div>
          </div>
        )}

        {/* ── UPLOADING ── */}
        {phase === "uploading" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
            <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                            flex items-center justify-center
                            shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-2xl uppercase tracking-tight">Saving…</p>
              <p className="text-sm text-muted-foreground mt-1">
                {progress && progress.total > 1
                  ? `${progress.done} of ${progress.total} photos added.`
                  : "Adding to your home."}
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleGalleryChange}
      />
    </motion.div>
  );
}
