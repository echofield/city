// FLOW — CARTE Screen
// Spatial positioning + proximity intelligence
// Uses FlowMap for Paris arrondissement visualization

import { motion } from "motion/react";
import { FlowMap } from "./FlowMap";
import { AroundYouCompact } from "./AroundYouPanel";
import type { Signal, SignalFeed, MapView } from "../types/signal";
import type { FlowState } from "../types/flow-state";
import type { AroundYouResult } from "../lib/around-you";
import { C, mono, label } from "./theme";

// ── Zone abbreviation (shared with LiveScreen) ──

const ZONE_ABBREVIATIONS: Record<string, string> = {
  "Stade de France": "St-France", "Parc des Princes": "PdP",
  "AccorHotels Arena": "Bercy", "Bercy Arena": "Bercy",
  "La Defense Arena": "Def Arena", "Roland Garros": "R-Garros",
  "Gare du Nord": "G. Nord", "Gare de Lyon": "G. Lyon",
  "Gare Montparnasse": "Montparn.", "Gare de l'Est": "G. Est",
  "Charles de Gaulle": "CDG", "Aeroport CDG": "CDG",
  "Champs-Elysees": "Champs", "Tour Eiffel": "Eiffel",
  "Saint-Germain-des-Pres": "St-Germ", "Quartier Latin": "Q. Latin",
};

function abbreviateZone(zone: string, maxLen: number = 12): string {
  if (ZONE_ABBREVIATIONS[zone]) return ZONE_ABBREVIATIONS[zone];
  for (const [full, short] of Object.entries(ZONE_ABBREVIATIONS)) {
    if (zone.includes(full)) return zone.replace(full, short);
  }
  return zone.length > maxLen ? zone.slice(0, maxLen - 1) + "." : zone;
}

// ── Ride Type Classification ──
// Helps driver anticipate client profile and ride nature

type RideType = "AERO" | "GARE" | "EVENT" | "NUIT" | "RESTO" | "PRO" | "SPOT";

const RIDE_TYPE_COLORS: Record<RideType, string> = {
  AERO: "#4ECCA3",   // Teal - airport runs
  GARE: "#5B8DEE",   // Blue - station pickups
  EVENT: "#E8B84A",  // Gold - concert/event
  NUIT: "#9B7BD4",   // Purple - nightlife
  RESTO: "#E88E5A",  // Orange - restaurant
  PRO: "#7B8FA1",    // Gray - business
  SPOT: "#6B7B8C",   // Default
};

function getRideType(signal: Signal): RideType {
  const type = signal.type || "";
  const reason = (signal.reason || "").toLowerCase();
  const zone = (signal.zone || "").toLowerCase();

  // Airport
  if (zone.includes("cdg") || zone.includes("orly") ||
      reason.includes("aeroport") || reason.includes("vols") || reason.includes("departs")) {
    return "AERO";
  }

  // Train station
  if (zone.includes("gare") || reason.includes("train") || reason.includes("arrivees")) {
    return "GARE";
  }

  // Concert / Event
  if (type === "event_exit" || type === "banlieue_pressure" ||
      reason.includes("concert") || reason.includes("spectateurs") ||
      reason.includes("festival") || reason.includes("expo") || reason.includes("salon")) {
    return "EVENT";
  }

  // Nightlife
  if (type === "nightlife" || reason.includes("club") || reason.includes("techno") ||
      reason.includes("nightlife") || zone.includes("pigalle") || reason.includes("bars")) {
    return "NUIT";
  }

  // Restaurant
  if (type === "restaurant" || reason.includes("restaurant") ||
      reason.includes("palace") || reason.includes("festive")) {
    return "RESTO";
  }

  // Business / Professional
  if (zone.includes("defense") || reason.includes("affaires") ||
      reason.includes("business") || reason.includes("bureau")) {
    return "PRO";
  }

  return "SPOT";
}

// ── Generate concrete cause line for CARTE ──
// More specific than generic "event" labels

function generateCarteCause(signal: Signal): string {
  const rideType = getRideType(signal);
  const reason = signal.reason || "";
  const zone = signal.zone || "";

  switch (rideType) {
    case "AERO":
      if (reason.includes("departs") || reason.includes("matinaux")) {
        return "Vague départs matinaux";
      }
      if (zone.includes("cdg")) return "Flux passagers CDG";
      if (zone.includes("orly")) return "Flux passagers Orly";
      return "Flux aéroport";

    case "GARE":
      if (reason.includes("train")) return "Arrivées trains";
      if (zone.includes("nord")) return "Gare du Nord - arrivées";
      if (zone.includes("lyon")) return "Gare de Lyon - arrivées";
      if (zone.includes("montparnasse")) return "Montparnasse - arrivées";
      return "Flux gare";

    case "EVENT":
      // Extract spectator count if present
      const spectMatch = reason.match(/(\d+)\s*spectateurs/);
      if (spectMatch) {
        return `Sortie event · ${spectMatch[1]} pers`;
      }
      if (reason.includes("concert")) return "Sortie concert";
      if (reason.includes("expo") || reason.includes("salon")) return "Fermeture expo";
      if (reason.includes("festival")) return "Fin festival";
      return "Sortie événement";

    case "NUIT":
      if (reason.includes("techno")) return "Fermeture club techno";
      if (zone.includes("pigalle")) return "Pigalle - clubs";
      if (zone.includes("oberkampf")) return "Oberkampf - bars";
      return "Sorties nuit";

    case "RESTO":
      if (reason.includes("premium") || reason.includes("palace")) {
        return "Sorties palace";
      }
      if (reason.includes("festive")) return "Vague festive";
      return "Sorties restaurants";

    case "PRO":
      return "Flux bureaux";

    default:
      // Extract key phrase from reason
      const shortReason = reason.split(" - ")[0];
      return shortReason.length > 20 ? shortReason.slice(0, 18) + "..." : shortReason || "Signal";
  }
}

// ── Helpers ──

function getTopSignals(signals: Signal[], limit: number = 5): Signal[] {
  return signals
    .filter((s) => s.kind === "live" || s.kind === "nearby" || s.kind === "alert")
    .slice(0, limit);
}

function getCorridorFromDirection(direction?: string): string {
  switch (direction) {
    case "nord": return "NORD";
    case "sud": return "SUD";
    case "est": return "EST";
    case "ouest": return "OUEST";
    default: return "CENTRE";
  }
}

// ── Direction helpers for spatial guidance ──

type Direction = "nord" | "est" | "sud" | "ouest" | "centre";

function getDirectionArrow(dir: Direction): string {
  switch (dir) {
    case "nord": return "↑";
    case "sud": return "↓";
    case "est": return "→";
    case "ouest": return "←";
    case "centre": return "◎";
  }
}

function getDirectionLabel(dir: Direction): string {
  switch (dir) {
    case "nord": return "NORD";
    case "sud": return "SUD";
    case "est": return "EST";
    case "ouest": return "OUEST";
    case "centre": return "CENTRE";
  }
}

// Infer direction from arrondissement
function getDirectionFromArr(arr: string | undefined): Direction {
  if (!arr) return "centre";
  const num = parseInt(arr.replace(/\D/g, ""), 10);
  if (isNaN(num)) return "centre";

  // Paris arrondissement approximate directions
  if ([17, 18, 19, 9, 10].includes(num)) return "nord";
  if ([11, 12, 20, 3, 4].includes(num)) return "est";
  if ([13, 14, 5, 6].includes(num)) return "sud";
  if ([16, 15, 7, 8].includes(num)) return "ouest";
  return "centre";
}

// Infer direction from zone name (fallback)
function getDirectionFromZone(zone: string | undefined): Direction {
  if (!zone) return "centre";
  const lower = zone.toLowerCase();
  if (lower.includes("nord") || lower.includes("gare du nord") || lower.includes("montmartre")) return "nord";
  if (lower.includes("est") || lower.includes("bastille") || lower.includes("nation")) return "est";
  if (lower.includes("sud") || lower.includes("montparnasse") || lower.includes("italie")) return "sud";
  if (lower.includes("ouest") || lower.includes("defense") || lower.includes("etoile")) return "ouest";
  return "centre";
}

// ── Proximity fallback for CARTE ──

function getCarteProximity(signal: Signal): { value: string; sublabel: string; color: string } {
  // Exact proximity
  if (signal.proximity_minutes !== undefined) {
    return {
      value: `${signal.proximity_minutes}′`,
      sublabel: "TRAJET",
      color: signal.proximity_minutes <= 10 ? C.green : C.textMid,
    };
  }

  // Nearby signals are close
  if (signal.kind === "nearby") {
    return { value: "~5′", sublabel: "PROCHE", color: C.green };
  }

  // Live signals - show "actif"
  if (signal.kind === "live") {
    return { value: "actif", sublabel: "MAINTENANT", color: C.green };
  }

  // Forming - show time until
  if (signal.is_forming && signal.minutes_until_start !== undefined) {
    return {
      value: `+${signal.minutes_until_start}′`,
      sublabel: "DEBUT",
      color: C.textMid,
    };
  }

  // Fallback to time window
  return {
    value: signal.time_window.label || signal.time_window.start || "—",
    sublabel: "",
    color: C.textDim,
  };
}

// ── Directional Hint ──

function DirectionalHint({ signal }: { signal: Signal | null }) {
  if (!signal) return null;

  // Determine direction from arrondissement or zone
  const direction = getDirectionFromArr(signal.arrondissement) !== "centre"
    ? getDirectionFromArr(signal.arrondissement)
    : getDirectionFromZone(signal.zone);

  const arrow = getDirectionArrow(direction);
  const dirLabel = getDirectionLabel(direction);
  const proximity = getCarteProximity(signal);
  const zoneDisplay = abbreviateZone(signal.zone || signal.title);

  // Ride type and cause
  const rideType = getRideType(signal);
  const cause = generateCarteCause(signal);

  return (
    <div
      className="px-4 py-3"
      style={{
        backgroundColor: C.surface,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      {/* Row 1: Direction arrow + zone + proximity */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span
            style={{
              fontSize: "1.5rem",
              color: C.green,
              fontWeight: 300,
            }}
          >
            {arrow}
          </span>
          <div className="flex flex-col">
            <span
              className="uppercase tracking-[0.1em]"
              style={{
                ...label,
                fontSize: "0.7rem",
                fontWeight: 500,
                color: C.text,
              }}
            >
              {dirLabel}
            </span>
            <span
              className="truncate"
              style={{
                ...label,
                fontSize: "0.65rem",
                color: C.textDim,
                maxWidth: 140,
              }}
            >
              {zoneDisplay}
            </span>
          </div>
        </div>

        {/* Travel time / status */}
        <div className="flex flex-col items-end">
          <span
            style={{
              ...mono,
              fontSize: "0.9rem",
              fontWeight: 500,
              color: proximity.color,
            }}
          >
            {proximity.value}
          </span>
          {proximity.sublabel && (
            <span
              className="uppercase tracking-[0.05em]"
              style={{
                ...label,
                fontSize: "0.5rem",
                color: C.textGhost,
              }}
            >
              {proximity.sublabel}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Cause + ride type badge */}
      <div className="flex items-center justify-between">
        <span
          style={{
            ...label,
            fontSize: "0.75rem",
            color: C.textMid,
          }}
        >
          {cause}
        </span>
        <span
          className="px-1.5 py-0.5 uppercase tracking-[0.08em]"
          style={{
            ...mono,
            fontSize: "0.5rem",
            fontWeight: 600,
            color: RIDE_TYPE_COLORS[rideType],
            backgroundColor: `${RIDE_TYPE_COLORS[rideType]}15`,
            borderRadius: 2,
          }}
        >
          {rideType}
        </span>
      </div>
    </div>
  );
}

// ── Signal Pin List ──

function SignalPinList({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {signals.map((signal) => {
        const proximity = getCarteProximity(signal);
        const zoneDisplay = abbreviateZone(signal.zone || "");
        const rideType = getRideType(signal);
        const cause = generateCarteCause(signal);

        return (
          <div
            key={signal.id}
            className="px-3 py-2.5"
            style={{
              backgroundColor: C.surface,
              border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${RIDE_TYPE_COLORS[rideType]}`,
              borderRadius: 3,
            }}
          >
            {/* Row 1: Zone + proximity */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                {/* Intensity indicator */}
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor:
                      signal.intensity >= 3
                        ? C.green
                        : signal.intensity >= 2
                          ? C.amber
                          : C.textDim,
                    boxShadow:
                      signal.intensity >= 3 ? `0 0 4px ${C.green}50` : "none",
                  }}
                />
                <span
                  className="truncate"
                  style={{
                    ...label,
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    color: C.text,
                  }}
                >
                  {zoneDisplay}
                </span>
              </div>
              <span
                style={{
                  ...mono,
                  fontSize: "0.7rem",
                  color: proximity.color,
                }}
              >
                {proximity.value}
              </span>
            </div>

            {/* Row 2: Cause + ride type badge */}
            <div className="flex items-center justify-between">
              <span
                className="truncate"
                style={{
                  ...label,
                  fontSize: "0.7rem",
                  color: C.textDim,
                  maxWidth: 160,
                }}
              >
                {cause}
              </span>
              <span
                className="px-1 py-0.5 uppercase tracking-[0.05em]"
                style={{
                  ...mono,
                  fontSize: "0.45rem",
                  fontWeight: 600,
                  color: RIDE_TYPE_COLORS[rideType],
                  backgroundColor: `${RIDE_TYPE_COLORS[rideType]}12`,
                  borderRadius: 2,
                }}
              >
                {rideType}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Reuse from LiveScreen pattern
function truncateReason(reason: string, maxLen: number = 25): string {
  if (reason.length <= maxLen) return reason;
  return reason.slice(0, maxLen).trim() + "...";
}

// ── Corridor Status ──

function CorridorStatus({ flowState }: { flowState: FlowState | null }) {
  if (!flowState) return null;

  const corridors = ["nord", "est", "sud", "ouest"];
  const zoneHeat = flowState.zoneHeat ?? {};
  const zoneSaturation = flowState.zoneSaturation ?? {};

  // Compute corridor heat from zones
  const corridorZones: Record<string, string[]> = {
    nord: ["17", "18", "19", "9", "10"],
    est: ["11", "12", "20", "3", "4"],
    sud: ["13", "14", "5", "6"],
    ouest: ["16", "15", "7", "8"],
  };

  const getCorridorStatus = (
    corridor: string
  ): "fluide" | "dense" | "sature" => {
    const zones = corridorZones[corridor] ?? [];
    let totalHeat = 0;
    let totalSat = 0;
    let count = 0;
    for (const z of zones) {
      totalHeat += zoneHeat[z] ?? 0;
      totalSat += zoneSaturation[z] ?? 0;
      count++;
    }
    const avgHeat = count > 0 ? totalHeat / count : 0;
    const avgSat = count > 0 ? totalSat / count : 0;
    if (avgSat > 60 || avgHeat > 0.7) return "sature";
    if (avgSat > 35 || avgHeat > 0.4) return "dense";
    return "fluide";
  };

  return (
    <div className="flex items-center justify-around py-2">
      {corridors.map((c) => {
        const status = getCorridorStatus(c);
        const color =
          status === "sature"
            ? C.red
            : status === "dense"
              ? C.amber
              : C.textDim;
        return (
          <div key={c} className="flex flex-col items-center gap-1">
            <span
              className="uppercase tracking-[0.1em]"
              style={{
                ...label,
                fontSize: "0.6rem",
                color: C.textDim,
              }}
            >
              {c.toUpperCase()}
            </span>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: color,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── CARTE Screen ──

interface CarteScreenProps {
  signalFeed: SignalFeed | null;
  flowState: FlowState | null;
  breathPhase: number;
  driverPosition?: { lat: number; lng: number; accuracy: number } | null;
  aroundYouResult?: AroundYouResult | null;
}

export function CarteScreen({
  signalFeed,
  flowState,
  breathPhase,
  driverPosition,
  aroundYouResult,
}: CarteScreenProps) {
  const signals = signalFeed?.signals ?? [];
  const topSignals = getTopSignals(signals, 5);

  // Top signal for directional hint
  const primarySignal = topSignals[0] ?? null;

  // Signal pins for map (top 3 only)
  const signalPins = topSignals.slice(0, 3).map((s) => ({
    id: s.id,
    zone: s.zone,
    arrondissement: s.arrondissement,
    intensity: s.intensity,
    kind: s.kind,
  }));

  // Hot zones from signals
  const hotZones = signals
    .filter((s) => s.kind === "live" && s.intensity >= 3)
    .map((s) => s.zone);

  // Friction zones from alerts
  const frictionZones = signals
    .filter((s) => s.kind === "alert" || s.type === "friction")
    .map((s) => s.zone);

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
      {/* Map */}
      <motion.div
        className="h-[45vh] lg:h-full lg:flex-[1.2] shrink-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <FlowMap
          zoneHeat={flowState?.zoneHeat ?? {}}
          zoneStates={flowState?.zoneState ?
            Object.fromEntries(
              Object.entries(flowState.zoneState).map(([k, v]) => [
                k,
                v === "hot" ? "active" : v === "warm" ? "forming" : "dormant",
              ])
            ) : {}
          }
          zoneSaturation={flowState?.zoneSaturation ?? {}}
          favoredZoneIds={flowState?.favoredZoneIds ?? []}
          breathPhase={breathPhase}
          windowState={flowState?.windowState ?? "stable"}
          banlieueHubs={flowState?.banlieueHubs}
          signalPins={signalPins}
          driverPosition={driverPosition}
        />
      </motion.div>

      {/* Side panel */}
      <div
        className="flex-1 flex flex-col min-h-0 lg:max-w-[360px]"
        style={{ borderLeft: `1px solid ${C.border}` }}
      >
        {/* Header */}
        <div
          className="shrink-0 px-4 py-3"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <span
            className="uppercase tracking-[0.2em]"
            style={{
              ...label,
              fontSize: "0.7rem",
              fontWeight: 500,
              color: C.text,
            }}
          >
            CARTE
          </span>
        </div>

        {/* Directional hint - primary action */}
        <DirectionalHint signal={primarySignal} />

        {/* Around You - local radar */}
        {aroundYouResult && aroundYouResult.signals.length > 0 && (
          <div style={{ borderBottom: `1px solid ${C.border}` }}>
            <AroundYouCompact result={aroundYouResult} isScanning={false} />
          </div>
        )}

        {/* Corridor status */}
        <div style={{ borderBottom: `1px solid ${C.border}` }}>
          <CorridorStatus flowState={flowState} />
        </div>

        {/* Top signals */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <span
            className="block mb-3 uppercase tracking-[0.12em]"
            style={{
              ...label,
              fontSize: "0.55rem",
              color: C.textDim,
            }}
          >
            SIGNAUX PROCHES
          </span>
          <SignalPinList signals={topSignals} />

          {topSignals.length === 0 && (
            <p
              className="text-center py-8"
              style={{
                ...label,
                fontSize: "0.8rem",
                color: C.textGhost,
              }}
            >
              Aucun signal actif
            </p>
          )}
        </div>

        {/* Driver position hint */}
        {signalFeed?.driver_position && (
          <div
            className="shrink-0 px-4 py-2"
            style={{ borderTop: `1px solid ${C.border}` }}
          >
            <span
              style={{
                ...mono,
                fontSize: "0.6rem",
                color: C.textGhost,
              }}
            >
              Position: {signalFeed.driver_position.lat.toFixed(4)},{" "}
              {signalFeed.driver_position.lng.toFixed(4)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
