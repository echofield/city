// FLOW v2 — Dispatch: Macro corridor intelligence
// Simplified. No fake stats. Just corridor status + shift phase.
// Helps drivers understand macro city movement, not micro actions.

import { motion, AnimatePresence } from "motion/react";
import { C, mono, label } from "./theme";
import { phaseDisplay } from "./FlowEngine";
import type { ShiftPhase, CorridorStatus } from "./FlowEngine";

interface DispatchModalProps {
  corridors: CorridorStatus[];
  phase: ShiftPhase;
  open: boolean;
  onClose: () => void;
  // Keep session for compatibility but don't render fake stats
  session?: unknown;
}

export function DispatchModal({
  corridors,
  phase,
  open,
  onClose,
}: DispatchModalProps) {
  const phaseColor = phase === "pic" ? C.green : phase === "montee" ? C.amber : C.textDim;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.82)" }}
            onClick={onClose}
            initial={{ backdropFilter: "blur(0px)" }}
            animate={{ backdropFilter: "blur(4px)" }}
            exit={{ backdropFilter: "blur(0px)" }}
          />

          {/* Panel */}
          <motion.div
            className="relative w-full sm:max-w-[400px] max-h-[70vh] overflow-y-auto"
            style={{
              backgroundColor: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: "6px 6px 0 0",
            }}
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
              style={{
                borderBottom: `1px solid ${C.border}`,
                backgroundColor: C.bg,
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="uppercase tracking-[0.3em]"
                  style={{ ...label, fontSize: "0.6rem", fontWeight: 500, color: C.text }}
                >
                  DISPATCH
                </span>
                <span
                  className="uppercase tracking-[0.15em]"
                  style={{
                    ...mono,
                    fontSize: "0.45rem",
                    color: phaseColor,
                    padding: "1px 5px",
                    border: `1px solid ${phaseColor}40`,
                    borderRadius: 2,
                  }}
                >
                  {phaseDisplay(phase)}
                </span>
              </div>
              <motion.button
                onClick={onClose}
                style={{
                  ...label,
                  fontSize: "0.5rem",
                  color: C.textDim,
                  backgroundColor: "transparent",
                  border: `1px solid ${C.border}`,
                  borderRadius: 3,
                  padding: "4px 12px",
                  cursor: "pointer",
                }}
                className="uppercase tracking-[0.15em]"
                whileTap={{ scale: 0.95 }}
              >
                FERMER
              </motion.button>
            </div>

            {/* Content: just AXES */}
            <div className="flex flex-col gap-4 px-5 py-5">
              <span
                className="uppercase tracking-[0.25em]"
                style={{ ...label, fontSize: "0.45rem", color: C.textDim }}
              >
                AXES
              </span>

              {/* Corridor rows — larger, clearer */}
              <div className="flex flex-col gap-0">
                {corridors.map((c) => {
                  const statusColor =
                    c.status === "plein" ? C.red
                      : c.status === "dense" ? C.amber
                        : C.textDim;
                  const statusDot =
                    c.status === "plein" ? "\u25C9"
                      : c.status === "dense" ? "\u25CF"
                        : "\u25CB";

                  return (
                    <div
                      key={c.direction}
                      className="flex items-center justify-between py-3"
                      style={{ borderBottom: `1px solid ${C.border}` }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="uppercase tracking-[0.2em] w-14"
                          style={{ ...label, fontSize: "0.65rem", color: C.textMid }}
                        >
                          {c.direction}
                        </span>
                        <span style={{ fontSize: "0.65rem", color: statusColor }}>{statusDot}</span>
                        <span
                          className="uppercase tracking-[0.12em]"
                          style={{ ...label, fontSize: "0.6rem", color: statusColor }}
                        >
                          {c.status}
                        </span>
                      </div>
                      {c.reason && (
                        <span
                          style={{ ...label, fontSize: "0.5rem", color: C.textDim, maxWidth: "40%" }}
                          className="text-right"
                        >
                          {c.reason}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}