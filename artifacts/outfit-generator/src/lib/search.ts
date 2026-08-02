/**
 * Full-text search across locally stored items and lookbook groups.
 *
 * Scoring weights:
 *   name / brand                  → 10 / 8   (highest)
 *   color / category              → 5  / 4
 *   notes / size / season / occasion → 3  each
 *   purchasePrice / purchaseDate  → 2  each
 *   visionLabels / visionText     → 1  each (lowest — auto-generated)
 */
import type { ClothingItem, SavedOutfit } from '@/types/local';

export interface SearchResults {
  items: ClothingItem[];
  groups: SavedOutfit[];
}

function scoreItem(item: ClothingItem, q: string): number {
  let s = 0;
  const has = (v: string | null | undefined) => v?.toLowerCase().includes(q) ?? false;
  if (has(item.name))          s += 10;
  if (has(item.brand))         s += 8;
  if (has(item.color))         s += 5;
  if (has(item.category))      s += 4;
  if (has(item.notes))         s += 3;
  if (has(item.size))          s += 3;
  if (has(item.season))        s += 3;
  if (has(item.occasion))      s += 3;
  if (has(item.purchasePrice)) s += 2;
  if (has(item.purchaseDate))  s += 2;
  if ((item.visionLabels ?? []).some(l => l.toLowerCase().includes(q))) s += 1;
  if ((item.visionText   ?? []).some(t => t.toLowerCase().includes(q))) s += 1;
  return s;
}

/**
 * Search all items and outfits for query.
 * Returns deduplicated results: individual items first, matched groups second.
 * Empty query → empty results.
 */
export function search(
  query: string,
  items: ClothingItem[],
  outfits: SavedOutfit[],
): SearchResults {
  const q = query.trim().toLowerCase();
  if (!q) return { items: [], groups: [] };

  // ── Items ──
  const scored = items
    .map(item => ({ item, score: scoreItem(item, q) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const matchedItems = scored.map(x => x.item);
  const matchedItemIds = new Set(matchedItems.map(i => i.id));

  // ── Groups: match on name, notes, or any contained item ──
  const matchedGroups = outfits.filter(outfit => {
    if (outfit.name.toLowerCase().includes(q))          return true;
    if (outfit.notes?.toLowerCase().includes(q))        return true;
    if (outfit.items.some(i => matchedItemIds.has(i.id) || scoreItem(i, q) > 0)) return true;
    return false;
  });

  return { items: matchedItems, groups: matchedGroups };
}
