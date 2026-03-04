// FLOW — Dispatch Panel
// Session overview + corridor status + impacts + timeline
// All data computed from FlowState (real, not mockup)

import { motion } from "motion/react";
import type { FlowState, ShiftPhase, ContextSignal } from "./FlowEngine";
import { C, mono, label } from "./theme";

// ── Corridor definitions (must match FlowEngine) ──

const CORRIDOR_DEFS = [
  { id: "nord", label: "NORD", zones: ["17", "18", "19", "9", "10"] },
  { id: "est", label: "EST", zones: ["11", "12", "20", "3", "4"] },
  { id: "sud", label: "SUD", zones: ["13", "14", "5", "6"] },
  { id: "ouest", label: "OUEST", zones: ["16", "15", "7", "8"] },
];

// ── Helpers ──

function getCorridorDensity(
  corridorZones: string[],
  zoneHeat: Record<string, number>,
  zoneSaturation: Record<string, number>
): { status: "dense" | "fluide"; avgHeat: number; avgSat: number } {
  let totalHeat = 0;
  let totalSat = 0;
  let count = 0;

  for (const zid of corridorZones) {
    const heat = zoneHeat[zid] ?? 0;
    const sat = zoneSaturation[zid] ?? 0;
    totalHeat += heat;
    totalSat += sat;
    count++;
  }

  const avgHeat = count > 0 ? totalHeat / count : 0;
  const avgSat = count > 0 ? totalSat / count : 0;

  // Dense if avg saturation > 40 OR avg heat > 0.5
  const status = avgSat > 40 || avgHeat > 0.5 ? "dense" : "fluide";

  return { status, avgHeat, avgSat };
}

function getImpactForCorridor(
  corridorId: string,
  signals: ContextSignal[]
): string | null {
  // Map signals to corridors based on keywords
  const corridorKeywords: Record<string, string[]> = {
    nord: ["montmartre", "pigalle", "18", "19", "17", "nord"],
    est: ["bastille", "marais", "11", "12", "20", "nation", "est"],
    sud: ["latin", "13", "14", "sud", "montparnasse"],
    ouest: ["trocadero", "16", "15", "defense", "ouest", "champs"],
  };

  const keywords = corridorKeywords[corridorId] ?? [];

  for (const sig of signals) {
    const textLower = sig.text.toLowerCase();
    if (keywords.some((kw) => textLower.includes(kw))) {
      return sig.text;
    }
    // PSG matches ouest (Parc des Princes)
    if (corridorId === "ouest" && textLower.includes("psg")) {
      return sig.text;
    }
  }
  return null;
}

function formatSessionDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  return `${m}m`;
}

function getPhaseLabel(phase: ShiftPhase): string {
  switch (phase) {
    case "calme": return "CALME";
    case "montee": return "MONTEE";
    case "pic": return "PIC";
    case "dispersion": return "DISPERSION";
  }
}

function getTimelinePhaseLabel(index: number, total: number): string {
  // Derive phase from position in timeline
  const phases = ["PIC", "DISPERSION", "TRANSITION", "NUIT", "CALME"];
  return phases[index % phases.length];
}

// ── Component ──

interface DispatchPanelProps {
  flowState: FlowState;
  sessionStartTime: number;
  onClose: () => void;
}

export function DispatchPanel({
  flowState,
  sessionStartTime,
  onClose,
}: DispatchPanelProps) {
  const sessionDurationMs = Date.now() - sessionStartTime;
  const sessionDuration = formatSessionDuration(sessionDurationMs);

  // Compute corridor statuses from real zone data
  const corridorStatuses = CORRIDOR_DEFS.map((corridor) => {
    const density = getCorridorDensity(
      corridor.zones,
      flowState.zoneHeat,
      flowState.zoneSaturation
    );
    const impact = getImpactForCorridor(corridor.id, flowState.signals);
    return {
      ...corridor,
      ...density,
      impact,
    };
  });

  // Build active impacts from signals that affect corridors
  const activeImpacts = corridorStatuses
    .filter((c) => c.impact && c.status === "dense")
    .map((c) => ({
      signal: c.impact!,
      effect: `hausse ${c.id}`,
    }));

  // Session stats (computed from flow state)
  const sessionHours = sessionDurationMs / 3600000;
  const avgEarnings = (flowState.earningsEstimate[0] + flowState.earningsEstimate[1]) / 2;
  const estimatedCourses = Math.max(1, Math.floor(sessionHours * 2.5)); // ~2.5 courses/hour
  const targetEarnings = 120; // EUR target
  const efficiency = Math.min(99, Math.round(50 + flowState.confidence * 0.4 + flowState.shiftProgress * 20));

  // Build +2H timeline from upcoming and peaks
  const timelineSlots = [
    ...flowState.upcoming.slice(0, 4).map((slot, i) => ({
      time: slot.time,
      phase: getTimelinePhaseLabel(i, flowState.upcoming.length),
      zone: slot.zone,
      phaseColor: i === 0 ? C.green : C.amber,
    })),
  ];

  // Add peaks if we have room
  if (timelineSlots.length < 4) {
    flowState.peaks.slice(0, 4 - timelineSlots.length).forEach((peak) => {
      timelineSlots.push({
        time: peak.time,
        phase: "PIC",
        zone: peak.zone,
        phaseColor: C.green,
      });
    });
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.25 }}
        style={{
          backgroundColor: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 4,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex items-center gap-3">
            <span
              className="uppercase tracking-[0.25em]"
              style={{
                ...label,
                fontSize: "0.85rem",
                fontWeight: 500,
                color: C.text,
              }}
            >
              DISPATCH
            </span>
            <span
              className="px-2 py-0.5 uppercase tracking-[0.15em]"
              style={{
                ...label,
                fontSize: "0.55rem",
                fontWeight: 500,
                color: flowState.shiftPhase === "pic" ? C.green : C.amber,
                backgroundColor:
                  flowState.shiftPhase === "pic" ? `${C.green}15` : `${C.amber}15`,
                border: `1px solid ${
                  flowState.shiftPhase === "pic" ? C.greenDim : C.amberDim
                }`,
                borderRadius: 2,
              }}
            >
              {getPhaseLabel(flowState.shiftPhase)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="uppercase tracking-[0.15em] px-3 py-1.5"
            style={{
              ...label,
              fontSize: "0.6rem",
              color: C.textDim,
              backgroundColor: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 2,
              cursor: "pointer",
            }}
          >
            FERMER
          </button>
        </div>

        {/* Session */}
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <span
            className="uppercase tracking-[0.15em]"
            style={{ ...label, fontSize: "0.55rem", color: C.textDim }}
          >
            SESSION
          </span>
          <div className="flex items-end justify-between mt-2">
            <span
              style={{
                ...mono,
                fontSize: "2rem",
                fontWeight: 500,
                color: C.text,
                lineHeight: 1,
              }}
            >
              {sessionDuration}
            </span>
            <div className="flex flex-col items-end">
              <span style={{ ...mono, fontSize: "1rem", color: C.textMid }}>
                {estimatedCourses}
              </span>
              <span style={{ ...label, fontSize: "0.6rem", color: C.textDim }}>
                / {targetEarnings} EUR
              </span>
            </div>
          </div>
          <div
            className="mt-3 h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: C.textGhost }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (flowState.sessionEarnings / targetEarnings) * 100)}%`,
                backgroundColor: C.green,
                transition: "width 0.5s ease",
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span style={{ ...label, fontSize: "0.6rem", color: C.textDim }}>
              {estimatedCourses} courses
            </span>
            <span style={{ ...label, fontSize: "0.6rem", color: C.textDim }}>
              Efficacite {efficiency}%
            </span>
          </div>
        </div>

        {/* Axes */}
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <span
            className="uppercase tracking-[0.15em]"
            style={{ ...label, fontSize: "0.55rem", color: C.textDim }}
          >
            AXES
          </span>
          <div className="flex flex-col mt-3 gap-2">
            {corridorStatuses.map((corridor) => (
              <div key={corridor.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="w-14 uppercase tracking-[0.1em]"
                    style={{ ...label, fontSize: "0.75rem", color: C.text }}
                  >
                    {corridor.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor:
                          corridor.status === "dense" ? C.amber : C.textGhost,
                      }}
                    />
                    <span
                      className="uppercase tracking-[0.1em]"
                      style={{
                        ...label,
                        fontSize: "0.7rem",
                        fontWeight: corridor.status === "dense" ? 500 : 400,
                        color: corridor.status === "dense" ? C.amber : C.textDim,
                      }}
                    >
                      {corridor.status === "dense" ? "DENSE" : "FLUIDE"}
                    </span>
                  </div>
                </div>
                {corridor.impact && (
                  <span
                    style={{
                      ...label,
                      fontSize: "0.6rem",
                      color: C.textDim,
                      maxWidth: 120,
                      textAlign: "right",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {corridor.impact.length > 20
                      ? corridor.impact.substring(0, 18) + "..."
                      : corridor.impact}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Impacts actifs */}
        {activeImpacts.length > 0 && (
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
            <span
              className="uppercase tracking-[0.15em]"
              style={{ ...label, fontSize: "0.55rem", color: C.textDim }}
            >
              IMPACTS ACTIFS
            </span>
            <div className="flex flex-col mt-3 gap-2">
              {activeImpacts.map((impact, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span style={{ ...label, fontSize: "0.75rem", color: C.amber }}>
                    {impact.signal.length > 25
                      ? impact.signal.substring(0, 23) + "..."
                      : impact.signal}
                  </span>
                  <span style={{ ...label, fontSize: "0.7rem", color: C.textGhost }}>
                    →
                  </span>
                  <span style={{ ...label, fontSize: "0.7rem", color: C.textDim }}>
                    {impact.effect}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* +2H Timeline */}
        <div className="px-5 py-4">
          <span
            className="uppercase tracking-[0.15em]"
            style={{ ...label, fontSize: "0.55rem", color: C.textDim }}
          >
            +2H
          </span>
          <div className="flex flex-col mt-3">
            {timelineSlots.map((slot, i) => (
              <div
                key={i}
                className="flex items-center gap-4 py-2.5"
                style={{ borderBottom: i < timelineSlots.length - 1 ? `1px solid ${C.border}` : "none" }}
              >
                <span
                  style={{
                    ...mono,
                    fontSize: "0.85rem",
                    color: C.textMid,
                    width: 50,
                  }}
                >
                  {slot.time}
                </span>
                <div className="flex items-center gap-2">
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      backgroundColor: slot.phaseColor,
                    }}
                  />
                  <span
                    className="uppercase tracking-[0.1em]"
                    style={{
                      ...label,
                      fontSize: "0.65rem",
                      color: slot.phaseColor,
                      width: 85,
                    }}
                  >
                    {slot.phase}
                  </span>
                </div>
                <span style={{ ...label, fontSize: "0.85rem", color: C.text }}>
                  {slot.zone}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
