// FLOW — Quick Glance Mode
// Ultra-simplified screen for dashboard-mounted phones.
// Shows ONLY: action + venue + time + signal strength.
// Readable in <1 second. Like a road sign.
// Tap → NAVIGUER. Swipe down / tap X → exit.
// Zero emoji. Color is the only language.

import { useCallback } from "react";
import { motion } from "motion/react";
import { C, mono, label } from "./theme";
import type { FlowSignal } from "./FlowEngine";

function wazeUrl(lat?: number, lng?: number): string | null {
  if (!lat || !lng) return null;
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

function strengthLabel(confidence: number): { text: string; color: string } {
  const score = Math.round(confidence * 100);
  if (score >= 85) return { text: "FORT", color: C.green };
  if (score >= 70) return { text: "BON", color: C.green };
  if (score >= 50) return { text: "MOYEN", color: C.amber };
  return { text: "FAIBLE", color: C.textDim };
}

interface GlanceModeProps {
  signal: FlowSignal | null;
  onExit: () => void;
}

export function GlanceMode({ signal, onExit }: GlanceModeProps) {
  const navUrl = signal ? wazeUrl(signal.lat, signal.lng) : null;
  const strength = signal ? strengthLabel(signal.confidence) : { text: "CALME", color: C.textGhost };
  const score = signal ? Math.round(signal.confidence * 100) : 0;

  const handleNav = useCallback(() => {
    if (navUrl) window.open(navUrl, "_blank");
  }, [navUrl]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ backgroundColor: C.bg }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Exit button — top right */}
      <button
        onClick={onExit}
        className="absolute top-4 right-4 p-2"
        style={{
          backgroundColor: "transparent",
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        <span style={{ ...mono, fontSize: "0.6rem", color: C.textDim }}>{"\u2715"}</span>
      </button>

      {/* GLANCE label — top left */}
      <div className="absolute top-4 left-4">
        <span
          className="uppercase tracking-[0.4em]"
          style={{ ...mono, fontSize: "0.35rem", color: C.textGhost }}
        >
          GLANCE
        </span>
      </div>

      {signal ? (
        <div className="flex flex-col items-center gap-6 px-8 w-full max-w-md" onClick={handleNav}>
          {/* ACTION — huge */}
          <span
            className="uppercase text-center"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: "clamp(2rem, 10vw, 3.5rem)",
              color: C.green,
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
            }}
          >
            {signal.action}
          </span>

          {/* VENUE — large */}
          <span
            className="uppercase text-center"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: "clamp(1rem, 5vw, 1.8rem)",
              color: C.textBright,
              lineHeight: 1.1,
              letterSpacing: "0.02em",
            }}
          >
            {signal.venue_name ?? signal.zone}
          </span>

          {/* TIME — monospace */}
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "clamp(1.5rem, 7vw, 2.5rem)",
              color: C.textMid,
              lineHeight: 1,
              letterSpacing: "0.05em",
            }}
          >
            {signal.proximity_minutes} MIN
          </span>

          {/* SIGNAL STRENGTH — score + word */}
          <div className="flex items-center gap-3">
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "clamp(1.2rem, 5vw, 2rem)",
                color: strength.color,
                lineHeight: 1,
              }}
            >
              {score}
            </span>
            <span
              className="uppercase tracking-[0.2em]"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: "clamp(0.8rem, 3vw, 1.2rem)",
                color: strength.color,
                lineHeight: 1,
              }}
            >
              {strength.text}
            </span>
          </div>

          {/* TAP indicator */}
          {navUrl && (
            <motion.div
              className="mt-4"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              <span
                className="uppercase tracking-[0.3em]"
                style={{ ...label, fontSize: "0.5rem", color: C.textGhost }}
              >
                TAP POUR NAVIGUER
              </span>
            </motion.div>
          )}
        </div>
      ) : (
        /* CALME glance */
        <div className="flex flex-col items-center gap-4">
          <span
            className="uppercase"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: "clamp(2.5rem, 12vw, 4rem)",
              color: C.textGhost,
              lineHeight: 0.9,
              letterSpacing: "-0.02em",
            }}
          >
            CALME
          </span>
          <span style={{ ...label, fontSize: "0.7rem", color: C.textDim }}>
            Aucun signal actif
          </span>
        </div>
      )}
    </motion.div>
  );
}
