// FLOW — Temporal Field Intelligence
// Action. Reaction. Information. Money.

import { TERRITORIES } from "./parisData";
import { generateRestaurantSignals, getRestaurantVenuesStatic } from "../lib/restaurant-signals";
import { generateSpecialEventSignals, getSpecialEventsStatic } from "../lib/special-event-signals";
import type { Signal } from "../types/signal";

// ── Types ──

export type ZoneState = "dormant" | "forming" | "active" | "peak" | "fading";
export type WindowState = "forming" | "active" | "closing" | "stable";
export type ShiftPhase = "calme" | "montee" | "pic" | "dispersion";
export type ActionType = "hold" | "prepare" | "move" | "rest";

export interface BanlieueHubState {
  id: string;
  heat: number;
  status: "dormant" | "forming" | "active";
  nextPic?: string;
  corridor: "nord" | "est" | "sud" | "ouest";
}

export interface ContextSignal {
  text: string;
  type: "event" | "weather" | "transport" | "surge";
}

export interface WindowMemory {
  time: string;
  zone: string;
  captured: boolean;
}

export interface TimelineSlot {
  time: string;
  zone: string;
  saturation: number; // 0-100
  earnings: number; // EUR/h estimate
}

export interface HotspotPeak {
  time: string;
  zone: string;
  reason: string;
  score: number; // 0-100
}

export interface FlowState {
  // Core
  windowState: WindowState;
  windowLabel: string;
  windowCountdown: string; // MM:SS format
  windowMinutes: number;
  shiftPhase: ShiftPhase;
  shiftProgress: number;
  action: ActionType;
  actionLabel: string;
  confidence: number; // 0-100

  // Spatial
  fieldMessage: string;
  temporalMessage: string;
  targetZone: string;
  targetZoneArr: string; // arrondissement
  favoredCorridor: string;
  favoredZoneIds: string[];
  alternatives: string[];
  zoneHeat: Record<string, number>;
  zoneStates: Record<string, ZoneState>;
  zoneSaturation: Record<string, number>;

  // Money
  earningsEstimate: [number, number]; // range EUR/h
  earningsIntensity: "FORT" | "MODERE" | "FAIBLE";
  sessionEarnings: number; // simulated cumulative

  // Context
  signals: ContextSignal[];
  memory: WindowMemory[];

  // Timeline
  upcoming: TimelineSlot[];
  peaks: HotspotPeak[];
}

// ── Constants ──

const CORRIDORS = [
  {
    id: "east",
    label: "corridor est",
    zones: ["11", "12", "20", "3", "4"],
    targetZone: "Bastille",
    targetArr: "XI",
  },
  {
    id: "west",
    label: "rive gauche",
    zones: ["16", "15", "7", "8"],
    targetZone: "Trocadero",
    targetArr: "XVI",
  },
  {
    id: "north",
    label: "nord",
    zones: ["17", "18", "19", "9", "10"],
    targetZone: "Montmartre",
    targetArr: "XVIII",
  },
  {
    id: "south",
    label: "arc sud",
    zones: ["13", "14", "5", "6"],
    targetZone: "Quartier Latin",
    targetArr: "V",
  },
  {
    id: "center",
    label: "centre",
    zones: ["1", "2", "cite", "stlouis"],
    targetZone: "Chatelet",
    targetArr: "I",
  },
];

const TERRITORY_IDS = TERRITORIES.map((t) => t.id);

const CYCLE_DURATION = 300; // 5 min window cycle
const SHIFT_DURATION = 1500; // 25 min shift arc

/**
 * Compute honest metro status based on current time.
 * This is STRUCTURAL data (horaire type), not real-time RATP.
 */
function computeMetroStatus(): ContextSignal | null {
  const now = new Date();
  const hour = now.getHours();
  const min = now.getMinutes();
  const totalMin = hour * 60 + min;

  const METRO_START = 5 * 60 + 30;
  const METRO_REDUCED = 23 * 60 + 30;
  const METRO_LAST_WINDOW = 24 * 60 + 30;
  const METRO_END = 25 * 60 + 15;

  const effectiveMin = hour < 5 ? totalMin + 24 * 60 : totalMin;

  if (effectiveMin < METRO_START) {
    return { text: "Metro arrete (reprise ~05h30)", type: "transport" };
  }
  if (effectiveMin >= METRO_START && effectiveMin < METRO_REDUCED) {
    return null;
  }
  if (effectiveMin >= METRO_REDUCED && effectiveMin < METRO_LAST_WINDOW) {
    const minsToLast = METRO_LAST_WINDOW - effectiveMin;
    if (minsToLast <= 60) {
      return { text: `Derniers metros dans ${minsToLast}min`, type: "transport" };
    }
    return { text: "Metro frequence reduite", type: "transport" };
  }
  if (effectiveMin >= METRO_LAST_WINDOW && effectiveMin < METRO_END) {
    return { text: "Derniers metros en cours", type: "transport" };
  }
  return { text: "Metro arrete (reprise ~05h30)", type: "transport" };
}

export function computeContextSignals(): ContextSignal[] {
  const signals: ContextSignal[] = [];
  const metroStatus = computeMetroStatus();
  if (metroStatus) signals.push(metroStatus);
  return signals;
}

/**
 * Generate daily restaurant exit signals.
 * These are recurring signals that increase Flow's usefulness
 * on normal nights (Monday-Sunday), not just event nights.
 */
export function computeRestaurantSignals(now: Date = new Date()): Signal[] {
  const venues = getRestaurantVenuesStatic();
  return generateRestaurantSignals(venues, now);
}

/**
 * Generate special event signals for today.
 * Mega-events, expos, banlieue festivals, chateau galas.
 * These are date-specific structural demand anomalies.
 */
export function computeSpecialEventSignals(now: Date = new Date()): Signal[] {
  const events = getSpecialEventsStatic();
  return generateSpecialEventSignals(events, now);
}

// ── Helpers ──

function hashNoise(id: string, seed: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  const x = Math.sin(h * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getZoneState(heat: number, saturation: number): ZoneState {
  if (heat > 0.7) return saturation > 75 ? "peak" : "active";
  if (heat > 0.35) return "forming";
  if (heat > 0.12) return "fading";
  return "dormant";
}

// ── Core computation ──

export function computeFlowState(sessionStartTime: number): FlowState {
  const now = Date.now();
  const sessionSeconds = (now - sessionStartTime) / 1000;
  const totalSeconds = now / 1000;

  // ── Shift phase ──
  const rawProgress = sessionSeconds / SHIFT_DURATION;
  const shiftProgress = rawProgress % 1;

  let shiftPhase: ShiftPhase;
  if (shiftProgress < 0.2) shiftPhase = "calme";
  else if (shiftProgress < 0.5) shiftPhase = "montee";
  else if (shiftProgress < 0.75) shiftPhase = "pic";
  else shiftPhase = "dispersion";

  // ── Window cycle ──
  const cycleSeconds = totalSeconds % CYCLE_DURATION;
  const cycleProgress = cycleSeconds / CYCLE_DURATION;
  const cycleIndex = Math.floor(totalSeconds / CYCLE_DURATION);

  let windowState: WindowState;
  let windowRemainingSeconds: number;

  if (cycleProgress < 0.18) {
    windowState = "forming";
    windowRemainingSeconds = (0.18 - cycleProgress) * CYCLE_DURATION + 0.37 * CYCLE_DURATION;
  } else if (cycleProgress < 0.55) {
    windowState = "active";
    windowRemainingSeconds = (0.55 - cycleProgress) * CYCLE_DURATION;
  } else if (cycleProgress < 0.7) {
    windowState = "closing";
    windowRemainingSeconds = (0.7 - cycleProgress) * CYCLE_DURATION;
  } else {
    windowState = "stable";
    windowRemainingSeconds = (1.0 - cycleProgress) * CYCLE_DURATION + 0.18 * CYCLE_DURATION;
  }

  const windowMinutes = Math.max(1, Math.ceil(windowRemainingSeconds / 60));
  const windowCountdown = formatCountdown(Math.max(0, windowRemainingSeconds));

  // ── Favored corridor ──
  const corridor = CORRIDORS[cycleIndex % CORRIDORS.length];
  const nextCorridor = CORRIDORS[(cycleIndex + 1) % CORRIDORS.length];

  // ── Action ──
  let action: ActionType;
  let actionLabel: string;

  if (shiftPhase === "dispersion") {
    action = "rest";
    actionLabel = "REPOS";
  } else if (windowState === "active") {
    action = "move";
    actionLabel = "BOUGER";
  } else if (windowState === "forming") {
    action = "prepare";
    actionLabel = "PREPARER";
  } else {
    action = "hold";
    actionLabel = "MAINTENIR";
  }

  // ── Window label ──
  const windowLabels: Record<WindowState, string> = {
    forming: "FENETRE EN FORMATION",
    active: "FENETRE ACTIVE",
    closing: "FENETRE FERME",
    stable: "CHAMP STABLE",
  };

  // ── Field messages ──
  let fieldMessage: string;
  let temporalMessage: string;

  switch (windowState) {
    case "forming":
      fieldMessage = `Champ favorise ${corridor.label}.`;
      temporalMessage = `Ouverture estimee ~${windowMinutes} min.`;
      break;
    case "active":
      fieldMessage = `${corridor.targetZone} actif.`;
      temporalMessage = `Fenetre ouverte — ${windowMinutes} min restantes.`;
      break;
    case "closing":
      fieldMessage = `Fenetre se ferme.`;
      temporalMessage = `${nextCorridor.targetZone} en formation.`;
      break;
    case "stable":
      fieldMessage = `Champ stable.`;
      temporalMessage = `Transition dans ~${windowMinutes} min.`;
      break;
  }

  // ── Zone heat + states + saturation ──
  const zoneHeat: Record<string, number> = {};
  const zoneStates: Record<string, ZoneState> = {};
  const zoneSaturation: Record<string, number> = {};

  for (const id of TERRITORY_IDS) {
    const isFavored = corridor.zones.includes(id);
    const isNextFavored = nextCorridor.zones.includes(id);
    const noise = hashNoise(id, cycleIndex) * 0.08;

    let heat = 0;
    if (isFavored) {
      switch (windowState) {
        case "active":
          heat = 0.55 + hashNoise(id, cycleIndex * 7) * 0.4;
          break;
        case "forming":
          heat = 0.2 + cycleProgress * 2.0;
          break;
        case "closing":
          heat = 0.3 * (1 - (cycleProgress - 0.55) / 0.15);
          break;
        default:
          heat = 0.05;
      }
    } else if (isNextFavored && windowState === "stable" && cycleProgress > 0.82) {
      heat = 0.1 + (cycleProgress - 0.82) * 2.5;
    }

    heat += Math.sin(totalSeconds * 0.08 + hashNoise(id, 0) * 20) * 0.02;
    heat += noise * 0.2;
    heat = Math.max(0, Math.min(1, heat));
    zoneHeat[id] = heat;

    // Saturation: high-heat zones tend to get saturated over time
    const baseSat = isFavored && windowState === "active"
      ? 30 + hashNoise(id, cycleIndex * 3) * 50
      : 10 + hashNoise(id, cycleIndex) * 25;
    zoneSaturation[id] = Math.round(Math.min(95, baseSat));

    zoneStates[id] = getZoneState(heat, zoneSaturation[id]);
  }

  // ── Alternatives ──
  const altZones = TERRITORY_IDS
    .filter((id) => !corridor.zones.includes(id) && zoneHeat[id] > 0.15)
    .sort((a, b) => zoneHeat[b] - zoneHeat[a])
    .slice(0, 3)
    .map((id) => TERRITORIES.find((t) => t.id === id)?.name ?? id);

  // ── Earnings ──
  let earningsLow: number;
  let earningsHigh: number;

  if (windowState === "active" && shiftPhase === "pic") {
    earningsLow = 42;
    earningsHigh = 58;
  } else if (windowState === "active") {
    earningsLow = 32;
    earningsHigh = 48;
  } else if (windowState === "forming") {
    earningsLow = 25;
    earningsHigh = 38;
  } else if (shiftPhase === "dispersion") {
    earningsLow = 15;
    earningsHigh = 25;
  } else {
    earningsLow = 20;
    earningsHigh = 32;
  }
  // Add noise
  earningsLow += Math.round(Math.sin(totalSeconds * 0.01) * 3);
  earningsHigh += Math.round(Math.sin(totalSeconds * 0.007) * 4);

  const avgRate = (earningsLow + earningsHigh) / 2;
  const earningsIntensity: "FORT" | "MODERE" | "FAIBLE" =
    avgRate >= 40 ? "FORT" : avgRate >= 25 ? "MODERE" : "FAIBLE";

  // Session cumulative (simulated)
  const sessionHours = sessionSeconds / 3600;
  const sessionEarnings = Math.round(sessionHours * avgRate * (0.85 + shiftProgress * 0.3));

  // ── Confidence ──
  const baseConfidence = 65 + Math.min(25, (sessionSeconds / SHIFT_DURATION) * 25);
  const confNoise = Math.sin(sessionSeconds * 0.015) * 5;
  const confidence = Math.min(98, Math.max(55, Math.round(baseConfidence + confNoise)));

  // ── Context signals ──
  const signalSet = computeContextSignals();

  // ── Window memory (simulated last 3 windows) ──
  const memory: WindowMemory[] = [];
  const currentHour = new Date().getHours();
  const currentMin = new Date().getMinutes();
  for (let i = 3; i >= 1; i--) {
    const minsAgo = i * 8 + Math.round(hashNoise(String(i), cycleIndex) * 5);
    let memMin = currentMin - minsAgo;
    let memHour = currentHour;
    while (memMin < 0) {
      memMin += 60;
      memHour--;
    }
    if (memHour < 0) memHour += 24;
    const prevCorr = CORRIDORS[(cycleIndex - i + CORRIDORS.length * 10) % CORRIDORS.length];
    memory.push({
      time: `${String(memHour).padStart(2, "0")}:${String(memMin).padStart(2, "0")}`,
      zone: prevCorr.targetZone,
      captured: hashNoise(String(i), cycleIndex * 11) > 0.35,
    });
  }

  // ── Upcoming timeline ──
  const upcoming: TimelineSlot[] = [];
  for (let i = 1; i <= 4; i++) {
    const futureCorr = CORRIDORS[(cycleIndex + i) % CORRIDORS.length];
    const futureMin = currentMin + i * 6;
    const futureHour = currentHour + Math.floor(futureMin / 60);
    const displayMin = futureMin % 60;
    const sat = Math.round(20 + hashNoise(futureCorr.id, cycleIndex + i) * 60);
    const earn = Math.round(25 + hashNoise(futureCorr.id, cycleIndex + i + 100) * 30);
    upcoming.push({
      time: `${String(futureHour % 24).padStart(2, "0")}:${String(displayMin).padStart(2, "0")}`,
      zone: futureCorr.targetZone,
      saturation: sat,
      earnings: earn,
    });
  }

  // ── Peaks tonight ──
  const peaks: HotspotPeak[] = [
    {
      time: "23h15",
      zone: "Bastille",
      reason: "concert",
      score: Math.round(70 + hashNoise("peak1", cycleIndex) * 25),
    },
    {
      time: "00h30",
      zone: "Montmartre",
      reason: "nuit",
      score: Math.round(60 + hashNoise("peak2", cycleIndex) * 30),
    },
    {
      time: "01h00",
      zone: "Chatelet",
      reason: "derniers metros",
      score: Math.round(55 + hashNoise("peak3", cycleIndex) * 35),
    },
  ];

  return {
    windowState,
    windowLabel: windowLabels[windowState],
    windowCountdown,
    windowMinutes,
    shiftPhase,
    shiftProgress,
    action,
    actionLabel,
    confidence,
    fieldMessage,
    temporalMessage,
    targetZone: corridor.targetZone,
    targetZoneArr: corridor.targetArr,
    favoredCorridor: corridor.label,
    favoredZoneIds: corridor.zones,
    alternatives: altZones,
    zoneHeat,
    zoneStates,
    zoneSaturation,
    earningsEstimate: [earningsLow, earningsHigh],
    earningsIntensity,
    sessionEarnings,
    signals: signalSet,
    memory,
    upcoming,
    peaks,
  };
}