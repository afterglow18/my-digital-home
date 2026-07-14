/**
 * UpgradeSheet — paywall shown when the user hits a free-tier limit.
 * Design: 3-plan selector (Monthly / Yearly / Lifetime) matching brand pricing.
 * Purchase is stubbed until RevenueCat is integrated.
 */
import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { useEntitlements, type PurchaseResult } from "@/hooks/useEntitlements";
import type { PurchaseProduct } from "@/types/local";

export type UpgradeReason = "items" | "outfits" | "mannequin";

interface Props {
  reason:  UpgradeReason;
  onClose: () => void;
}

const FEATURES = [
  "Unlimited beauty products",
  "Unlimited saved looks",
  "Save your entire vanity",
  "One-time payment options",
  "Choose monthly, yearly or lifetime!",
] as const;

type Plan = {
  id: PurchaseProduct;
  label:   string;
  price:   string;
  per:     string;
  badge?:  string;
  perks:   string[];
};

const PLANS: Plan[] = [
  {
    id:    "monthly",
    label: "MONTHLY",
    price: "$1.99",
    per:   "/month",
    perks: ["Cancel anytime", "Billed monthly"],
  },
  {
    id:    "yearly",
    label: "YEARLY",
    price: "$19.99",
    per:   "/year",
    perks: ["Save 17%", "Billed yearly"],
  },
  {
    id:    "lifetime",
    label: "LIFETIME",
    price: "$9.99",
    per:   "one-time",
    badge: "BEST ★ VALUE",
    perks: ["Pay once", "Yours forever"],
  },
];

export function UpgradeSheet({ reason, onClose }: Props) {
  const { purchase } = useEntitlements();
  const [selected, setSelected] = useState<PurchaseProduct>("lifetime");
  const [status, setStatus]     = useState<"idle" | "pending">("idle");

  const selectedPlan = PLANS.find(p => p.id === selected)!;

  const handlePurchase = useCallback(async () => {
    if (status === "pending") return;
    setStatus("pending");
    const result: PurchaseResult = await purchase(selected);
    if (result === "success") {
      onClose();
    } else {
      setStatus("idle");
    }
  }, [status, purchase, selected, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[80] flex flex-col max-w-md mx-auto overflow-y-auto"
      style={{ background: "#F5F0E8" }}
    >
      {/* Hanger hero + close */}
      <div
        className="relative flex items-center justify-center flex-shrink-0"
        style={{
          height: 100,
          background: "repeating-linear-gradient(45deg, #F5C842 0px, #F5C842 20px, #E8B800 20px, #E8B800 40px)",
        }}
      >
        <span className="text-5xl leading-none" style={{ color: "rgba(255,255,255,0.9)", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}>🪝</span>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center
                     shadow-sm border border-black/10
                     active:scale-95 transition-transform"
        >
          <X className="w-4 h-4 text-black/70" />
        </button>
      </div>

      {/* Title */}
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <h1
          className="font-display font-black uppercase leading-none tracking-tight"
          style={{ fontSize: 44, letterSpacing: "-0.02em" }}
        >
          UNLOCK<br />YOUR<br />UNLIMITED<br />DIGITAL<br />VANITY
        </h1>
        <p className="text-sm font-medium text-black/50 mt-2">
          A premium feature — unlock it once.
        </p>
      </div>

      {/* Features card */}
      <div className="mx-5 mb-5 rounded-2xl overflow-hidden flex-shrink-0" style={{ background: "#111" }}>
        <p
          className="px-4 pt-4 pb-2 font-bold text-xs uppercase tracking-widest"
          style={{ color: "#F5C842" }}
        >
          Upgrade to premium &amp; get:
        </p>
        <ul className="px-4 pb-4 flex flex-col gap-2.5">
          {FEATURES.map(f => (
            <li key={f} className="flex items-center gap-3">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "#F5C842" }}
              >
                <Check className="w-3 h-3 text-black" strokeWidth={3} />
              </span>
              <span className="text-white text-sm font-medium leading-snug">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Plan picker */}
      <p className="text-center text-[10px] font-bold uppercase tracking-widest text-black/40 mb-3 flex-shrink-0">
        Choose your plan
      </p>
      <div className="px-5 flex gap-2 mb-5 flex-shrink-0">
        {PLANS.map(plan => {
          const isSelected = selected === plan.id;
          return (
            <button
              key={plan.id}
              onClick={() => setSelected(plan.id)}
              className="flex-1 flex flex-col items-start p-3 rounded-xl text-left transition-all"
              style={{
                border: isSelected ? "2px solid #F5C842" : "2px solid #D4C9B0",
                background: isSelected ? "#FFFBE8" : "white",
                boxShadow: isSelected ? "3px 3px 0 #F5C842" : "none",
                position: "relative",
              }}
            >
              {plan.badge && (
                <span
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={{ background: "#F5C842", color: "#000", border: "1px solid rgba(0,0,0,0.1)" }}
                >
                  {plan.badge}
                </span>
              )}
              <span className="text-[9px] font-black uppercase tracking-widest text-black/50 mb-0.5">
                {plan.label}
              </span>
              <span className="font-black text-xl leading-none" style={{ fontFamily: "var(--font-display)" }}>
                {plan.price}
              </span>
              <span className="text-[10px] text-black/40 font-medium">{plan.per}</span>
              <div className="mt-2 flex flex-col gap-0.5">
                {plan.perks.map(perk => (
                  <span key={perk} className="flex items-center gap-1 text-[9px] font-semibold text-black/60">
                    <Check className="w-2.5 h-2.5 flex-shrink-0 text-black/40" strokeWidth={3} />
                    {perk}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* CTA */}
      <div
        className="px-5 flex flex-col gap-3 flex-shrink-0"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={handlePurchase}
          disabled={status === "pending"}
          className="w-full py-4 rounded-xl font-black text-lg uppercase tracking-tight
                     transition-all active:translate-y-0.5 active:shadow-none
                     disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: status === "pending" ? "#D4B800" : "#F5C842",
            color: "#000",
            border: "3px solid #000",
            boxShadow: status === "pending" ? "none" : "4px 4px 0 #000",
            letterSpacing: "-0.01em",
          }}
        >
          {status === "pending"
            ? "Opening checkout…"
            : `UNLOCK FOREVER – ${selectedPlan.price} ›`}
        </button>
        <button
          onClick={onClose}
          className="text-sm font-bold text-black/40 text-center underline underline-offset-2
                     hover:text-black/60 transition-colors"
        >
          Maybe Later
        </button>
      </div>
    </motion.div>
  );
}
