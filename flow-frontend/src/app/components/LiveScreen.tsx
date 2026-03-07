// FLOW — LIVE Screen
// Two-layer signal feed: STRUCTURAL (big waves) + LOCAL (micro opportunities)
// Makes the city feel alive with real venues, events, and timings

import { motion, AnimatePresence } from "motion/react";
import type { Signal, SignalFeed } from "../types/signal";
import type { FlowState, ShiftPhase } from "../types/flow-state";
import { C, mono, label } from "./theme";

// ── Signal Categories with Icons ──
// Fast visual scanning for drivers

type SignalCategory = "concert" | "restaurant" | "theatre" | "airport" | "nightlife" | "train" | "expo" | "festival" | "hotel" | "other";

const CATEGORY_ICONS: Record<SignalCategory, string> = {
  concert: "🎵",
  restaurant: "🍽",
  theatre: "🎭",
  airport: "✈",
  nightlife: "🍸",
  train: "🚆",
  expo: "🎪",
  festival: "🎉",
  hotel: "🏨",
  other: "📍",
};

const CATEGORY_LABELS: Record<SignalCategory, string> = {
  concert: "Concert",
  restaurant: "Restaurants",
  theatre: "Théâtre",
  airport: "Aéroport",
  nightlife: "Nightlife",
  train: "Gare",
  expo: "Expo",
  festival: "Festival",
  hotel: "Hôtel",
  other: "Signal",
};

function getSignalCategory(signal: Signal): SignalCategory {
  const reason = (signal.reason || "").toLowerCase();
  const zone = (signal.zone || "").toLowerCase();
  const type = signal.type || "";
  const title = (signal.title || "").toLowerCase();

  // Concert / Arena
  if (reason.includes("concert") || reason.includes("spectateurs") ||
      title.includes("arena") || title.includes("zenith") || title.includes("olympia")) {
    return "concert";
  }

  // Restaurant
  if (type === "restaurant" || reason.includes("restaurant") ||
      reason.includes("palace") || reason.includes("festive")) {
    return "restaurant";
  }

  // Theatre / Opera
  if (reason.includes("theatre") || reason.includes("spectacle") ||
      reason.includes("opera") || title.includes("chatelet") || title.includes("garnier")) {
    return "theatre";
  }

  // Airport
  if (zone.includes("cdg") || zone.includes("orly") ||
      reason.includes("aeroport") || reason.includes("vols") || reason.includes("departs")) {
    return "airport";
  }

  // Nightlife / Clubs
  if (type === "nightlife" || reason.includes("club") || reason.includes("techno") ||
      reason.includes("nightlife") || zone.includes("pigalle") || reason.includes("bars")) {
    return "nightlife";
  }

  // Train stations
  if (zone.includes("gare") || reason.includes("train") || reason.includes("arrivees")) {
    return "train";
  }

  // Expo / Salon
  if (reason.includes("expo") || reason.includes("salon") || reason.includes("visiteurs")) {
    return "expo";
  }

  // Festival
  if (reason.includes("festival") || reason.includes("rer arrete") || type === "banlieue_pressure") {
    return "festival";
  }

  // Hotel
  if (reason.includes("hotel") || reason.includes("palace") || title.includes("costes")) {
    return "hotel";
  }

  return "other";
}

// ── Structural vs Local classification ──
// Structural = big city waves (arenas, airports, major stations)
// Local = micro opportunities (restaurant clusters, small venues)

function isStructuralSignal(signal: Signal): boolean {
  const category = getSignalCategory(signal);
  const reason = (signal.reason || "").toLowerCase();

  // Always structural: airports, major arenas, expos
  if (category === "airport") return true;
  if (category === "concert" && signal.intensity >= 3) return true;
  if (category === "expo") return true;
  if (category === "festival" && reason.includes("festival")) return true;

  // Check for large venue indicators
  if (reason.includes("arena") || reason.includes("stade")) return true;
  if (reason.includes("20000") || reason.includes("17000") || reason.includes("30000")) return true;

  // Major train stations during rush
  if (category === "train" && signal.intensity >= 3) return true;

  return false;
}

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

// ── Countdown formatter ──
// Creates urgency and habit loops

function formatCountdown(minutesUntil: number | undefined, isActive: boolean): {
  text: string;
  urgency: "imminent" | "soon" | "forming" | "active" | "none";
} {
  if (isActive) {
    return { text: "ACTIF", urgency: "active" };
  }

  if (minutesUntil === undefined || minutesUntil < 0) {
    return { text: "", urgency: "none" };
  }

  if (minutesUntil <= 5) {
    return { text: "imminent", urgency: "imminent" };
  }
  if (minutesUntil <= 15) {
    return { text: `dans ${minutesUntil}m`, urgency: "soon" };
  }
  if (minutesUntil <= 60) {
    return { text: `dans ${minutesUntil}m`, urgency: "forming" };
  }
  // > 60 min
  const hours = Math.floor(minutesUntil / 60);
  const mins = minutesUntil % 60;
  if (mins === 0) {
    return { text: `dans ~${hours}h`, urgency: "none" };
  }
  return { text: `dans ~${hours}h${mins > 15 ? String(mins).padStart(2, "0") : ""}`, urgency: "none" };
}

function getCountdownColor(urgency: string): string {
  switch (urgency) {
    case "imminent": return C.amber;
    case "soon": return C.green;
    case "active": return C.greenBright;
    case "forming": return C.textMid;
    default: return C.textGhost;
  }
}

// ── Rare Opportunity detection ──
// High-value signals with low competition

function isRareOpportunity(signal: Signal): boolean {
  const source = signal.source || "";
  const type = signal.type || "";
  const reason = (signal.reason || "").toLowerCase();
  const zone = (signal.zone || "").toLowerCase();

  // Banlieue events = rare by definition
  if (type === "banlieue_pressure") return true;

  // Chateau/gala events
  if (reason.includes("chateau") || reason.includes("gala") || reason.includes("mariage")) {
    return true;
  }

  // Late night festivals (no metro)
  if (reason.includes("festival") && (reason.includes("rer") || reason.includes("metro"))) {
    return true;
  }

  // Deep banlieue zones
  const banlieueZones = ["villepinte", "chevreuse", "maincy", "vaux", "meridon"];
  if (banlieueZones.some(z => zone.includes(z))) return true;

  // Airport early morning (03:00-06:00)
  if (zone.includes("cdg") || zone.includes("orly")) {
    const hour = new Date().getHours();
    if (hour >= 3 && hour <= 6) return true;
  }

  // Very high VTC probability signals
  if (signal.confidence === "high" && signal.intensity >= 4) {
    // Check if it's a premium crowd signal
    if (reason.includes("premium") || reason.includes("vip")) return true;
  }

  return false;
}

function getRareOpportunityReason(signal: Signal): string {
  const reason = (signal.reason || "").toLowerCase();
  const zone = (signal.zone || "").toLowerCase();

  if (reason.includes("chateau") || reason.includes("gala")) {
    return "Trajet long · Peu de chauffeurs";
  }
  if (zone.includes("villepinte") || reason.includes("festival")) {
    return "Zero metro · Courses garanties";
  }
  if (zone.includes("cdg") || zone.includes("orly")) {
    return "Courses longues · Faible concurrence";
  }
  if (reason.includes("premium") || reason.includes("vip")) {
    return "Clientele premium · Pourboires";
  }
  return "Opportunite rare";
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

// ── Generate concrete action copy based on signal type ──
// The goal: explain WHY, not just WHERE

function generateConcreteAction(signal: Signal): string {
  const source = signal.source || "";
  const type = signal.type || "";
  const title = signal.title || "";
  const zone = signal.zone || "";

  // Extract key info from reason
  const reason = signal.reason || "";

  // Special events: Concert, Expo, Banlieue
  if (source === "special-events" || type === "event_exit" || type === "banlieue_pressure") {
    // Concert exit
    if (reason.includes("concert") || reason.includes("spectateurs")) {
      const match = reason.match(/(\d+)\s*spectateurs/);
      const count = match ? match[1] : "";
      const venue = title.split(" - ")[0] || zone;
      if (signal.is_forming) {
        return `${venue} — sortie ${count ? count + " pers" : "imminente"}`;
      }
      return `${venue} — vague de sortie`;
    }
    // Expo exit
    if (reason.includes("expo") || reason.includes("salon") || reason.includes("visiteurs")) {
      return `${zone} — fermeture expo`;
    }
    // Festival / banlieue events
    if (reason.includes("festival") || reason.includes("RER") || reason.includes("goldmine")) {
      return `${zone} — fin event, zero metro`;
    }
    // Chateau / wedding events
    if (reason.includes("chateau") || reason.includes("mariages") || reason.includes("galas")) {
      return `${zone} — sortie gala, courses longues`;
    }
    // Airport
    if (reason.includes("CDG") || reason.includes("aeroport") || reason.includes("vols")) {
      return "CDG — vague departs matinaux";
    }
    // Club/techno
    if (reason.includes("techno") || reason.includes("club") || reason.includes("sold-out")) {
      return `${zone} — fermeture club`;
    }
    // Fashion week
    if (reason.includes("Fashion") || reason.includes("mode") || reason.includes("premium")) {
      if (signal.is_forming) return `${zone} — Fashion Week, arrivees`;
      return `${zone} — Fashion Week sortie`;
    }
  }

  // Restaurant signals
  if (source === "restaurant-daily" || type === "restaurant") {
    const venueName = signal.display_label || title.split(" ")[0] || zone;
    if (reason.includes("premium") || reason.includes("palace")) {
      return `${venueName} — sortie palace`;
    }
    if (reason.includes("festive")) {
      return `${venueName} — vague festive`;
    }
    return `${venueName} — fenetre sortie`;
  }

  // Nightlife signals
  if (type === "nightlife" || type === "club") {
    return `${zone} — fermeture clubs`;
  }

  // Station/transport signals
  if (type === "station" || type === "transport") {
    if (zone.includes("CDG") || zone.includes("Orly")) {
      return `${zone} — flux passagers`;
    }
    if (zone.includes("Gare")) {
      return `${zone} — arrivees trains`;
    }
  }

  // Default: use existing action if it's concrete enough
  const existingAction = signal.action || "";
  if (existingAction.length < 30 && !existingAction.includes("Position")) {
    return existingAction;
  }

  // Fallback: zone + simple context from reason
  const shortReason = reason.split(" - ")[0] || reason.slice(0, 20);
  return `${zone} — ${shortReason}`;
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

// ── Extract venue name from signal ──

function extractVenueName(signal: Signal): string {
  const title = signal.title || "";
  const displayLabel = signal.display_label || "";
  const zone = signal.zone || "";

  // Use display_label if it's a venue name (not a generic label)
  if (displayLabel && !["CONCERT", "EXPO", "BANLIEUE", "EVENT"].includes(displayLabel.toUpperCase())) {
    return displayLabel;
  }

  // Extract venue from title (format: "Venue - Event")
  if (title.includes(" - ")) {
    return title.split(" - ")[0];
  }

  // Fallback to zone
  return zone;
}

// ── Generate cause/reason line ──

function generateCauseLine(signal: Signal): string {
  const category = getSignalCategory(signal);
  const reason = signal.reason || "";

  switch (category) {
    case "concert":
      if (reason.includes("spectateurs")) {
        const match = reason.match(/(\d+)\s*spectateurs/);
        return match ? `Sortie concert · ${match[1]} pers` : "Sortie concert";
      }
      return "Sortie concert";

    case "restaurant":
      if (reason.includes("premium") || reason.includes("palace")) {
        return "Fermeture palace";
      }
      if (reason.includes("festive")) {
        return "Vague festive";
      }
      return "Fermeture restaurants";

    case "theatre":
      return "Fin spectacle";

    case "airport":
      if (reason.includes("departs") || reason.includes("matinaux")) {
        return "Vague départs";
      }
      return "Flux passagers";

    case "nightlife":
      if (reason.includes("techno")) return "Sortie club techno";
      return "Fermeture clubs";

    case "train":
      return "Arrivées trains";

    case "expo":
      return "Fermeture salon";

    case "festival":
      if (reason.includes("metro") || reason.includes("RER")) {
        return "Fin festival · Zero métro";
      }
      return "Sortie festival";

    case "hotel":
      return "Sorties hôtel";

    default:
      // Use first part of reason if available
      const shortReason = reason.split(" - ")[0];
      return shortReason.length > 25 ? shortReason.slice(0, 23) + "..." : shortReason || "Signal";
  }
}

// ── Signal Card (City-Alive Design) ──
// Shows: ICON + VENUE | CAUSE | TIMING
// Makes the city feel like it's moving

function SignalCard({ signal, isTop = false }: { signal: Signal; isTop?: boolean }) {
  const intensityColor = getIntensityColor(signal.intensity);
  const category = getSignalCategory(signal);
  const icon = CATEGORY_ICONS[category];
  const venueName = extractVenueName(signal);
  const causeLine = generateCauseLine(signal);

  // Countdown
  const countdown = formatCountdown(signal.minutes_until_start, signal.is_active ?? false);
  const countdownColor = getCountdownColor(countdown.urgency);

  // Rare opportunity detection
  const isRare = isRareOpportunity(signal);
  const rareReason = isRare ? getRareOpportunityReason(signal) : null;

  // Is this a structural (big) signal?
  const isStructural = isStructuralSignal(signal);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="px-4 py-3"
      style={{
        backgroundColor: C.surface,
        border: isRare ? `1px solid ${C.amber}40` :
                isStructural ? `1px solid ${C.greenDim}` :
                `1px solid ${C.border}`,
        borderRadius: 4,
        borderLeft: `3px solid ${isRare ? C.amber : intensityColor}`,
        boxShadow: isRare ? `0 0 12px ${C.amber}20` :
                   isStructural ? `0 0 8px ${C.green}10` : "none",
      }}
    >
      {/* RARE OPPORTUNITY banner */}
      {isRare && (
        <div
          className="flex items-center gap-2 mb-2 pb-2"
          style={{ borderBottom: `1px solid ${C.amber}25` }}
        >
          <span
            className="uppercase tracking-[0.12em]"
            style={{
              ...label,
              fontSize: "0.5rem",
              fontWeight: 600,
              color: C.amber,
            }}
          >
            RARE
          </span>
          <span
            style={{
              ...label,
              fontSize: "0.55rem",
              color: C.textDim,
            }}
          >
            {rareReason}
          </span>
        </div>
      )}

      {/* ROW 1: Icon + Venue Name + Countdown */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {/* Category icon */}
          <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{icon}</span>
          {/* Venue name - prominent */}
          <span
            className="truncate"
            style={{
              ...label,
              fontSize: "0.95rem",
              fontWeight: 600,
              color: C.text,
              letterSpacing: "0.01em",
            }}
          >
            {venueName}
          </span>
        </div>
        {/* Countdown badge */}
        {countdown.text && (
          <span
            className="uppercase tracking-[0.05em] px-2 py-0.5 shrink-0"
            style={{
              ...mono,
              fontSize: "0.6rem",
              fontWeight: countdown.urgency === "imminent" ? 600 : 400,
              color: countdownColor,
              backgroundColor: countdown.urgency === "active" ? `${C.green}15` :
                              countdown.urgency === "imminent" ? `${C.amber}15` : "transparent",
              borderRadius: 2,
            }}
          >
            {countdown.text}
          </span>
        )}
      </div>

      {/* ROW 2: Cause line - what's happening */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          style={{
            ...label,
            fontSize: "0.8rem",
            fontWeight: 400,
            color: C.textMid,
          }}
        >
          {causeLine}
        </span>
      </div>

      {/* ROW 3: Timing + zone */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            style={{
              ...mono,
              fontSize: "0.7rem",
              color: C.textDim,
            }}
          >
            {signal.time_window.label || signal.time_window.start}
          </span>
          {signal.zone && signal.zone !== venueName && (
            <span
              style={{
                ...label,
                fontSize: "0.6rem",
                color: C.textGhost,
              }}
            >
              · {abbreviateZone(signal.zone)}
            </span>
          )}
        </div>
        {/* Intensity dots */}
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                backgroundColor: level <= signal.intensity ? intensityColor : `${C.textGhost}30`,
              }}
            />
          ))}
        </div>
      </div>
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

// ── City Pulse Bar ──
// Shows pressure distribution across corridors at a glance

interface CorridorPulse {
  id: string;
  label: string;
  intensity: number; // 0-1
}

function computeCorridorPulses(signals: Signal[], flowState: FlowState | null): CorridorPulse[] {
  // Zone to corridor mapping
  const zoneToCorridorMap: Record<string, string> = {
    "17": "nord", "18": "nord", "19": "nord", "9": "nord", "10": "nord",
    "11": "est", "12": "est", "20": "est", "3": "est", "4": "est",
    "13": "sud", "14": "sud", "5": "sud", "6": "sud",
    "16": "ouest", "15": "ouest", "7": "ouest", "8": "ouest",
  };

  // Compute intensity per corridor
  const corridorScores: Record<string, number> = {
    nord: 0, est: 0, sud: 0, ouest: 0
  };

  for (const signal of signals) {
    const arr = signal.arrondissement || "";
    const corridor = zoneToCorridorMap[arr];
    if (corridor) {
      // Weight by priority score and activity
      const weight = (signal.is_active ? 1.5 : 1.0) * (signal.intensity / 4);
      corridorScores[corridor] += weight;
    }

    // Also check zone text for corridor hints
    const zoneLower = (signal.zone || "").toLowerCase();
    if (zoneLower.includes("pigalle") || zoneLower.includes("montmartre") || zoneLower.includes("cdg")) {
      corridorScores["nord"] += 0.5;
    } else if (zoneLower.includes("bercy") || zoneLower.includes("bastille") || zoneLower.includes("marais")) {
      corridorScores["est"] += 0.5;
    } else if (zoneLower.includes("trocadero") || zoneLower.includes("champs") || zoneLower.includes("defense")) {
      corridorScores["ouest"] += 0.5;
    }
  }

  // Also use flowState zone heat if available
  const zoneHeat = flowState?.zoneHeat ?? {};
  for (const [zoneId, heat] of Object.entries(zoneHeat)) {
    const corridor = zoneToCorridorMap[zoneId];
    if (corridor && typeof heat === "number") {
      corridorScores[corridor] += heat * 2;
    }
  }

  // Normalize to 0-1
  const maxScore = Math.max(...Object.values(corridorScores), 1);
  const corridors: CorridorPulse[] = [
    { id: "est", label: "EST", intensity: corridorScores["est"] / maxScore },
    { id: "nord", label: "NORD", intensity: corridorScores["nord"] / maxScore },
    { id: "ouest", label: "OUEST", intensity: corridorScores["ouest"] / maxScore },
    { id: "sud", label: "SUD", intensity: corridorScores["sud"] / maxScore },
  ];

  // Sort by intensity descending
  corridors.sort((a, b) => b.intensity - a.intensity);

  return corridors;
}

function CityPulseBar({ signals, flowState }: { signals: Signal[]; flowState: FlowState | null }) {
  const pulses = computeCorridorPulses(signals, flowState);
  const now = new Date();
  const dayName = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"][now.getDay()];
  const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className="px-4 py-2"
      style={{
        backgroundColor: C.surface,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="uppercase tracking-[0.15em]"
          style={{
            ...label,
            fontSize: "0.5rem",
            color: C.textGhost,
          }}
        >
          CHAMP VILLE
        </span>
        <span
          style={{
            ...mono,
            fontSize: "0.55rem",
            color: C.textDim,
          }}
        >
          {dayName} {timeStr}
        </span>
      </div>

      {/* Corridor bars */}
      <div className="flex flex-col gap-1">
        {pulses.map((pulse) => (
          <div key={pulse.id} className="flex items-center gap-2">
            <span
              className="w-10 uppercase tracking-[0.08em]"
              style={{
                ...label,
                fontSize: "0.55rem",
                color: pulse.intensity > 0.5 ? C.text : C.textDim,
              }}
            >
              {pulse.label}
            </span>
            <div
              className="flex-1 h-1.5 rounded-sm overflow-hidden"
              style={{ backgroundColor: `${C.textGhost}20` }}
            >
              <div
                style={{
                  width: `${Math.max(5, pulse.intensity * 100)}%`,
                  height: "100%",
                  backgroundColor: pulse.intensity > 0.7 ? C.green :
                                  pulse.intensity > 0.4 ? C.amber : C.textDim,
                  borderRadius: 2,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
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

  // Split signals into two layers
  const structuralSignals = signals.filter(isStructuralSignal);
  const localSignals = signals.filter((s) => !isStructuralSignal(s));

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

      {/* City Pulse Bar - pressure distribution at a glance */}
      <CityPulseBar signals={signals} flowState={flowState} />

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
          {/* STRUCTURAL SIGNALS — Big city waves */}
          {structuralSignals.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="uppercase tracking-[0.15em]"
                  style={{
                    ...label,
                    fontSize: "0.5rem",
                    color: C.green,
                    fontWeight: 600,
                  }}
                >
                  VAGUES MAJEURES
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: `${C.green}30`,
                  }}
                />
              </div>
              <div className="flex flex-col gap-2.5">
                <AnimatePresence mode="popLayout">
                  {structuralSignals.slice(0, 4).map((signal) => (
                    <SignalCard key={signal.id} signal={signal} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* LOCAL OPPORTUNITIES — Micro waves */}
          {localSignals.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="uppercase tracking-[0.15em]"
                  style={{
                    ...label,
                    fontSize: "0.5rem",
                    color: C.textDim,
                    fontWeight: 500,
                  }}
                >
                  OPPORTUNITÉS LOCALES
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: `${C.border}`,
                  }}
                />
              </div>
              <div className="flex flex-col gap-2.5">
                <AnimatePresence mode="popLayout">
                  {localSignals.slice(0, 6).map((signal) => (
                    <SignalCard key={signal.id} signal={signal} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Empty state if no signals in either category */}
          {structuralSignals.length === 0 && localSignals.length === 0 && (
            <div
              className="text-center py-8"
              style={{ color: C.textGhost }}
            >
              <span style={{ ...label, fontSize: "0.75rem" }}>
                Aucun signal actif
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
