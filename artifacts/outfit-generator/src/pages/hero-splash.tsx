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
            fontSize: "clamp(30px, 9vw, 44px)",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            color: "#fff8ee",
            textShadow: "0 0 28px rgba(255,210,100,0.55), 0 2px 10px rgba(0,0,0,0.7)",
          }}
        >
          MY DIGITAL
          <br />
          VANITY
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(255,230,180,0.6)",
          }}
        >
          your beauty collection
        </div>
      </div>
    </motion.div>
  );
}
