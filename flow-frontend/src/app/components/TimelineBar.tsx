// FLOW v1.6 — Timeline Bar: Arc temporel
// CALME --- MONTE --- PLEIN --- SORTIE
// Le chauffeur voit ou en est la nuit.

import { motion } from "motion/react";
import { C, mono, label } from "./theme";
import type { ShiftPhase } from "./FlowEngine";

const PHASES: { id: ShiftPhase; label: string }[] = [
  { id: "calme", label: "CALME" },
  { id: "montee", label: "MONTE" },
  { id: "pic", label: "PLEIN" },
  { id: "sortie", label: "SORTIE" },
];

function getPhaseColor(phase: ShiftPhase, isCurrent: boolean): string {
  if (!isCurrent) return C.textGhost;
  switch (phase) {
    case "calme": return C.textDim;
    case "montee": return C.amber;
    case "pic": return C.green;
    case "sortie": return C.textDim;
  }
}

export function TimelineBar({
  currentPhase,
  progress,
}: {
  currentPhase: ShiftPhase;
  progress: number;
}) {
  const currentIndex = PHASES.findIndex((p) => p.id === currentPhase);

  return (
    <div className="flex items-center w-full gap-0 px-1 py-2">
      {PHASES.map((phase, i) => {
        const isCurrent = phase.id === currentPhase;
        const isPast = i < currentIndex;
        const color = getPhaseColor(phase.id, isCurrent);
        const dotColor = isCurrent ? color : isPast ? C.textDim : C.textGhost;

        return (
          <div key={phase.id} className="flex items-center flex-1 min-w-0">
            {/* Node */}
            <div className="flex flex-col items-center gap-1 shrink-0" style={{ width: 44 }}>
              <div className="relative flex items-center justify-center">
                {isCurrent && (
                  <motion.div
                    className="absolute"
                    animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      backgroundColor: color,
                    }}
                  />
                )}
                <div
                  style={{
                    width: isCurrent ? 7 : 4,
                    height: isCurrent ? 7 : 4,
                    borderRadius: "50%",
                    backgroundColor: dotColor,
                    transition: "all 0.5s ease",
                    boxShadow: isCurrent ? `0 0 8px ${color}60` : "none",
                  }}
                />
              </div>
              <span
                className="uppercase tracking-[0.1em]"
                style={{
                  ...label,
                  fontSize: "0.45rem",
                  color: isCurrent ? color : isPast ? C.textDim : C.textGhost,
                  fontWeight: isCurrent ? 500 : 400,
                  transition: "color 0.4s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {phase.label}
              </span>
            </div>

            {/* Connector line */}
            {i < PHASES.length - 1 && (
              <div className="flex-1 relative" style={{ height: 1, marginTop: -10 }}>
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 1,
                    backgroundColor: C.textGhost,
                  }}
                />
                {isPast && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      height: 1,
                      backgroundColor: C.textDim,
                    }}
                  />
                )}
                {isCurrent && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, Math.max(0, ((progress % 0.25) / 0.25) * 100))}%`,
                    }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      height: 1,
                      backgroundColor: color,
                    }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
