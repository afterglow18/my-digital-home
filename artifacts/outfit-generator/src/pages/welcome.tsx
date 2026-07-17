/**
 * WelcomePage — Burgundy wallet unzip animation.
 *
 * SPLASH    : closed burgundy wallet with gold zipper, app branding below.
 * UNZIPPING : zipper pull slides left→right; interior revealed by clip-path.
 * OPEN      : wallet fully open, interior visible.
 * HERO      : hero image crossfades over the open wallet.
 * EXITING   : whole screen fades out → onEnter().
 */

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";

type Phase = "splash" | "unzipping" | "open" | "hero" | "exiting";

const UNZIP_MS   = 1500;   // zipper slides across
const PAUSE_MS   = 280;    // brief hold with wallet open
const HERO_MS    = 900;    // hero crossfade
const HOLD_MS    = 450;    // hold on hero
const EXIT_MS    = 700;    // fade out to app

const BURG_DARK  = "#3d0f18";
const BURG_MID   = "#5C0F1E";
const BURG_LIGHT = "#7D1528";
const GOLD       = "#d4af37";
const GOLD_LIGHT = "#f0d080";

interface Props { onEnter: () => void; }

export default function WelcomePage({ onEnter }: Props) {
  const [phase,       setPhase]       = useState<Phase>("splash");
  const [heroVisible, setHeroVisible] = useState(false);
  const calledRef = useRef(false);
  const zipControls = useAnimation();
  const revealControls = useAnimation();

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleTap = async () => {
    if (phase !== "splash") return;
    setPhase("unzipping");

    // Run zipper pull + interior reveal together
    zipControls.start({
      x: "calc(100% - 28px)",
      transition: { duration: UNZIP_MS / 1000, ease: [0.4, 0, 0.6, 1] },
    });
    revealControls.start({
      clipPath: "inset(0 0% 0 0 round 0px)",
      transition: { duration: UNZIP_MS / 1000, ease: [0.4, 0, 0.6, 1] },
    });

    setTimeout(() => setPhase("open"), UNZIP_MS);
    setTimeout(() => setHeroVisible(true), UNZIP_MS + PAUSE_MS);
    setTimeout(() => setPhase("hero"),  UNZIP_MS + PAUSE_MS + HERO_MS * 0.4);
    setTimeout(() => setPhase("exiting"), UNZIP_MS + PAUSE_MS + HERO_MS + HOLD_MS);
    setTimeout(finish, UNZIP_MS + PAUSE_MS + HERO_MS + HOLD_MS + EXIT_MS);
  };

  const isExiting = phase === "exiting";

  return (
    <motion.div
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: EXIT_MS / 1000, ease: "easeIn" }}
      onClick={phase === "splash" ? handleTap : undefined}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "#130306",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: phase === "splash" ? "pointer" : "default",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 65% 50% at 50% 50%, rgba(120,10,35,0.4) 0%, transparent 70%)",
      }} />

      {/* Hero image — fades in after wallet opens */}
      <motion.img
        src="/handbag-hero.jpg"
        alt="Handbag collection"
        draggable={false}
        animate={{ opacity: heroVisible ? 1 : 0 }}
        transition={{ duration: HERO_MS / 1000, ease: "easeOut" }}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "center", zIndex: 1,
        }}
      />

      {/* Wallet + branding */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* ── Wallet card ── */}
        <div style={{
          position: "relative",
          width: "min(80vw, 300px)",
          height: "min(52vw, 195px)",
          borderRadius: 18,
          overflow: "visible",
          filter: "drop-shadow(0 16px 48px rgba(0,0,0,0.8)) drop-shadow(0 4px 12px rgba(120,10,35,0.5))",
        }}>

          {/* Wallet body */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: 18, overflow: "hidden",
            border: `1.5px solid ${GOLD}55`,
          }}>
            {/* Burgundy exterior */}
            <div style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(145deg, ${BURG_LIGHT} 0%, ${BURG_MID} 40%, ${BURG_DARK} 100%)`,
            }} />

            {/* Subtle plaid texture lines */}
            <div style={{
              position: "absolute", inset: 0, opacity: 0.08,
              backgroundImage: [
                "repeating-linear-gradient(0deg, transparent 0px, transparent 14px, rgba(255,255,255,0.9) 14px, rgba(255,255,255,0.9) 16px)",
                "repeating-linear-gradient(90deg, transparent 0px, transparent 14px, rgba(255,255,255,0.9) 14px, rgba(255,255,255,0.9) 16px)",
              ].join(", "),
            }} />

            {/* Gold hardware line at left edge */}
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0, width: 5,
              background: `linear-gradient(180deg, ${GOLD_LIGHT} 0%, ${GOLD} 50%, ${GOLD_LIGHT} 100%)`,
              opacity: 0.7,
            }} />

            {/* Wallet interior — revealed by clip-path as zipper opens */}
            <motion.div
              animate={revealControls}
              initial={{ clipPath: "inset(0 100% 0 0 round 0px)" }}
              style={{
                position: "absolute", inset: 0,
                background: `linear-gradient(160deg, #1a0508 0%, #110306 50%, #0a0205 100%)`,
                zIndex: 5,
              }}
            >
              {/* Interior texture */}
              <div style={{
                position: "absolute", inset: 0, opacity: 0.06,
                background: "repeating-linear-gradient(45deg, rgba(212,175,55,0.5) 0px, transparent 1px, transparent 8px, rgba(212,175,55,0.5) 9px)",
              }} />
              {/* Interior glow */}
              <div style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(ellipse 70% 60% at 60% 50%, rgba(212,175,55,0.08) 0%, transparent 70%)",
              }} />
              {/* Card slots suggestion */}
              {[0.22, 0.48, 0.74].map((x, i) => (
                <div key={i} style={{
                  position: "absolute",
                  left: `${x * 100}%`,
                  top: "18%", bottom: "18%",
                  width: 2,
                  background: `rgba(212,175,55,0.12)`,
                  borderRadius: 1,
                }} />
              ))}
            </motion.div>

            {/* Zipper track line */}
            <div style={{
              position: "absolute", top: 13, left: 8, right: 8, height: 3,
              borderRadius: 2,
              background: `linear-gradient(90deg, ${GOLD}cc, ${GOLD_LIGHT}ff, ${GOLD}cc)`,
              zIndex: 8,
            }}>
              {/* Zipper teeth (decorative dashes) */}
              <div style={{
                position: "absolute", inset: 0,
                backgroundImage: `repeating-linear-gradient(90deg, transparent 0px, transparent 5px, rgba(0,0,0,0.4) 5px, rgba(0,0,0,0.4) 7px)`,
              }} />
            </div>

            {/* Zipper pull tab — slides across */}
            <motion.div
              animate={zipControls}
              initial={{ x: 0 }}
              style={{
                position: "absolute", top: 5, left: 6,
                zIndex: 10,
                display: "flex", flexDirection: "column", alignItems: "center",
              }}
            >
              {/* Pull body */}
              <div style={{
                width: 18, height: 18, borderRadius: 4,
                background: `linear-gradient(145deg, ${GOLD_LIGHT}, ${GOLD})`,
                border: `1px solid rgba(180,140,20,0.8)`,
                boxShadow: "0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,240,160,0.5)",
              }} />
              {/* Connector to track */}
              <div style={{
                width: 3, height: 4,
                background: GOLD,
                borderRadius: 1,
              }} />
            </motion.div>
          </div>
        </div>

        {/* ── Branding ── */}
        <div style={{ marginTop: 28, textAlign: "center" }}>
          <div style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontWeight: 700,
            fontSize: "clamp(18px, 5.5vw, 26px)",
            letterSpacing: "0.08em",
            color: GOLD_LIGHT,
            textShadow: `0 0 28px rgba(212,175,55,0.5), 0 2px 8px rgba(0,0,0,0.9)`,
            lineHeight: 1.25,
          }}>
            MY DIGITAL<br />HANDBAGS
          </div>
          <div style={{
            fontSize: 10, fontWeight: 500,
            letterSpacing: "0.28em", textTransform: "uppercase",
            color: "rgba(212,175,55,0.45)",
            marginTop: 7,
          }}>
            your collection, curated
          </div>

          <AnimatePresence>
            {phase === "splash" && (
              <motion.div
                key="tap-hint"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                style={{
                  fontSize: 10, letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "rgba(212,175,55,0.5)",
                  marginTop: 18,
                }}
              >
                tap to open
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer links */}
      <div style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom) + 10px)",
        left: 0, right: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 4, zIndex: 210,
      }}>
        <a
          href="https://classy-alpaca-441.notion.site/Privacy-Policy-39682db6065380b19dedcb108d4a0ef4"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.22)", textDecoration: "none", letterSpacing: "0.02em" }}
        >
          Privacy Policy
        </a>
        <a
          href="https://app.notion.com/p/My-Digital-Closet-Support-39782db60653802a9088dcbae84c0527?source=copy_link"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.22)", textDecoration: "none", letterSpacing: "0.02em" }}
        >
          Support
        </a>
      </div>
    </motion.div>
  );
}
