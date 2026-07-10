/**
 * FavoritesPage ("Totally 💛") — every clothing item the user has hearted.
 * Items can be dragged to reorder; order is persisted in localStorage.
 * Tap an item card to open the full details sheet.
 */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, GripVertical } from "lucide-react";
import {
  useListClothing,
  useUpdateClothingItem,
  getListClothingQueryKey,
  ClothingItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getImageUrl } from "@/lib/utils";
import { ItemDetailsSheet } from "@/components/clothing/ItemDetailsSheet";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const CATEGORY_LABELS: Record<string, string> = {
  tops:        "Top",
  bottoms:     "Bottom",
  shoes:       "Shoes",
  accessories: "Accessory",
  outerwear:   "Jacket",
  dresses:     "Dress",
};

const ORDER_KEY = "closet-favorites-order";

function getSavedOrder(): number[] {
  try { return JSON.parse(localStorage.getItem(ORDER_KEY) ?? "[]"); } catch { return []; }
}
function saveOrder(ids: number[]) {
  try { localStorage.setItem(ORDER_KEY, JSON.stringify(ids)); } catch {}
}

function applyOrder(items: ClothingItem[], order: number[]): ClothingItem[] {
  if (!order.length) return items;
  const map = new Map(items.map((i) => [i.id, i]));
  const ordered = order.map((id) => map.get(id)).filter(Boolean) as ClothingItem[];
  const rest = items.filter((i) => !order.includes(i.id));
  return [...ordered, ...rest];
}

// ── Sortable card ─────────────────────────────────────────────────────────────

function SortableFavoriteCard({
  item,
  onTap,
  onUnheart,
  isUpdating,
}: {
  item: ClothingItem;
  onTap: (item: ClothingItem) => void;
  onUnheart: (item: ClothingItem) => void;
  isUpdating: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden"
    >
      {/* Card header */}
      <div className="px-3 py-2.5 border-b-2 border-black flex justify-between items-center bg-primary gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 rounded"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4 text-black/40" />
        </button>

        {/* Tap name to open details */}
        <button
          onClick={() => onTap(item)}
          className="flex-1 text-left min-w-0"
        >
          <h3 className="font-display font-bold text-lg uppercase tracking-tight truncate">
            {item.name || CATEGORY_LABELS[item.category ?? ""] || "Item"}
          </h3>
        </button>

        {/* Unheart */}
        <button
          onClick={() => onUnheart(item)}
          disabled={isUpdating}
          className="w-8 h-8 flex-shrink-0 flex items-center justify-center
                     bg-red-500 border-2 border-black rounded-full
                     shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                     active:translate-y-0.5 active:translate-x-0.5 active:shadow-none
                     transition-all disabled:opacity-50"
          title="Remove from Totally"
        >
          <Heart className="w-3.5 h-3.5 text-white" fill="white" />
        </button>
      </div>

      {/* Tap photo to open details */}
      <button onClick={() => onTap(item)} className="w-full text-left">
        <div
          className="w-full h-52 border-b-2 border-black overflow-hidden"
          style={{ background: "#FDECEF" }}
        >
          {item.imageObjectPath ? (
            <img
              src={getImageUrl(item.imageObjectPath)!}
              alt={item.name}
              className="w-full h-full"
              style={{ objectFit: "contain", objectPosition: "center" }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-4xl opacity-20">
                {item.category === "shoes"
                  ? "👟"
                  : item.category === "dresses"
                  ? "👗"
                  : item.category === "accessories"
                  ? "👜"
                  : "👚"}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-3">
          <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">
            {CATEGORY_LABELS[item.category ?? ""] ?? item.category}
          </span>
        </div>
      </button>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FavoritesPage() {
  const { data: tops        = [], isLoading: l1 } = useListClothing({ category: "tops"        });
  const { data: bottoms     = [], isLoading: l2 } = useListClothing({ category: "bottoms"     });
  const { data: shoes       = [], isLoading: l3 } = useListClothing({ category: "shoes"       });
  const { data: accessories = [], isLoading: l4 } = useListClothing({ category: "accessories" });
  const { data: outerwear   = [], isLoading: l5 } = useListClothing({ category: "outerwear"   });
  const { data: dresses     = [], isLoading: l6 } = useListClothing({ category: "dresses"     });

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6;

  const rawFavorites = [
    ...tops, ...bottoms, ...shoes, ...accessories, ...outerwear, ...dresses,
  ].filter((item) => item.isFavorite);

  const [orderedIds, setOrderedIds] = useState<number[]>([]);
  const [detailsItem, setDetailsItem] = useState<ClothingItem | null>(null);

  // Load saved order on mount
  useEffect(() => {
    setOrderedIds(getSavedOrder());
  }, []);

  const favorites = applyOrder(rawFavorites, orderedIds);

  const updateItem  = useUpdateClothingItem();
  const queryClient = useQueryClient();

  const handleUnheart = (item: ClothingItem) => {
    updateItem.mutate(
      { id: item.id, data: { isFavorite: false } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
          // Remove from order
          setOrderedIds((prev) => {
            const next = prev.filter((id) => id !== item.id);
            saveOrder(next);
            return next;
          });
        },
      }
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedIds((prev) => {
      const ids = favorites.map((i) => i.id);
      // Merge: start from displayed order
      const base = ids.length ? ids : prev;
      const oldIndex = base.indexOf(active.id as number);
      const newIndex = base.indexOf(over.id as number);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = arrayMove(base, oldIndex, newIndex);
      saveOrder(next);
      return next;
    });
  };

  return (
    <div className="min-h-full flex flex-col pt-8 px-4 pb-8 bg-secondary/10 relative">

      <header className="mb-6">
        <h1 className="text-4xl font-display font-bold uppercase tracking-tighter mb-1">
          Totally 💛
        </h1>
        <p className="font-medium text-muted-foreground text-sm">
          Hearted pieces. Drag to reorder.
        </p>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 bg-muted animate-pulse border-2 border-black rounded-xl" />
          ))}
        </div>
      ) : favorites.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={favorites.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <AnimatePresence mode="popLayout">
              <div className="flex flex-col gap-6">
                {favorites.map((item) => (
                  <SortableFavoriteCard
                    key={item.id}
                    item={item}
                    onTap={setDetailsItem}
                    onUnheart={handleUnheart}
                    isUpdating={updateItem.isPending}
                  />
                ))}
              </div>
            </AnimatePresence>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8
                        bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                        rounded-xl mt-8">
          <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center border-2 border-black mb-4">
            <Heart className="w-7 h-7" />
          </div>
          <h3 className="font-display font-bold text-xl mb-2">No faves yet.</h3>
          <p className="text-sm font-medium text-muted-foreground">
            Tap any item in your wardrobe, then tap the ❤️ to save it here.
          </p>
        </div>
      )}

      {/* Item details sheet */}
      <AnimatePresence>
        {detailsItem && (
          <ItemDetailsSheet
            key={detailsItem.id}
            item={detailsItem}
            onClose={() => setDetailsItem(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
