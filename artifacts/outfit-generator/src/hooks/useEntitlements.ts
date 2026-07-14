/**
 * useEntitlements — local-first entitlement hook.
 *
 * Tier is persisted in localStorage and updated when a purchase completes.
 * The purchase() method is a stub until RevenueCat is wired up;
 * it returns "unavailable" so paywalls close gracefully.
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { Tier, TierCapabilities, PurchaseProduct } from '@/types/local';
import { TIER_CAPS } from '@/types/local';

// ── Shared external store ─────────────────────────────────────────────────────

const STORAGE_KEY = 'mdc_tier';

function readStoredTier(): Tier {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'unlock' || v === 'premium') return v;
  } catch {
    // private browsing
  }
  return 'free';
}

let _currentTier: Tier = readStoredTier();
const _subscribers = new Set<() => void>();

function subscribeTier(notify: () => void) {
  _subscribers.add(notify);
  return () => { _subscribers.delete(notify); };
}

function getTierSnapshot(): Tier {
  return _currentTier;
}

/** Promote the tier globally and persist. Called after a successful purchase. */
export function setGlobalTier(t: Tier): void {
  try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  _currentTier = t;
  _subscribers.forEach((fn) => fn());
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type PurchaseResult = 'success' | 'cancelled' | 'unavailable';

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEntitlements() {
  const tier = useSyncExternalStore(subscribeTier, getTierSnapshot);
  const caps: TierCapabilities = TIER_CAPS[tier];

  const canAddItem = useCallback(
    (currentCount: number) =>
      caps.maxItems === null || currentCount < caps.maxItems,
    [caps.maxItems],
  );

  const canSaveOutfit = useCallback(
    (currentCount: number) =>
      caps.maxOutfits === null || currentCount < caps.maxOutfits,
    [caps.maxOutfits],
  );

  /**
   * Purchase stub — RevenueCat integration not yet connected.
   * Returns "unavailable" so the paywall closes without crashing.
   *
   * Product mapping:
   *   'monthly'  → RevenueCat monthly subscription → tier 'unlock'
   *   'yearly'   → RevenueCat yearly subscription  → tier 'unlock'
   *   'lifetime' → RevenueCat one-time purchase    → tier 'unlock'
   *   'premium'  → RevenueCat one-time purchase    → tier 'premium'
   *
   * Replace this body with the actual RevenueCat purchase call
   * after connecting the integration.
   */
  const purchase = useCallback(
    async (_product: PurchaseProduct): Promise<PurchaseResult> => {
      // TODO: replace with RevenueCat purchase once integrated
      console.warn('[useEntitlements] RevenueCat not yet configured — product:', _product);
      return 'unavailable';
    },
    [],
  );

  return { tier, caps, canAddItem, canSaveOutfit, purchase };
}
