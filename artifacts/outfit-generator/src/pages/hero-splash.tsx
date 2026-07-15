/**
 * HeroSplash — full-screen hero image shown once on first launch.
 * Fades in, holds for 2.5 s, then fades out into the welcome screen.
 * Tap anywhere to skip ahead.
 */
import { useEffect } from "react";
import { motion } from "framer-motion";

interface Props {
  onContinue: () => void;
}

const HOLD_MS = 1000; // how long the image stays fully visible

export default function HeroSplash({ onContinue }: Props) {
  // Auto-advance after hold period — ref avoids resetting timer if parent re-renders
  useEffect(() => {
    const t = setTimeout(onContinue, HOLD_MS);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      onClick={onContinue}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        cursor: "pointer",
        background: "#1a0a10",
      }}
    >
      {/* Full-screen hero image */}
      <img
        src="/hero-splash.jpg"
        alt="My Digital Vanity"
        draggable={false}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center top",
          userSelect: "none",
          pointerEvents: "none",
        }}
      />

      {/* Same title text as the lights page */}
      <div
        style={{
          position: "absolute",
          top: "36%",
          left: 0,
          right: 0,
          zIndex: 10,
          textAlign: "center",
          pointerEvents: "none",
          padding: "0 48px",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display, serif)",
            fontWeight: 900,
            fontSize: "clamp(28px, 8vw, 40px)",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            color: "#1a0a10",
            textShadow: "0 2px 12px rgba(0,0,0,0.25)",
          }}
        >
          Welcome to
          <br />
          My Digital Vanity
        </div>
      </div>
    </motion.div>
  );
}
