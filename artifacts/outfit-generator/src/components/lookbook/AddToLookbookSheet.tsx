/**
 * AddToLookbookSheet — lets the user add or remove the current item from any
 * saved lookbook group. Shows a 3-thumbnail preview per group and a filled
 * checkmark on groups that already contain this item.
 */
import React from "react";
import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import type { ClothingItem } from "@/types/local";
import {
  useListOutfits,
  useAddItemToOutfit,
  useRemoveItemFromOutfit,
  getListOutfitsQueryKey,
} from "@/hooks/useLocalOutfits";
import { useQueryClient } from "@tanstack/react-query";
import { getImageUrl } from "@/lib/utils";

interface Props {
  item: ClothingItem;
  onClose: () => void;
}

function Thumb({ src, alt }: { src: string | null | undefined; alt: string }) {
  return (
    <div className="w-12 h-12 border-2 border-black rounded overflow-hidden bg-[#FDECEF] flex-shrink-0">
      {src ? (
        <img
          src={getImageUrl(src)!}
          alt={alt}
          className="w-full h-full object-contain"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-[8px] text-black/25 font-bold uppercase">—</span>
        </div>
      )}
    </div>
  );
}

export function AddToLookbookSheet({ item, onClose }: Props) {
  const { data: outfits = [] } = useListOutfits();
  const addItem    = useAddItemToOutfit();
  const removeItem = useRemoveItemFromOutfit();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });

  const handleToggle = (outfitId: string, alreadyIn: boolean) => {
    if (alreadyIn) {
      removeItem.mutate({ id: outfitId, itemId: item.id }, { onSuccess: invalidate });
    } else {
      addItem.mutate({ id: outfitId, data: { itemId: item.id } }, { onSuccess: invalidate });
    }
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[90] flex flex-col max-w-md mx-auto bg-white"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 pb-3 border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <div>
          <h2 className="font-display font-bold text-xl uppercase tracking-tight">Add to Lookbook</h2>
          <p className="text-xs text-black/45 font-medium mt-0.5 truncate max-w-[220px]">{item.name}</p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                     bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                     active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {outfits.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center py-16 gap-3">
            <p className="text-sm font-bold uppercase text-black/40">No lookbooks yet.</p>
            <p className="text-xs text-black/30">Save a look from the Generate tab first.</p>
          </div>
        ) : (
          outfits.map(outfit => {
            const alreadyIn = outfit.itemIds.includes(item.id);
            const thumbs    = outfit.items.slice(0, 3);

            return (
              <button
                key={outfit.id}
                onClick={() => handleToggle(outfit.id, alreadyIn)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all
                            active:translate-y-0.5 active:translate-x-0.5 active:shadow-none
                            ${alreadyIn
                              ? "border-[#6B7A52] bg-[#6B7A52]/8 shadow-[2px_2px_0px_0px_rgba(107,122,82,0.5)]"
                              : "border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            }`}
              >
                {/* Thumbnails */}
                <div className="flex gap-1.5 flex-shrink-0">
                  {thumbs.length > 0
                    ? thumbs.map(it => <Thumb key={it.id} src={it.imageObjectPath} alt={it.name} />)
                    : Array.from({ length: 3 }).map((_, i) => (
                        <Thumb key={i} src={null} alt="" />
                      ))
                  }
                  {/* Fill remaining slots */}
                  {thumbs.length < 3 &&
                    Array.from({ length: 3 - thumbs.length }).map((_, i) => (
                      <Thumb key={`empty-${i}`} src={null} alt="" />
                    ))
                  }
                </div>

                {/* Name */}
                <span className="flex-1 font-display font-bold text-sm uppercase tracking-tight truncate">
                  {outfit.name}
                </span>

                {/* Checkmark */}
                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                                 ${alreadyIn ? "bg-[#6B7A52] border-[#6B7A52]" : "border-black/25 bg-transparent"}`}>
                  {alreadyIn && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 pt-3 pb-4 border-t-2 border-black flex-shrink-0"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={onClose}
          className="w-full btn-brutalist py-3 rounded-xl text-sm"
        >
          Done
        </button>
      </div>
    </motion.div>
  );
}
