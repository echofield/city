// FLOW — Dispatch Panel (Simplified)
// Macro corridor view: density, saturation, field state
// No fake stats. Only real computed data.

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

function getCorridorStatus(
  corridorZones: string[],
  zoneHeat: Record<string, number>,
  zoneSaturation: Record<string, number>
): { status: "sature" | "dense" | "fluide"; avgHeat: number; avgSat: number } {
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

  // Three-tier status
  if (avgSat > 60) return { status: "sature", avgHeat, avgSat };
  if (avgSat > 35 || avgHeat > 0.4) return { status: "dense", avgHeat, avgSat };
  return { status: "fluide", avgHeat, avgSat };
}

function getImpactForCorridor(
  corridorId: string,
  signals: ContextSignal[]
): string | null {
  const corridorKeywords: Record<string, string[]> = {
    nord: ["montmartre", "pigalle", "18", "19", "17", "nord", "gare du nord"],
    est: ["bastille", "marais", "11", "12", "20", "nation", "est", "bercy"],
    sud: ["latin", "13", "14", "sud", "montparnasse"],
    ouest: ["trocadero", "16", "15", "defense", "ouest", "champs", "psg"],
  };

  const keywords = corridorKeywords[corridorId] ?? [];
  for (const sig of signals) {
    const textLower = sig.text.toLowerCase();
    if (keywords.some((kw) => textLower.includes(kw))) {
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

function getStatusColor(status: "sature" | "dense" | "fluide"): string {
  switch (status) {
    case "sature": return C.red;
    case "dense": return C.amber;
    case "fluide": return C.textDim;
  }
}

function getStatusLabel(status: "sature" | "dense" | "fluide"): string {
  switch (status) {
    case "sature": return "SATURE";
    case "dense": return "DENSE";
    case "fluide": return "FLUIDE";
  }
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
  const zoneHeat = flowState.zoneHeat ?? {};
  const zoneSaturation = flowState.zoneSaturation ?? {};
  const signals = flowState.signals ?? [];

  const corridorStatuses = CORRIDOR_DEFS.map((corridor) => {
    const status = getCorridorStatus(corridor.zones, zoneHeat, zoneSaturation);
    const impact = getImpactForCorridor(corridor.id, signals);
    return { ...corridor, ...status, impact };
  });

  // Active impacts: signals affecting dense/saturated corridors
  const activeImpacts = corridorStatuses
    .filter((c) => c.impact && c.status !== "fluide")
    .map((c) => ({ corridor: c.label, signal: c.impact! }));

  // Field state summary
  const saturatedCount = corridorStatuses.filter((c) => c.status === "sature").length;
  const denseCount = corridorStatuses.filter((c) => c.status === "dense").length;
  const fieldState = saturatedCount > 0
    ? "SATURE"
    : denseCount >= 2
      ? "DENSE"
      : denseCount === 1
        ? "MIXTE"
        : "FLUIDE";

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
        className="w-full max-w-sm"
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
              className="uppercase tracking-[0.2em]"
              style={{
                ...label,
                fontSize: "0.8rem",
                fontWeight: 500,
                color: C.text,
              }}
            >
              DISPATCH
            </span>
            <span
              className="px-2 py-0.5 uppercase tracking-[0.12em]"
              style={{
                ...label,
                fontSize: "0.5rem",
                fontWeight: 500,
                color: (flowState.shiftPhase ?? "calme") === "pic" ? C.green : C.textMid,
                backgroundColor:
                  (flowState.shiftPhase ?? "calme") === "pic" ? `${C.green}15` : `${C.surface}`,
                border: `1px solid ${C.border}`,
                borderRadius: 2,
              }}
            >
              {getPhaseLabel(flowState.shiftPhase ?? "calme")}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1"
            style={{
              ...label,
              fontSize: "0.55rem",
              color: C.textDim,
              backgroundColor: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 2,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {/* Session + Field State */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex items-center gap-2">
            <span
              style={{ ...mono, fontSize: "1.2rem", fontWeight: 500, color: C.text }}
            >
              {sessionDuration}
            </span>
            <span
              className="uppercase tracking-[0.1em]"
              style={{ ...label, fontSize: "0.55rem", color: C.textDim }}
            >
              SESSION
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor:
                  fieldState === "SATURE" ? C.red :
                  fieldState === "DENSE" ? C.amber :
                  fieldState === "MIXTE" ? C.amber : C.textDim,
              }}
            />
            <span
              className="uppercase tracking-[0.1em]"
              style={{
                ...label,
                fontSize: "0.65rem",
                fontWeight: 500,
                color:
                  fieldState === "SATURE" ? C.red :
                  fieldState === "DENSE" ? C.amber : C.textMid,
              }}
            >
              {fieldState}
            </span>
          </div>
        </div>

        {/* Corridors */}
        <div className="px-5 py-4">
          <span
            className="block mb-3 uppercase tracking-[0.15em]"
            style={{ ...label, fontSize: "0.5rem", color: C.textGhost }}
          >
            CORRIDORS
          </span>
          <div className="flex flex-col gap-2.5">
            {corridorStatuses.map((corridor) => (
              <div key={corridor.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="w-12 uppercase tracking-[0.1em]"
                    style={{ ...label, fontSize: "0.75rem", fontWeight: 500, color: C.text }}
                  >
                    {corridor.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: getStatusColor(corridor.status),
                      }}
                    />
                    <span
                      className="uppercase tracking-[0.08em]"
                      style={{
                        ...label,
                        fontSize: "0.65rem",
                        color: getStatusColor(corridor.status),
                      }}
                    >
                      {getStatusLabel(corridor.status)}
                    </span>
                  </div>
                </div>
                <span
                  style={{
                    ...mono,
                    fontSize: "0.6rem",
                    color: C.textGhost,
                  }}
                >
                  {Math.round(corridor.avgSat)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Active Impacts (if any) */}
        {activeImpacts.length > 0 && (
          <div
            className="px-5 py-3"
            style={{ borderTop: `1px solid ${C.border}` }}
          >
            <span
              className="block mb-2 uppercase tracking-[0.1em]"
              style={{ ...label, fontSize: "0.5rem", color: C.textGhost }}
            >
              IMPACTS
            </span>
            {activeImpacts.slice(0, 3).map((impact, i) => (
              <div key={i} className="flex items-center gap-2 mb-1">
                <span
                  className="uppercase"
                  style={{ ...label, fontSize: "0.55rem", color: C.amber }}
                >
                  {impact.corridor}
                </span>
                <span style={{ ...label, fontSize: "0.6rem", color: C.textDim }}>
                  {impact.signal.length > 28
                    ? impact.signal.slice(0, 26) + "..."
                    : impact.signal}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
