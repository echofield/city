// FLOW v1.6 — Read Mode: L'instrument de terrain
// <1 second comprehension. Timer label + Action + Place + Why + Confidence + "Ouvrir radar"
// NO list, NO map, NO scrolling.
// The driver glances. The driver decides.

import { motion, AnimatePresence } from "motion/react";
import { C, mono, label } from "./theme";
import { phaseDisplay, confidenceLabel, getNextSkeletonTime } from "./FlowEngine";
import type { FlowState, DriverOpportunity } from "./FlowEngine";

// ── Color grammar ──

function actionColor(action: DriverOpportunity["action"] | null): string {
  if (!action) return C.textDim;
  switch (action) {
    case "rejoindre": return C.green;
    case "anticiper": return C.amber;
    case "maintenir": return C.textMid;
    case "contourner": return C.red;
    case "tenter": return C.amber;
  }
}

function confColor(conf: number): string {
  if (conf >= 0.8) return C.green;
  if (conf >= 0.65) return C.amber;
  return C.textDim;
}

function crowdDisplay(crowd?: DriverOpportunity["crowd"]): string | null {
  if (!crowd) return null;
  if (crowd.value) {
    if (crowd.value >= 10000) return `~${Math.round(crowd.value / 1000)}k`;
    if (crowd.value >= 1000) return `~${(crowd.value / 1000).toFixed(1)}k`;
    return `~${crowd.value}`;
  }
  if (crowd.band) return crowd.band;
  return null;
}

// ── Props ──

interface ReadModeProps {
  flow: FlowState;
  onSwitchToRadar: () => void;
}

// ── Component ──

export function ReadMode({ flow, onSwitchToRadar }: ReadModeProps) {
  const opp = flow.opportunities.bestNow;
  const isCalme = !opp;
  const color = actionColor(opp?.action ?? null);
  const conf = opp?.confidence ?? 0;

  return (
    <motion.div
      className="h-screen w-screen flex flex-col overflow-hidden relative"
      style={{ backgroundColor: C.bg }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* ─── TOP BAR: phase + session earnings ─── */}
      <div
        className="shrink-0 flex items-center justify-between px-5 py-2.5"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={
              flow.shiftPhase === "pic"
                ? { scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }
                : {}
            }
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              backgroundColor: color,
            }}
          />
          <span
            className="uppercase tracking-[0.15em]"
            style={{ ...label, fontSize: "0.5rem", color: C.textDim }}
          >
            {flow.copy.phaseLabel}
          </span>
        </div>
        <span style={{ ...mono, fontSize: "0.7rem", color: C.green }}>
          {flow.sessionEarnings} EUR
        </span>
      </div>

      {/* ─── CORE: the instrument ─── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-1 min-h-0">
        {isCalme ? (
          /* ── CALME STATE ── */
          <motion.div
            className="flex flex-col items-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <span
              className="uppercase tracking-[0.2em]"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: "clamp(2.2rem, 10vw, 4rem)",
                color: C.textDim,
                lineHeight: 0.9,
              }}
            >
              CALME
            </span>
            <span style={{ ...label, fontSize: "0.7rem", color: C.textDim }}>
              Prochain point : {getNextSkeletonTime()}
            </span>
          </motion.div>
        ) : (
          /* ── ACTIVE STATE ── */
          <>
            {/* Timer label */}
            <AnimatePresence mode="wait">
              <motion.span
                key={opp.timerLabel}
                initial={{ opacity: 0.6 }}
                animate={{ opacity: 1 }}
                style={{
                  ...label,
                  fontSize: "clamp(0.7rem, 2.2vw, 0.85rem)",
                  color,
                  letterSpacing: "0.04em",
                  lineHeight: 1,
                }}
              >
                {opp.timerLabel}
              </motion.span>
            </AnimatePresence>

            <div className="h-3" />

            {/* ACTION WORD — the biggest thing on screen */}
            <AnimatePresence mode="wait">
              <motion.h1
                key={opp.action}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.12 }}
                className="uppercase tracking-[0.04em] text-center"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 600,
                  fontSize: "clamp(2.2rem, 10vw, 4rem)",
                  color,
                  margin: 0,
                  lineHeight: 0.9,
                }}
              >
                {opp.action.toUpperCase()}
              </motion.h1>
            </AnimatePresence>

            {/* PLACE */}
            <AnimatePresence mode="wait">
              <motion.div
                key={opp.placeLabel}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15, delay: 0.04 }}
                className="flex items-baseline gap-2 mt-1"
              >
                <span
                  className="uppercase tracking-[0.08em]"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 400,
                    fontSize: "clamp(1rem, 3.5vw, 1.4rem)",
                    color: C.text,
                    lineHeight: 1.2,
                  }}
                >
                  {opp.placeLabel}
                </span>
                {opp.distanceMinutes && (
                  <span style={{ ...mono, fontSize: "0.55rem", color: C.textDim }}>
                    {opp.distanceMinutes} min
                  </span>
                )}
              </motion.div>
            </AnimatePresence>

            {/* WHY — one line, no label, just the concrete trigger */}
            <motion.div
              className="mt-3 flex flex-col items-center gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.9 }}
              transition={{ delay: 0.08 }}
            >
              <span
                style={{
                  ...label,
                  fontSize: "clamp(0.7rem, 2.2vw, 0.85rem)",
                  fontWeight: 400,
                  color: C.text,
                  lineHeight: 1.2,
                  textAlign: "center",
                }}
              >
                {opp.why}
                {crowdDisplay(opp.crowd) && (
                  <span style={{ color: C.textDim }}>
                    {" "}· {crowdDisplay(opp.crowd)}
                  </span>
                )}
              </span>

              {/* Confidence — small, minimal */}
              <div className="flex items-center gap-2 mt-1">
                <div
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    backgroundColor: confColor(conf),
                  }}
                />
                <span style={{ ...mono, fontSize: "0.5rem", color: confColor(conf) }}>
                  {confidenceLabel(conf)}
                </span>
              </div>
            </motion.div>
          </>
        )}
      </div>

      {/* ─── KIND badge ─── */}
      {opp && (
        <div className="shrink-0 flex justify-center pb-2">
          <span
            className="uppercase tracking-[0.15em]"
            style={{
              ...mono,
              fontSize: "0.4rem",
              color: opp.kind === "confirme" ? C.greenDim : C.amberDim,
              padding: "2px 8px",
              border: `1px solid ${opp.kind === "confirme" ? C.greenDim : C.amberDim}`,
              borderRadius: 2,
            }}
          >
            {opp.kind === "confirme" ? "CONFIRME" : "PISTE"}
          </span>
        </div>
      )}

      {/* ─── STALE indicator ─── */}
      {flow.meta.stale && (
        <div className="shrink-0 flex justify-center pb-1">
          <span
            style={{
              ...mono,
              fontSize: "0.4rem",
              color: C.amber,
            }}
          >
            Derniere MAJ : {new Date(flow.meta.compiledAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      )}

      {/* ─── CTA: OUVRIR RADAR ─── */}
      <div
        className="shrink-0 px-5 pb-5 pt-3"
        style={{ borderTop: `1px solid ${C.border}` }}
      >
        <motion.button
          onClick={onSwitchToRadar}
          className="w-full py-3 uppercase tracking-[0.2em] text-center"
          style={{
            ...label,
            fontSize: "clamp(0.65rem, 1.8vw, 0.8rem)",
            fontWeight: 400,
            color: C.textDim,
            backgroundColor: "transparent",
            border: `1px solid ${C.border}`,
            borderRadius: 3,
            cursor: "pointer",
          }}
          whileTap={{ scale: 0.95 }}
        >
          OUVRIR RADAR
        </motion.button>
      </div>

      {/* Breathing phase line */}
      <motion.div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 2, backgroundColor: color }}
        animate={{ opacity: [0.1, 0.35, 0.1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}
