/**
 * RevenueCat client — wraps @revenuecat/purchases-capacitor.
 *
 * Works in browser (test store) and native iOS (App Store).
 * Entitlement: "unlock"
 * Packages:    $rc_monthly | $rc_annual | $rc_lifetime
 */
import { Purchases } from "@revenuecat/purchases-capacitor";
import type {
  PurchasesPackage,
  PurchasesOfferings,
  CustomerInfo,
} from "@revenuecat/purchases-capacitor";
import type { PurchaseProduct, Tier } from "@/types/local";

const TEST_KEY = import.meta.env.VITE_REVENUECAT_TEST_API_KEY as string;
const IOS_KEY  = import.meta.env.VITE_REVENUECAT_IOS_API_KEY  as string;

export const ENTITLEMENT_ID = "unlock";

/** Map app product keys → RevenueCat package identifiers */
const PACKAGE_ID: Record<PurchaseProduct, string> = {
  monthly:  "$rc_monthly",
  yearly:   "$rc_annual",
  lifetime: "$rc_lifetime",
  premium:  "$rc_lifetime",
};

/** Which tier each product unlocks */
export const PRODUCT_TIER_MAP: Record<PurchaseProduct, Tier> = {
  monthly:  "unlock",
  yearly:   "unlock",
  lifetime: "unlock",
  premium:  "premium",
};

let _initialised = false;

/**
 * Initialise the RevenueCat SDK.
 * Returns a Promise so callers can await SDK readiness before syncing.
 */
export async function initRevenueCat(): Promise<void> {
  if (_initialised) return;
  _initialised = true;

  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  const apiKey   = isNative ? (IOS_KEY ?? TEST_KEY) : (TEST_KEY ?? IOS_KEY);

  if (!apiKey) {
    console.warn("[RevenueCat] No API key — purchases disabled");
    return;
  }

  try {
    await Purchases.configure({ apiKey });
    console.log("[RevenueCat] Configured");
  } catch (e) {
    console.error("[RevenueCat] Configure error:", e);
    // Reset so a retry is possible on next launch
    _initialised = false;
  }
}

/**
 * Derive a Tier from live CustomerInfo.
 * This is the single authoritative mapping — never grant access without it.
 */
export function tierFromCustomerInfo(customerInfo: CustomerInfo): Tier {
  const active = customerInfo.entitlements?.active ?? {};
  if (ENTITLEMENT_ID in active) return "unlock";
  return "free";
}

/**
 * Fetch live CustomerInfo from RevenueCat and return the current tier.
 * Use this on launch, foreground return, and after purchase/restore.
 */
export async function syncEntitlementFromServer(): Promise<{
  tier: Tier;
  customerInfo: CustomerInfo;
}> {
  const { customerInfo } = await Purchases.getCustomerInfo();
  return { tier: tierFromCustomerInfo(customerInfo), customerInfo };
}

/**
 * Restore previous purchases and return the resulting tier.
 * Replaces the old restoreAndCheck() boolean return.
 */
export async function restoreAndGetTier(): Promise<{
  tier: Tier;
  customerInfo: CustomerInfo;
}> {
  const { customerInfo } = await Purchases.restorePurchases();
  return { tier: tierFromCustomerInfo(customerInfo), customerInfo };
}

/** Fetch the current offering and find the package for a given product. */
export async function getPackageForProduct(
  product: PurchaseProduct,
): Promise<PurchasesPackage | null> {
  const pkgId = PACKAGE_ID[product];
  const offerings: PurchasesOfferings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return null;
  return (
    current.availablePackages.find(
      (p: PurchasesPackage) =>
        p.packageType === pkgId || p.identifier === pkgId,
    ) ?? null
  );
}
