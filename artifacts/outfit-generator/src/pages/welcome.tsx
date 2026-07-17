/**
 * WelcomePage — Hero image splash with zoom-in entrance animation.
 *
 * SPLASH   : Full-screen hero room photo with branding overlay.
 * ZOOMING  : Image scales up and fades — camera "enters" the home.
 * EXITING  : Whole screen fades out → onEnter().
 */

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "splash" | "zooming" | "exiting";

const ZOOM_MS = 1100;
const HOLD_MS = 200;
const EXIT_MS = 600;

interface Props { onEnter: () => void; }

export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase] = useState<Phase>("splash");
  const calledRef = useRef(false);

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleTap = () => {
    if (phase !== "splash") return;
    setPhase("zooming");
    setTimeout(() => setPhase("exiting"), ZOOM_MS + HOLD_MS);
    setTimeout(finish, ZOOM_MS + HOLD_MS + EXIT_MS);
  };

  return (
    <motion.div
      animate={{ opacity: phase === "exiting" ? 0 : 1 }}
      transition={{ duration: EXIT_MS / 1000, ease: "easeIn" }}
      onClick={phase === "splash" ? handleTap : undefined}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        cursor: phase === "splash" ? "pointer" : "default",
        overflow: "hidden",
        background: "#1a2218",
      }}
    >
      {/* ── Hero image — zooms on tap ── */}
      <motion.img
        src="/hero-home.png"
        alt="My Digital Home"
        draggable={false}
        animate={phase === "zooming" ? { scale: 1.18, opacity: 0 } : { scale: 1, opacity: 1 }}
        initial={{ scale: 1.06, opacity: 0 }}
        transition={
          phase === "zooming"
            ? { duration: ZOOM_MS / 1000, ease: [0.4, 0, 1, 1] }
            : { duration: 1.1, ease: "easeOut" }
        }
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "center top",
        }}
      />

      {/* ── Dark gradient overlay for text legibility ── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: [
          "linear-gradient(to bottom,",
          "  rgba(15,20,12,0.55) 0%,",
          "  rgba(15,20,12,0.10) 38%,",
          "  rgba(15,20,12,0.10) 62%,",
          "  rgba(15,20,12,0.75) 100%",
          ")"
        ].join(" "),
      }} />

      {/* ── Top branding ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
        style={{
          position: "absolute", top: "calc(env(safe-area-inset-top) + 52px)",
          left: 0, right: 0,
          display: "flex", flexDirection: "column", alignItems: "center",
          pointerEvents: "none", zIndex: 10,
        }}
      >
        <div style={{
          fontFamily: "'Great Vibes', cursive",
          fontWeight: 400,
          fontSize: "clamp(42px, 13vw, 62px)",
          color: "#ffffff",
          textShadow: "0 2px 24px rgba(0,0,0,0.7), 0 1px 6px rgba(0,0,0,0.9)",
          lineHeight: 1.1,
          textAlign: "center",
        }}>
          My Digital<br />Home
        </div>
        <div style={{
          fontSize: 10, fontWeight: 600,
          letterSpacing: "0.30em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.65)", marginTop: 8,
          textShadow: "0 1px 6px rgba(0,0,0,0.8)",
        }}>
          your collection, curated
        </div>
      </motion.div>

      {/* ── Bottom CTA ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.7, ease: "easeOut" }}
        style={{
          position: "absolute",
          bottom: "calc(env(safe-area-inset-bottom) + 88px)",
          left: 0, right: 0,
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 14, zIndex: 10, pointerEvents: "none",
        }}
      >
        {/* Enter button */}
        <AnimatePresence>
          {phase === "splash" && (
            <motion.div
              key="enter-btn"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.35 }}
              style={{
                background: "rgba(107,122,82,0.92)",
                border: "1.5px solid rgba(255,255,255,0.35)",
                borderRadius: 28,
                padding: "13px 44px",
                color: "#ffffff",
                fontSize: 15, fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
                backdropFilter: "blur(6px)",
                pointerEvents: "auto",
                cursor: "pointer",
              }}
            >
              Enter My Home
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{
          fontSize: 10, letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.45)",
          textShadow: "0 1px 4px rgba(0,0,0,0.7)",
        }}>
          tap to open
        </div>
      </motion.div>

      {/* ── Footer links ── */}
      <div style={{
        position: "fixed", bottom: "calc(env(safe-area-inset-bottom) + 10px)",
        left: 0, right: 0, display: "flex", flexDirection: "column",
        alignItems: "center", gap: 4, zIndex: 210,
      }}>
        <a href="https://classy-alpaca-441.notion.site/Privacy-Policy-39682db6065380b19dedcb108d4a0ef4"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.30)", textDecoration: "none", letterSpacing: "0.02em" }}>
          Privacy Policy
        </a>
        <a href="https://app.notion.com/p/My-Digital-Closet-Support-39782db60653802a9088dcbae84c0527?source=copy_link"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.30)", textDecoration: "none", letterSpacing: "0.02em" }}>
          Support
        </a>
      </div>
    </motion.div>
  );
}
