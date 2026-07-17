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
        background: "#d8ccb4",
      }}
    >
      {/* ── Scrollable column: image + CTA panel ── */}
      <motion.div
        animate={phase === "zooming" ? { scale: 1.14, opacity: 0 } : { scale: 1, opacity: 1 }}
        initial={{ scale: 1.03, opacity: 0 }}
        transition={
          phase === "zooming"
            ? { duration: ZOOM_MS / 1000, ease: [0.4, 0, 1, 1] }
            : { duration: 1.0, ease: "easeOut" }
        }
        style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        {/* Hero image — full width, natural square ratio */}
        <img
          src="/hero-home.jpg"
          alt="My Digital Home"
          draggable={false}
          style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", objectPosition: "center top", display: "block", flexShrink: 0 }}
        />

        {/* CTA panel — fills remaining height below the image */}
        <div style={{
          flex: 1,
          background: "linear-gradient(to bottom, #d4c9ab, #bfb698)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 18, paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
        }}>
          <div style={{
            fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase",
            color: "rgba(60,52,30,0.6)", fontWeight: 600,
          }}>
            your collection, curated
          </div>

          <AnimatePresence>
            {phase === "splash" && (
              <motion.div
                key="enter-btn"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                style={{
                  background: "#6B7A52",
                  borderRadius: 30,
                  padding: "14px 52px",
                  color: "#ffffff",
                  fontSize: 15, fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  boxShadow: "0 4px 18px rgba(60,70,40,0.35)",
                  cursor: "pointer",
                }}
              >
                Enter My Home
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{
            fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
            color: "rgba(60,52,30,0.4)",
          }}>
            tap anywhere to open
          </div>
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
