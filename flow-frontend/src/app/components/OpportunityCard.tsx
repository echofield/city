// FLOW v1.6 — Opportunity Card: tap-to-reveal explain card
// Layer 1: why + window + confidence
// Layer 2: cause breakdown (event/weather/transport/skeleton)
// Layer 3: corridor + distance
// Compact. Factual. Trustworthy.

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { C, mono, label } from "./theme";
import { confidenceLabel } from "./FlowEngine";
import type { DriverOpportunity } from "./FlowEngine";

function actionColor(action: DriverOpportunity["action"]): string {
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

function sourceColor(source: string): string {
  switch (source) {
    case "event": return C.amber;
    case "transport": return C.textMid;
    case "weather": return "#6688aa";
    case "skeleton": return C.textDim;
    case "manual": return C.green;
    default: return C.textDim;
  }
}

interface OpportunityCardProps {
  opp: DriverOpportunity;
  rank?: "best" | "alt" | "upcoming" | "peak";
  compact?: boolean;
}

export function OpportunityCard({ opp, rank = "alt", compact = false }: OpportunityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const color = actionColor(opp.action);
  const isBest = rank === "best";
  const crowd = crowdDisplay(opp.crowd);

  return (
    <motion.div
      layout
      onClick={() => setExpanded(!expanded)}
      className="flex flex-col cursor-pointer"
      style={{
        backgroundColor: isBest ? `${color}08` : C.surface,
        border: `1px solid ${isBest ? `${color}30` : C.border}`,
        borderRadius: 3,
        overflow: "hidden",
      }}
      whileTap={{ scale: 0.99 }}
    >
      {/* ── Always visible: action + place + timer ── */}
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Action dot */}
          <div
            style={{
              width: isBest ? 6 : 4,
              height: isBest ? 6 : 4,
              borderRadius: "50%",
              backgroundColor: color,
              flexShrink: 0,
              boxShadow: isBest ? `0 0 8px ${color}40` : "none",
            }}
          />
          {/* Action + place */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-baseline gap-2">
              <span
                className="uppercase tracking-[0.1em]"
                style={{
                  ...label,
                  fontSize: isBest ? "0.75rem" : "0.65rem",
                  fontWeight: 500,
                  color,
                }}
              >
                {opp.action.toUpperCase()}
              </span>
              <span
                className="uppercase tracking-[0.05em]"
                style={{
                  ...label,
                  fontSize: isBest ? "0.75rem" : "0.65rem",
                  fontWeight: 400,
                  color: C.text,
                }}
              >
                {opp.placeLabel}
              </span>
            </div>
            {/* Why line — always visible */}
            <span style={{ ...label, fontSize: "0.55rem", color: C.textDim, lineHeight: 1.3 }}>
              {opp.why}
              {crowd && <span style={{ color: C.textGhost }}> · {crowd}</span>}
            </span>
          </div>
        </div>

        {/* Timer + kind */}
        <div className="flex flex-col items-end gap-0.5 shrink-0 ml-2">
          <span style={{ ...mono, fontSize: "0.6rem", color, lineHeight: 1 }}>
            {opp.timerMinutes <= 2 ? "Mtn" : `${opp.timerMinutes}m`}
          </span>
          <span
            style={{
              ...mono,
              fontSize: "0.35rem",
              color: opp.kind === "confirme" ? C.greenDim : C.amberDim,
            }}
          >
            {opp.kind === "confirme" ? "OK" : "~"}
          </span>
        </div>
      </div>

      {/* ── Expanded: explain card (3 layers) ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div
              className="flex flex-col gap-2.5 px-3.5 pb-3 pt-1"
              style={{ borderTop: `1px solid ${C.border}` }}
            >
              {/* Layer 1: Window + Confidence */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span style={{ ...mono, fontSize: "0.55rem", color: C.textMid }}>
                    {opp.window.start} - {opp.window.end}
                  </span>
                  {opp.distanceMinutes && (
                    <span style={{ ...mono, fontSize: "0.5rem", color: C.textDim }}>
                      {opp.distanceMinutes} min trajet
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    style={{
                      width: 3,
                      height: 3,
                      borderRadius: "50%",
                      backgroundColor: confColor(opp.confidence),
                    }}
                  />
                  <span style={{ ...mono, fontSize: "0.45rem", color: confColor(opp.confidence) }}>
                    {confidenceLabel(opp.confidence)}
                  </span>
                </div>
              </div>

              {/* Layer 2: Evidence breakdown */}
              <div className="flex items-center gap-2 flex-wrap">
                {opp.evidence.map((ev, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 px-2 py-0.5"
                    style={{
                      border: `1px solid ${sourceColor(ev.source)}30`,
                      borderRadius: 2,
                    }}
                  >
                    <div
                      style={{
                        width: 3,
                        height: 3,
                        borderRadius: "50%",
                        backgroundColor: sourceColor(ev.source),
                      }}
                    />
                    <span style={{ ...label, fontSize: "0.4rem", color: sourceColor(ev.source) }}>
                      {sourceLabel(ev.source)}
                    </span>
                    <span style={{ ...label, fontSize: "0.4rem", color: C.textDim }}>
                      {ev.ref}
                    </span>
                  </div>
                ))}
              </div>

              {/* Layer 3: Corridor + ride profile */}
              <div className="flex items-center gap-4">
                {opp.corridor && (
                  <span
                    className="uppercase tracking-[0.1em]"
                    style={{ ...label, fontSize: "0.4rem", color: C.textDim }}
                  >
                    Corridor {opp.corridor}
                  </span>
                )}
                {opp.rideProfile && (
                  <span style={{ ...label, fontSize: "0.4rem", color: C.textGhost }}>
                    Courses {opp.rideProfile}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Opportunity Section ──

export function OpportunitySection({
  title,
  opportunities,
  rank,
}: {
  title: string;
  opportunities: DriverOpportunity[];
  rank: OpportunityCardProps["rank"];
}) {
  if (opportunities.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="uppercase tracking-[0.2em]"
        style={{ ...label, fontSize: "0.45rem", color: C.textDim }}
      >
        {title}
      </span>
      {opportunities.map((opp) => (
        <OpportunityCard key={opp.id} opp={opp} rank={rank} />
      ))}
    </div>
  );
}
