/**
 * WelcomePage — Side-view burgundy purse animation.
 *
 * SPLASH    : full side-view burgundy handbag with gold zipper, app branding.
 * UNZIPPING : zipper pull slides left→right; opening gap reveals dark interior.
 * ZOOMING   : whole bag scales up — camera dives into the opening.
 * HERO      : hero image crossfades in at peak zoom.
 * EXITING   : whole screen fades out → onEnter().
 */

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";

type Phase = "splash" | "unzipping" | "zooming" | "hero" | "exiting";

const UNZIP_MS  = 1400;
const ZOOM_MS   = 900;
const HERO_MS   = 800;
const HOLD_MS   = 400;
const EXIT_MS   = 700;

const GOLD      = "#d4af37";
const GOLD_LT   = "#f0d080";

interface Props { onEnter: () => void; }

export default function WelcomePage({ onEnter }: Props) {
  const [phase,       setPhase]       = useState<Phase>("splash");
  const [heroVisible, setHeroVisible] = useState(false);
  const calledRef    = useRef(false);
  const zipControls  = useAnimation(); // zipper pull x position
  const gapControls  = useAnimation(); // opening gap height
  const bagControls  = useAnimation(); // whole-bag zoom

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleTap = async () => {
    if (phase !== "splash") return;
    setPhase("unzipping");

    // Step 1: zipper slides + gap opens
    zipControls.start({
      x: "calc(100% - 26px)",
      transition: { duration: UNZIP_MS / 1000, ease: [0.35, 0, 0.65, 1] },
    });
    gapControls.start({
      scaleY: 1,
      transition: { duration: UNZIP_MS / 1000, ease: [0.35, 0, 0.65, 1] },
    });

    // Step 2: after unzip, zoom whole bag into screen
    setTimeout(async () => {
      setPhase("zooming");
      bagControls.start({
        scale: 18,
        y: -40,        // drift slightly up so the opening fills the screen
        opacity: 0,
        transition: { duration: ZOOM_MS / 1000, ease: [0.4, 0, 1, 1] },
      });
    }, UNZIP_MS + 80);

    // Step 3: hero fades in during zoom
    setTimeout(() => setHeroVisible(true), UNZIP_MS + ZOOM_MS * 0.45);
    setTimeout(() => setPhase("hero"),     UNZIP_MS + ZOOM_MS * 0.7);
    setTimeout(() => setPhase("exiting"),  UNZIP_MS + ZOOM_MS + HOLD_MS);
    setTimeout(finish,                     UNZIP_MS + ZOOM_MS + HOLD_MS + EXIT_MS);
  };

  const isExiting = phase === "exiting";

  return (
    <motion.div
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: EXIT_MS / 1000, ease: "easeIn" }}
      onClick={phase === "splash" ? handleTap : undefined}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "#130306",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: phase === "splash" ? "pointer" : "default",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 70% 55% at 50% 52%, rgba(120,10,35,0.42) 0%, transparent 70%)",
      }} />

      {/* Hero image — fades in as bag zooms */}
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

      {/* Bag + branding — zooms on cue */}
      <motion.div
        animate={bagControls}
        style={{
          position: "relative", zIndex: 2,
          display: "flex", flexDirection: "column", alignItems: "center",
          transformOrigin: "center 38%", // zoom toward the opening
        }}
      >
        <SidePurse zipControls={zipControls} gapControls={gapControls} />

        {/* Branding */}
        <div style={{ marginTop: 26, textAlign: "center" }}>
          <div style={{
            fontFamily: "'Great Vibes', cursive",
            fontWeight: 400,
            fontSize: "clamp(38px, 11vw, 56px)",
            color: "#f7f2ec",
            textShadow: `0 0 32px rgba(255,245,235,0.35), 0 2px 10px rgba(0,0,0,0.9)`,
            lineHeight: 1.15,
          }}>
            My Digital<br />Handbags
          </div>
          <div style={{
            fontSize: 10, fontWeight: 500,
            letterSpacing: "0.28em", textTransform: "uppercase",
            color: "rgba(247,242,236,0.5)", marginTop: 7,
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
                  color: "rgba(247,242,236,0.55)", marginTop: 18,
                }}
              >
                tap to open
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Footer */}
      <div style={{
        position: "fixed", bottom: "calc(env(safe-area-inset-bottom) + 10px)",
        left: 0, right: 0, display: "flex", flexDirection: "column",
        alignItems: "center", gap: 4, zIndex: 210,
      }}>
        <a href="https://classy-alpaca-441.notion.site/Privacy-Policy-39682db6065380b19dedcb108d4a0ef4"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.22)", textDecoration: "none", letterSpacing: "0.02em" }}>
          Privacy Policy
        </a>
        <a href="https://app.notion.com/p/My-Digital-Closet-Support-39782db60653802a9088dcbae84c0527?source=copy_link"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.22)", textDecoration: "none", letterSpacing: "0.02em" }}>
          Support
        </a>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────
   Flat zip-around wallet SVG (portrait orientation)
   Looks like a slim bifold/zip wallet — no handles,
   thin profile, wrist-ring on the left, zipper across top.
───────────────────────────────────────────────────── */
interface BagProps {
  zipControls: ReturnType<typeof useAnimation>;
  gapControls: ReturnType<typeof useAnimation>;
}

function SidePurse({ zipControls, gapControls }: BagProps) {
  // Wallet dims — portrait, slim
  const W   = 240;
  const H   = 300;
  const BX  = 22;
  const BY  = 18;
  const BW  = 196;
  const BH  = 264;
  const BR  = 20;

  const ZIP_Y   = BY + 5;      // zipper track y
  const GAP_TOP = BY + 12;     // where the opening starts
  const GAP_H   = 26;          // max gap height when fully open

  return (
    <div style={{
      position: "relative", width: W, height: H,
      filter: "drop-shadow(0 20px 50px rgba(0,0,0,0.9)) drop-shadow(0 4px 14px rgba(120,10,35,0.6))",
    }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" xmlns="http://www.w3.org/2000/svg">

        {/* ── Wallet body ── */}
        <rect x={BX} y={BY} width={BW} height={BH} rx={BR}
          fill="url(#walletGrad)" stroke="#c4a03560" strokeWidth="1.5" />

        {/* Edge depth shadow (right + bottom) — gives 3-D slim feel */}
        <rect x={BX + 4} y={BY + BH} width={BW - 4} height={5} rx={3}
          fill="rgba(0,0,0,0.45)" />
        <rect x={BX + BW} y={BY + 4} width={5} height={BH - 4} rx={3}
          fill="rgba(0,0,0,0.35)" />

        {/* Subtle plaid weave texture */}
        <rect x={BX} y={BY} width={BW} height={BH} rx={BR}
          fill="url(#plaidH)" opacity="0.06" />
        <rect x={BX} y={BY} width={BW} height={BH} rx={BR}
          fill="url(#plaidV)" opacity="0.06" />

        {/* Leather grain highlight (top-left sheen) */}
        <rect x={BX} y={BY} width={BW} height={BH} rx={BR}
          fill="url(#sheen)" opacity="0.15" />

        {/* Outer stitching border */}
        <rect x={BX + 9} y={BY + 9} width={BW - 18} height={BH - 18} rx={BR - 6}
          fill="none" stroke="#c4a03528" strokeWidth="1" strokeDasharray="4 4" />

        {/* ── Wrist ring on left side ── */}
        {/* Ring bar attached to wallet */}
        <rect x={BX - 6} y={BY + BH / 2 - 14} width={9} height={28} rx={4}
          fill="url(#hwGold)" stroke="#a0781880" strokeWidth="0.8" />
        {/* Ring loop */}
        <rect x={BX - 18} y={BY + BH / 2 - 10} width={14} height={20} rx={7}
          fill="none" stroke="url(#hwGold)" strokeWidth="3.5" />

        {/* ── Snap / turnlock logo plate (centre) ── */}
        <rect x={BX + BW / 2 - 20} y={BY + BH / 2 - 11} width={40} height={22} rx={6}
          fill="url(#hwGold)" opacity="0.75" />
        <rect x={BX + BW / 2 - 20} y={BY + BH / 2 - 11} width={40} height={22} rx={6}
          fill="none" stroke="#c4a035" strokeWidth="0.8" />
        {/* Centre stud on plate */}
        <circle cx={BX + BW / 2} cy={BY + BH / 2} r={5}
          fill="url(#studGrad)" stroke="#c4a03580" strokeWidth="0.6" />

        {/* ── Interior dark area revealed by zipper ── */}
        <clipPath id="walletClip">
          <rect x={BX} y={BY} width={BW} height={BH} rx={BR} />
        </clipPath>

        {/* Static dark backing */}
        <rect x={BX} y={GAP_TOP} width={BW} height={GAP_H}
          fill="#0a0205" clipPath="url(#walletClip)" />

        {/* Animated reveal panel */}
        <foreignObject x={BX} y={GAP_TOP} width={BW} height={GAP_H}
          clipPath="url(#walletClip)">
          <motion.div
            animate={gapControls}
            initial={{ scaleY: 0 }}
            style={{
              width: "100%", height: "100%",
              transformOrigin: "top center",
              background: "linear-gradient(180deg, #04000a 0%, #0e0308 55%, #1a0508 100%)",
            }}
          />
        </foreignObject>

        {/* Card-slot hint lines inside the opening (visible when open) */}
        {[0.28, 0.52, 0.76].map((frac, i) => (
          <line key={i}
            x1={BX + BW * frac} y1={GAP_TOP + 4}
            x2={BX + BW * frac} y2={GAP_TOP + GAP_H - 4}
            stroke={`${GOLD}22`} strokeWidth="1" />
        ))}

        {/* ── Zipper track across top ── */}
        <line x1={BX + 6} y1={ZIP_Y} x2={BX + BW - 6} y2={ZIP_Y}
          stroke={`${GOLD}bb`} strokeWidth="2.5" strokeLinecap="round" />
        {/* Teeth dashes */}
        <line x1={BX + 6} y1={ZIP_Y} x2={BX + BW - 6} y2={ZIP_Y}
          stroke="rgba(0,0,0,0.3)" strokeWidth="2.5"
          strokeDasharray="3.5 4.5" strokeLinecap="butt" />

        {/* ── Defs ── */}
        <defs>
          <linearGradient id="walletGrad" x1="0" y1="0" x2="0.25" y2="1">
            <stop offset="0%"   stopColor="#922030" />
            <stop offset="30%"  stopColor="#6B1520" />
            <stop offset="65%"  stopColor="#3d0f18" />
            <stop offset="100%" stopColor="#250810" />
          </linearGradient>

          <pattern id="plaidH" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="18" height="1.5" y="8" fill="white" />
          </pattern>
          <pattern id="plaidV" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="1.5" height="18" x="8" fill="white" />
          </pattern>

          <linearGradient id="sheen" x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0%"   stopColor="white" stopOpacity="0.10" />
            <stop offset="40%"  stopColor="white" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="hwGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#f0d060" />
            <stop offset="50%"  stopColor="#a07820" />
            <stop offset="100%" stopColor="#d4af37" />
          </linearGradient>

          <radialGradient id="studGrad" cx="35%" cy="30%" r="65%">
            <stop offset="0%"   stopColor="#fff8c0" />
            <stop offset="100%" stopColor="#806010" />
          </radialGradient>
        </defs>
      </svg>

      {/* Zipper pull — slides along the track */}
      <motion.div
        animate={zipControls}
        initial={{ x: 0 }}
        style={{
          position: "absolute",
          top: ZIP_Y - 14,
          left: BX + 4,
          display: "flex", flexDirection: "column", alignItems: "center",
          zIndex: 20, pointerEvents: "none",
        }}
      >
        {/* Connector loop */}
        <div style={{
          width: 8, height: 6, borderRadius: 2,
          background: `linear-gradient(180deg, ${GOLD_LT}, ${GOLD})`,
          border: "0.5px solid rgba(180,140,20,0.8)",
        }} />
        {/* Pull tab */}
        <div style={{
          width: 14, height: 18, borderRadius: 4, marginTop: 1,
          background: `linear-gradient(145deg, ${GOLD_LT}, ${GOLD}, #a07820)`,
          border: "0.8px solid rgba(180,140,20,0.9)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,240,160,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ width: 6, height: 1, background: "rgba(0,0,0,0.3)", borderRadius: 1 }} />
        </div>
      </motion.div>
    </div>
  );
}

