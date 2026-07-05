/**
 * QuickAddSheet
 *
 * Flow:
 *   pick ──(file chosen)──► uploading ──► bg-removing ──► close
 *                                      ↘ bg-failed ──► retry | keep original
 *
 * The original photo is uploaded first so the item appears in the wardrobe
 * immediately.  Background removal runs after and patches the image silently.
 */
import React, { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Image as ImageIcon,
  X,
  Loader2,
  RefreshCw,
  ImageOff,
  Check,
} from "lucide-react";
import {
  useCreateClothingItem,
  useUpdateClothingItem,
  getListClothingQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { processClothingImage, encodeToPng, TimeoutError } from "@/lib/processImage";

// ── Types ──────────────────────────────────────────────────────────────────────

type Category = "tops" | "bottoms" | "shoes" | "accessories" | "outerwear" | "dresses";

const CATEGORY_LABELS: Record<Category, string> = {
  tops:        "Top",
  bottoms:     "Bottom",
  shoes:       "Shoes",
  accessories: "Accessory",
  outerwear:   "Outerwear",
  dresses:     "Dress",
};

type Phase =
  | "pick"         // two-button landing screen
  | "uploading"    // encoding + uploading original PNG, creating DB record
  | "bg-removing"  // bg removal running; item already in DB
  | "bg-failed";   // bg removal failed; item saved with original photo

// ── Upload helper ──────────────────────────────────────────────────────────────

async function uploadBlob(blob: Blob, filename: string): Promise<string> {
  const res = await fetch("/api/storage/uploads/request-url", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ name: filename, size: blob.size, contentType: "image/png" }),
  });
  if (!res.ok) throw new Error("Failed to request upload URL");

  const { uploadURL, objectPath } = (await res.json()) as {
    uploadURL: string;
    objectPath: string;
  };

  const put = await fetch(uploadURL, {
    method:  "PUT",
    headers: { "Content-Type": "image/png" },
    body:    blob,
  });
  if (!put.ok) throw new Error("Upload PUT failed");

  return objectPath;
}

// ── Simulated progress ─────────────────────────────────────────────────────────
// The library's resources.json ships empty so its progress callback never fires
// with total > 0.  We animate a decelerating ramp independently.

function useSimulatedProgress(running: boolean) {
  const [pct, setPct] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (!running) { setPct(0); return; }

    setPct(0);
    timer.current = setInterval(() => {
      setPct((p) => {
        if (p >= 92) return p;
        return Math.min(92, p + Math.max(0.5, (92 - p) * 0.05));
      });
    }, 600);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [running]);

  const finish = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    setPct(100);
  }, []);

  return { pct, finish };
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  category:      Category;
  existingCount: number;
}

export function QuickAddSheet({ open, onOpenChange, category, existingCount }: Props) {
  const [phase,    setPhase]   = useState<Phase>("pick");
  const [bgErrMsg, setBgErrMsg] = useState<string | null>(null);

  // Refs keep async callbacks stable without extra re-renders
  const originalFileRef = useRef<File | null>(null);
  const savedItemIdRef  = useRef<number | null>(null);

  // Two separate file inputs: one triggers camera, one opens gallery
  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const createItem  = useCreateClothingItem();
  const updateItem  = useUpdateClothingItem();
  const queryClient = useQueryClient();

  const bgRunning = phase === "bg-removing";
  const { pct: bgPct, finish: bgFinish } = useSimulatedProgress(bgRunning);

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setPhase("pick");
    setBgErrMsg(null);
    originalFileRef.current = null;
    savedItemIdRef.current  = null;
    onOpenChange(false);
  }, [onOpenChange]);

  // ── Background removal (runs after item is in DB) ────────────────────────
  const runBgRemoval = useCallback(async (itemId: number) => {
    const file = originalFileRef.current;
    if (!file) return;

    setPhase("bg-removing");
    setBgErrMsg(null);

    try {
      const processed  = await processClothingImage(file);
      const filename   = `${category}-processed-${Date.now()}.png`;
      const objectPath = await uploadBlob(processed, filename);

      await new Promise<void>((resolve, reject) => {
        updateItem.mutate(
          { id: itemId, data: { imageObjectPath: objectPath } },
          { onSuccess: () => resolve(), onError: (e) => reject(e) },
        );
      });

      bgFinish();
      queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
      setTimeout(handleClose, 350); // brief pause so bar hits 100% visibly
    } catch (err) {
      console.error("Background removal error:", err);
      const msg = err instanceof TimeoutError
        ? "Removing the background timed out. Your item is saved — you can try again or keep the original photo."
        : "Background removal failed. Your item is saved — you can try again or keep the original photo.";
      setBgErrMsg(msg);
      setPhase("bg-failed");
    }
  }, [category, bgFinish, updateItem, queryClient, handleClose]);

  // ── File picked → upload original → create item → run bg removal ─────────
  const handleFile = useCallback(async (file: File) => {
    originalFileRef.current = file;
    setPhase("uploading");

    try {
      const png      = await encodeToPng(file);
      const filename = `${category}-${Date.now()}.png`;
      const path     = await uploadBlob(png, filename);

      const label    = CATEGORY_LABELS[category];
      const n        = existingCount + 1;
      const autoName = n === 1 ? label : `${label} ${n}`;

      await new Promise<void>((resolve, reject) => {
        createItem.mutate(
          { data: { name: autoName, category, imageObjectPath: path } },
          {
            onSuccess: (data) => {
              savedItemIdRef.current = (data as { id: number }).id;
              queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
              resolve();
            },
            onError: reject,
          },
        );
      });

      runBgRemoval(savedItemIdRef.current!);
    } catch (err) {
      console.error("Upload / create failed:", err);
      setBgErrMsg("Could not save the item. Check your connection and try again.");
      setPhase("pick");
    }
  }, [category, existingCount, createItem, queryClient, runBgRemoval]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ""; // allow re-selecting same file
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
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b-2 border-black flex-shrink-0">
        <h2 className="font-display font-bold text-xl uppercase tracking-tight">
          Add {label}
        </h2>
        {phase === "pick" && (
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

      {/* Body */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* ── PICK ── */}
          {phase === "pick" && (
            <motion.div
              key="pick"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col p-5 gap-5"
            >
              {bgErrMsg && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                  {bgErrMsg}
                </p>
              )}

              {/* Two big action buttons */}
              <div className="flex gap-3">
                {/* Take Photo */}
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                             border-4 border-black rounded-2xl bg-primary
                             shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                             active:translate-x-1 active:translate-y-1 active:shadow-none
                             transition-all"
                >
                  <span className="text-4xl leading-none">📷</span>
                  <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight">
                    Take<br />Photo
                  </span>
                </button>

                {/* Upload Photo */}
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
                    Upload<br />Photo
                  </span>
                </button>
              </div>

              {/* Tips */}
              <div className="border-2 border-black rounded-2xl bg-white p-4
                              shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <p className="font-display font-bold text-sm uppercase tracking-tight mb-3 flex items-center gap-2">
                  <span>📸</span> Best Results
                </p>
                <ul className="flex flex-col gap-2">
                  {[
                    "Lay the clothing item flat.",
                    "Use a plain background.",
                    "Smooth out any wrinkles.",
                    "Take the photo directly from above.",
                    "Make sure the entire item is visible.",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-sm text-black/70 leading-snug">
                      <span className="mt-0.5 w-4 h-4 border-2 border-black rounded-sm bg-primary
                                       flex items-center justify-center flex-shrink-0">
                        <Check className="w-2.5 h-2.5" strokeWidth={3} />
                      </span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}

          {/* ── UPLOADING ── */}
          {phase === "uploading" && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-5 p-6"
            >
              <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                              flex items-center justify-center
                              shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-2xl uppercase tracking-tight">Saving…</p>
                <p className="text-sm text-muted-foreground mt-1">Adding to your closet.</p>
              </div>
            </motion.div>
          )}

          {/* ── BG-REMOVING ── */}
          {phase === "bg-removing" && (
            <motion.div
              key="bg-removing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-6 p-6"
            >
              <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                              flex items-center justify-center
                              shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <ImageIcon className="w-12 h-12" strokeWidth={1.5} />
              </div>

              <div className="text-center">
                <p className="font-display font-bold text-2xl uppercase tracking-tight">
                  Processing…
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your item is saved. Removing the background now.
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-xs">
                <div className="flex justify-between text-[10px] font-bold uppercase
                                tracking-wide mb-1 text-black/40">
                  <span>Removing background</span>
                  <span>{Math.round(bgPct)}%</span>
                </div>
                <div className="w-full h-3 bg-black/10 rounded-full border border-black/20 overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    animate={{ width: `${bgPct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
                {bgPct < 20 && (
                  <p className="text-[10px] text-muted-foreground mt-2 text-center">
                    Downloading AI model — cached after first use.
                  </p>
                )}
              </div>

              <button
                onClick={handleClose}
                className="text-xs text-muted-foreground underline underline-offset-2"
              >
                Close and keep original
              </button>
            </motion.div>
          )}

          {/* ── BG-FAILED ── */}
          {phase === "bg-failed" && (
            <motion.div
              key="bg-failed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex flex-col items-center justify-center gap-5 p-6"
            >
              <div className="w-24 h-24 border-4 border-black rounded-2xl bg-white
                              flex items-center justify-center
                              shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
                <ImageOff className="w-10 h-10" strokeWidth={1.5} />
              </div>

              <div className="text-center max-w-xs">
                <p className="font-display font-bold text-2xl uppercase tracking-tight">
                  Background Removal Failed
                </p>
                {bgErrMsg && (
                  <p className="text-sm text-muted-foreground mt-2 leading-snug">{bgErrMsg}</p>
                )}
              </div>

              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button
                  onClick={() => {
                    const id = savedItemIdRef.current;
                    if (id != null) runBgRemoval(id);
                  }}
                  className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2
                             font-bold uppercase text-sm border-2 border-black bg-primary
                             shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                             active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2
                             font-bold uppercase text-sm border-2 border-black bg-white
                             shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                             active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
                >
                  <Check className="w-4 h-4" />
                  Keep Original
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Hidden file inputs */}
      {/* Camera — opens native camera on mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />
      {/* Gallery — opens photo library / file picker */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />
    </motion.div>
  );
}
