/**
 * ItemDetailsSheet — full-screen overlay showing a clothing item's details.
 * Every field is optional and editable. A "Save" button appears only when
 * the form is dirty. Delete is always available.
 *
 * Replace-photo flow (single photo):
 *   pick ──► encoding ──► preview (Original | Cleaned ✨) ──► uploading ──► done
 *
 * IMPORTANT: No AnimatePresence around phase blocks — any exit-animation window
 * creates a blank screen between phase changes. The replacement overlay itself
 * slides in with motion.div; inner phases switch instantly with plain divs.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, Trash2, Save, ChevronDown, Loader2, Check, Camera } from "lucide-react";
import type { ClothingItem, ClothingItemUpdateCategory } from "@/types/local";
import { useUpdateClothingItem, useDeleteClothingItem, getListClothingQueryKey } from "@/hooks/useLocalWardrobe";
import { getListOutfitsQueryKey } from "@/hooks/useLocalOutfits";
import { useQueryClient } from "@tanstack/react-query";
import { getImageUrl } from "@/lib/utils";
import { removeBackground, blobToDataUrl, dataUrlToBlob } from "@/lib/backgroundRemoval";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEASON_OPTIONS   = ["", "Spring", "Summer", "Fall", "Winter", "All Season"];
const OCCASION_OPTIONS = ["", "Casual", "Work", "Formal", "Sport", "Special Event"];
const CATEGORY_OPTIONS = ["furniture", "decor", "organization", "supplies"];

type PhotoPhase = "pick" | "encoding" | "preview" | "uploading";

/**
 * Compress any image File/Blob to a JPEG ≤ 2048 px on the longest edge.
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
  item: ClothingItem | null;
  onClose: () => void;
  onDeleted?: () => void;
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

export function ItemDetailsSheet({ item, onClose, onDeleted }: ItemDetailsSheetProps) {
  const [form, setForm]                           = useState<FormState | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Replace-photo overlay state ──────────────────────────────────────────
  const [replaceOpen,  setReplaceOpen]  = useState(false);
  const [photoPhase,   setPhotoPhase]   = useState<PhotoPhase>("pick");
  const [photoError,   setPhotoError]   = useState<string | null>(null);
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [originalUrl,  setOriginalUrl]  = useState<string | null>(null);
  const [cleanedBlob,  setCleanedBlob]  = useState<Blob | null>(null);
  const [cleanedUrl,   setCleanedUrl]   = useState<string | null>(null);
  const [bgProcessing, setBgProcessing] = useState(false);
  const [bgFailed,     setBgFailed]     = useState(false);
  const [selected,     setSelected]     = useState<"original" | "cleaned">("original");

  // Generation counter — prevents a slow first photo clobbering a fast second one
  const bgGenRef        = useRef(0);
  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const updateItem  = useUpdateClothingItem();
  const deleteItem  = useDeleteClothingItem();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (item) setForm(toForm(item));
    setShowDeleteConfirm(false);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item || !form) return null;

  const dirty = isDirty(form, item);
  const patch = (key: keyof FormState) => (value: string | boolean) =>
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
  };

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

  // ── Replace-photo callbacks ───────────────────────────────────────────────

  const handleReplaceClose = useCallback(() => {
    bgGenRef.current += 1;   // cancel any in-flight removal
    setBgProcessing(false);  // MUST reset — close can happen mid-removal
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

    // Reset comparison state
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setBgProcessing(false);
    setSelected("original");

    // Show spinner immediately before any async work
    setPhotoPhase("encoding");

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

    // Show original, switch to comparison screen
    setOriginalBlob(jpeg);
    setOriginalUrl(URL.createObjectURL(jpeg));
    setPhotoPhase("preview");

    // Background removal
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
      await new Promise<void>((resolve, reject) => {
        updateItem.mutate(
          { id: item.id, data: { imageObjectPath: dataUrl } },
          {
            onSuccess: () => { invalidate(); resolve(); },
            onError: reject,
          },
        );
      });
      handleReplaceClose();
    } catch (err) {
      setPhotoError(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      setPhotoPhase("preview");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, cleanedBlob, originalBlob, item.id, handleReplaceClose]);

  // ── File input handlers ───────────────────────────────────────────────────

  const onCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleReplaceFile(file);
    e.target.value = "";
  };

  const onGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleReplaceFile(file);
    e.target.value = "";
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 240 }}
        className="fixed inset-0 z-[65] flex flex-col max-w-md mx-auto bg-[#f9f4ee] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 pb-3
                        bg-white border-b-2 border-black flex-shrink-0"
          style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
          <h2 className="font-display font-bold text-xl uppercase tracking-tight">Item Details</h2>
          <div className="flex items-center gap-2">
            {/* Favourite toggle */}
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
            {/* Close */}
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
          {item.imageObjectPath ? (
            <>
              <img
                src={getImageUrl(item.imageObjectPath)!}
                alt={item.name}
                className="w-full h-full object-contain"
              />
              {/* Replace Photo button — bottom-right corner */}
              <button
                onClick={() => setReplaceOpen(true)}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5
                           bg-white border-2 border-black rounded-full text-xs font-bold uppercase
                           shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                           active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
              >
                <Camera className="w-3.5 h-3.5" />
                Replace Photo
              </button>
            </>
          ) : (
            /* No photo yet — centred Add Photo button */
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
              Delete from Vanity Forever
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
          Slides in on top of the ItemDetailsSheet. Plain conditional divs for
          phase blocks — no AnimatePresence, which would blank the screen on
          every phase change.
      ──────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {replaceOpen && (
          <motion.div
            key="replace-photo"
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 240 }}
            className="fixed inset-0 z-[70] flex flex-col max-w-md mx-auto bg-[#f9f4ee]"
          >
            {/* Overlay header */}
            <div className="flex items-center justify-between px-4 pb-3 bg-white border-b-2 border-black flex-shrink-0"
              style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
              <h2 className="font-display font-bold text-xl uppercase tracking-tight">
                {item.imageObjectPath ? "Replace Photo" : "Add Photo"}
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

            {/* Hidden file inputs */}
            <input ref={cameraInputRef}  type="file" accept="image/*" capture="environment"
                   className="hidden" onChange={onCameraChange} />
            <input ref={galleryInputRef} type="file" accept="image/*" multiple={false}
                   className="hidden" onChange={onGalleryChange} />

            {/* Phase content — plain divs, no AnimatePresence */}
            <div className="flex-1 flex flex-col overflow-y-auto">

              {/* ── Pick ── */}
              {photoPhase === "pick" && (
                <div className="flex flex-col flex-1 px-5 py-6 gap-4">
                  {photoError && (
                    <p className="text-red-600 text-sm font-medium text-center">{photoError}</p>
                  )}

                  <button
                    onClick={() => cameraInputRef.current?.click()}
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

                  {/* Tips */}
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

              {/* ── Encoding — full-screen spinner, shown immediately after pick ── */}
              {photoPhase === "encoding" && (
                <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
                  <Loader2 size={48} className="animate-spin text-black/60" />
                  <p className="font-display font-bold text-2xl uppercase tracking-tight">Processing…</p>
                  <p className="text-sm text-black/50">Getting your photo ready.</p>
                </div>
              )}

              {/* ── Preview — side-by-side comparison ── */}
              {photoPhase === "preview" && (
                <div className="flex flex-col gap-4 px-5 py-5">
                  {photoError && (
                    <p className="text-red-600 text-sm font-medium text-center">{photoError}</p>
                  )}

                  <p className="text-center text-[10px] font-bold uppercase tracking-[0.15em] text-black/40">
                    {bgProcessing ? "This will take a moment…" : bgFailed ? "Original" : "Tap to choose"}
                  </p>

                  {/* Cards */}
                  <div className="flex gap-3">
                    {/* Original */}
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

                    {/* Cleaned */}
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

                  {/* Actions */}
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

              {/* ── Uploading ── */}
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
    </>
  );
}
