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
    nord: ["montmartre", "pigalle", "18", "19", "17", "nord", "gare du nord", "cdg"],
    est: ["bastille", "marais", "11", "12", "20", "nation", "est", "bercy"],
    sud: ["latin", "13", "14", "sud", "montparnasse", "versailles"],
    ouest: ["trocadero", "16", "15", "defense", "ouest", "champs", "psg", "fashion"],
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

// Generate concrete corridor context
function getCorridorContext(corridorId: string, status: string): string {
  const hour = new Date().getHours();

  // Time-based context hints
  const contextMap: Record<string, Record<string, string>> = {
    nord: {
      sature: hour >= 22 || hour < 6 ? "clubs Pigalle actifs" : "gares en pic",
      dense: hour >= 3 && hour < 6 ? "CDG departs" : "flux transit",
      fluide: "demande moderee",
    },
    est: {
      sature: hour >= 22 ? "Bercy/Bastille pic" : "transit est",
      dense: "Marais/Bastille actif",
      fluide: "demande moderee",
    },
    sud: {
      sature: "Montparnasse dense",
      dense: hour >= 17 && hour < 19 ? "retours bureaux" : "flux sud",
      fluide: "calme",
    },
    ouest: {
      sature: hour >= 22 ? "8e/16e nightlife" : "La Defense pic",
      dense: "restaurants/hotels premium",
      fluide: "demande moderee",
    },
  };

  return contextMap[corridorId]?.[status] ?? "";
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

        {/* Corridors - simplified with context */}
        <div className="px-5 py-4">
          <span
            className="block mb-3 uppercase tracking-[0.15em]"
            style={{ ...label, fontSize: "0.5rem", color: C.textGhost }}
          >
            AXES PARIS
          </span>
          <div className="flex flex-col gap-3">
            {corridorStatuses.map((corridor) => {
              const context = corridor.impact ||
                getCorridorContext(corridor.id, corridor.status);
              return (
                <div
                  key={corridor.id}
                  className="flex items-start gap-3"
                  style={{
                    opacity: corridor.status === "fluide" ? 0.6 : 1,
                  }}
                >
                  {/* Status dot */}
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: getStatusColor(corridor.status),
                      marginTop: 4,
                      flexShrink: 0,
                    }}
                  />
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="uppercase tracking-[0.1em]"
                        style={{
                          ...label,
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          color: C.text,
                        }}
                      >
                        {corridor.label}
                      </span>
                      <span
                        className="uppercase tracking-[0.08em]"
                        style={{
                          ...label,
                          fontSize: "0.5rem",
                          color: getStatusColor(corridor.status),
                        }}
                      >
                        {getStatusLabel(corridor.status)}
                      </span>
                    </div>
                    {/* Context - the WHY */}
                    {context && (
                      <span
                        style={{
                          ...label,
                          fontSize: "0.65rem",
                          color: C.textDim,
                          fontStyle: "italic",
                        }}
                      >
                        {context.length > 35 ? context.slice(0, 33) + "..." : context}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick recommendation */}
        <div
          className="px-5 py-3"
          style={{ borderTop: `1px solid ${C.border}` }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "0.8rem" }}>
              {fieldState === "SATURE" ? "⚠" :
               fieldState === "DENSE" ? "◉" : "○"}
            </span>
            <span
              style={{
                ...label,
                fontSize: "0.7rem",
                color: C.textMid,
                fontStyle: "italic",
              }}
            >
              {fieldState === "SATURE"
                ? "Axes charges — positionnement anticipé conseillé"
                : fieldState === "DENSE"
                  ? "Activité soutenue — rester mobile"
                  : fieldState === "MIXTE"
                    ? "Demande variable — surveiller signaux"
                    : "Ville calme — attente ou pause"}
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
