/**
 * useVisionIndexer — background hook that processes clothing photos for search.
 *
 * On web:    extracts dominant colors via canvas (version 4 / 5)
 * On iOS:    calls native VisionPlugin for label + text detection (version 1)
 *
 * Runs automatically on app startup after a 1.5 s delay.
 * Call `notifyNewItemPhoto()` from anywhere to trigger a re-run immediately
 * after creating or replacing a photo (e.g. QuickAddSheet success).
 *
 * Version scheme:
 *   0 = unanalyzed   → process
 *   1 = iOS Vision   → skip on web, re-process on native if desired
 *   4 = web canvas   → skip
 *   5 = web, no labels found → skip (image may be too noisy)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { dbListClothing, dbUpdateClothing } from '@/lib/db';
import { extractColorsFromDataUrl } from '@/lib/visionExtract';
import { analyzeWithVision } from '@/lib/visionPlugin';
import { getImageUrl } from '@/lib/utils';

const ITEM_DELAY_MS        = 350;   // gap between items to keep UI responsive
const STARTUP_DELAY_MS     = 1500;  // wait for initial render before indexing
const WEB_VERSION          = 4;
const WEB_NO_LABELS_VERSION = 5;
const IOS_VERSION          = 1;

// ── Module-level trigger so any component can kick a re-run ──────────────────
type Listener = () => void;
const _listeners = new Set<Listener>();

/** Call after creating or updating an item photo to immediately index it. */
export function notifyNewItemPhoto() {
  _listeners.forEach(fn => fn());
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useVisionIndexer() {
  const [isIndexing, setIsIndexing]   = useState(false);
  const runningRef = useRef(false);
  const pendingRef = useRef(false);  // queued re-run while current run is active

  const runOnce = useCallback(async () => {
    if (runningRef.current) {
      pendingRef.current = true;
      return;
    }
    runningRef.current = true;
    setIsIndexing(true);

    try {
      const allItems = await dbListClothing();
      const isNative = Capacitor.isNativePlatform();

      const queue = allItems.filter(item => {
        if (!item.imageObjectPath) return false;
        const v = item.visionVersion ?? 0;
        if (v === WEB_NO_LABELS_VERSION) return false; // "no labels found, skip"
        if (isNative)  return v < IOS_VERSION;         // native: only process v0
        return v < WEB_VERSION;                        // web: process 0,1,2,3
      });

      for (const item of queue) {
        try {
          const url = getImageUrl(item.imageObjectPath!);
          if (!url) continue;

          let labels: string[] = [];
          let text:   string[] = [];
          let version: number;

          if (isNative) {
            const result = await analyzeWithVision(url);
            labels  = result.labels;
            text    = result.text;
            version = IOS_VERSION;
          } else {
            labels  = await extractColorsFromDataUrl(url);
            version = labels.length > 0 ? WEB_VERSION : WEB_NO_LABELS_VERSION;
          }

          await dbUpdateClothing(item.id, { visionLabels: labels, visionText: text, visionVersion: version });
        } catch {
          // silently skip this item — a failed item should not stall the queue
        }

        await new Promise<void>(r => setTimeout(r, ITEM_DELAY_MS));
      }
    } finally {
      runningRef.current = false;
      setIsIndexing(false);

      // If a new item was queued while we were running, go again
      if (pendingRef.current) {
        pendingRef.current = false;
        setTimeout(runOnce, 100);
      }
    }
  }, []);

  // ── Startup run ──────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(runOnce, STARTUP_DELAY_MS);
    return () => clearTimeout(t);
  }, [runOnce]);

  // ── Subscribe to external triggers (new photo saved) ─────────────────────
  useEffect(() => {
    const handler = () => { runOnce(); };
    _listeners.add(handler);
    return () => { _listeners.delete(handler); };
  }, [runOnce]);

  return { isIndexing };
}
