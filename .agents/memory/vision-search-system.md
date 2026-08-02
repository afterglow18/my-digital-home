---
name: Vision search system
description: Search Everything feature — vision indexer, color extraction, native plugin, search UI, version scheme
---

# Vision Search System

## Version scheme for `ClothingItem.visionVersion`
- `0` = unanalyzed → process
- `1` = iOS Vision (VNClassifyImageRequest + VNRecognizeTextRequest)
- `4` = web canvas color extraction (current correct result)
- `5` = web analyzed, no labels found → skip retry

On web: re-run anything `< 4` (versions 0, 1, 2, 3). Skip 5.
On native: only process `< 1` (version 0).

**Why:** Prevents repeated work. Version 5 means "tried it, no data, don't waste time again."

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
