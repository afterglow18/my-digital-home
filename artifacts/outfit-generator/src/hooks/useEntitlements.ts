/**
 * useEntitlements — entitlement hook backed by RevenueCat.
 *
 * Rules:
 *  - Premium access is ONLY granted when RevenueCat confirms an active entitlement.
 *  - localStorage is a fast-read cache only — it is never the authority.
 *  - On every launch, foreground return, purchase, and restore we re-fetch
 *    live CustomerInfo and update (or downgrade) accordingly.
 *  - Refunds / expirations are handled via the CustomerInfo update listener
 *    registered in App.tsx, which calls setGlobalTier() in real time.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { Purchases } from '@revenuecat/purchases-capacitor';
import type { Tier, TierCapabilities, PurchaseProduct } from '@/types/local';
import { TIER_CAPS, PRODUCT_TIER } from '@/types/local';
import {
  ENTITLEMENT_ID,
  PRODUCT_TIER_MAP,
  getPackageForProduct,
  tierFromCustomerInfo,
  syncEntitlementFromServer,
  restoreAndGetTier,
  isNativePlatform,
  withTimeout,
} from '@/lib/revenuecat';

// ── Shared external store ─────────────────────────────────────────────────────

const STORAGE_KEY         = 'mdc_tier';
const STORAGE_PRODUCT_KEY = 'mdc_active_product';

function readStoredTier(): Tier {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'unlock' || v === 'premium') return v;
  } catch {
    // private browsing
  }
  return 'free';
}

export function readStoredProduct(): PurchaseProduct | null {
  try {
    const v = localStorage.getItem(STORAGE_PRODUCT_KEY);
    if (v === 'monthly' || v === 'yearly' || v === 'lifetime') return v as PurchaseProduct;
  } catch {}
  return null;
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

/**
 * Update the in-memory tier, persist to localStorage, and notify all subscribers.
 * When downgrading to 'free', the cached product is also cleared so a stale
 * localStorage value can never be used to re-infer a premium tier.
 */
export function setGlobalTier(t: Tier, product?: PurchaseProduct): void {
  try {
    localStorage.setItem(STORAGE_KEY, t);
    if (product) {
      localStorage.setItem(STORAGE_PRODUCT_KEY, product);
    } else if (t === 'free') {
      localStorage.removeItem(STORAGE_PRODUCT_KEY);
    }
  } catch {}
  _currentTier = t;
  _subscribers.forEach((fn) => fn());
}

/**
 * Fetch live CustomerInfo from RevenueCat and update the global tier.
 * - If entitlement is active  → promote / keep premium.
 * - If entitlement is gone    → downgrade to 'free' (handles refunds/expiry).
 * - If the network call fails → keep the cached tier silently (offline grace).
 *
 * Export this so App.tsx can call it on launch, foreground return, etc.
 */
export async function syncFromRevenueCat(): Promise<void> {
  try {
    const { tier } = await syncEntitlementFromServer();
    setGlobalTier(tier);
  } catch (err) {
    console.warn('[RevenueCat] Sync failed — keeping cached tier:', err);
  }
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
   * Purchase a product.
   * Tier is derived from the live CustomerInfo returned by the SDK —
   * never inferred from a local product-to-tier map alone.
   */
  const purchase = useCallback(
    async (product: PurchaseProduct): Promise<PurchaseResult> => {
      if (!isNativePlatform()) {
        console.warn('[RevenueCat] Purchase called outside native app');
        return 'unavailable';
      }
      try {
        const pkg = await withTimeout(getPackageForProduct(product), 20_000);
        if (!pkg) {
          console.warn('[RevenueCat] Package not found for product:', product);
          return 'unavailable';
        }

        const { customerInfo } = await withTimeout(
          Purchases.purchasePackage({ aPackage: pkg }),
          60_000,
        );
        const newTier = tierFromCustomerInfo(customerInfo);

        if (newTier !== 'free') {
          setGlobalTier(newTier, product);
          return 'success';
        }

        // SDK returned but entitlement not active — treat as cancelled
        return 'cancelled';
      } catch (err: any) {
        if (err?.code === 'PURCHASE_CANCELLED' || err?.userCancelled === true) {
          return 'cancelled';
        }
        console.error('[RevenueCat] Purchase error:', err);
        return 'unavailable';
      }
    },
    [],
  );

  /**
   * Restore previous purchases.
   * Explicitly downgrades to 'free' if nothing is active, so restore
   * can remove premium just as easily as it grants it.
   */
  const restore = useCallback(async (): Promise<PurchaseResult> => {
    if (!isNativePlatform()) {
      console.warn('[RevenueCat] Restore called outside native app');
      return 'unavailable';
    }
    try {
      const { tier: restoredTier } = await withTimeout(restoreAndGetTier(), 20_000);
      setGlobalTier(restoredTier);
      return restoredTier !== 'free' ? 'success' : 'cancelled';
    } catch (err) {
      console.error('[RevenueCat] Restore error:', err);
      return 'unavailable';
    }
  }, []);

  return { tier, caps, canAddItem, canSaveOutfit, purchase, restore };
}
