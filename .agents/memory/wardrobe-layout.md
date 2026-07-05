---
name: Wardrobe image layout strategy
description: How the closet background image is sized and overlays are positioned on the wardrobe page
---

## Current image

`/closet-bg.png` — 853×1844 PNG (user-supplied, 3 baked-in placeholder cards per row).

## Sizing strategy

`object-fit: CONTAIN` inside `calc(100dvh − 90px)` container.

Image ratio 853/1844 ≈ 0.4626.
Container ratio on iPhone 390×754 ≈ 0.517 → container wider → image fills HEIGHT.

| Device | rW (px) | rL each side |
|---|---|---|
| iPhone SE  375×577 | 267 | 54 px |
| iPhone 390 ×754   | 349 | 21 px |
| iPhone Max 430×842| 390 | 20 px |

Container background `#F0C030` — side letterbox blends with yellow door colour.

## Overlay philosophy

The PNG already has all visual UI baked in. HTML provides:
- **Transparent tap zones** over every baked-in button
- **ClosetRow** (no background) rendered over the **rectangular dotted box area only**
- **Empty slots**: image's dashed placeholder cards show through (ClosetRow is transparent)
- **Image hangers**: baked-in gold hanger graphics sit ABOVE the ClosetRow container and are always visible — ClosetRow renders NO HTML hanger

## ClosetRow component

`src/components/ClosetRow.tsx` — fixed 3-slot carousel, no hanger rendering.

Behaviour:
- Divides its container into 3 equal slots (left / center / right), `overflow:hidden`
- Card fills the FULL container height (= the rectangular dotted box, below the image's hanger)
- `borderRadius: "10px"` all corners — matches the placeholder box shape
- Selected item: 4.5px blush-pink border + outer glow; unselected: 1.5px warm-gold hairline
- Border/shadow always transition (0.24s ease) so the highlight glides to the new card on swipe
- `hasDragged` ref prevents synthetic click triggering after a drag
- Tracks last-notified item **ID** (not index) for accurate parent `centred` map
- No `hangerH` prop — hanger concept was removed entirely

## Landmark fractions (853×1844 PNG, all 0→1)

```
doorL:   0.110   // inner left edge of closet
doorR:   0.890   // inner right edge of closet

rows[0] TOPS:    { btnCY: 0.278, boxY: 0.304, boxBot: 0.445 }
rows[1] BOTTOMS: { btnCY: 0.480, boxY: 0.513, boxBot: 0.651 }
rows[2] SHOES:   { btnCY: 0.685, boxY: 0.724, boxBot: 0.851 }

// boxY  = top of rectangular dotted box (BELOW the image's baked-in hanger graphic)
// boxBot = bottom of dotted box

barY:     0.863
barBot:   0.928
hangerCX: 0.140
saveBtnL: 0.228
saveBtnR: 0.772
manneCX:  0.860
```

## ClosetRow container positioning (wardrobe.tsx)

```
top:    pY(ir, lm.boxY)                          // = ir.top + ir.height * boxY
height: pH(ir, lm.boxBot - lm.boxY)
left:   pX(ir, LM.doorL)
right:  ir.left + pW(ir, 1 - LM.doorR)
overflow: hidden
// NO background — transparent, image placeholder cards show through empty slots
// Image's gold hanger graphics are ABOVE this container (boxY is below the hanger)
```

**Why boxY not carY:** Original `carY` landed inside the hanger graphic area; adding a hangerH offset inside ClosetRow compounded the misalignment. The fix was to measure `boxY` = exact bottom of the hanger graphic, position ClosetRow there, and remove hangerH entirely.

**Why ClosetRow over SwipeRow:** SwipeRow overflows the closet bounds; ClosetRow is pinned to the 3-slot box with overflow:hidden.
