---
name: Vision search system
description: Search Everything feature — vision indexer, color extraction, native plugin, search UI, version scheme
---

# Vision Search System

## Version scheme for `ClothingItem.visionVersion`
- `0` = unanalyzed → process
- `1` = iOS Vision only, no canvas colors (legacy — re-index on native)
- `2` = iOS Vision + canvas color extraction merged (current iOS correct result)
- `4` = web canvas color extraction (current web correct result)
- `5` = web analyzed, no labels found → skip retry

On web:   re-run anything `< 4` (versions 0, 1, 2, 3). Skip 5.
On native: re-run anything `< 2` (versions 0, 1). Skip 2+.

**Why:** Apple Vision classifies objects ("couch", "lamp") but never emits color names. Canvas extraction runs in parallel on iOS too and its results are merged first so color names rank higher in search. v1 items on device get re-indexed automatically on next app open.

## notifyNewItemPhoto() — immediate indexing trigger
After creating or replacing a photo, call `notifyNewItemPhoto()` from `src/hooks/useVisionIndexer.ts` to kick the indexer without waiting for next launch.

**Not yet wired** to `QuickAddSheet.tsx` or the Replace Photo success path in `ItemDetailsSheet.tsx`. New photos won't be indexed until next app launch until this is added.

## iOS native plugin location
Files live in `ios-native/` (outside `ios/` which gets deleted by Codemagic on each build):
- `ios-native/VisionPlugin.swift` — Swift implementation
- `ios-native/VisionPlugin.m` — ObjC Capacitor bridge
- `ios-native/add_to_xcode.rb` — xcodeproj script to register files in Xcode

Codemagic step `"Inject Vision plugin"` in `codemagic.yaml` copies + registers them before build.

**Why:** Codemagic deletes ios/ before each build. Storing plugin source outside ios/ preserves it.

## showAddToLookbook prop on ItemDetailsSheet
`showAddToLookbook={true}` swaps the "Clean Up Photo" overlay button for an "Add to Lookbook" button that opens `AddToLookbookSheet`.

Pass `showAddToLookbook={true}` from:
- `saved.tsx` when item opened from search results (`detailsFromSearch` state)
- `favorites.tsx` (always true)

Pass nothing (defaults to `false`) from:
- `wardrobe.tsx` (normal wardrobe context)

## Search is Lookbook-page only
SearchBar + SearchResultsPanel lives in `saved.tsx` only (per spec). Results replace the outfit card list while query is active.
