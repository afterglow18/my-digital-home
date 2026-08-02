/**
 * Web canvas–based color extraction.
 *
 * Algorithm:
 *  1. Draw the image onto a 48×48 canvas.
 *  2. Sample 4×4 pixel patches from each corner (64 total) to detect the studio
 *     background color.
 *  3. Exclude pixels within BG_TOLERANCE Euclidean distance of the background.
 *  4. Map surviving foreground pixels to named colors using brightness + HSL hue.
 *  5. Return names that represent ≥ 10 % of foreground pixels.
 */

const SIZE = 48;
const CORNER_PATCH = 4;          // 4×4 patch per corner
const MIN_FRACTION = 0.10;       // must cover 10 % of foreground
const BG_TOLERANCE = 40;         // Euclidean RGB distance → "background"

function colorDistance(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else                h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function pixelToColorName(r: number, g: number, b: number): string {
  const brightness = (r + g + b) / 3;
  const [h, s, l] = rgbToHsl(r, g, b);

  // ── Achromatic (low saturation) ─────────────────────────────────────────────
  if (s < 0.12) {
    if (brightness < 80)  return 'black';
    if (brightness < 110) return 'dark grey';
    if (brightness < 175) return 'grey';
    if (brightness < 225) return 'light grey';
    return 'white';
  }

  // ── Warm neutrals (medium saturation, warm hue range) ───────────────────────
  if (s < 0.35 && h >= 18 && h <= 55) {
    if (l > 0.76) return 'beige';
    if (l > 0.50) return 'tan';
    if (l > 0.20) return 'brown';
  }

  // ── Chromatic by hue ────────────────────────────────────────────────────────
  if (h < 15 || h >= 345) return 'red';
  if (h < 45)  return 'orange';
  if (h < 65)  return 'yellow';
  if (h < 150) return 'green';
  if (h < 185) return 'teal';
  if (h < 255) return 'blue';
  if (h < 285) return 'purple';
  return 'pink';
}

/** Extract dominant foreground color names from an image data URL. */
export function extractColorsFromDataUrl(dataUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) { resolve([]); return; }
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

        // ── Background detection via corner patches ──────────────────────────
        const bgSamples: [number, number, number][] = [];
        const corners: [number, number][] = [
          [0, 0],
          [SIZE - CORNER_PATCH, 0],
          [0, SIZE - CORNER_PATCH],
          [SIZE - CORNER_PATCH, SIZE - CORNER_PATCH],
        ];
        for (const [ox, oy] of corners) {
          for (let y = oy; y < oy + CORNER_PATCH; y++) {
            for (let x = ox; x < ox + CORNER_PATCH; x++) {
              const i = (y * SIZE + x) * 4;
              bgSamples.push([data[i], data[i + 1], data[i + 2]]);
            }
          }
        }
        // Median per channel
        const med = (arr: number[]) => arr.sort((a, b) => a - b)[Math.floor(arr.length / 2)];
        const bgR = med(bgSamples.map(s => s[0]));
        const bgG = med(bgSamples.map(s => s[1]));
        const bgB = med(bgSamples.map(s => s[2]));

        // ── Count foreground pixel colours ───────────────────────────────────
        const counts = new Map<string, number>();
        let fgTotal = 0;
        for (let y = 0; y < SIZE; y++) {
          for (let x = 0; x < SIZE; x++) {
            const i = (y * SIZE + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            if (a < 128) continue;                                        // transparent
            if (colorDistance(r, g, b, bgR, bgG, bgB) < BG_TOLERANCE) continue; // background
            fgTotal++;
            const name = pixelToColorName(r, g, b);
            counts.set(name, (counts.get(name) ?? 0) + 1);
          }
        }

        if (fgTotal === 0) { resolve([]); return; }

        const result = [...counts.entries()]
          .filter(([, n]) => n / fgTotal >= MIN_FRACTION)
          .sort((a, b) => b[1] - a[1])
          .map(([name]) => name);

        resolve(result);
      } catch {
        resolve([]);
      }
    };
    img.onerror = () => resolve([]);
    img.src = dataUrl;
  });
}
