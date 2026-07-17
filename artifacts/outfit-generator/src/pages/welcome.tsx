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
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontWeight: 700,
            fontSize: "clamp(18px, 5.5vw, 26px)",
            letterSpacing: "0.08em",
            color: GOLD_LT,
            textShadow: `0 0 28px rgba(212,175,55,0.5), 0 2px 8px rgba(0,0,0,0.9)`,
            lineHeight: 1.25,
          }}>
            MY DIGITAL<br />HANDBAGS
          </div>
          <div style={{
            fontSize: 10, fontWeight: 500,
            letterSpacing: "0.28em", textTransform: "uppercase",
            color: "rgba(212,175,55,0.45)", marginTop: 7,
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
                  color: "rgba(212,175,55,0.5)", marginTop: 18,
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
   Side-view structured handbag SVG
   Proportions: wide landscape bag, two short handles,
   structured base with feet, zipper across top opening.
───────────────────────────────────────────────────── */
interface BagProps {
  zipControls: ReturnType<typeof useAnimation>;
  gapControls: ReturnType<typeof useAnimation>;
}

function SidePurse({ zipControls, gapControls }: BagProps) {
  const W   = 300;
  const H   = 220;
  const BX  = 20;   // bag body left x
  const BY  = 72;   // bag body top y
  const BW  = 260;  // bag body width
  const BH  = 128;  // bag body height
  const BR  = 16;   // corner radius

  // Zipper track sits at the very top of the bag body
  const ZIP_Y = BY + 4;
  // Gap opening sits just below zipper track
  const GAP_TOP = BY + 10;
  const GAP_H   = 22; // fully open gap height

  return (
    <div style={{ position: "relative", width: W, height: H,
      filter: "drop-shadow(0 18px 50px rgba(0,0,0,0.85)) drop-shadow(0 4px 12px rgba(120,10,35,0.55))" }}>

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" xmlns="http://www.w3.org/2000/svg">

        {/* ── Handles ── */}
        {/* Left handle */}
        <path d={`M ${BX + 60} ${BY} C ${BX + 60} ${BY - 38}, ${BX + 95} ${BY - 48}, ${BX + 110} ${BY - 48} C ${BX + 125} ${BY - 48}, ${BX + 140} ${BY - 38}, ${BX + 140} ${BY}`}
          stroke="#c4a035" strokeWidth="8" strokeLinecap="round" fill="none" />
        {/* Handle shadow/depth */}
        <path d={`M ${BX + 60} ${BY} C ${BX + 60} ${BY - 34}, ${BX + 95} ${BY - 44}, ${BX + 110} ${BY - 44} C ${BX + 125} ${BY - 44}, ${BX + 140} ${BY - 34}, ${BX + 140} ${BY}`}
          stroke="#a07820" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.5" />

        {/* ── D-ring hardware at handle bases ── */}
        {[BX + 60, BX + 140].map((x, i) => (
          <g key={i}>
            <rect x={x - 7} y={BY - 4} width={14} height={10} rx={3}
              fill="url(#hwGold)" stroke="#c4a035" strokeWidth="0.8" />
          </g>
        ))}

        {/* ── Bag body ── */}
        <rect x={BX} y={BY} width={BW} height={BH} rx={BR}
          fill="url(#bagGrad)" stroke="#c4a03580" strokeWidth="1.2" />

        {/* Plaid texture overlay */}
        <rect x={BX} y={BY} width={BW} height={BH} rx={BR}
          fill="url(#plaidH)" opacity="0.07" />
        <rect x={BX} y={BY} width={BW} height={BH} rx={BR}
          fill="url(#plaidV)" opacity="0.07" />

        {/* Highlight sheen (top-left) */}
        <rect x={BX} y={BY} width={BW} height={BH} rx={BR}
          fill="url(#sheen)" opacity="0.18" />

        {/* Body stitching border */}
        <rect x={BX + 8} y={BY + 8} width={BW - 16} height={BH - 16} rx={BR - 4}
          fill="none" stroke="#c4a03530" strokeWidth="1" strokeDasharray="5 4" />

        {/* Center logo plate */}
        <rect x={BX + BW/2 - 22} y={BY + BH/2 - 10} width={44} height={20} rx={5}
          fill="url(#hwGold)" opacity="0.7" />
        <rect x={BX + BW/2 - 22} y={BY + BH/2 - 10} width={44} height={20} rx={5}
          fill="none" stroke="#c4a035" strokeWidth="0.8" />

        {/* ── Bag feet (bottom) ── */}
        {[BX + 28, BX + BW - 28].map((x, i) => (
          <rect key={i} x={x - 6} y={BY + BH - 5} width={12} height={10} rx={3}
            fill="url(#hwGold)" stroke="#a07820" strokeWidth="0.8" />
        ))}

        {/* ── Interior gap (revealed as zipper opens) ── */}
        {/* Dark interior behind gap */}
        <clipPath id="bodyClip">
          <rect x={BX} y={BY} width={BW} height={BH} rx={BR} />
        </clipPath>
        <rect x={BX} y={GAP_TOP} width={BW} height={GAP_H}
          fill="url(#interiorGrad)" clipPath="url(#bodyClip)" />

        {/* Gap reveal — starts at scaleY:0 and opens downward */}
        <foreignObject x={BX} y={GAP_TOP} width={BW} height={GAP_H} clipPath="url(#bodyClip)">
          <motion.div
            animate={gapControls}
            initial={{ scaleY: 0 }}
            style={{
              width: "100%", height: "100%",
              transformOrigin: "top center",
              background: "linear-gradient(180deg, #060010 0%, #110308 60%, #1a0508 100%)",
            }}
          />
        </foreignObject>

        {/* ── Zipper track ── */}
        <line x1={BX + 4} y1={ZIP_Y} x2={BX + BW - 4} y2={ZIP_Y}
          stroke={`${GOLD}cc`} strokeWidth="3" strokeLinecap="round" />
        {/* Teeth pattern */}
        <line x1={BX + 4} y1={ZIP_Y} x2={BX + BW - 4} y2={ZIP_Y}
          stroke="rgba(0,0,0,0.35)" strokeWidth="3"
          strokeDasharray="4 5" strokeLinecap="butt" />

        {/* ── Defs ── */}
        <defs>
          {/* Bag body gradient */}
          <linearGradient id="bagGrad" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%"   stopColor="#8a1e30" />
            <stop offset="35%"  stopColor="#5C0F1E" />
            <stop offset="75%"  stopColor="#3d0f18" />
            <stop offset="100%" stopColor="#280a10" />
          </linearGradient>

          {/* Plaid lines horizontal */}
          <pattern id="plaidH" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="2" y="9" fill="white" />
          </pattern>
          {/* Plaid lines vertical */}
          <pattern id="plaidV" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="2" height="20" x="9" fill="white" />
          </pattern>

          {/* Sheen */}
          <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="white" stopOpacity="0.12" />
            <stop offset="45%"  stopColor="white" stopOpacity="0" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          {/* Gold hardware */}
          <linearGradient id="hwGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#f0d060" />
            <stop offset="50%"  stopColor="#a07820" />
            <stop offset="100%" stopColor="#d4af37" />
          </linearGradient>

          {/* Interior gradient */}
          <linearGradient id="interiorGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#060010" />
            <stop offset="100%" stopColor="#1a0508" />
          </linearGradient>
        </defs>
      </svg>

      {/* Zipper pull — positioned over SVG, slides on track */}
      <motion.div
        animate={zipControls}
        initial={{ x: 0 }}
        style={{
          position: "absolute",
          top: ZIP_Y - 10,        // center pull on track
          left: BX + 2,
          display: "flex", flexDirection: "column", alignItems: "center",
          zIndex: 20,
          pointerEvents: "none",
        }}
      >
        {/* D-ring connector */}
        <div style={{
          width: 10, height: 6, borderRadius: 2,
          background: `linear-gradient(180deg, ${GOLD_LT}, ${GOLD})`,
          border: "0.5px solid rgba(180,140,20,0.8)",
        }} />
        {/* Pull tab body */}
        <div style={{
          width: 16, height: 20, borderRadius: 4, marginTop: 1,
          background: `linear-gradient(145deg, ${GOLD_LT}, ${GOLD}, #a07820)`,
          border: "0.8px solid rgba(180,140,20,0.9)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,240,160,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {/* Engraved line detail */}
          <div style={{ width: 8, height: 1, background: "rgba(0,0,0,0.3)", borderRadius: 1 }} />
        </div>
      </motion.div>
    </div>
  );
}

// expose GOLD_LT at module scope for the pull tab
const GOLD_LT = "#f0d080";
