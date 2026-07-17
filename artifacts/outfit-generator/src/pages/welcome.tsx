/**
 * WelcomePage — Handbag zoom-in animation.
 *
 * SPLASH : top-down view of an open handbag with app branding.
 * ZOOMING: camera falls into the bag — scale rockets up, bag fades.
 * HERO   : hero image crossfades in at peak zoom.
 * EXITING: whole screen fades out → onEnter().
 */

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "splash" | "zooming" | "hero" | "exiting";

const ZOOM_DURATION_MS  = 1300;
const HERO_FADE_START   = 0.55;  // fraction of zoom when hero begins fading in
const HERO_CROSSFADE_MS = 900;
const HOLD_MS           = 500;
const EXIT_DURATION_MS  = 700;

interface Props { onEnter: () => void; }

export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase]           = useState<Phase>("splash");
  const [heroVisible, setHeroVisible] = useState(false);
  const calledRef = useRef(false);

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleTap = () => {
    if (phase !== "splash") return;
    setPhase("zooming");

    setTimeout(() => setHeroVisible(true), ZOOM_DURATION_MS * HERO_FADE_START);
    setTimeout(() => setPhase("hero"),    ZOOM_DURATION_MS + HERO_CROSSFADE_MS * 0.4);
    setTimeout(() => setPhase("exiting"), ZOOM_DURATION_MS + HERO_CROSSFADE_MS + HOLD_MS);
    setTimeout(finish,                    ZOOM_DURATION_MS + HERO_CROSSFADE_MS + HOLD_MS + EXIT_DURATION_MS);
  };

  const isZooming = phase === "zooming" || phase === "hero";
  const isExiting = phase === "exiting";

  return (
    <motion.div
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: EXIT_DURATION_MS / 1000, ease: "easeIn" }}
      onClick={phase === "splash" ? handleTap : undefined}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "#0d0218",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: phase === "splash" ? "pointer" : "default",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 55% at 50% 45%, rgba(90,20,130,0.4) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Hero image — fades in behind the zooming bag */}
      <motion.img
        src="/handbag-hero.jpg"
        alt="Handbag collection"
        draggable={false}
        animate={{ opacity: heroVisible ? 1 : 0 }}
        transition={{ duration: HERO_CROSSFADE_MS / 1000, ease: "easeOut" }}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          zIndex: 1,
        }}
      />

      {/* Bag + branding — zooms into screen on tap */}
      <motion.div
        animate={
          isZooming
            ? { scale: 16, opacity: 0 }
            : { scale: 1,  opacity: 1 }
        }
        transition={
          isZooming
            ? { duration: ZOOM_DURATION_MS / 1000, ease: [0.25, 0, 0.85, 1] }
            : { duration: 0 }
        }
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Top-down open handbag SVG */}
        <TopDownBag />

        {/* Branding */}
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <div
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontWeight: 700,
              fontSize: "clamp(18px, 5.5vw, 26px)",
              letterSpacing: "0.08em",
              color: "#f0d080",
              textShadow: "0 0 28px rgba(212,175,55,0.5), 0 2px 8px rgba(0,0,0,0.9)",
              lineHeight: 1.25,
            }}
          >
            MY DIGITAL
            <br />
            HANDBAGS
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "rgba(212,175,55,0.45)",
              marginTop: 7,
            }}
          >
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
                  fontSize: 10,
                  letterSpacing: "0.22em",
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
      </motion.div>

      {/* Footer links */}
      <div
        style={{
          position: "fixed",
          bottom: "calc(env(safe-area-inset-bottom) + 10px)",
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          zIndex: 210,
        }}
      >
        <a
          href="https://classy-alpaca-441.notion.site/Privacy-Policy-39682db6065380b19dedcb108d4a0ef4"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "rgba(255,255,255,0.22)",
            textDecoration: "none",
            letterSpacing: "0.02em",
          }}
        >
          Privacy Policy
        </a>
        <a
          href="https://app.notion.com/p/My-Digital-Closet-Support-39782db60653802a9088dcbae84c0527?source=copy_link"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "rgba(255,255,255,0.22)",
            textDecoration: "none",
            letterSpacing: "0.02em",
          }}
        >
          Support
        </a>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Top-down open handbag — SVG illustration
   Viewed from directly above, bag is open.
   Interior is the focal point the camera dives into.
───────────────────────────────────────────── */
function TopDownBag() {
  const W = 220;
  const H = 200;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "drop-shadow(0 12px 40px rgba(0,0,0,0.8))" }}
    >
      {/* ── Handles (top arcs) ── */}
      {/* Left handle */}
      <path
        d="M 62 68 C 52 30, 30 22, 30 48"
        stroke="#c4a035"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      {/* Right handle */}
      <path
        d="M 158 68 C 168 30, 190 22, 190 48"
        stroke="#c4a035"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />

      {/* ── Bag body (exterior) ── */}
      <rect
        x="38" y="60"
        width="144" height="124"
        rx="18" ry="18"
        fill="url(#bagBody)"
        stroke="#c4a035"
        strokeWidth="1.5"
        opacity="0.9"
      />

      {/* ── Open interior ── */}
      <ellipse
        cx="110" cy="130"
        rx="58" ry="50"
        fill="url(#interiorGrad)"
      />

      {/* Interior depth rim */}
      <ellipse
        cx="110" cy="130"
        rx="58" ry="50"
        fill="none"
        stroke="rgba(212,175,55,0.2)"
        strokeWidth="1"
      />

      {/* Interior pocket line suggestion */}
      <line
        x1="68" y1="155"
        x2="152" y2="155"
        stroke="rgba(180,140,60,0.15)"
        strokeWidth="1"
      />

      {/* Inner glow centre — the "void" camera dives into */}
      <ellipse
        cx="110" cy="128"
        rx="30" ry="26"
        fill="url(#innerVoid)"
        opacity="0.9"
      />

      {/* ── Top clasp / turnlock hardware ── */}
      {/* Clasp bar */}
      <rect
        x="94" y="58"
        width="32" height="10"
        rx="5"
        fill="url(#claspGold)"
        stroke="rgba(255,220,100,0.4)"
        strokeWidth="0.5"
      />
      {/* Centre stud */}
      <circle
        cx="110" cy="63"
        r="4"
        fill="url(#studGold)"
        stroke="rgba(255,240,160,0.5)"
        strokeWidth="0.5"
      />

      {/* ── Subtle body stitching lines ── */}
      <rect
        x="46" y="68"
        width="128" height="108"
        rx="14"
        fill="none"
        stroke="rgba(212,175,55,0.12)"
        strokeWidth="1"
        strokeDasharray="4 3"
      />

      {/* ── Shimmer sweep over body ── */}
      <rect
        x="38" y="60"
        width="144" height="124"
        rx="18"
        fill="url(#shimmer)"
        opacity="0.4"
      />

      {/* ── Gradient defs ── */}
      <defs>
        {/* Bag exterior body */}
        <linearGradient id="bagBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#5a1a2e" />
          <stop offset="40%"  stopColor="#3d0f1f" />
          <stop offset="100%" stopColor="#220a12" />
        </linearGradient>

        {/* Open interior — dark suede feel */}
        <radialGradient id="interiorGrad" cx="50%" cy="45%" r="55%">
          <stop offset="0%"   stopColor="#1a0a22" />
          <stop offset="55%"  stopColor="#110618" />
          <stop offset="100%" stopColor="#0a0212" />
        </radialGradient>

        {/* Deep void the camera dives into */}
        <radialGradient id="innerVoid" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#060010" stopOpacity="1" />
          <stop offset="100%" stopColor="#110618" stopOpacity="0" />
        </radialGradient>

        {/* Clasp gold */}
        <linearGradient id="claspGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#f0d060" />
          <stop offset="50%"  stopColor="#a07820" />
          <stop offset="100%" stopColor="#d4af37" />
        </linearGradient>

        {/* Stud gold */}
        <radialGradient id="studGold" cx="35%" cy="30%" r="60%">
          <stop offset="0%"   stopColor="#fff0a0" />
          <stop offset="100%" stopColor="#8a6010" />
        </radialGradient>

        {/* Shimmer highlight */}
        <linearGradient id="shimmer" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="white" stopOpacity="0.06" />
          <stop offset="40%"  stopColor="white" stopOpacity="0.0"  />
          <stop offset="100%" stopColor="white" stopOpacity="0.0"  />
        </linearGradient>
      </defs>
    </svg>
  );
}
