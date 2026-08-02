/**
 * ItemDetailsSheet — full-screen overlay showing a clothing item's details.
 *
 * Two separate photo flows, each a slide-up overlay:
 *
 * 1. Replace Photo  (new file from camera / gallery)
 *    pick ──► encoding ──► preview (Original | Cleaned ✨) ──► uploading ──► done
 *
 * 2. Clean Up Photo  (process the existing stored image)
 *    overlay opens → spinner while removal runs → side-by-side Original | Cleaned
 *    User taps a card (pink ring), then "Save Original" or "Save Cleaned Version".
 *    Optimistic: displayImageUrl updates instantly; DB write fires in the background.
 *
 * IMPORTANT: No AnimatePresence around phase blocks — any exit-animation window
 * creates a blank screen between phase changes. The overlays themselves slide in
 * with motion.div; inner phases switch instantly with plain conditional divs.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, Trash2, Save, ChevronDown, Loader2, Check, Camera, Sparkles } from "lucide-react";
import type { ClothingItem, ClothingItemUpdateCategory } from "@/types/local";
import { useUpdateClothingItem, useDeleteClothingItem, getListClothingQueryKey } from "@/hooks/useLocalWardrobe";
import { getListOutfitsQueryKey } from "@/hooks/useLocalOutfits";
import { useQueryClient } from "@tanstack/react-query";
import { getImageUrl } from "@/lib/utils";
import { removeBackground, blobToDataUrl, dataUrlToBlob } from "@/lib/backgroundRemoval";
import { Camera as CapCamera, CameraSource, CameraResultType } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { AddToLookbookSheet } from "@/components/lookbook/AddToLookbookSheet";
import { notifyNewItemPhoto } from "@/hooks/useVisionIndexer";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEASON_OPTIONS   = ["", "Spring", "Summer", "Fall", "Winter", "All Season"];
const OCCASION_OPTIONS = ["", "Casual", "Work", "Formal", "Sport", "Special Event"];
const CATEGORY_OPTIONS = ["furniture", "decor", "organization", "supplies"];

type PhotoPhase = "pick" | "encoding" | "preview" | "uploading";

/** Compress any image File/Blob to a JPEG ≤ 2048 px on the longest edge. */
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

function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm font-medium
                   bg-white focus:outline-none focus:ring-2 focus:ring-primary
                   placeholder:font-normal placeholder:text-black/25"
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none border-2 border-black rounded-lg px-3 py-2 pr-8
                     text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
        >
          {options.map((o) => (
            <option key={o} value={o}>{o || `— ${label} —`}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-black/40" />
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ItemDetailsSheetProps {
  item: ClothingItem;
  onClose: () => void;
  onDeleted?: () => void;
  /** When true: photo overlay shows "Add to Lookbook" instead of "Clean Up". */
  showAddToLookbook?: boolean;
}

interface FormState {
  name: string; brand: string; color: string; size: string;
  season: string; occasion: string; purchasePrice: string;
  purchaseDate: string; notes: string; isFavorite: boolean; category: string;
}

function toForm(item: ClothingItem): FormState {
  return {
    name:          item.name          ?? "",
    brand:         item.brand         ?? "",
    color:         item.color         ?? "",
    size:          item.size          ?? "",
    season:        item.season        ?? "",
    occasion:      item.occasion      ?? "",
    purchasePrice: item.purchasePrice ?? "",
    purchaseDate:  item.purchaseDate  ?? "",
    notes:         item.notes         ?? "",
    isFavorite:    item.isFavorite    ?? false,
    category:      item.category      ?? "",
  };
}

function isDirty(form: FormState, item: ClothingItem): boolean {
  return (
    form.name          !== (item.name          ?? "") ||
    form.brand         !== (item.brand         ?? "") ||
    form.color         !== (item.color         ?? "") ||
    form.size          !== (item.size          ?? "") ||
    form.season        !== (item.season        ?? "") ||
    form.occasion      !== (item.occasion      ?? "") ||
    form.purchasePrice !== (item.purchasePrice ?? "") ||
    form.purchaseDate  !== (item.purchaseDate  ?? "") ||
    form.notes         !== (item.notes         ?? "") ||
    form.isFavorite    !== (item.isFavorite    ?? false) ||
    form.category      !== (item.category      ?? "")
  );
}

export function ItemDetailsSheet({ item, onClose, onDeleted, showAddToLookbook = false }: ItemDetailsSheetProps) {
  // Lazy init — form is always non-null on the first render so the sheet
  // motion.div appears immediately. A useState(null)+useEffect pattern causes
  // the component to return null on its first render, which creates exactly the
  // same blank-gap as AnimatePresence mode="wait" — on iOS WKWebView that gap
  // renders as a black screen.
  const [form, setForm]                           = useState<FormState>(() => toForm(item));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Optimistic image display — overrides item.imageObjectPath immediately on save,
  // before the DB write completes, so the screen never flashes back to the old photo.
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null);

  // ── Replace-photo overlay state ──────────────────────────────────────────
  const [replaceOpen,  setReplaceOpen]  = useState(false);
  const [photoPhase,   setPhotoPhase]   = useState<PhotoPhase>("pick");
  const [addToLookbookOpen, setAddToLookbookOpen] = useState(false);
  const [photoError,   setPhotoError]   = useState<string | null>(null);
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [originalUrl,  setOriginalUrl]  = useState<string | null>(null);
  const [cleanedBlob,  setCleanedBlob]  = useState<Blob | null>(null);
  const [cleanedUrl,   setCleanedUrl]   = useState<string | null>(null);
  const [bgProcessing, setBgProcessing] = useState(false);
  const [bgFailed,     setBgFailed]     = useState(false);
  const [selected,     setSelected]     = useState<"original" | "cleaned">("original");
  const bgGenRef        = useRef(0); // cancel stale async results
  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // ── Clean Up Photo overlay state ─────────────────────────────────────────
  const [cleanupOpen,       setCleanupOpen]       = useState(false);
  const [cleanupProcessing, setCleanupProcessing] = useState(false);
  const [cleanupResult,     setCleanupResult]     = useState<string | null>(null); // cleaned data URL
  const [cleanupFailed,     setCleanupFailed]     = useState(false);
  const [cleanupSelected,   setCleanupSelected]   = useState<"original" | "cleaned">("cleaned");
  const [cleanupDone,       setCleanupDone]       = useState<boolean>(() =>
    localStorage.getItem(`cleanup-done-${item.id}`) === "1"
  );
  const cleanupGenRef = useRef(0);

  const updateItem  = useUpdateClothingItem();
  const deleteItem  = useDeleteClothingItem();
  const queryClient = useQueryClient();

  // Runs when item.id changes (component is remounted via key= in wardrobe.tsx,
  // so this only fires once per lifetime — but kept for safety in case of reuse).
  useEffect(() => {
    setForm(toForm(item));
    setShowDeleteConfirm(false);
    setDisplayImageUrl(null);
    setCleanupDone(localStorage.getItem(`cleanup-done-${item.id}`) === "1");
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── invalidate (stable ref — queryClient never changes) ──────────────────
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
  }, [queryClient]);

  // ── Replace-photo callbacks ───────────────────────────────────────────────
  // ALL useCallback hooks must be declared unconditionally (before any early
  // return) to satisfy React's Rules of Hooks. They safely handle a null item
  // via optional chaining where needed.

  const handleReplaceClose = useCallback(() => {
    bgGenRef.current += 1;
    setBgProcessing(false);
    setPhotoPhase("pick");
    setPhotoError(null);
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setSelected("original");
    setReplaceOpen(false);
  }, []);

  const handleReplaceFile = useCallback(async (file: File | Blob) => {
    setPhotoError(null);
    const myGen = ++bgGenRef.current;
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setBgProcessing(false);
    setSelected("original");
    setPhotoPhase("encoding"); // show spinner immediately

    let jpeg: Blob;
    try {
      jpeg = await encodeForUpload(file);
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      setPhotoError(`Could not read the photo: ${err instanceof Error ? err.message : String(err)}`);
      setPhotoPhase("pick");
      return;
    }
    if (bgGenRef.current !== myGen) return;

    setOriginalBlob(jpeg);
    setOriginalUrl(URL.createObjectURL(jpeg));
    setPhotoPhase("preview");

    setBgProcessing(true);
    try {
      const dataUrl   = await blobToDataUrl(jpeg);
      if (bgGenRef.current !== myGen) return;
      const resultUrl = await removeBackground(dataUrl);
      if (bgGenRef.current !== myGen) return;
      const resultBlob   = await dataUrlToBlob(resultUrl);
      const resultObjUrl = URL.createObjectURL(resultBlob);
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

  const handleReplaceSave = useCallback(async () => {
    const blob = selected === "cleaned" && cleanedBlob ? cleanedBlob : originalBlob;
    if (!blob) return;
    setPhotoPhase("uploading");
    try {
      const dataUrl = await blobToDataUrl(blob);
      // Optimistic: update display immediately so screen doesn't flash on close
      setDisplayImageUrl(dataUrl);
      await new Promise<void>((resolve, reject) => {
        updateItem.mutate(
          { id: item?.id ?? "", data: { imageObjectPath: dataUrl } },
          { onSuccess: () => { invalidate(); notifyNewItemPhoto(); resolve(); }, onError: reject },
        );
      });
      handleReplaceClose();
    } catch (err) {
      setPhotoError(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      setPhotoPhase("preview");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, cleanedBlob, originalBlob, item?.id, invalidate, handleReplaceClose]);

  // ── Clean Up Photo callbacks ──────────────────────────────────────────────

  const handleCleanupOpen = useCallback(async (sourceUrl: string) => {
    const myGen = ++cleanupGenRef.current;
    setCleanupResult(null);
    setCleanupFailed(false);
    setCleanupSelected("cleaned");
    setCleanupProcessing(true);
    setCleanupOpen(true);

    try {
      const resultUrl = await removeBackground(sourceUrl);
      if (cleanupGenRef.current !== myGen) return;
      setCleanupResult(resultUrl);
    } catch (err) {
      if (cleanupGenRef.current !== myGen) return;
      console.warn("Cleanup background removal failed:", err);
      setCleanupFailed(true);
    } finally {
      if (cleanupGenRef.current === myGen) setCleanupProcessing(false);
    }
  }, []);

  const handleCleanupClose = useCallback(() => {
    cleanupGenRef.current += 1; // cancel any in-flight removal
    setCleanupProcessing(false);
    setCleanupOpen(false);
    setCleanupResult(null);
    setCleanupFailed(false);
    setCleanupSelected("cleaned");
  }, []);

  const handleCleanupSave = useCallback((choice: "original" | "cleaned") => {
    const sourceUrl  = displayImageUrl ?? item?.imageObjectPath;
    const chosenUrl  = choice === "cleaned" && cleanupResult ? cleanupResult : sourceUrl;
    if (!chosenUrl) return;

    // Optimistic update — screen reflects the choice immediately, no flash
    setDisplayImageUrl(chosenUrl);
    setCleanupDone(true); // prevent re-opening cleanup on the same item
    if (item?.id) localStorage.setItem(`cleanup-done-${item.id}`, "1"); // survives restarts
    handleCleanupClose();

    // DB write in the background — no await, no spinner
    updateItem.mutate(
      { id: item?.id ?? "", data: { imageObjectPath: chosenUrl } },
      { onSuccess: () => { invalidate(); notifyNewItemPhoto(); } },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupResult, displayImageUrl, item?.id, item?.imageObjectPath, invalidate, handleCleanupClose]);

  // ── Early return (after all hooks) ────────────────────────────────────────
  // Note: form is always non-null (lazy-initialized from item above).

  if (!item) return null;

  const dirty = isDirty(form, item);
  const patch = (key: keyof FormState) => (value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // The URL currently shown in the photo area (optimistic override wins)
  const shownImageUrl = displayImageUrl ?? getImageUrl(item.imageObjectPath);

  const handleSave = () => {
    updateItem.mutate(
      {
        id: item.id,
        data: {
          name:          form.name.trim() || item.name,
          brand:         form.brand.trim() || null,
          color:         form.color.trim() || null,
          size:          form.size.trim() || null,
          season:        form.season || null,
          occasion:      form.occasion || null,
          purchasePrice: form.purchasePrice.trim() || null,
          purchaseDate:  form.purchaseDate.trim() || null,
          notes:         form.notes.trim() || null,
          isFavorite:    form.isFavorite,
          category:      (form.category || item.category) as ClothingItemUpdateCategory,
        },
      },
      { onSuccess: () => { invalidate(); onClose(); } },
    );
  };

  const handleDelete = () => {
    deleteItem.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          invalidate();
          onDeleted?.();
          onClose();
        },
      },
    );
  };

  // ── File input handlers ───────────────────────────────────────────────────

  const onCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleReplaceFile(file);
    e.target.value = "";
  };

  // On native iOS, use the Capacitor Camera plugin — presents camera as a modal
  // over the WKWebView so iOS never suspends the view (no jetsam kill).
  const handleCameraCapture = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const photo = await CapCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
        });
        if (photo.dataUrl) {
          const blob = await dataUrlToBlob(photo.dataUrl);
          handleReplaceFile(blob);
        }
      } catch {
        // User cancelled — ignore silently
      }
    } else {
      cameraInputRef.current?.click();
    }
  }, [handleReplaceFile]);

  const onGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleReplaceFile(file);
    e.target.value = "";
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Main details sheet ────────────────────────────────────────────── */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 240 }}
        className="fixed inset-0 z-[65] flex flex-col max-w-md mx-auto bg-[#f9f4ee] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 pb-3
                        bg-white border-b-2 border-black flex-shrink-0"
          style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
          <h2 className="font-display font-bold text-xl uppercase tracking-tight">Item Details</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next = !form.isFavorite;
                patch("isFavorite")(next);
                updateItem.mutate(
                  { id: item.id, data: { isFavorite: next } },
                  { onSuccess: invalidate },
                );
              }}
              className={`w-9 h-9 border-2 border-black rounded-full flex items-center justify-center transition-all
                          ${form.isFavorite
                            ? "shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            : "bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"}`}
                        style={form.isFavorite ? { background: "#4F5E3C" } : {}}
            >
              <Heart
                className="w-4 h-4"
                fill={form.isFavorite ? "white" : "none"}
                stroke={form.isFavorite ? "white" : "currentColor"}
              />
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                         bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                         active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Photo area */}
        <div
          className="w-full h-52 flex-shrink-0 border-b-2 border-black relative"
          style={{
            backgroundImage: "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%)",
            backgroundSize: "16px 16px",
          }}
        >
          {shownImageUrl ? (
            <img
              src={shownImageUrl}
              alt={item.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <button
                onClick={() => setReplaceOpen(true)}
                className="flex flex-col items-center gap-2 px-5 py-4
                           border-2 border-dashed border-black/30 rounded-2xl
                           text-black/40 hover:border-black/60 hover:text-black/60 transition-all"
              >
                <Camera className="w-7 h-7" />
                <span className="text-xs font-bold uppercase tracking-widest">Add Photo</span>
              </button>
            </div>
          )}
        </div>

        {/* Action buttons — below photo */}
        {shownImageUrl && (
          <div className="flex gap-2 px-4 py-3 border-b-2 border-black bg-white flex-shrink-0">
            {showAddToLookbook ? (
              <button
                onClick={() => setAddToLookbookOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5
                           bg-white border-2 border-[#6B7A52] text-[#6B7A52] rounded-full
                           text-xs font-bold uppercase
                           shadow-[2px_2px_0px_0px_rgba(107,122,82,0.5)]
                           active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
              >
                💚 Lookbook
              </button>
            ) : (
              !cleanupDone && (
                <button
                  onClick={() => handleCleanupOpen(shownImageUrl)}
                  className="flex items-center gap-1.5 px-3 py-1.5
                             bg-white border-2 border-green-500 text-green-700 rounded-full
                             text-xs font-bold uppercase
                             shadow-[2px_2px_0px_0px_rgba(34,197,94,0.5)]
                             active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Clean Up
                </button>
              )
            )}
            <button
              onClick={() => setReplaceOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5
                         bg-white border-2 border-black rounded-full text-xs font-bold uppercase
                         shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                         active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
            >
              <Camera className="w-3.5 h-3.5" />
              Replace
            </button>
          </div>
        )}

        {/* Form */}
        <div className="flex-1 px-4 py-5 flex flex-col gap-4">
          <Field label="Item Name" value={form.name} onChange={patch("name") as (v: string) => void}
                 placeholder="e.g. Charlotte Tilbury Flawless Filter" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Brand"  value={form.brand} onChange={patch("brand") as (v: string) => void} placeholder="e.g. NARS" />
            <Field label="Color"  value={form.color} onChange={patch("color") as (v: string) => void} placeholder="Rose Gold" />
          </div>
          <Field label="Size / Volume" value={form.size} onChange={patch("size") as (v: string) => void}
                 placeholder="30ml, 50ml, Full Size…" />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Season"   value={form.season}   onChange={patch("season") as (v: string) => void}   options={SEASON_OPTIONS} />
            <SelectField label="Occasion" value={form.occasion} onChange={patch("occasion") as (v: string) => void} options={OCCASION_OPTIONS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase Price" value={form.purchasePrice} onChange={patch("purchasePrice") as (v: string) => void} placeholder="$49.99" />
            <Field label="Purchase Date"  value={form.purchaseDate}  onChange={patch("purchaseDate") as (v: string) => void}  type="date" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => patch("notes")(e.target.value)}
              placeholder="Anything worth remembering…"
              rows={3}
              className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm font-medium
                         bg-white focus:outline-none focus:ring-2 focus:ring-primary resize-none
                         placeholder:font-normal placeholder:text-black/25"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Category" value={form.category}
                         onChange={patch("category") as (v: string) => void} options={CATEGORY_OPTIONS} />
            <div className="flex flex-col gap-1 opacity-50 pointer-events-none">
              <span className="text-[10px] font-bold uppercase tracking-widest text-black/40">Times Worn</span>
              <div className="border-2 border-black/20 rounded-lg px-3 py-2 text-sm font-medium bg-white/50">
                {item.timesWorn ?? 0}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-4 py-4 bg-white border-t-2 border-black flex-shrink-0 flex flex-col gap-2">
          <AnimatePresence>
            {dirty && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                onClick={handleSave}
                disabled={updateItem.isPending}
                className="w-full btn-brutalist py-3 rounded-xl flex items-center justify-center gap-2 text-sm"
              >
                <Save className="w-4 h-4" />
                {updateItem.isPending ? "Saving…" : "Save Changes"}
              </motion.button>
            )}
          </AnimatePresence>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm
                         font-bold uppercase border-2 border-black/20 text-black/35
                         hover:border-red-500 hover:text-red-600 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Delete from Home Forever
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold uppercase border-2 border-black bg-white
                           shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                           active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteItem.isPending}
                className="flex-1 py-3 rounded-xl text-sm font-bold uppercase border-2 border-red-600
                           bg-red-500 text-white shadow-[2px_2px_0px_0px_rgba(185,28,28,1)]
                           active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all
                           disabled:opacity-50"
              >
                {deleteItem.isPending ? "Deleting…" : "Yes, Delete Forever"}
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Replace-photo overlay ─────────────────────────────────────────────
          No AnimatePresence around phase blocks — plain conditional divs only.
      ──────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {replaceOpen && (
          <motion.div
            key="replace-photo"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 240 }}
            className="fixed inset-0 z-[70] flex flex-col max-w-md mx-auto bg-[#f9f4ee]"
          >
            <div className="flex items-center justify-between px-4 pb-3 bg-white border-b-2 border-black flex-shrink-0"
              style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
              <h2 className="font-display font-bold text-xl uppercase tracking-tight">
                {shownImageUrl ? "Replace Photo" : "Add Photo"}
              </h2>
              <button
                onClick={handleReplaceClose}
                className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                           bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                           active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input ref={cameraInputRef}  type="file" accept="image/*"
                   className="hidden" onChange={onCameraChange} />
            <input ref={galleryInputRef} type="file" accept="image/*" multiple={false}
                   className="hidden" onChange={onGalleryChange} />

            <div className="flex-1 flex flex-col overflow-y-auto">
              {photoPhase === "pick" && (
                <div className="flex flex-col flex-1 px-5 py-6 gap-4">
                  {photoError && (
                    <p className="text-red-600 text-sm font-medium text-center">{photoError}</p>
                  )}
                  <button
                    onClick={handleCameraCapture}
                    className="w-full btn-brutalist py-4 rounded-2xl flex items-center justify-center gap-2 text-sm"
                  >
                    <Camera className="w-5 h-5" />
                    Take Photo
                  </button>
                  <button
                    onClick={() => galleryInputRef.current?.click()}
                    className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-sm
                               font-bold uppercase border-2 border-black bg-white
                               shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                               active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
                  >
                    Upload from Camera Roll
                  </button>
                  <div className="mt-4 flex flex-col gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Tips for best results</p>
                    {[
                      "Place the item on a plain background.",
                      "Photograph from directly above or front-on.",
                      "Make sure the item is fully in frame.",
                      "Good lighting removes backgrounds more cleanly.",
                    ].map((tip) => (
                      <p key={tip} className="text-xs text-black/50">• {tip}</p>
                    ))}
                  </div>
                </div>
              )}

              {photoPhase === "encoding" && (
                <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
                  <Loader2 size={48} className="animate-spin text-black/60" />
                  <p className="font-display font-bold text-2xl uppercase tracking-tight">Processing…</p>
                  <p className="text-sm text-black/50">Getting your photo ready.</p>
                </div>
              )}

              {photoPhase === "preview" && (
                <div className="flex flex-col gap-4 px-5 py-5">
                  {photoError && (
                    <p className="text-red-600 text-sm font-medium text-center">{photoError}</p>
                  )}
                  <p className="text-center text-[10px] font-bold uppercase tracking-[0.15em] text-black/40">
                    {bgProcessing ? "This will take a moment…" : bgFailed ? "Original" : "Tap to choose"}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelected("original")}
                      className="flex-1 rounded-2xl overflow-hidden border-[3px] transition-all p-0"
                      style={{
                        borderColor: selected === "original" ? "black" : "rgba(0,0,0,0.15)",
                        opacity:     selected === "original" ? 1 : 0.55,
                      }}
                    >
                      <div className="relative bg-black" style={{ minHeight: 176 }}>
                        <img src={originalUrl!} alt="Original"
                             className="w-full object-contain block" style={{ maxHeight: 176 }} />
                        {selected === "original" && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black
                                          flex items-center justify-center">
                            <Check size={11} color="white" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <p className="text-center text-[10px] font-bold uppercase tracking-widest py-1.5">Original</p>
                    </button>

                    <button
                      onClick={() => cleanedUrl && setSelected("cleaned")}
                      disabled={!cleanedUrl}
                      className="flex-1 rounded-2xl overflow-hidden border-[3px] transition-all p-0"
                      style={{
                        borderColor: selected === "cleaned" && cleanedUrl ? "black" : "rgba(0,0,0,0.15)",
                        opacity:     selected === "cleaned" && cleanedUrl ? 1 : 0.55,
                      }}
                    >
                      <div
                        className="relative flex items-center justify-center"
                        style={{
                          background: "repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 0 0 / 12px 12px",
                          minHeight: 176,
                        }}
                      >
                        {cleanedUrl ? (
                          <>
                            <img src={cleanedUrl} alt="Cleaned"
                                 className="w-full object-contain block" style={{ maxHeight: 176 }} />
                            {selected === "cleaned" && (
                              <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black
                                              flex items-center justify-center">
                                <Check size={11} color="white" strokeWidth={3} />
                              </div>
                            )}
                          </>
                        ) : bgFailed ? (
                          <p className="text-[11px] font-bold uppercase text-black/40 text-center px-3">
                            Could not remove background
                          </p>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 size={30} className="animate-spin text-black/40" />
                            <p className="text-[11px] font-bold uppercase text-black/40">Processing</p>
                          </div>
                        )}
                      </div>
                      <p className="text-center text-[10px] font-bold uppercase tracking-widest py-1.5">Cleaned ✨</p>
                    </button>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => setPhotoPhase("pick")}
                      className="flex-1 py-3 rounded-xl text-sm font-bold uppercase border-2 border-black bg-white
                                 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                                 active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all
                                 flex items-center justify-center gap-1.5"
                    >
                      ↩ Retake
                    </button>
                    <button
                      onClick={handleReplaceSave}
                      disabled={bgProcessing}
                      className="flex-1 py-3 rounded-xl text-sm btn-brutalist
                                 flex items-center justify-center gap-1.5
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bgProcessing ? "Processing…" : "✓ Save Photo"}
                    </button>
                  </div>
                </div>
              )}

              {photoPhase === "uploading" && (
                <div className="flex-1 flex flex-col items-center justify-center gap-5">
                  <Loader2 size={48} className="animate-spin text-black/60" />
                  <p className="font-display font-bold text-2xl uppercase tracking-tight">Saving…</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Clean Up Photo overlay ────────────────────────────────────────────
          Uses the EXISTING stored image — no file picker.
          Optimistic save: displayImageUrl updates instantly, DB write is fire-and-forget.
          Pink ring + checkmark for the selected card.
      ──────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {cleanupOpen && (
          <motion.div
            key="cleanup-photo"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 240 }}
            className="fixed inset-0 z-[75] flex flex-col max-w-md mx-auto bg-[#f9f4ee]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 bg-white border-b-2 border-black flex-shrink-0"
              style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
              <div>
                <h2 className="font-display font-bold text-xl uppercase tracking-tight">Clean Up Photo</h2>
                <p className="text-[10px] text-black/40 font-medium uppercase tracking-wider mt-0.5">
                  {cleanupProcessing ? "Removing background…" : cleanupFailed ? "Could not remove background" : "Tap to choose, then save"}
                </p>
              </div>
              <button
                onClick={handleCleanupClose}
                className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                           bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                           active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cards + actions */}
            <div className="flex-1 flex flex-col overflow-y-auto px-5 py-6 gap-5">

              {/* Side-by-side comparison */}
              <div className="flex gap-3">

                {/* Original card */}
                <button
                  onClick={() => setCleanupSelected("original")}
                  className="flex-1 rounded-2xl overflow-hidden transition-all p-0"
                  style={{
                    border: cleanupSelected === "original"
                      ? "3px solid #22c55e"   // green-500
                      : "3px solid rgba(0,0,0,0.12)",
                    opacity: cleanupSelected === "original" ? 1 : 0.55,
                  }}
                >
                  <div
                    className="relative flex items-center justify-center"
                    style={{
                      background: "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%) 0 0 / 16px 16px",
                      minHeight: 200,
                    }}
                  >
                    {shownImageUrl && (
                      <img
                        src={shownImageUrl}
                        alt="Original"
                        className="w-full object-contain block"
                        style={{ maxHeight: 200 }}
                      />
                    )}
                    {cleanupSelected === "original" && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full
                                      flex items-center justify-center"
                           style={{ background: "#22c55e" }}>
                        <Check size={13} color="white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="text-center text-[10px] font-bold uppercase tracking-widest py-2">
                    Original
                  </p>
                </button>

                {/* Cleaned card */}
                <button
                  onClick={() => !cleanupProcessing && cleanupResult && setCleanupSelected("cleaned")}
                  disabled={cleanupProcessing || !cleanupResult}
                  className="flex-1 rounded-2xl overflow-hidden transition-all p-0"
                  style={{
                    border: cleanupSelected === "cleaned" && cleanupResult
                      ? "3px solid #22c55e"
                      : "3px solid rgba(0,0,0,0.12)",
                    opacity: cleanupSelected === "cleaned" && cleanupResult ? 1 : 0.55,
                  }}
                >
                  <div
                    className="relative flex items-center justify-center"
                    style={{
                      background: "repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 0 0 / 12px 12px",
                      minHeight: 200,
                    }}
                  >
                    {cleanupResult ? (
                      <>
                        <img
                          src={cleanupResult}
                          alt="Cleaned"
                          className="w-full object-contain block"
                          style={{ maxHeight: 200 }}
                        />
                        {cleanupSelected === "cleaned" && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full
                                          flex items-center justify-center"
                               style={{ background: "#22c55e" }}>
                            <Check size={13} color="white" strokeWidth={3} />
                          </div>
                        )}
                      </>
                    ) : cleanupFailed ? (
                      <p className="text-[11px] font-bold uppercase text-black/40 text-center px-4">
                        Could not remove background
                      </p>
                    ) : (
                      /* Spinner while model runs */
                      <div className="flex flex-col items-center gap-3 py-4">
                        <Loader2 size={36} className="animate-spin" style={{ color: "#22c55e" }} />
                        <p className="text-[11px] font-bold uppercase tracking-wider"
                           style={{ color: "#22c55e" }}>
                          This will take a moment…
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-center text-[10px] font-bold uppercase tracking-widest py-2">
                    Cleaned ✨
                  </p>
                </button>
              </div>

              {/* Save buttons */}
              <div className="flex flex-col gap-3 mt-auto">
                {/* Save Cleaned Version — only once the result is ready */}
                {!cleanupProcessing && !cleanupFailed && cleanupResult && (
                  <button
                    onClick={() => handleCleanupSave("cleaned")}
                    className="w-full py-4 rounded-2xl text-sm font-bold uppercase
                               flex items-center justify-center gap-2
                               border-[3px] text-white transition-all
                               active:scale-[0.98]"
                    style={{
                      background: "#22c55e",
                      borderColor: "#16a34a",
                      boxShadow: "0 3px 0 0 #15803d",
                    }}
                  >
                    <Sparkles className="w-4 h-4" />
                    Save Cleaned Version
                  </button>
                )}
                {/* Save Original — always available so users don't have to wait */}
                <button
                  onClick={() => handleCleanupSave("original")}
                  className="w-full py-4 rounded-2xl text-sm font-bold uppercase border-2 border-black bg-white
                             shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                             active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all
                             flex items-center justify-center"
                >
                  {cleanupFailed ? "Keep Original" : "Save Original"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ── Add to Lookbook sheet ──────────────────────────────────────────── */}
      <AnimatePresence>
        {addToLookbookOpen && (
          <AddToLookbookSheet
            key="add-to-lookbook"
            item={item}
            onClose={() => setAddToLookbookOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
