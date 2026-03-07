// FLOW — LIVE Screen
// Tactical ranked card feed driven by signalFeed
// Not category-based. Ranked by decision value.

import { motion, AnimatePresence } from "motion/react";
import type { Signal, SignalFeed } from "../types/signal";
import type { FlowState, ShiftPhase } from "../types/flow-state";
import { C, mono, label } from "./theme";

// ── Zone abbreviation rules for long venue names ──

const ZONE_ABBREVIATIONS: Record<string, string> = {
  // Common venues
  "Stade de France": "St-France",
  "Parc des Princes": "PdP",
  "AccorHotels Arena": "Bercy",
  "Bercy Arena": "Bercy",
  "La Defense Arena": "Def Arena",
  "Roland Garros": "R-Garros",
  "Philharmonie de Paris": "Philharm.",
  "Zenith de Paris": "Zenith",
  "Olympia": "Olympia",
  "Grand Palais": "Gd Palais",
  "Palais des Congres": "Congres",
  // Stations
  "Gare du Nord": "G. Nord",
  "Gare de Lyon": "G. Lyon",
  "Gare Montparnasse": "Montparn.",
  "Gare de l'Est": "G. Est",
  "Gare Saint-Lazare": "St-Lazare",
  // Airports
  "Charles de Gaulle": "CDG",
  "Aeroport CDG": "CDG",
  "Orly": "Orly",
  // Areas
  "Champs-Elysees": "Champs",
  "Place de la Concorde": "Concorde",
  "Tour Eiffel": "Eiffel",
  "Trocadero": "Troca",
  "Montmartre": "Montm.",
  "Saint-Germain-des-Pres": "St-Germ",
  "Quartier Latin": "Q. Latin",
  "Les Halles": "Halles",
  "Le Marais": "Marais",
  "Pigalle": "Pigalle",
  "Opera": "Opera",
  "Bastille": "Bastille",
  "Nation": "Nation",
  "Republique": "Repub.",
  "Belleville": "Bellev.",
  "Oberkampf": "Oberk.",
};

function abbreviateZone(zone: string, maxLen: number = 14): string {
  // Check direct abbreviation
  if (ZONE_ABBREVIATIONS[zone]) {
    return ZONE_ABBREVIATIONS[zone];
  }
  // Check partial matches
  for (const [full, short] of Object.entries(ZONE_ABBREVIATIONS)) {
    if (zone.includes(full)) {
      return zone.replace(full, short);
    }
  }
  // Truncate if still too long
  if (zone.length > maxLen) {
    return zone.slice(0, maxLen - 1) + ".";
  }
  return zone;
}

// ── Helpers ──

function getIntensityColor(intensity: number): string {
  if (intensity >= 4) return C.greenBright;
  if (intensity >= 3) return C.green;
  if (intensity >= 2) return C.amber;
  return C.textDim;
}

function getKindColor(kind: Signal["kind"]): string {
  switch (kind) {
    case "live": return C.green;
    case "nearby": return C.greenBright;
    case "alert": return C.amber;
    case "soon": return C.textMid;
    case "compound": return C.green;
    default: return C.textDim;
  }
}

function getDisplayLabel(signal: Signal): string {
  if (signal.display_label) return signal.display_label;
  if (signal.kind === "nearby") return "PROCHE DE TOI";
  if (signal.kind === "alert") return "ALERTE";
  if (signal.is_compound) return "SIGNAL COMPOSE";
  if (signal.intensity >= 3) return "SIGNAL FORT";
  if (signal.is_forming) return "BIENTOT";
  return "SIGNAL";
}

function getNextSignalTime(signals: Signal[]): string | null {
  const forming = signals.filter((s) => s.is_forming && s.time_window.start);
  if (forming.length === 0) return null;
  // Find earliest
  const sorted = forming.sort((a, b) => {
    const aMin = a.minutes_until_start ?? 999;
    const bMin = b.minutes_until_start ?? 999;
    return aMin - bMin;
  });
  return sorted[0]?.time_window.label ?? sorted[0]?.time_window.start ?? null;
}

// ── Confidence badge helper ──

function getConfidenceBadge(confidence: string | undefined): { icon: string; label: string; color: string } {
  switch (confidence) {
    case "high": return { icon: "●", label: "H", color: C.green };
    case "medium": return { icon: "◐", label: "M", color: C.textMid };
    case "low": return { icon: "○", label: "L", color: C.textGhost };
    default: return { icon: "○", label: "", color: C.textGhost };
  }
}

// ── Truncate reason to fast-scan phrase ──

function truncateReason(reason: string, maxLen: number = 45): string {
  if (reason.length <= maxLen) return reason;
  return reason.slice(0, maxLen).trim() + "...";
}

// ── Proximity fallback helper ──

function getProximityDisplay(signal: Signal): { text: string; color: string } | null {
  // If we have exact proximity, use it
  if (signal.proximity_minutes !== undefined) {
    return {
      text: `${signal.proximity_minutes}′`,
      color: signal.proximity_minutes <= 10 ? C.green : C.textDim,
    };
  }

  // Fallback 1: Use kind to infer proximity
  if (signal.kind === "nearby") {
    return { text: "~5′", color: C.green };
  }

  // Fallback 2: If forming, show time hint instead
  if (signal.is_forming && signal.minutes_until_start !== undefined) {
    return { text: `+${signal.minutes_until_start}′`, color: C.textDim };
  }

  // Fallback 3: Live signals are "now"
  if (signal.kind === "live") {
    return { text: "actif", color: C.green };
  }

  // No proximity info - don't show anything rather than incomplete
  return null;
}

// ── Signal Card (Compressed) ──
// 3 rows max: ROW1: action + badges | ROW2: zone/title + time | ROW3: short reason

function SignalCard({ signal, isTop = false }: { signal: Signal; isTop?: boolean }) {
  const intensityColor = getIntensityColor(signal.intensity);
  const displayLabel = getDisplayLabel(signal);
  const confBadge = getConfidenceBadge(signal.confidence);
  const proximityDisplay = getProximityDisplay(signal);
  const zoneDisplay = abbreviateZone(signal.zone || signal.title);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="px-4 py-3"
      style={{
        backgroundColor: isTop ? `${C.surface}` : C.surface,
        border: isTop ? `1px solid ${C.greenDim}` : `1px solid ${C.border}`,
        borderRadius: 4,
        borderLeft: `3px solid ${intensityColor}`,
        boxShadow: isTop ? `0 0 12px ${C.green}15` : "none",
      }}
    >
      {/* ROW 1: Action line (primary) + badges */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span style={{ color: intensityColor, fontSize: "0.85rem", fontWeight: 600 }}>→</span>
          <span
            className="truncate"
            style={{
              ...label,
              fontSize: "0.9rem",
              fontWeight: 500,
              color: C.text,
            }}
          >
            {signal.action}
          </span>
        </div>
        {/* Compact badges: proximity + confidence + density */}
        <div className="flex items-center gap-2 shrink-0">
          {proximityDisplay && (
            <span
              style={{
                ...mono,
                fontSize: "0.65rem",
                color: proximityDisplay.color,
              }}
            >
              {proximityDisplay.text}
            </span>
          )}
          {signal.driver_density && signal.driver_density !== "balanced" && (
            <span
              className="px-1 py-0.5 uppercase"
              style={{
                ...label,
                fontSize: "0.45rem",
                color: signal.driver_density === "opportunity" ? C.green : C.red,
                backgroundColor:
                  signal.driver_density === "opportunity" ? `${C.green}15` : `${C.red}15`,
                borderRadius: 2,
              }}
            >
              {signal.driver_density === "opportunity" ? "OPP" : "SAT"}
            </span>
          )}
          {signal.confidence && (
            <span
              style={{
                fontSize: "0.6rem",
                color: confBadge.color,
              }}
              title={signal.confidence}
            >
              {confBadge.icon}
            </span>
          )}
        </div>
      </div>

      {/* ROW 2: Zone/Title + Label + Time */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="truncate"
            style={{
              ...label,
              fontSize: "0.85rem",
              fontWeight: 400,
              color: C.textMid,
            }}
          >
            {zoneDisplay}
          </span>
          {signal.arrondissement && (
            <span
              style={{
                ...label,
                fontSize: "0.65rem",
                color: C.textGhost,
              }}
            >
              {signal.arrondissement}
            </span>
          )}
          <span
            className="uppercase tracking-[0.08em] px-1"
            style={{
              ...label,
              fontSize: "0.45rem",
              fontWeight: 500,
              color: getKindColor(signal.kind),
              backgroundColor: `${getKindColor(signal.kind)}12`,
              borderRadius: 2,
            }}
          >
            {displayLabel}
          </span>
        </div>
        <span
          style={{
            ...mono,
            fontSize: "0.65rem",
            color: C.textDim,
            whiteSpace: "nowrap",
          }}
        >
          {signal.display_sublabel || signal.time_window.label || signal.time_window.start}
        </span>
      </div>

      {/* ROW 3: Short reason */}
      <p
        style={{
          ...label,
          fontSize: "0.7rem",
          fontWeight: 300,
          color: C.textGhost,
          margin: 0,
          lineHeight: 1.3,
        }}
      >
        {truncateReason(signal.reason)}
      </p>

      {/* Overlapping factors - only for compound signals, inline */}
      {signal.is_compound && signal.overlapping_factors && signal.overlapping_factors.length > 0 && (
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          {signal.overlapping_factors.slice(0, 3).map((factor, i) => (
            <span
              key={i}
              className="px-1 py-0.5 uppercase tracking-[0.05em]"
              style={{
                ...label,
                fontSize: "0.45rem",
                color: C.amber,
                backgroundColor: `${C.amber}12`,
                borderRadius: 2,
              }}
            >
              {factor}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Get recommended posture based on shift phase and time ──

function getRecommendedPosture(shiftPhase: ShiftPhase, nextSignalTime: string | null): {
  posture: string;
  action: string;
  icon: string;
} {
  // If next signal is within ~30 min, prepare
  const hasUpcomingSignal = nextSignalTime !== null;

  switch (shiftPhase) {
    case "montee":
      return {
        posture: "PREPARATION",
        action: hasUpcomingSignal ? "Repositionne vers zone cible" : "Reste mobile, pic proche",
        icon: "↗",
      };
    case "pic":
      return {
        posture: "MONITOR",
        action: "Surveille opportunites residuelles",
        icon: "◉",
      };
    case "dispersion":
      return {
        posture: "REPOS OU FIN",
        action: "Fenetre terminee. Pause ou fin de session",
        icon: "◇",
      };
    case "calme":
    default:
      if (hasUpcomingSignal) {
        return {
          posture: "ATTENTE ACTIVE",
          action: "Prochain signal bientot. Reste pret",
          icon: "◎",
        };
      }
      return {
        posture: "REPOS",
        action: "Aucune opportunite proche. Pause recommandee",
        icon: "○",
      };
  }
}

// ── Calm State (Always Alive) ──
// Flow should never feel empty. Even in calm moments, show useful context.

interface CalmStateProps {
  nextSignalTime: string | null;
  shiftPhase: ShiftPhase;
  formingSignals: Signal[];
  allSignals: Signal[];
  flowState: FlowState | null;
}

/**
 * Compute a fallback recommendation when no forming signals exist.
 * Based on time of day, corridors, and city rhythm.
 */
function computeFallbackContext(flowState: FlowState | null): {
  hint: string;
  corridor: string;
  zone: string;
  timeContext: string;
} {
  const now = new Date();
  const hour = now.getHours();

  // Time-based corridor recommendations
  if (hour >= 22 || hour < 2) {
    // Late evening / early night
    return {
      hint: "Nuit active",
      corridor: "centre-est",
      zone: "Bastille / Oberkampf",
      timeContext: "Sorties bars en formation",
    };
  } else if (hour >= 2 && hour < 5) {
    // Deep night
    return {
      hint: "Nuit profonde",
      corridor: "nord",
      zone: "Pigalle / Montmartre",
      timeContext: "Fermetures clubs imminentes",
    };
  } else if (hour >= 5 && hour < 7) {
    // Early morning
    return {
      hint: "Aube",
      corridor: "nord",
      zone: "CDG / Gare du Nord",
      timeContext: "Vague departs aeroport",
    };
  } else if (hour >= 7 && hour < 10) {
    // Morning rush
    return {
      hint: "Rush matinal",
      corridor: "ouest",
      zone: "La Defense / 8e",
      timeContext: "Trajets affaires",
    };
  } else if (hour >= 17 && hour < 20) {
    // Evening rush
    return {
      hint: "Rush soir",
      corridor: "centre",
      zone: "Gares / Hotels",
      timeContext: "Retours bureaux + arrivees",
    };
  } else if (hour >= 20 && hour < 22) {
    // Pre-night
    return {
      hint: "Pre-soiree",
      corridor: "ouest",
      zone: "8e / 16e",
      timeContext: "Sorties restaurants en preparation",
    };
  } else {
    // Afternoon (calmer)
    return {
      hint: "Apres-midi calme",
      corridor: flowState?.favoredCorridor ?? "centre",
      zone: flowState?.targetZone ?? "Centre Paris",
      timeContext: "Demande moderee",
    };
  }
}

function CalmState({
  nextSignalTime,
  shiftPhase,
  formingSignals,
  allSignals,
  flowState,
}: CalmStateProps) {
  const posture = getRecommendedPosture(shiftPhase, nextSignalTime);
  const nextForming = formingSignals[0];

  // Find next signal by time if no forming signals
  const nextByPriority = allSignals.length > 0
    ? allSignals.sort((a, b) => b.priority_score - a.priority_score)[0]
    : null;

  // Compute fallback context
  const fallback = computeFallbackContext(flowState);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col min-h-0 overflow-y-auto"
    >
      {/* Main posture - compact */}
      <div className="flex flex-col items-center pt-8 pb-4 px-6 text-center">
        <span
          style={{
            fontSize: "1.5rem",
            color: C.textGhost,
            marginBottom: "0.25rem",
          }}
        >
          {posture.icon}
        </span>

        <h1
          className="uppercase tracking-[0.2em]"
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(1.5rem, 5vw, 2rem)",
            fontWeight: 300,
            color: C.textDim,
            margin: 0,
          }}
        >
          {posture.posture}
        </h1>

        <p
          className="mt-2"
          style={{
            ...label,
            fontSize: "0.75rem",
            fontWeight: 400,
            color: C.textMid,
            maxWidth: 260,
          }}
        >
          {posture.action}
        </p>
      </div>

      {/* Always show context cards */}
      <div className="flex-1 px-4 pb-4 flex flex-col gap-3">
        {/* 1. Next forming signal if exists */}
        {nextForming && (
          <div
            className="px-4 py-3"
            style={{
              backgroundColor: C.surface,
              border: `1px solid ${C.greenDim}`,
              borderLeft: `3px solid ${C.green}`,
              borderRadius: 4,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className="uppercase tracking-[0.1em]"
                style={{
                  ...label,
                  fontSize: "0.5rem",
                  color: C.green,
                }}
              >
                PROCHAIN SIGNAL
              </span>
              {nextForming.minutes_until_start !== undefined && (
                <span
                  style={{
                    ...mono,
                    fontSize: "0.65rem",
                    color: C.green,
                  }}
                >
                  dans {nextForming.minutes_until_start}′
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span
                style={{
                  ...label,
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  color: C.text,
                }}
              >
                {abbreviateZone(nextForming.zone || nextForming.title)}
              </span>
              <span
                style={{
                  ...mono,
                  fontSize: "0.75rem",
                  color: C.textMid,
                }}
              >
                {nextSignalTime}
              </span>
            </div>
            <p
              className="mt-1"
              style={{
                ...label,
                fontSize: "0.65rem",
                color: C.textDim,
              }}
            >
              {truncateReason(nextForming.reason, 50)}
            </p>
          </div>
        )}

        {/* 2. Best available signal if no forming but signals exist */}
        {!nextForming && nextByPriority && (
          <div
            className="px-4 py-3"
            style={{
              backgroundColor: C.surface,
              border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${C.amber}`,
              borderRadius: 4,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className="uppercase tracking-[0.1em]"
                style={{
                  ...label,
                  fontSize: "0.5rem",
                  color: C.amber,
                }}
              >
                MEILLEUR SIGNAL DISPONIBLE
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span
                style={{
                  ...label,
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  color: C.text,
                }}
              >
                {abbreviateZone(nextByPriority.zone || nextByPriority.title)}
              </span>
              <span
                style={{
                  ...mono,
                  fontSize: "0.75rem",
                  color: C.textMid,
                }}
              >
                {nextByPriority.time_window.label || nextByPriority.time_window.start}
              </span>
            </div>
            <p
              className="mt-1"
              style={{
                ...label,
                fontSize: "0.65rem",
                color: C.textDim,
              }}
            >
              {truncateReason(nextByPriority.reason, 50)}
            </p>
          </div>
        )}

        {/* 3. City posture / fallback recommendation - always shown */}
        <div
          className="px-4 py-3"
          style={{
            backgroundColor: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="uppercase tracking-[0.1em]"
              style={{
                ...label,
                fontSize: "0.5rem",
                color: C.textGhost,
              }}
            >
              POSTURE VILLE
            </span>
            <span
              className="uppercase tracking-[0.08em]"
              style={{
                ...label,
                fontSize: "0.5rem",
                color: C.textDim,
              }}
            >
              {fallback.hint}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                backgroundColor: `${C.green}15`,
                border: `1px solid ${C.greenDim}`,
              }}
            >
              <span style={{ fontSize: "0.9rem", color: C.green }}>
                {fallback.corridor === "nord" ? "↑" :
                 fallback.corridor === "sud" ? "↓" :
                 fallback.corridor === "est" || fallback.corridor === "centre-est" ? "→" :
                 fallback.corridor === "ouest" ? "←" : "◎"}
              </span>
            </div>
            <div className="flex-1">
              <span
                className="block"
                style={{
                  ...label,
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  color: C.text,
                }}
              >
                Axe {fallback.corridor.toUpperCase()}
              </span>
              <span
                className="block"
                style={{
                  ...label,
                  fontSize: "0.7rem",
                  color: C.textDim,
                }}
              >
                {fallback.zone}
              </span>
            </div>
          </div>
          <p
            className="mt-2 pt-2"
            style={{
              ...label,
              fontSize: "0.65rem",
              color: C.textGhost,
              borderTop: `1px solid ${C.border}`,
            }}
          >
            {fallback.timeContext}
          </p>
        </div>

        {/* 4. Flow state hint if available */}
        {flowState && (
          <div
            className="px-4 py-2.5"
            style={{
              backgroundColor: "transparent",
              border: `1px dashed ${C.border}`,
              borderRadius: 4,
            }}
          >
            <div className="flex items-center justify-between">
              <span
                style={{
                  ...label,
                  fontSize: "0.7rem",
                  color: C.textDim,
                }}
              >
                {flowState.fieldMessage}
              </span>
              <span
                style={{
                  ...mono,
                  fontSize: "0.65rem",
                  color: C.textGhost,
                }}
              >
                {flowState.windowLabel}
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Live Screen ──

interface LiveScreenProps {
  signalFeed: SignalFeed | null;
  flowState: FlowState | null;
  onOpenDispatch: () => void;
}

export function LiveScreen({ signalFeed, flowState, onOpenDispatch }: LiveScreenProps) {
  const signals = signalFeed?.signals ?? [];
  const liveCount = signalFeed?.live_count ?? 0;
  const nearbyCount = signalFeed?.nearby_count ?? 0;
  const alertCount = signalFeed?.alert_count ?? 0;
  const totalActive = liveCount + nearbyCount + alertCount;

  const shiftPhase = flowState?.shiftPhase ?? "calme";
  const nextSignalTime = signals.length > 0 ? getNextSignalTime(signals) : null;

  // Forming signals for calm state preview
  const formingSignals = signals.filter((s) => s.is_forming);

  // Show calm state if no active signals
  const showCalm = totalActive === 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="uppercase tracking-[0.2em]"
            style={{
              ...label,
              fontSize: "0.75rem",
              fontWeight: 500,
              color: C.text,
            }}
          >
            LIVE
          </span>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: totalActive > 0 ? C.green : C.textGhost,
              boxShadow: totalActive > 0 ? `0 0 8px ${C.green}40` : "none",
            }}
          />
          <span
            className="uppercase tracking-[0.1em]"
            style={{
              ...label,
              fontSize: "0.55rem",
              color: C.textDim,
            }}
          >
            {shiftPhase === "calme"
              ? "CALME"
              : shiftPhase === "pic"
                ? "PIC"
                : shiftPhase === "montee"
                  ? "MONTEE"
                  : "DISPERSION"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            style={{
              ...mono,
              fontSize: "0.7rem",
              color: C.textDim,
            }}
          >
            {signals.length} signaux
          </span>
          <button
            onClick={onOpenDispatch}
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
            ?
          </button>
        </div>
      </div>

      {/* Content */}
      {showCalm ? (
        <CalmState
          nextSignalTime={nextSignalTime}
          shiftPhase={shiftPhase}
          formingSignals={formingSignals}
          allSignals={signals}
          flowState={flowState}
        />
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-3">
            <AnimatePresence mode="popLayout">
              {signals.slice(0, 10).map((signal, index) => (
                <SignalCard key={signal.id} signal={signal} isTop={index === 0} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
