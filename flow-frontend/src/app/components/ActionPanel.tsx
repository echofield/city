// FLOW — Action Panel: The rich right-side instrument
// Shows the bestNow opportunity with full detail:
// Status dot + timer, big action verb, place + distance,
// window + entry, score chips, context, NAVIGUER button,
// corridors, evidence, earnings estimate.
// This is what makes Flow feel like a game, not a dashboard.

import { motion, AnimatePresence } from "motion/react";
import { C, mono, label } from "./theme";
import {
  phaseDisplay,
  getNextSkeletonTime,
} from "./FlowEngine";
import type {
  FlowState,
  DriverOpportunity,
  CorridorStatus,
  ShiftPhase,
} from "./FlowEngine";

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

function corridorStatusColor(status: CorridorStatus["status"]): string {
  switch (status) {
    case "fluide": return C.textDim;
    case "dense": return C.amber;
    case "plein": return C.red;
  }
}

function windowStateLabel(opp: DriverOpportunity): string {
  if (opp.timerMinutes <= 2) return "FENETRE ACTIVE";
  if (opp.kind === "confirme") return "FENETRE ACTIVE";
  return "EN FORMATION";
}

function windowStateDot(opp: DriverOpportunity): string {
  if (opp.kind === "confirme") return C.green;
  return C.amber;
}

function sourceLabel(source: string): string {
  switch (source) {
    case "event": return "Evenement";
    case "transport": return "Transport";
    case "weather": return "Meteo";
    case "skeleton": return "Habitude";
    case "manual": return "Manuel";
    default: return source;
  }
}

// ── Score Chips (the trading indicators) ──

function ScoreChips({ opp, corridors }: { opp: DriverOpportunity; corridors: CorridorStatus[] }) {
  // OPP: opportunity score from confidence
  const oppScore = Math.round(opp.confidence * 100);
  // TRAF: traffic density from corridor
  const corridor = corridors.find((c) => c.direction === opp.corridor);
  const trafScore = corridor
    ? corridor.status === "plein" ? 85 : corridor.status === "dense" ? 55 : 25
    : 30;
  // COUT: cost = distance in minutes (lower is better, show raw)
  const coutScore = opp.distanceMinutes ?? 0;

  return (
    <div className="flex items-stretch gap-2">
      <div
        className="flex-1 flex flex-col items-center py-2"
        style={{ border: `1px solid ${C.green}30`, borderRadius: 3 }}
      >
        <span
          className="uppercase tracking-[0.15em]"
          style={{ ...label, fontSize: "0.45rem", color: C.textDim }}
        >
          OPP
        </span>
        <span style={{ ...mono, fontSize: "1.1rem", color: C.green, lineHeight: 1.2 }}>
          {oppScore}
        </span>
      </div>
      <div
        className="flex-1 flex flex-col items-center py-2"
        style={{ border: `1px solid ${C.amber}30`, borderRadius: 3 }}
      >
        <span
          className="uppercase tracking-[0.15em]"
          style={{ ...label, fontSize: "0.45rem", color: C.textDim }}
        >
          TRAF
        </span>
        <span style={{ ...mono, fontSize: "1.1rem", color: C.amber, lineHeight: 1.2 }}>
          {trafScore}
        </span>
      </div>
      <div
        className="flex-1 flex flex-col items-center py-2"
        style={{ border: `1px solid ${C.textDim}30`, borderRadius: 3 }}
      >
        <span
          className="uppercase tracking-[0.15em]"
          style={{ ...label, fontSize: "0.45rem", color: C.textDim }}
        >
          COUT
        </span>
        <span style={{ ...mono, fontSize: "1.1rem", color: C.textMid, lineHeight: 1.2 }}>
          {coutScore}
        </span>
      </div>
    </div>
  );
}

// ── EUR/h estimate ──

function EarningsEstimate({ phase }: { phase: ShiftPhase }) {
  const baseRate = phase === "pic" ? 42 : phase === "montee" ? 34 : 26;
  const highRate = baseRate + Math.round(baseRate * 0.35);
  return (
    <div className="flex items-center justify-between">
      <span style={{ ...label, fontSize: "0.55rem", color: C.textDim }}>
        EUR/h estime
      </span>
      <span style={{ ...mono, fontSize: "0.85rem", color: C.green }}>
        {baseRate}<span style={{ color: C.textDim }}>{" -> "}</span>{highRate}
      </span>
    </div>
  );
}

// ── Main Panel ──

interface ActionPanelProps {
  flow: FlowState;
  onNavigate?: () => void;
  onDispatch?: () => void;
  onEndShift?: () => void;
}

export function ActionPanel({ flow, onNavigate, onDispatch, onEndShift }: ActionPanelProps) {
  const opp = flow.opportunities.bestNow;
  const isCalme = !opp;
  const color = actionColor(opp?.action ?? null);

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: C.bg }}
    >
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0 px-4 sm:px-5">
          {isCalme ? (
            /* ── CALME STATE ── */
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <span
                className="uppercase tracking-[0.15em]"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 600,
                  fontSize: "clamp(1.8rem, 6vw, 2.8rem)",
                  color: C.textDim,
                  lineHeight: 0.9,
                }}
              >
                CALME
              </span>
              <span style={{ ...label, fontSize: "0.7rem", color: C.textDim }}>
                Prochain point : {getNextSkeletonTime()}
              </span>
            </div>
          ) : (
            <>
              {/* ── Status line + Timer ── */}
              <div
                className="flex items-center justify-between pt-4 pb-2"
              >
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={opp.kind === "confirme" ? {
                      scale: [1, 1.3, 1],
                      opacity: [0.7, 1, 0.7],
                    } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: windowStateDot(opp),
                    }}
                  />
                  <span
                    className="uppercase tracking-[0.15em]"
                    style={{ ...label, fontSize: "0.5rem", color: windowStateDot(opp) }}
                  >
                    {windowStateLabel(opp)}
                  </span>
                </div>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={opp.timerMinutes}
                    initial={{ opacity: 0.5, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      ...mono,
                      fontSize: "clamp(1.4rem, 4vw, 2rem)",
                      color,
                      lineHeight: 1,
                    }}
                  >
                    {opp.timerMinutes <= 2
                      ? "NOW"
                      : `${String(Math.floor(opp.timerMinutes / 60)).padStart(2, "0")}:${String(opp.timerMinutes % 60).padStart(2, "0")}`}
                  </motion.span>
                </AnimatePresence>
              </div>

              {/* ── ACTION VERB ── */}
              <AnimatePresence mode="wait">
                <motion.h1
                  key={opp.action}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }}
                  transition={{ duration: 0.12 }}
                  className="uppercase tracking-[0.02em]"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    fontSize: "clamp(1.8rem, 6vw, 2.8rem)",
                    color,
                    margin: 0,
                    lineHeight: 0.95,
                    paddingBottom: "0.15em",
                  }}
                >
                  {opp.action.toUpperCase()}
                </motion.h1>
              </AnimatePresence>

              {/* ── PLACE + Arrondissement ── */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={opp.placeLabel}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: 0.03 }}
                  className="flex items-baseline gap-2.5"
                >
                  <span
                    className="uppercase tracking-[0.04em]"
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 500,
                      fontSize: "clamp(1rem, 3.5vw, 1.5rem)",
                      color: C.text,
                      lineHeight: 1.2,
                    }}
                  >
                    {opp.placeLabel}
                  </span>
                  {opp.corridor && (
                    <span
                      className="uppercase tracking-[0.1em]"
                      style={{ ...label, fontSize: "0.65rem", color: C.textDim }}
                    >
                      {opp.corridor.toUpperCase()}
                    </span>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* ── Distance ── */}
              <div className="flex items-center gap-4 mt-1 mb-3">
                {opp.distanceKm != null && (
                  <span style={{ ...mono, fontSize: "0.7rem", color: C.textMid }}>
                    {opp.distanceKm} km
                  </span>
                )}
                {opp.distanceMinutes != null && (
                  <span style={{ ...mono, fontSize: "0.7rem", color: C.textMid }}>
                    {opp.distanceMinutes} min
                  </span>
                )}
              </div>

              {/* ── Window + Entry ── */}
              <div
                className="flex items-center gap-3 mb-3"
                style={{
                  padding: "6px 0",
                }}
              >
                <span style={{ ...mono, fontSize: "0.6rem", color: C.textMid }}>
                  Fenetre{" "}
                  <span style={{ color: C.text, padding: "1px 5px", border: `1px solid ${C.border}`, borderRadius: 2 }}>
                    {opp.window.start}-{opp.window.end}
                  </span>
                </span>
                {opp.entryPoint && (
                  <span style={{ ...mono, fontSize: "0.55rem", color: C.textDim }}>
                    Entree: {opp.entryPoint}
                  </span>
                )}
              </div>

              {/* ── Score Chips ── */}
              <div className="mb-3">
                <ScoreChips opp={opp} corridors={flow.corridors} />
              </div>

              {/* ── Context line ── */}
              <div className="mb-3">
                <span style={{ ...label, fontSize: "0.65rem", color: C.textMid, lineHeight: 1.4 }}>
                  Position {opp.corridor?.toUpperCase() ?? "CENTRE"}.{" "}
                  {opp.placeLabel} {opp.kind === "confirme" ? "confirme" : "en formation"}.
                </span>
              </div>

              {/* ── NAVIGUER Button ── */}
              <motion.button
                onClick={onNavigate}
                className="w-full py-3.5 uppercase tracking-[0.15em] text-center mb-3"
                style={{
                  ...label,
                  fontSize: "clamp(0.75rem, 2vw, 0.9rem)",
                  fontWeight: 500,
                  color: C.bg,
                  backgroundColor: color,
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
                whileTap={{ scale: 0.97 }}
              >
                NAVIGUER {"->"}
              </motion.button>

              {/* ── Corridors compact ── */}
              <div
                className="flex flex-col gap-0 py-2 mb-2"
                style={{ borderTop: `1px solid ${C.border}` }}
              >
                <span
                  className="uppercase tracking-[0.2em] mb-1.5"
                  style={{ ...label, fontSize: "0.4rem", color: C.textDim }}
                >
                  CORRIDORS
                </span>
                <div className="flex items-center gap-3">
                  {flow.corridors.map((c) => (
                    <div key={c.direction} className="flex items-center gap-1.5">
                      <div
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          backgroundColor: corridorStatusColor(c.status),
                        }}
                      />
                      <span
                        className="uppercase tracking-[0.1em]"
                        style={{ ...label, fontSize: "0.45rem", color: corridorStatusColor(c.status) }}
                      >
                        {c.direction}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Window remaining + ride profile ── */}
              <div
                className="flex items-center justify-between py-2"
                style={{ borderTop: `1px solid ${C.border}` }}
              >
                <span style={{ ...label, fontSize: "0.6rem", color: C.textMid }}>
                  Fenetre ouverte — {opp.timerMinutes <= 2 ? "maintenant" : `${opp.timerMinutes} min restantes`}.
                </span>
                {opp.rideProfile && (
                  <span
                    className="uppercase tracking-[0.1em]"
                    style={{
                      ...mono,
                      fontSize: "0.4rem",
                      color: C.textDim,
                      padding: "2px 6px",
                      border: `1px solid ${C.border}`,
                      borderRadius: 2,
                    }}
                  >
                    {opp.rideProfile === "longues" ? "L" : opp.rideProfile === "courtes" ? "C" : "M"}
                  </span>
                )}
              </div>

              {/* ── EUR/h estimate ── */}
              <div className="py-2" style={{ borderTop: `1px solid ${C.border}` }}>
                <EarningsEstimate phase={flow.shiftPhase} />
              </div>

              {/* ── Evidence bullets ── */}
              <div className="flex flex-col gap-1.5 py-2" style={{ borderTop: `1px solid ${C.border}` }}>
                {opp.evidence.map((ev, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        backgroundColor: ev.source === "event" ? C.amber : ev.source === "skeleton" ? C.green : C.textDim,
                      }}
                    />
                    <span style={{ ...label, fontSize: "0.55rem", color: C.textMid }}>
                      {sourceLabel(ev.source)} {ev.ref}
                    </span>
                  </div>
                ))}
                {crowdDisplay(opp.crowd) && (
                  <div className="flex items-center gap-2">
                    <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: C.green }} />
                    <span style={{ ...label, fontSize: "0.55rem", color: C.textMid }}>
                      {opp.why} · {crowdDisplay(opp.crowd)}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Bottom bar: Timeline + Buttons ── */}
      <div className="shrink-0" style={{ borderTop: `1px solid ${C.border}` }}>
        {/* Timeline */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-2">
          {(["calme", "montee", "pic", "sortie"] as ShiftPhase[]).map((p) => {
            const isCurrent = p === flow.shiftPhase;
            const phaseColor = p === "pic" ? C.green : p === "montee" ? C.amber : C.textDim;
            return (
              <div key={p} className="flex items-center gap-1.5">
                <div
                  style={{
                    width: isCurrent ? 6 : 4,
                    height: isCurrent ? 6 : 4,
                    borderRadius: "50%",
                    backgroundColor: isCurrent ? phaseColor : C.textGhost,
                    transition: "all 0.4s",
                  }}
                />
                <span
                  className="uppercase tracking-[0.1em]"
                  style={{
                    ...label,
                    fontSize: "0.45rem",
                    color: isCurrent ? phaseColor : C.textGhost,
                    fontWeight: isCurrent ? 500 : 400,
                  }}
                >
                  {phaseDisplay(p)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div
          className="flex items-center gap-2 px-4 sm:px-5 py-3"
          style={{ borderTop: `1px solid ${C.border}` }}
        >
          <motion.button
            onClick={onDispatch}
            className="flex-1 py-2.5 uppercase tracking-[0.15em] text-center"
            style={{
              ...label,
              fontSize: "0.6rem",
              fontWeight: 500,
              color: C.text,
              backgroundColor: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 3,
              cursor: "pointer",
            }}
            whileTap={{ scale: 0.97 }}
          >
            DISPATCH
          </motion.button>
          <motion.button
            onClick={onEndShift}
            className="py-2.5 px-5 uppercase tracking-[0.15em]"
            style={{
              ...label,
              fontSize: "0.55rem",
              fontWeight: 400,
              color: C.textDim,
              backgroundColor: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 3,
              cursor: "pointer",
            }}
            whileTap={{ scale: 0.97 }}
          >
            FIN SHIFT
          </motion.button>
        </div>
      </div>
    </div>
  );
}