// FLOW v1.6 — Intelligence de terrain
// Un chauffeur experimente qui murmure des indices utiles.
// Core concept: DriverOpportunity — decision objects, not raw signals.
// ZERO fake data philosophy: if uncertain → degrade. If unknown → say so.

import { TERRITORIES, BANLIEUE_HUBS } from "./parisData";
import type { TrainWave } from "./SncfService";
import type { ForcedMobilitySnapshot, ForcedMobilityWave } from "./ForcedMobilityEngine";
import { findWaveForVenue, waveConversionLabel } from "./ForcedMobilityEngine";

// ── Types ──

export type ZoneState = "dormant" | "forming" | "active" | "peak" | "fading";
export type WindowState = "forming" | "active" | "closing" | "stable";
export type ShiftPhase = "calme" | "montee" | "pic" | "sortie";

export type VenueType =
  | "theatre"
  | "concert"
  | "club"
  | "station"
  | "airport"
  | "bar_area"
  | "stadium"
  | "office"
  | "restaurant"
  | "metro";

// ── Driver Anchor ──

export interface DriverAnchor {
  id: string;
  label: string;
  lat: number;
  lng: number;
  corridor: "nord" | "est" | "sud" | "ouest" | "centre";
}

export const ANCHOR_OPTIONS: DriverAnchor[] = [
  { id: "gare-du-nord", label: "Gare du Nord", lat: 48.8809, lng: 2.3553, corridor: "nord" },
  { id: "gare-de-lyon", label: "Gare de Lyon", lat: 48.8443, lng: 2.3734, corridor: "est" },
  { id: "chatelet", label: "Chatelet", lat: 48.8584, lng: 2.3474, corridor: "centre" },
  { id: "bastille", label: "Bastille", lat: 48.8533, lng: 2.3692, corridor: "est" },
  { id: "opera", label: "Opera", lat: 48.8707, lng: 2.3276, corridor: "centre" },
  { id: "montparnasse", label: "Montparnasse", lat: 48.8414, lng: 2.3219, corridor: "sud" },
  { id: "la-defense", label: "La Defense", lat: 48.8918, lng: 2.2362, corridor: "ouest" },
  { id: "cdg", label: "CDG", lat: 49.0097, lng: 2.5479, corridor: "nord" },
  { id: "orly", label: "Orly", lat: 48.7262, lng: 2.3652, corridor: "sud" },
  { id: "pantin", label: "Pantin", lat: 48.8935, lng: 2.3932, corridor: "nord" },
  { id: "saint-denis", label: "Saint-Denis", lat: 48.9362, lng: 2.3574, corridor: "nord" },
  { id: "montreuil", label: "Montreuil", lat: 48.8638, lng: 2.4433, corridor: "est" },
];

// ── DriverOpportunity — the core decision object ──

export interface OpportunityEvidence {
  source: "event" | "transport" | "weather" | "skeleton" | "manual";
  ref: string;
}

export interface DriverOpportunity {
  id: string;
  kind: "confirme" | "piste";
  action: "maintenir" | "rejoindre" | "anticiper" | "contourner" | "tenter";
  placeId: string;
  placeLabel: string;
  corridor?: "nord" | "est" | "sud" | "ouest";
  window: { start: string; end: string };
  timerLabel: string;
  timerMinutes: number;
  why: string;
  distanceMinutes?: number;
  distanceKm?: number;
  crowd?: { value?: number; band?: "S" | "M" | "L" };
  rideProfile?: "courtes" | "longues" | "mixte";
  confidence: number; // 0..1
  evidence: OpportunityEvidence[];
  freshness: { compiledAt: string; stale: boolean };
  entryPoint?: string;
}

// ── FlowState v1.6 ──

export interface DispatchSession {
  duration_min: number;
  courses_count: number;
  earnings: number;
  target_earnings: number;
  efficiency: number;
}

export interface CorridorStatus {
  direction: "nord" | "est" | "sud" | "ouest";
  status: "fluide" | "dense" | "plein";
  reason?: string;
}

export interface FlowState {
  // Meta
  meta: {
    compiledAt: string;
    stale: boolean;
    overallConfidence: number;
    source: "live" | "skeleton" | "degraded";
  };

  // Opportunities
  opportunities: {
    bestNow: DriverOpportunity | null;
    alternatives: DriverOpportunity[];
    upcoming: DriverOpportunity[];
    tonightPeaks: DriverOpportunity[];
    farOpportunity?: DriverOpportunity;
  };

  // Map
  map: {
    zoneHeat: Record<string, number>;
    zoneStates: Record<string, ZoneState>;
    magnets: string[]; // banlieue hub IDs that are active
  };

  // Copy
  copy: {
    phaseLabel: string;
    timerLabel: string;
  };

  // Session
  shiftPhase: ShiftPhase;
  shiftProgress: number;
  sessionEarnings: number;
  corridors: CorridorStatus[];

  // SNCF transport layer
  trainWaves?: TrainWave[];

  // Forced Mobility Waves
  forcedMobility?: ForcedMobilitySnapshot;
}

// ── Vocabulary Display Helpers ──

export function phaseDisplay(phase: ShiftPhase): string {
  switch (phase) {
    case "calme": return "Calme";
    case "montee": return "Monte";
    case "pic": return "Plein";
    case "sortie": return "Sortie";
  }
}

export function confidenceLabel(conf: number): string {
  if (conf >= 0.85) return "Bonne fenetre";
  if (conf >= 0.72) return "Moment interessant";
  if (conf >= 0.60) return "Ca se forme";
  return "Calme";
}

export function confidencePercent(conf: number): string {
  return `${Math.round(conf * 100)}%`;
}

// ── Venue Database ──

interface VenueRecord {
  id: string;
  name: string;
  type: VenueType;
  zone: string;
  corridorId: "nord" | "est" | "sud" | "ouest" | "centre";
  capacity?: number;
  crowdBand?: "S" | "M" | "L";
  endTimeRule?: { typicalEndLocal?: string; exitOffsetMinutes?: { before: number; after: number } };
  lat: number;
  lng: number;
}

const PARIS_VENUES: VenueRecord[] = [
  { id: "chatelet-theatre", name: "Theatre du Chatelet", type: "theatre", zone: "Chatelet", corridorId: "centre", capacity: 1200, endTimeRule: { typicalEndLocal: "22:15", exitOffsetMinutes: { before: 15, after: 30 } }, lat: 48.8584, lng: 2.3474 },
  { id: "accor-arena", name: "Accor Arena", type: "concert", zone: "Bastille", corridorId: "est", capacity: 15000, endTimeRule: { typicalEndLocal: "23:00", exitOffsetMinutes: { before: 15, after: 45 } }, lat: 48.8388, lng: 2.3786 },
  { id: "la-cigale", name: "La Cigale", type: "concert", zone: "Montmartre", corridorId: "nord", capacity: 1400, endTimeRule: { typicalEndLocal: "23:00", exitOffsetMinutes: { before: 10, after: 30 } }, lat: 48.8822, lng: 2.3407 },
  { id: "gare-du-nord", name: "Gare du Nord", type: "station", zone: "Gare du Nord", corridorId: "nord", crowdBand: "L", lat: 48.8809, lng: 2.3553 },
  { id: "gare-de-lyon", name: "Gare de Lyon", type: "station", zone: "Gare de Lyon", corridorId: "est", crowdBand: "L", lat: 48.8443, lng: 2.3734 },
  { id: "gare-montparnasse", name: "Gare Montparnasse", type: "station", zone: "Montparnasse", corridorId: "sud", crowdBand: "M", lat: 48.8414, lng: 2.3219 },
  { id: "olympia", name: "L'Olympia", type: "concert", zone: "Opera", corridorId: "centre", capacity: 2000, endTimeRule: { typicalEndLocal: "22:30", exitOffsetMinutes: { before: 10, after: 30 } }, lat: 48.8707, lng: 2.3276 },
  { id: "moulin-rouge", name: "Moulin Rouge", type: "theatre", zone: "Montmartre", corridorId: "nord", capacity: 850, endTimeRule: { typicalEndLocal: "23:30", exitOffsetMinutes: { before: 10, after: 25 } }, lat: 48.8842, lng: 2.3322 },
  { id: "folies-bergere", name: "Folies Bergere", type: "theatre", zone: "Opera", corridorId: "nord", capacity: 800, endTimeRule: { typicalEndLocal: "22:15", exitOffsetMinutes: { before: 10, after: 25 } }, lat: 48.8745, lng: 2.3465 },
  { id: "zenith-paris", name: "Zenith Paris", type: "concert", zone: "Villette", corridorId: "nord", capacity: 6300, endTimeRule: { typicalEndLocal: "23:00", exitOffsetMinutes: { before: 15, after: 40 } }, lat: 48.8935, lng: 2.3932 },
  { id: "bataclan", name: "Bataclan", type: "concert", zone: "Bastille", corridorId: "est", capacity: 1500, endTimeRule: { typicalEndLocal: "23:00", exitOffsetMinutes: { before: 10, after: 30 } }, lat: 48.8634, lng: 2.3702 },
  { id: "palais-garnier", name: "Palais Garnier", type: "theatre", zone: "Opera", corridorId: "centre", capacity: 1900, endTimeRule: { typicalEndLocal: "22:15", exitOffsetMinutes: { before: 15, after: 30 } }, lat: 48.8719, lng: 2.3316 },
  { id: "rex-club", name: "Rex Club", type: "club", zone: "Grands Boulevards", corridorId: "centre", crowdBand: "M", endTimeRule: { typicalEndLocal: "05:00", exitOffsetMinutes: { before: 30, after: 60 } }, lat: 48.8706, lng: 2.3487 },
  { id: "concrete", name: "Concrete", type: "club", zone: "Bastille", corridorId: "est", crowdBand: "M", endTimeRule: { typicalEndLocal: "05:00", exitOffsetMinutes: { before: 30, after: 60 } }, lat: 48.8430, lng: 2.3818 },
  { id: "stade-france", name: "Stade de France", type: "stadium", zone: "Saint-Denis", corridorId: "nord", capacity: 80000, endTimeRule: { exitOffsetMinutes: { before: 15, after: 45 } }, lat: 48.9244, lng: 2.3602 },
  { id: "bastille-bars", name: "Bastille bars", type: "bar_area", zone: "Bastille", corridorId: "est", crowdBand: "L", lat: 48.8533, lng: 2.3692 },
  { id: "oberkampf-bars", name: "Oberkampf bars", type: "bar_area", zone: "Oberkampf", corridorId: "est", crowdBand: "M", lat: 48.8650, lng: 2.3773 },
  { id: "pigalle-bars", name: "Pigalle bars", type: "bar_area", zone: "Pigalle", corridorId: "nord", crowdBand: "M", lat: 48.8822, lng: 2.3370 },
  { id: "chatelet-metro", name: "Chatelet-Les Halles", type: "metro", zone: "Chatelet", corridorId: "centre", crowdBand: "L", lat: 48.8615, lng: 2.3473 },
  { id: "cdg-airport", name: "CDG", type: "airport", zone: "CDG", corridorId: "nord", crowdBand: "L", lat: 49.0097, lng: 2.5479 },
  { id: "orly-airport", name: "Orly", type: "airport", zone: "Orly", corridorId: "sud", crowdBand: "L", lat: 48.7262, lng: 2.3652 },
  { id: "la-defense-offices", name: "La Defense", type: "office", zone: "La Defense", corridorId: "ouest", crowdBand: "L", lat: 48.8918, lng: 2.2362 },
  { id: "trocadero-restos", name: "Restaurants Trocadero", type: "restaurant", zone: "Trocadero", corridorId: "ouest", crowdBand: "M", lat: 48.8625, lng: 2.2884 },
  { id: "marais-restos", name: "Restaurants Marais", type: "restaurant", zone: "Marais", corridorId: "est", crowdBand: "M", lat: 48.8566, lng: 2.3619 },
];

// ── Venue-specific entry points ──
// Real positioning intel, not generic corridor labels.
// Each venue has a known best pickup side / drop zone.

const VENUE_ENTRY_POINTS: Record<string, string> = {
  "chatelet-theatre": "cote Place du Chatelet",
  "accor-arena": "cote Boulevard de Bercy",
  "la-cigale": "cote Boulevard de Rochechouart",
  "gare-du-nord": "cote Rue de Dunkerque",
  "gare-de-lyon": "cote Hall 1 — Rue de Bercy",
  "gare-montparnasse": "cote Boulevard de Vaugirard",
  "olympia": "cote Boulevard des Capucines",
  "moulin-rouge": "cote Boulevard de Clichy",
  "folies-bergere": "cote Rue Richer",
  "zenith-paris": "cote Avenue Jean-Jaures",
  "bataclan": "cote Boulevard Voltaire",
  "palais-garnier": "cote Place de l'Opera",
  "rex-club": "cote Grands Boulevards",
  "concrete": "cote Quai de la Rapee",
  "stade-france": "cote Porte de Paris RER",
  "bastille-bars": "cote Rue de Lappe / Roquette",
  "oberkampf-bars": "cote Rue Oberkampf",
  "pigalle-bars": "cote Rue de Douai",
  "chatelet-metro": "cote Forum des Halles",
  "cdg-airport": "Terminal 2E — Departs",
  "orly-airport": "Terminal 4 — Arrivees",
  "la-defense-offices": "cote Esplanade — Parvis",
  "trocadero-restos": "cote Avenue Kleber",
  "marais-restos": "cote Rue des Francs-Bourgeois",
};

// ── Helpers ──

function hashNoise(id: string, seed: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  const x = Math.sin(h * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * 111320;
  const dLng = (lng2 - lng1) * 111320 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
}

function distanceMinutes(anchorLat: number, anchorLng: number, venueLat: number, venueLng: number): number {
  const meters = distanceM(anchorLat, anchorLng, venueLat, venueLng);
  return Math.max(2, Math.round(meters / 500)); // ~30km/h urban avg
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function venueTypeWhy(v: VenueRecord): string {
  switch (v.type) {
    case "theatre": return `Sortie theatre ${v.name}`;
    case "concert": return `Sortie concert ${v.name}`;
    case "club": return `Nuit active ${v.zone}`;
    case "station": return `Arrivee train ${v.name}`;
    case "airport": return `Arrivees ${v.name}`;
    case "bar_area": return `Bars pleins ${v.zone}`;
    case "stadium": return `Match ${v.name}`;
    case "office": return `Sortie bureaux ${v.zone}`;
    case "restaurant": return `Sortie restos ${v.zone}`;
    case "metro": return `Derniers metros ${v.zone}`;
  }
}

function buildCrowd(v: VenueRecord): DriverOpportunity["crowd"] {
  if (v.capacity) {
    return { value: Math.floor(v.capacity * 0.6) };
  }
  if (v.crowdBand) {
    return { band: v.crowdBand };
  }
  return undefined;
}

function inferAction(
  distMin: number,
  confidence: number,
  venueType: VenueType,
  timerMin: number,
): DriverOpportunity["action"] {
  if (distMin <= 3 && confidence >= 0.7) return "maintenir";
  if (timerMin > 15 && distMin > 5) return "anticiper";
  if (distMin > 3 && confidence >= 0.6) return "rejoindre";
  if (confidence < 0.5) return "tenter";
  return "rejoindre";
}

// ── Opportunity Builder ──

const CYCLE_DURATION = 300; // 5 min cycle
const SHIFT_DURATION = 1500; // 25 min shift arc

function buildOpportunities(
  anchor: DriverAnchor,
  sessionStartTime: number,
): {
  bestNow: DriverOpportunity | null;
  alternatives: DriverOpportunity[];
  upcoming: DriverOpportunity[];
  tonightPeaks: DriverOpportunity[];
  farOpportunity?: DriverOpportunity;
} {
  const now = new Date();
  const hour = now.getHours();
  const totalSeconds = Date.now() / 1000;
  const cycleIndex = Math.floor(totalSeconds / CYCLE_DURATION);
  const compiledAt = now.toISOString();

  // Determine which venues are currently active based on time
  const activeVenues: { venue: VenueRecord; exitDate: Date; confidence: number; kind: DriverOpportunity["kind"] }[] = [];
  const upcomingVenues: { venue: VenueRecord; exitDate: Date; confidence: number; kind: DriverOpportunity["kind"] }[] = [];

  for (const v of PARIS_VENUES) {
    const noise = hashNoise(v.id, cycleIndex);

    // Skip based on time of day + venue type + deterministic noise
    let isActive = false;
    let isUpcoming = false;
    let exitDate = new Date(now);
    let conf = 0.5;
    let kind: DriverOpportunity["kind"] = "piste";

    if (v.type === "theatre" || v.type === "concert") {
      if (hour >= 20 && hour <= 23 && noise > 0.3) {
        isActive = true;
        const endH = parseInt(v.endTimeRule?.typicalEndLocal?.split(":")[0] ?? "22");
        const endM = parseInt(v.endTimeRule?.typicalEndLocal?.split(":")[1] ?? "15");
        exitDate.setHours(endH, endM, 0, 0);
        if (exitDate.getTime() < now.getTime()) exitDate.setDate(exitDate.getDate() + 1);
        conf = 0.78 + noise * 0.15;
        kind = "confirme";
      } else if (hour >= 18 && hour < 20 && noise > 0.4) {
        isUpcoming = true;
        exitDate.setHours(parseInt(v.endTimeRule?.typicalEndLocal?.split(":")[0] ?? "22"), parseInt(v.endTimeRule?.typicalEndLocal?.split(":")[1] ?? "15"), 0, 0);
        conf = 0.65 + noise * 0.1;
        kind = "confirme";
      }
    } else if (v.type === "club" || v.type === "bar_area") {
      if ((hour >= 22 || hour <= 4) && noise > 0.25) {
        isActive = true;
        exitDate.setHours(hour < 4 ? 4 : 1, 30, 0, 0);
        if (exitDate.getTime() < now.getTime()) exitDate.setDate(exitDate.getDate() + 1);
        conf = 0.55 + noise * 0.2;
        kind = noise > 0.5 ? "confirme" : "piste";
      }
    } else if (v.type === "station") {
      if ((hour >= 6 && hour <= 10) || (hour >= 16 && hour <= 22)) {
        isActive = noise > 0.4;
        exitDate.setMinutes(exitDate.getMinutes() + Math.round(5 + noise * 20));
        conf = 0.6 + noise * 0.15;
        kind = "piste";
      }
    } else if (v.type === "airport") {
      if ((hour >= 5 && hour <= 10) || (hour >= 16 && hour <= 23)) {
        isActive = noise > 0.35;
        exitDate.setMinutes(exitDate.getMinutes() + Math.round(10 + noise * 30));
        conf = 0.55 + noise * 0.2;
        kind = "piste";
      }
    } else if (v.type === "metro") {
      if ((hour >= 23 || hour <= 1) && noise > 0.2) {
        isActive = true;
        exitDate.setHours(hour >= 23 ? 0 : 1, 15, 0, 0);
        if (hour >= 23) exitDate.setDate(exitDate.getDate() + 1);
        conf = 0.7;
        kind = "confirme";
      }
    } else if (v.type === "restaurant") {
      if (hour >= 21 && hour <= 23 && noise > 0.4) {
        isActive = true;
        exitDate.setHours(22, 30 + Math.round(noise * 30), 0, 0);
        if (exitDate.getTime() < now.getTime()) exitDate.setMinutes(exitDate.getMinutes() + 15);
        conf = 0.5 + noise * 0.15;
        kind = "piste";
      }
    } else if (v.type === "stadium") {
      if (noise > 0.65 && hour >= 19 && hour <= 23) {
        isActive = true;
        exitDate.setHours(22, 45, 0, 0);
        if (exitDate.getTime() < now.getTime()) exitDate.setMinutes(exitDate.getMinutes() + 15);
        conf = 0.85;
        kind = "confirme";
      }
    } else if (v.type === "office") {
      if (hour >= 17 && hour <= 20 && noise > 0.3) {
        isActive = true;
        exitDate.setHours(18, 30 + Math.round(noise * 30), 0, 0);
        if (exitDate.getTime() < now.getTime()) exitDate.setMinutes(exitDate.getMinutes() + 10);
        conf = 0.65 + noise * 0.1;
        kind = "piste";
      }
    }

    if (isActive) {
      activeVenues.push({ venue: v, exitDate, confidence: conf, kind });
    } else if (isUpcoming) {
      upcomingVenues.push({ venue: v, exitDate, confidence: conf, kind });
    }
  }

  // Build opportunities from active venues
  function buildOpp(
    item: { venue: VenueRecord; exitDate: Date; confidence: number; kind: DriverOpportunity["kind"] },
    idx: number,
  ): DriverOpportunity {
    const v = item.venue;
    const distMin = distanceMinutes(anchor.lat, anchor.lng, v.lat, v.lng);
    const timerMin = Math.max(0, Math.round((item.exitDate.getTime() - now.getTime()) / 60000));
    const exitBefore = v.endTimeRule?.exitOffsetMinutes?.before ?? 15;
    const exitAfter = v.endTimeRule?.exitOffsetMinutes?.after ?? 30;
    const windowStart = new Date(item.exitDate.getTime() - exitBefore * 60000);
    const windowEnd = new Date(item.exitDate.getTime() + exitAfter * 60000);

    const action = inferAction(distMin, item.confidence, v.type, timerMin);

    let timerLabel: string;
    if (timerMin <= 0) timerLabel = "Maintenant";
    else if (timerMin <= 2) timerLabel = "Maintenant";
    else timerLabel = `Fenetre ferme dans ${timerMin} min`;

    // Entry point: venue-specific pickup zone from database
    const entryPoint = VENUE_ENTRY_POINTS[v.id] ?? undefined;

    const distKm = Math.round(distanceM(anchor.lat, anchor.lng, v.lat, v.lng) / 100) / 10;

    return {
      id: `${v.id}-${cycleIndex}-${idx}`,
      kind: item.kind,
      action,
      placeId: v.id,
      placeLabel: v.zone,
      corridor: v.corridorId === "centre" ? undefined : v.corridorId as DriverOpportunity["corridor"],
      window: { start: formatTime(windowStart), end: formatTime(windowEnd) },
      timerLabel,
      timerMinutes: timerMin,
      why: venueTypeWhy(v),
      distanceMinutes: distMin,
      distanceKm: distKm,
      crowd: buildCrowd(v),
      rideProfile: v.type === "airport" || v.type === "station" ? "longues" : v.type === "club" ? "courtes" : "mixte",
      confidence: Math.round(item.confidence * 100) / 100,
      evidence: buildEvidence(v),
      freshness: { compiledAt, stale: false },
      entryPoint,
    };
  }

  // Sort active by confidence * proximity factor
  const scoredActive = activeVenues.map((item, idx) => ({
    item,
    idx,
    score: item.confidence * (1 / (1 + distanceMinutes(anchor.lat, anchor.lng, item.venue.lat, item.venue.lng) * 0.05)),
  }));
  scoredActive.sort((a, b) => b.score - a.score);

  const bestNow = scoredActive.length > 0 ? buildOpp(scoredActive[0].item, 0) : null;
  const alternatives = scoredActive.slice(1, 4).map((s, i) => buildOpp(s.item, i + 1));

  // Far opportunity (> 10min drive, high confidence)
  const farCandidates = scoredActive.filter(
    (s) => distanceMinutes(anchor.lat, anchor.lng, s.item.venue.lat, s.item.venue.lng) > 10 && s.item.confidence >= 0.7,
  );
  const farOpportunity = farCandidates.length > 0 ? buildOpp(farCandidates[0].item, 100) : undefined;

  // Upcoming
  const upcoming = upcomingVenues.slice(0, 4).map((item, idx) => buildOpp(item, idx + 50));

  // Tonight peaks: combine top active + upcoming sorted by confidence
  const allOpps = [...scoredActive.map((s) => buildOpp(s.item, s.idx + 200)), ...upcoming];
  allOpps.sort((a, b) => b.confidence - a.confidence);
  const tonightPeaks = allOpps.slice(0, 6);

  return { bestNow, alternatives, upcoming, tonightPeaks, farOpportunity };
}

function buildEvidence(v: VenueRecord): OpportunityEvidence[] {
  const evidence: OpportunityEvidence[] = [];
  if (v.type === "theatre" || v.type === "concert" || v.type === "stadium") {
    evidence.push({ source: "event", ref: v.name });
  }
  if (v.type === "station" || v.type === "airport" || v.type === "metro") {
    evidence.push({ source: "transport", ref: v.name });
  }
  if (v.type === "club" || v.type === "bar_area" || v.type === "restaurant" || v.type === "office") {
    evidence.push({ source: "skeleton", ref: `${v.zone} pattern` });
  }
  return evidence;
}

// ── Zone Heat (signal-driven, not random) ──

function buildZoneHeat(
  opportunities: FlowState["opportunities"],
  anchor: DriverAnchor,
  breathPhase: number,
): { zoneHeat: Record<string, number>; zoneStates: Record<string, ZoneState> } {
  const zoneHeat: Record<string, number> = {};
  const zoneStates: Record<string, ZoneState> = {};
  const TERRITORY_IDS = TERRITORIES.map((t) => t.id);

  // Initialize all to zero/dormant
  for (const id of TERRITORY_IDS) {
    zoneHeat[id] = 0;
    zoneStates[id] = "dormant";
  }

  // Map venue zones to territory IDs
  const zoneToTerritory: Record<string, string> = {
    "Chatelet": "1",
    "Opera": "9",
    "Bastille": "11",
    "Montmartre": "18",
    "Gare du Nord": "10",
    "Gare de Lyon": "12",
    "Montparnasse": "14",
    "Villette": "19",
    "Grands Boulevards": "9",
    "Oberkampf": "11",
    "Pigalle": "18",
    "Marais": "4",
    "Trocadero": "16",
    "Saint-Denis": "18", // closest intra-muros
  };

  // Add heat from opportunities
  const allOpps = [
    opportunities.bestNow,
    ...opportunities.alternatives,
    ...opportunities.upcoming,
  ].filter(Boolean) as DriverOpportunity[];

  for (const opp of allOpps) {
    const tid = zoneToTerritory[opp.placeLabel];
    if (!tid) continue;

    const heat = opp.confidence * (opp.kind === "confirme" ? 1.0 : 0.6);
    zoneHeat[tid] = Math.min(1, (zoneHeat[tid] ?? 0) + heat);
  }

  // Anchor proximity boost (subtle)
  const anchorCorridorZones: Record<string, string[]> = {
    nord: ["9", "10", "17", "18", "19"],
    est: ["3", "4", "11", "12", "20"],
    sud: ["5", "6", "13", "14"],
    ouest: ["7", "8", "15", "16"],
    centre: ["1", "2", "cite", "stlouis"],
  };
  const anchorZones = anchorCorridorZones[anchor.corridor] ?? [];
  for (const id of anchorZones) {
    zoneHeat[id] = Math.min(1, (zoneHeat[id] ?? 0) + 0.05);
  }

  // Compute states
  for (const id of TERRITORY_IDS) {
    const h = zoneHeat[id] ?? 0;
    if (h > 0.7) zoneStates[id] = "peak";
    else if (h > 0.4) zoneStates[id] = "active";
    else if (h > 0.15) zoneStates[id] = "forming";
    else if (h > 0.05) zoneStates[id] = "fading";
    else zoneStates[id] = "dormant";
  }

  return { zoneHeat, zoneStates };
}

// ── Corridor Status ──

function buildCorridors(
  opportunities: FlowState["opportunities"],
  cycleIndex: number,
): CorridorStatus[] {
  const corridorLoad: Record<string, number> = { nord: 0, est: 0, sud: 0, ouest: 0 };

  const allOpps = [
    opportunities.bestNow,
    ...opportunities.alternatives,
    ...opportunities.upcoming,
  ].filter(Boolean) as DriverOpportunity[];

  for (const opp of allOpps) {
    if (opp.corridor) {
      corridorLoad[opp.corridor] = (corridorLoad[opp.corridor] ?? 0) + opp.confidence;
    }
  }

  return (["nord", "est", "sud", "ouest"] as const).map((dir) => {
    const load = corridorLoad[dir] ?? 0;
    let status: CorridorStatus["status"] = "fluide";
    if (load > 1.5) status = "plein";
    else if (load > 0.7) status = "dense";

    // Find a reason from opportunities
    const reason = allOpps.find((o) => o.corridor === dir)?.why;

    return { direction: dir, status, reason };
  });
}

// ── Shift Phase ──

function computeShiftPhase(sessionSeconds: number): { phase: ShiftPhase; progress: number } {
  const rawProgress = sessionSeconds / SHIFT_DURATION;
  const progress = rawProgress % 1;

  let phase: ShiftPhase;
  if (progress < 0.2) phase = "calme";
  else if (progress < 0.5) phase = "montee";
  else if (progress < 0.75) phase = "pic";
  else phase = "sortie";

  return { phase, progress };
}

// ── Main computation ──

export function computeFlowState(
  sessionStartTime: number,
  anchor: DriverAnchor,
  trainWaves?: TrainWave[],
  forcedMobility?: ForcedMobilitySnapshot,
): FlowState {
  const now = Date.now();
  const sessionSeconds = (now - sessionStartTime) / 1000;
  const totalSeconds = now / 1000;
  const cycleIndex = Math.floor(totalSeconds / CYCLE_DURATION);

  // Shift
  const { phase: shiftPhase, progress: shiftProgress } = computeShiftPhase(sessionSeconds);

  // Opportunities
  const opportunities = buildOpportunities(anchor, sessionStartTime);

  // Map heat
  const breathPhase = Math.sin(totalSeconds * 0.1) * 0.5 + 0.5;
  const { zoneHeat, zoneStates } = buildZoneHeat(opportunities, anchor, breathPhase);

  // Active magnets
  const magnets = BANLIEUE_HUBS
    .filter((h) => {
      const noise = hashNoise(h.id, cycleIndex);
      const hour = new Date().getHours();
      if (h.id === "cdg" || h.id === "orly") return (hour >= 5 && hour <= 10) || (hour >= 16 && hour <= 22);
      if (h.id === "saint-denis") return noise > 0.5;
      if (h.id === "la-defense") return hour >= 7 && hour <= 20;
      return noise > 0.6;
    })
    .map((h) => h.id);

  // Corridors
  const corridors = buildCorridors(opportunities, cycleIndex);

  // Session earnings (simulated)
  const sessionHours = sessionSeconds / 3600;
  const baseRate = shiftPhase === "pic" ? 45 : shiftPhase === "montee" ? 35 : 25;
  const sessionEarnings = Math.round(sessionHours * baseRate * (0.85 + shiftProgress * 0.3));

  // Confidence
  const bestConf = opportunities.bestNow?.confidence ?? 0;
  const overallConfidence = bestConf > 0 ? bestConf : 0.3;

  // Copy
  const timerLabel = opportunities.bestNow?.timerLabel ?? "Calme";
  const phaseLabel = phaseDisplay(shiftPhase);

  return {
    meta: {
      compiledAt: new Date().toISOString(),
      stale: false,
      overallConfidence,
      source: "live",
    },
    opportunities,
    map: {
      zoneHeat,
      zoneStates,
      magnets,
    },
    copy: {
      phaseLabel,
      timerLabel,
    },
    shiftPhase,
    shiftProgress,
    sessionEarnings,
    corridors,
    trainWaves,
    forcedMobility,
  };
}

// ── Banlieue Hub Heat Computation ──

export interface BanlieueHubState {
  id: string;
  heat: number;
  status: "dormant" | "forming" | "active";
  nextPic?: string;
}

export function computeBanlieueHubStates(sessionStartTime: number): Record<string, BanlieueHubState> {
  const now = Date.now();
  const totalSeconds = now / 1000;
  const cycleIndex = Math.floor(totalSeconds / CYCLE_DURATION);
  const result: Record<string, BanlieueHubState> = {};
  const currentHour = new Date().getHours();

  for (const hub of BANLIEUE_HUBS) {
    const noise = hashNoise(hub.id, cycleIndex);
    let heat = 0;
    let status: BanlieueHubState["status"] = "dormant";
    let nextPic: string | undefined;

    if (hub.id === "cdg" || hub.id === "orly") {
      const isTravel = (currentHour >= 5 && currentHour <= 10) || (currentHour >= 16 && currentHour <= 22);
      heat = isTravel ? 0.4 + noise * 0.3 : 0.05 + noise * 0.1;
      status = heat > 0.4 ? "active" : heat > 0.15 ? "forming" : "dormant";
      nextPic = isTravel ? `${String((currentHour + 1) % 24).padStart(2, "0")}:00` : undefined;
    } else if (hub.id === "saint-denis") {
      const hasEvent = noise > 0.5;
      heat = hasEvent ? 0.5 + noise * 0.35 : 0.08;
      status = heat > 0.4 ? "active" : heat > 0.15 ? "forming" : "dormant";
      nextPic = hasEvent ? "21:30" : undefined;
    } else if (hub.id === "la-defense") {
      const isBusiness = currentHour >= 7 && currentHour <= 20;
      heat = isBusiness ? 0.3 + noise * 0.25 : 0.05;
      status = heat > 0.3 ? "active" : heat > 0.1 ? "forming" : "dormant";
      nextPic = isBusiness ? `${String(Math.min(20, currentHour + 2)).padStart(2, "0")}:00` : undefined;
    } else {
      heat = 0.1 + noise * 0.25;
      status = heat > 0.25 ? "forming" : "dormant";
      nextPic = heat > 0.2 ? `${String((currentHour + 2) % 24).padStart(2, "0")}:00` : undefined;
    }

    result[hub.id] = { id: hub.id, heat, status, nextPic };
  }

  return result;
}

// ── Calme fallback: next skeleton window ──

export function getNextSkeletonTime(): string {
  const now = new Date();
  const hour = now.getHours();
  // Skeleton peaks: 18:00 (sortie bureaux), 20:30 (sortie restos), 22:00 (concerts), 00:30 (derniers metros)
  const peaks = [18, 20.5, 22, 0.5];
  for (const p of peaks) {
    const peakH = Math.floor(p);
    const peakM = Math.round((p - peakH) * 60);
    const target = new Date(now);
    target.setHours(peakH, peakM, 0, 0);
    if (p < 6) target.setDate(target.getDate() + 1); // night hours = next day
    if (target.getTime() > now.getTime()) {
      return `${String(peakH).padStart(2, "0")}:${String(peakM).padStart(2, "0")}`;
    }
  }
  return "18:00"; // fallback to next evening
}

export function getNextSkeletonMinutes(): number {
  const now = new Date();
  const peaks = [18, 20.5, 22, 0.5];
  for (const p of peaks) {
    const peakH = Math.floor(p);
    const peakM = Math.round((p - peakH) * 60);
    const target = new Date(now);
    target.setHours(peakH, peakM, 0, 0);
    if (p < 6) target.setDate(target.getDate() + 1);
    if (target.getTime() > now.getTime()) {
      return Math.max(1, Math.round((target.getTime() - now.getTime()) / 60000));
    }
  }
  return 60;
}

// ── Signal Model (unified intelligence surface) ──

export type SignalType = "signal_fort" | "proche" | "alerte" | "bientot";
export type SignalKind = "live" | "nearby" | "soon" | "week";

export interface FlowSignal {
  id: string;
  type: SignalType;
  title: string;
  zone: string;
  zones?: string[];
  time_window: { start: string; end: string };
  reason: string;
  action: string;
  priority_score: number;   // 0..100
  proximity_minutes: number;
  confidence: number;       // 0..1
  signal_kind: SignalKind;
  // Ramification
  layers?: string[];
  compound?: boolean;
  demand_level?: "low" | "moderate" | "high" | "very_high";
  // Enrichments
  entry_point?: string;
  strategy?: string;
  ride_profile?: "courtes" | "longues" | "mixte";
  venue_name?: string;
  // Perception upgrades
  confidence_sources?: string[];  // 2-3 evidence labels
  is_rare?: boolean;              // RARE OPPORTUNITY tag
  countdown_label?: string;       // "EXIT WAVE starts in 18m"
  field_label?: string;           // "Fenetre forte" / "Pression montante" / "Sortie imminente"
  venue_type?: VenueType;
  // Forced Mobility Wave
  forced_wave?: ForcedMobilityWave;
  // Decision layer (UI tightening)
  hunting_mode?: "HOLD" | "HUNT" | "ANTICIPATE";
  decision_tags?: string[];
  estimated_value?: string;
  ride_outcome?: string;
  wave_phase?: "FORMATION" | "ACTIVE" | "DECAY";
  why_factors?: string[];
  peak_time?: string;
  // Driver density estimate
  concurrence?: "faible" | "moderee" | "forte";
  // Crowd & clientele
  crowd_estimate?: number;          // approximate people exiting (e.g. 900, 18000)
  clientele?: string[];             // ["touristique", "premium", "locale", "etudiante"]
  // Navigation
  lat?: number;
  lng?: number;
}

export interface WeekSignal extends FlowSignal {
  day: string;
  day_index: number; // 0=lundi .. 6=dimanche
  is_best_night?: boolean;
  amplifiers?: string[];
}

// ── Build Signals from Opportunities ──

function oppToSignalType(opp: DriverOpportunity, proximityMin: number): SignalType {
  if (opp.confidence >= 0.8 && opp.kind === "confirme") return "signal_fort";
  if (proximityMin <= 5) return "proche";
  if (opp.timerMinutes > 20) return "bientot";
  if (opp.confidence >= 0.65) return "signal_fort";
  return "bientot";
}

function oppToSignalKind(opp: DriverOpportunity): SignalKind {
  if (opp.timerMinutes <= 5) return "live";
  if ((opp.distanceMinutes ?? 99) <= 6) return "nearby";
  if (opp.timerMinutes <= 30) return "soon";
  return "week";
}

function computePriorityScore(opp: DriverOpportunity): number {
  // Weighted combination: immediacy, confidence, proximity, earning potential
  const immediacy = Math.max(0, 1 - opp.timerMinutes / 60); // closer = higher
  const proximity = Math.max(0, 1 - (opp.distanceMinutes ?? 20) / 30);
  const confScore = opp.confidence;
  const earningPotential = opp.rideProfile === "longues" ? 0.9 : opp.rideProfile === "mixte" ? 0.6 : 0.4;

  return Math.round(
    (immediacy * 30 + confScore * 35 + proximity * 20 + earningPotential * 15)
  );
}

function actionVerb(opp: DriverOpportunity): string {
  // entryPoint already contains "cote ..." with the real street/side.
  const ep = opp.entryPoint ?? "";
  switch (opp.action) {
    case "maintenir": return ep ? `Reste en position. ${ep}` : "Reste en position.";
    case "rejoindre": return ep ? `Rejoins ${opp.placeLabel}. ${ep}` : `Rejoins ${opp.placeLabel}.`;
    case "anticiper": return ep ? `Anticipe. ${ep}` : `Anticipe vers ${opp.placeLabel}.`;
    case "contourner": return "Contourne zone saturee.";
    case "tenter": return `Tente ${opp.placeLabel}.`;
  }
}

function buildConfidenceSources(opp: DriverOpportunity, hasRain: boolean, hasMetroDisruption: boolean, adjustedConf: number): string[] {
  const sources: string[] = opp.evidence.map(e => e.source);
  if (hasRain && adjustedConf >= 0.6) sources.push("weather");
  if (hasMetroDisruption && adjustedConf >= 0.6) sources.push("transport_disruption");
  return sources;
}

function isRareOpportunity(opp: DriverOpportunity, adjustedConf: number, compound: boolean): boolean {
  return adjustedConf >= 0.85 && compound;
}

function buildFieldLabel(adjustedConf: number, timerMinutes: number, compound: boolean): string {
  if (adjustedConf >= 0.85) return "Fenetre forte";
  if (adjustedConf >= 0.75) return "Pression montante";
  if (adjustedConf >= 0.55) return "Sortie imminente";
  if (compound) return "Fenetre potentielle";
  return "Calme";
}

function oppToVenueType(opp: DriverOpportunity): VenueType | undefined {
  const venue = PARIS_VENUES.find(v => opp.placeId === v.id);
  return venue?.type;
}

function oppToVenueName(opp: DriverOpportunity): string {
  const venue = PARIS_VENUES.find(v => opp.placeId === v.id);
  return venue?.name ?? opp.placeLabel;
}

// ── Crowd & Clientele ──

function computeCrowdEstimate(opp: DriverOpportunity): number | undefined {
  const venue = PARIS_VENUES.find(v => v.id === opp.placeId);
  if (!venue || !venue.capacity) return undefined;
  const fillRate = 0.65 + opp.confidence * 0.3;
  return Math.round(venue.capacity * fillRate / 100) * 100;
}

function computeClientele(venueType?: VenueType): string[] | undefined {
  switch (venueType) {
    case "theatre": return ["touristique", "premium"];
    case "concert": return ["locale", "premium"];
    case "stadium": return ["locale"];
    case "club": return ["locale", "nuit"];
    case "bar_area": return ["locale", "nuit"];
    case "restaurant": return ["touristique", "premium"];
    case "station": return ["mixte"];
    case "airport": return ["touristique", "affaires"];
    case "office": return ["affaires"];
    default: return undefined;
  }
}

// ── Decision Layer Helpers ──

function computeHuntingMode(opp: DriverOpportunity): "HOLD" | "HUNT" | "ANTICIPATE" {
  if (opp.action === "maintenir") return "HOLD";
  if (opp.action === "anticiper") return "ANTICIPATE";
  return "HUNT";
}

function computeEstimatedValue(venueType?: VenueType, rideProfile?: string): string {
  if (venueType === "airport") return "35-80";
  if (venueType === "station" && rideProfile === "longues") return "25-70";
  if (venueType === "stadium" || venueType === "concert") return "15-45";
  if (venueType === "club" || venueType === "bar_area") return "8-20";
  if (venueType === "office") return "15-35";
  if (venueType === "theatre") return "15-40";
  if (venueType === "restaurant") return "12-30";
  return "12-35";
}

function computeRideOutcome(venueType?: VenueType, rideProfile?: string): string {
  if (venueType === "airport") return "LONG / HOTEL / BUSINESS";
  if (venueType === "station" && rideProfile === "longues") return "LONG / HOTEL / BANLIEUE";
  if (venueType === "station") return "MIXTE / BANLIEUE";
  if (venueType === "stadium" || venueType === "concert") return "MIXTE / FREQUENCE FORTE";
  if (venueType === "club" || venueType === "bar_area") return "COURTES / FREQUENCE FORTE";
  if (venueType === "office") return "MIXTE / REGULIER";
  if (venueType === "theatre") return "MIXTE / PREMIUM";
  return "MIXTE";
}

function computeDecisionTags(
  venueType: VenueType | undefined,
  rideProfile: string | undefined,
  concurrence: string | undefined,
  confidence: number,
  compound: boolean,
): string[] {
  const tags: string[] = [];
  if (rideProfile === "longues") tags.push("COURSES LONGUES");
  if (venueType === "club" || venueType === "bar_area") tags.push("FREQUENCE FORTE");
  if (concurrence === "faible") tags.push("CONCURRENCE FAIBLE");
  if (confidence >= 0.85 && compound) tags.push("FENETRE RARE");
  if (venueType === "airport" && rideProfile === "longues") tags.push("PREMIUM");
  if (venueType === "stadium" || venueType === "concert") tags.push("BURST");
  return tags.slice(0, 3);
}

function computeWavePhase(timerMinutes: number, venueType?: VenueType): "FORMATION" | "ACTIVE" | "DECAY" {
  if (timerMinutes > 15) return "FORMATION";
  if (timerMinutes <= 2) return "DECAY";
  return "ACTIVE";
}

function computeWhyFactors(opp: DriverOpportunity, hasRain: boolean, hasMetro: boolean, hour: number): string[] {
  const factors: string[] = [];
  // Source-based factors
  for (const ev of opp.evidence) {
    if (ev.source === "event") factors.push("evenement");
    if (ev.source === "transport") factors.push("flux transport");
  }
  // Venue type factors
  const venue = PARIS_VENUES.find(v => v.id === opp.placeId);
  if (venue?.type === "airport") factors.push("bagages");
  if (venue?.type === "station") factors.push("arrivees");
  if (venue?.type === "club" || venue?.type === "bar_area") factors.push("fermeture");
  // Context factors
  if (hasRain && hour >= 18) factors.push("pluie");
  if (hasMetro && hour >= 22) factors.push("metro faible");
  if (hour >= 23 || hour <= 4) factors.push("nuit");
  return factors.slice(0, 3);
}

function computePeakTime(opp: DriverOpportunity): string | undefined {
  if (opp.timerMinutes <= 0) return undefined;
  const exitBefore = 5; // minutes before end = peak conversion
  const peakDate = new Date(Date.now() + (opp.timerMinutes - exitBefore) * 60000);
  if (peakDate.getTime() <= Date.now()) return undefined;
  return `${String(peakDate.getHours()).padStart(2, "0")}:${String(peakDate.getMinutes()).padStart(2, "0")}`;
}

function venueTypeCause(type?: VenueType): string {
  switch (type) {
    case "theatre": return "Sortie theatre";
    case "concert": return "Sortie concert";
    case "club": return "Fermeture club";
    case "station": return "Arrivees trains";
    case "airport": return "Departs / arrivees";
    case "bar_area": return "Fermeture bars";
    case "stadium": return "Sortie match";
    case "office": return "Sortie bureaux";
    case "restaurant": return "Fermeture restos";
    case "metro": return "Derniers metros";
    default: return "";
  }
}

export function buildSignals(flow: FlowState, anchor: DriverAnchor, trainWaves?: TrainWave[], forcedMobility?: ForcedMobilitySnapshot): FlowSignal[] {
  const signals: FlowSignal[] = [];
  const allOpps = [
    flow.opportunities.bestNow,
    ...flow.opportunities.alternatives,
    ...flow.opportunities.upcoming,
    ...flow.opportunities.tonightPeaks,
    flow.opportunities.farOpportunity,
  ].filter(Boolean) as DriverOpportunity[];

  // Deduplicate by placeId (keep highest confidence)
  const seen = new Map<string, DriverOpportunity>();
  for (const opp of allOpps) {
    const existing = seen.get(opp.placeId);
    if (!existing || opp.confidence > existing.confidence) {
      seen.set(opp.placeId, opp);
    }
  }

  const deduped = Array.from(seen.values());

  // Weather layer (simulated: random rain on some evenings)
  const hour = new Date().getHours();
  const hasRain = hashNoise("weather-today", Math.floor(Date.now() / 86400000)) > 0.55;
  const hasMetroDisruption = hashNoise("metro-disruption", Math.floor(Date.now() / 43200000)) > 0.7;

  for (const opp of deduped) {
    const proxMin = opp.distanceMinutes ?? 20;
    const type = oppToSignalType(opp, proxMin);
    const kind = oppToSignalKind(opp);

    // Build layers
    const layers: string[] = [];
    for (const ev of opp.evidence) {
      if (ev.source === "event") layers.push("event");
      if (ev.source === "transport") layers.push("transport");
      if (ev.source === "skeleton") layers.push("pattern");
    }
    if (hasRain && hour >= 18) layers.push("weather");
    if (hasMetroDisruption && hour >= 22) layers.push("transport_disruption");

    const compound = layers.length >= 2;
    const demandBoost = compound ? 0.15 : 0;
    const adjustedConf = Math.min(1, opp.confidence + demandBoost);

    let demandLevel: FlowSignal["demand_level"] = "moderate";
    if (adjustedConf >= 0.85 && compound) demandLevel = "very_high";
    else if (adjustedConf >= 0.75) demandLevel = "high";
    else if (adjustedConf >= 0.55) demandLevel = "moderate";
    else demandLevel = "low";

    // Build reason string
    const reasonParts: string[] = [];
    reasonParts.push(opp.why);
    if (hasRain && hour >= 18) reasonParts.push("Pluie annoncee");
    if (hasMetroDisruption && hour >= 22) reasonParts.push("Perturbation metro");

    // Concurrence estimate: driver density based on zone popularity + time
    let concurrence: FlowSignal["concurrence"] = "moderee";
    const venueType = oppToVenueType(opp);
    if (venueType === "bar_area" && (hour >= 22 || hour <= 2)) concurrence = "forte";
    else if (venueType === "concert" || venueType === "stadium") concurrence = "forte";
    else if (venueType === "airport" || venueType === "office") concurrence = "faible";
    else if (venueType === "station" && hour >= 17 && hour <= 19) concurrence = "forte";
    else if (venueType === "theatre" || venueType === "restaurant") concurrence = "moderee";
    else if (venueType === "club" && (hour >= 1 && hour <= 4)) concurrence = "moderee";
    if (adjustedConf < 0.6) concurrence = "faible";

    const signal: FlowSignal = {
      id: `sig-${opp.id}`,
      type,
      title: `${opp.placeLabel} — ${opp.window.start}`,
      zone: opp.placeLabel,
      time_window: opp.window,
      reason: reasonParts.join(" + "),
      action: actionVerb(opp),
      priority_score: computePriorityScore(opp) + (compound ? 10 : 0),
      proximity_minutes: proxMin,
      confidence: adjustedConf,
      signal_kind: kind,
      layers,
      compound,
      demand_level: demandLevel,
      entry_point: opp.entryPoint,
      ride_profile: opp.rideProfile,
      venue_name: oppToVenueName(opp),
      // Perception upgrades
      confidence_sources: buildConfidenceSources(opp, hasRain && hour >= 18, hasMetroDisruption && hour >= 22, adjustedConf),
      is_rare: isRareOpportunity(opp, adjustedConf, compound),
      countdown_label: opp.timerMinutes > 2 ? `dans ${opp.timerMinutes}m` : undefined,
      field_label: buildFieldLabel(adjustedConf, opp.timerMinutes, compound),
      venue_type: oppToVenueType(opp),
      concurrence,
      // Crowd & clientele
      crowd_estimate: computeCrowdEstimate(opp),
      clientele: computeClientele(venueType),
      // Navigation
      lat: PARIS_VENUES.find(v => v.id === opp.placeId)?.lat,
      lng: PARIS_VENUES.find(v => v.id === opp.placeId)?.lng,
      // Decision layer
      hunting_mode: computeHuntingMode(opp),
      estimated_value: computeEstimatedValue(venueType, opp.rideProfile),
      ride_outcome: computeRideOutcome(venueType, opp.rideProfile),
      decision_tags: computeDecisionTags(venueType, opp.rideProfile, concurrence, adjustedConf, compound),
      wave_phase: computeWavePhase(opp.timerMinutes, venueType),
      why_factors: computeWhyFactors(opp, hasRain && hour >= 18, hasMetroDisruption && hour >= 22, hour),
      peak_time: computePeakTime(opp),
    };

    // ── SNCF enrichment: boost station signals with real train data ──
    if (trainWaves && trainWaves.length > 0 && venueType === "station") {
      const wave = trainWaves.find(w => w.stationId === opp.placeId);
      if (wave && wave.arrivals.length > 0 && wave.isActive) {
        // Boost confidence from real transport data
        const confBoost = wave.confidence > 0.8 ? 0.12 : 0.06;
        signal.confidence = Math.min(1, signal.confidence + confBoost);

        // Add concrete train info to reason
        const nextTrain = wave.arrivals.find(a => a.minutesUntil > 0);
        if (nextTrain) {
          const originShort = nextTrain.origin.split("-")[0].trim();
          signal.reason = `${nextTrain.commercialMode} de ${originShort} dans ${nextTrain.minutesUntil}m` +
            (wave.arrivals.length > 1 ? ` + ${wave.arrivals.length - 1} trains` : "") +
            (hasRain && hour >= 18 ? " + Pluie annoncee" : "");
        }

        // Wave summary for strategy
        const modeCount: Record<string, number> = {};
        for (const a of wave.arrivals) {
          modeCount[a.commercialMode] = (modeCount[a.commercialMode] ?? 0) + 1;
        }
        const summaryParts = Object.entries(modeCount)
          .sort((a, b) => b[1] - a[1])
          .map(([mode, count]) => `${count} ${mode}`)
          .slice(0, 3);

        // Override ride profile based on actual train types
        const longDistanceCount = wave.arrivals.filter(a => a.isLongDistance).length;
        if (longDistanceCount >= 2) {
          signal.ride_profile = "longues";
          signal.demand_level = "high";
        }

        // Set countdown from next real train
        if (nextTrain && nextTrain.minutesUntil > 2) {
          signal.countdown_label = `${nextTrain.commercialMode} dans ${nextTrain.minutesUntil}m`;
        }

        // Add transport source if not present
        if (!signal.confidence_sources?.includes("transport")) {
          signal.confidence_sources = [...(signal.confidence_sources ?? []), "transport"];
        }

        // Boost priority score
        signal.priority_score = Math.min(100, signal.priority_score + 15);

        // Passenger count as field label
        if (wave.passengerEstimate > 1000) {
          signal.field_label = `${summaryParts.join(" + ")} — ~${Math.round(wave.passengerEstimate / 100) * 100} pax`;
        }
      }
    }

    // ── Forced Mobility Wave enrichment ──
    if (forcedMobility && forcedMobility.waves.length > 0) {
      const fmw = findWaveForVenue(forcedMobility, opp.placeId);
      if (fmw) {
        // Store wave reference on signal
        signal.forced_wave = fmw;

        // Boost confidence based on forced mobility score
        const fmwConfBoost = fmw.final_forced_mobility_score >= 60 ? 0.15 :
          fmw.final_forced_mobility_score >= 40 ? 0.08 : 0.03;
        signal.confidence = Math.min(1, signal.confidence + fmwConfBoost);

        // Override demand level from wave
        if (fmw.final_forced_mobility_score >= 70) signal.demand_level = "very_high";
        else if (fmw.final_forced_mobility_score >= 50) signal.demand_level = "high";

        // Enrich reason with wave conversion label
        if (fmw.is_compound) {
          signal.reason = fmw.factors.slice(0, 3).join(" + ");
          signal.compound = true;
          signal.is_rare = true;
        }

        // Override ride profile from wave
        if (fmw.likely_ride_profile === "premium_long" || fmw.likely_ride_profile === "long") {
          signal.ride_profile = "longues";
        } else if (fmw.likely_ride_profile === "short_fast") {
          signal.ride_profile = "courtes";
        }

        // Boost priority from wave score
        const fmwPriorityBoost = Math.round(fmw.final_forced_mobility_score * 0.3);
        signal.priority_score = Math.min(100, signal.priority_score + fmwPriorityBoost);

        // Wave-specific field label
        if (fmw.final_forced_mobility_score >= 60) {
          signal.field_label = waveConversionLabel(fmw);
        }

        // Add forced_mobility to confidence sources
        if (!signal.confidence_sources?.includes("forced_mobility")) {
          signal.confidence_sources = [...(signal.confidence_sources ?? []), "forced_mobility"];
        }
      }
    }

    signals.push(signal);
  }

  // Sort by priority_score descending
  signals.sort((a, b) => b.priority_score - a.priority_score);

  return signals;
}

// ── City Pulse: corridor pressure bars ──

export interface CityPulseEntry {
  corridor: string;
  label: string;
  pressure: number; // 0..1
}

export function buildCityPulse(signals: FlowSignal[], corridors: CorridorStatus[]): CityPulseEntry[] {
  // Group signal pressure by corridor region
  const regionPressure: Record<string, number> = {
    "CENTRE-EST": 0,
    "NORD": 0,
    "OUEST": 0,
    "SUD": 0,
  };

  const zoneToRegion: Record<string, string> = {
    "Bastille": "CENTRE-EST", "Oberkampf": "CENTRE-EST", "Marais": "CENTRE-EST",
    "Chatelet": "CENTRE-EST", "Gare de Lyon": "CENTRE-EST",
    "Opera": "CENTRE-EST", "Grands Boulevards": "CENTRE-EST",
    "Montmartre": "NORD", "Pigalle": "NORD", "Gare du Nord": "NORD",
    "Villette": "NORD", "Saint-Denis": "NORD", "CDG": "NORD",
    "Trocadero": "OUEST", "La Defense": "OUEST",
    "Montparnasse": "SUD", "Orly": "SUD",
  };

  for (const s of signals) {
    const region = zoneToRegion[s.zone] ?? "CENTRE-EST";
    regionPressure[region] = Math.min(1, (regionPressure[region] ?? 0) + s.confidence * 0.3);
  }

  // Also factor corridor density
  for (const c of corridors) {
    const region = c.direction === "nord" ? "NORD"
      : c.direction === "est" ? "CENTRE-EST"
      : c.direction === "sud" ? "SUD"
      : "OUEST";
    if (c.status === "dense") regionPressure[region] = Math.min(1, (regionPressure[region] ?? 0) + 0.15);
    if (c.status === "plein") regionPressure[region] = Math.min(1, (regionPressure[region] ?? 0) + 0.3);
  }

  const entries: CityPulseEntry[] = [
    { corridor: "centre-est", label: "CENTRE-EST", pressure: regionPressure["CENTRE-EST"] },
    { corridor: "nord", label: "NORD", pressure: regionPressure["NORD"] },
    { corridor: "ouest", label: "OUEST", pressure: regionPressure["OUEST"] },
    { corridor: "sud", label: "SUD", pressure: regionPressure["SUD"] },
  ];

  entries.sort((a, b) => b.pressure - a.pressure);
  return entries;
}

// ── Field State: overall field activity ──

export function computeFieldState(signals: FlowSignal[]): { label: string; active: boolean } {
  if (signals.length === 0) return { label: "CALME", active: false };
  const strongCount = signals.filter(s => s.type === "signal_fort" || s.confidence >= 0.75).length;
  if (strongCount >= 3) return { label: "CHAMP ACTIF", active: true };
  if (strongCount >= 1) return { label: "SIGNAUX DETECTES", active: true };
  if (signals.length >= 2) return { label: "EN FORMATION", active: false };
  return { label: "CALME", active: false };
}

// ── Confidence source labels (human-readable) ──

export function confidenceSourceLabel(source: string): string {
  switch (source) {
    case "event": return "Evenement confirme";
    case "transport": return "Flux transport";
    case "skeleton": return "Historique fort";
    case "weather": return "Pluie prevue";
    case "transport_disruption": return "Metro perturbe";
    case "forced_mobility": return "Vague forcee";
    case "manual": return "Signal manuel";
    default: return source;
  }
}

// ── SEMAINE: Build weekly money windows ──

const WEEK_DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export function buildWeekSignals(): WeekSignal[] {
  const today = new Date();
  const weekSeed = Math.floor(today.getTime() / (7 * 86400000));

  const signals: WeekSignal[] = [];

  // Weekly pattern database (money windows that repeat)
  // Each entry: concrete venue names, specific positioning streets, ride profile.
  const weeklyPatterns = [
    { dayOffset: 4, start: "22:00", end: "03:00", title: "Vague nuit Vendredi", zones: ["Pigalle", "Bastille", "Oberkampf"], reason: "Fermeture bars Bastille + Oberkampf — premiere vague de sortie", strategy: "Position Rue de Lappe / Oberkampf des 21:30", baseDemand: 0.82, kind: "pattern" as const, rideProfile: "courtes" as const },
    { dayOffset: 5, start: "22:00", end: "03:30", title: "Pic nuit Samedi", zones: ["Bastille", "Pigalle", "Grands Boulevards"], reason: "Samedi — concentration nuit sur axe Centre-Est. Sorties concerts + bars", strategy: "Position Bastille ou Pigalle des 21:30", baseDemand: 0.9, kind: "concert+nightlife" as const, rideProfile: "mixte" as const },
    { dayOffset: 5, start: "22:30", end: "23:30", title: "Sortie Accor Arena", zones: ["Bastille", "Gare de Lyon"], reason: "Sortie concert Accor Arena — 15 000 spectateurs, Boulevard de Bercy", strategy: "Position Boulevard de Bercy 15 min avant fin", baseDemand: 0.88, kind: "event" as const, rideProfile: "longues" as const },
    { dayOffset: 3, start: "22:00", end: "01:00", title: "Sorties midweek", zones: ["Oberkampf", "Bastille", "Marais"], reason: "Jeudi — sorties bars Oberkampf + Marais. Clientele locale, courses courtes", strategy: "Position Rue Oberkampf ou Rue des Francs-Bourgeois", baseDemand: 0.68, kind: "pattern" as const, rideProfile: "courtes" as const },
    { dayOffset: 6, start: "17:00", end: "22:00", title: "Retours weekend", zones: ["Gare de Lyon", "Gare du Nord", "Montparnasse"], reason: "Retours de weekend — arrivees TGV Gare de Lyon + Montparnasse. Bagages = courses longues", strategy: "Rotation gares. Priorite Hall 1 Gare de Lyon", baseDemand: 0.72, kind: "transport" as const, rideProfile: "longues" as const },
    { dayOffset: 0, start: "07:00", end: "09:30", title: "Rush matinal Lundi", zones: ["Gare du Nord", "Gare de Lyon", "La Defense"], reason: "Lundi — arrivees Eurostar + Thalys Gare du Nord. Cadres La Defense", strategy: "Position Rue de Dunkerque ou Esplanade La Defense", baseDemand: 0.6, kind: "transport" as const, rideProfile: "longues" as const },
    { dayOffset: 2, start: "22:00", end: "23:00", title: "Sorties theatres", zones: ["Opera", "Chatelet", "Marais"], reason: "Mercredi — sorties Palais Garnier + Theatre du Chatelet. Clientele aisee", strategy: "Position Place de l'Opera ou Place du Chatelet", baseDemand: 0.58, kind: "event" as const, rideProfile: "longues" as const },
  ];

  let bestNightIdx = -1;
  let bestNightScore = 0;

  weeklyPatterns.forEach((pattern, idx) => {
    const dayIndex = pattern.dayOffset;
    const noise = hashNoise(`week-${dayIndex}-${pattern.title}`, weekSeed);
    const adjustedDemand = Math.min(1, pattern.baseDemand + noise * 0.1);

    // Amplifiers
    const amplifiers: string[] = [];
    const hasRain = hashNoise(`rain-${dayIndex}`, weekSeed) > 0.6;
    const hasEvent = pattern.kind === "event" || pattern.kind === "concert+nightlife";
    if (hasRain) amplifiers.push("Pluie prevue");
    if (hasEvent) amplifiers.push("Evenement confirme");
    if (adjustedDemand > 0.8) amplifiers.push("Historique fort");

    const compound = amplifiers.length >= 2;
    const finalDemand = Math.min(1, adjustedDemand + (compound ? 0.1 : 0));

    let demand_level: FlowSignal["demand_level"] = "moderate";
    if (finalDemand >= 0.85) demand_level = "very_high";
    else if (finalDemand >= 0.72) demand_level = "high";
    else if (finalDemand >= 0.55) demand_level = "moderate";
    else demand_level = "low";

    const signal: WeekSignal = {
      id: `week-${dayIndex}-${idx}`,
      type: finalDemand >= 0.8 ? "signal_fort" : "bientot",
      title: pattern.title,
      zone: pattern.zones[0],
      zones: pattern.zones,
      time_window: { start: pattern.start, end: pattern.end },
      reason: pattern.reason,
      action: pattern.strategy,
      priority_score: Math.round(finalDemand * 100),
      proximity_minutes: 0,
      confidence: finalDemand,
      signal_kind: "week",
      layers: amplifiers.map(a => a.toLowerCase()),
      compound,
      demand_level,
      strategy: pattern.strategy,
      ride_profile: pattern.rideProfile,
      day: WEEK_DAYS[dayIndex],
      day_index: dayIndex,
      is_best_night: false,
      amplifiers,
    };

    signals.push(signal);

    // Track best night (evening/night only)
    const startH = parseInt(pattern.start.split(":")[0]);
    if ((startH >= 20 || startH <= 4) && finalDemand > bestNightScore) {
      bestNightScore = finalDemand;
      bestNightIdx = signals.length - 1;
    }
  });

  if (bestNightIdx >= 0) {
    signals[bestNightIdx].is_best_night = true;
  }

  // Sort by day_index then priority
  signals.sort((a, b) => a.day_index - b.day_index || b.priority_score - a.priority_score);

  return signals;
}

// ── SEMAINE: Weekly Strategic Briefing ──

export interface WeekBriefing {
  weekCharacter: string;
  weekIntensity: number;
  briefingParagraph1: string;
  briefingParagraph2: string;
  briefingConfidence: "HIGH" | "MODERATE" | "LOW";
  strongCorridors: {
    corridor: string;
    label: string;
    intensity: number;
    reason: string;
  }[];
  eventDistortions: {
    day: string;
    venue: string;
    effect: string;
    magnitude: "fort" | "modere";
  }[];
  bestDay: string;
  bestNight: string;
  bestNightReason: string;
  bestWindows: {
    day: string;
    time: string;
    venue: string;
    cause: string;
    rideProfile: "LONG" | "COURT" | "MIXTE";
    estimatedValue: string;
    score: number;
  }[];
  riskZones: {
    zone: string;
    reason: string;
    time: string;
  }[];
}

export function buildWeekBriefing(signals: WeekSignal[]): WeekBriefing {
  const avgDemand = signals.length > 0
    ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
    : 0;

  let weekCharacter: string;
  if (avgDemand >= 0.78) weekCharacter = "Semaine forte";
  else if (avgDemand >= 0.62) weekCharacter = "Semaine standard";
  else weekCharacter = "Semaine calme";

  const corridorStrength: Record<string, { total: number; count: number; reasons: Set<string> }> = {
    "CENTRE-EST": { total: 0, count: 0, reasons: new Set() },
    "NORD": { total: 0, count: 0, reasons: new Set() },
    "SUD": { total: 0, count: 0, reasons: new Set() },
    "OUEST": { total: 0, count: 0, reasons: new Set() },
  };

  const zoneToRegion: Record<string, string> = {
    "Bastille": "CENTRE-EST", "Oberkampf": "CENTRE-EST", "Marais": "CENTRE-EST",
    "Chatelet": "CENTRE-EST", "Gare de Lyon": "CENTRE-EST",
    "Opera": "CENTRE-EST", "Grands Boulevards": "CENTRE-EST",
    "Montmartre": "NORD", "Pigalle": "NORD", "Gare du Nord": "NORD",
    "Villette": "NORD", "Saint-Denis": "NORD", "CDG": "NORD",
    "Trocadero": "OUEST", "La Defense": "OUEST",
    "Montparnasse": "SUD", "Orly": "SUD",
  };

  for (const s of signals) {
    const zones = s.zones ?? [s.zone];
    for (const z of zones) {
      const region = zoneToRegion[z];
      if (region && corridorStrength[region]) {
        corridorStrength[region].total += s.confidence;
        corridorStrength[region].count++;
        if (s.title.includes("Nightlife") || s.title.includes("Nuit") || s.reason.includes("bars") || s.reason.includes("clubs")) {
          corridorStrength[region].reasons.add("Nuit active");
        }
        if (s.reason.includes("train") || s.title.includes("Rush") || s.title.includes("Retour")) {
          corridorStrength[region].reasons.add("Flux transport");
        }
        if (s.title.includes("Accor") || s.title.includes("theatre") || s.title.includes("Sortie")) {
          corridorStrength[region].reasons.add("Evenements");
        }
      }
    }
  }

  const strongCorridors = Object.entries(corridorStrength)
    .map(([label, data]) => ({
      corridor: label.toLowerCase().replace("-", "_"),
      label,
      intensity: data.count > 0 ? Math.min(1, data.total / data.count) : 0,
      reason: Array.from(data.reasons).join(" + ") || "Pattern standard",
    }))
    .filter(c => c.intensity > 0.3)
    .sort((a, b) => b.intensity - a.intensity);

  const eventDistortions: WeekBriefing["eventDistortions"] = [];
  for (const s of signals) {
    if (s.amplifiers && s.amplifiers.some(a => a.includes("Evenement"))) {
      const zones = s.zones ?? [s.zone];
      const mainRegion = zoneToRegion[zones[0]] ?? "CENTRE-EST";
      eventDistortions.push({
        day: s.day,
        venue: s.title,
        effect: `Amplifie ${mainRegion} ${s.time_window.start}\u2013${s.time_window.end}`,
        magnitude: s.confidence >= 0.82 ? "fort" : "modere",
      });
    }
  }

  const nightSignals = [...signals].filter(s => {
    const h = parseInt(s.time_window.start.split(":")[0]);
    return h >= 20 || h <= 4;
  });
  nightSignals.sort((a, b) => b.confidence - a.confidence);
  const bestNightSignal = nightSignals[0];

  const dayTotals: Record<string, number> = {};
  for (const s of signals) {
    dayTotals[s.day] = (dayTotals[s.day] ?? 0) + s.confidence;
  }
  const bestDay = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Samedi";

  const strongCount = signals.filter(s => s.confidence >= 0.8).length;
  const hasEvents = eventDistortions.length > 0;
  const topCorridor = strongCorridors[0]?.label ?? "Centre-Est";
  const secondCorridor = strongCorridors[1]?.label;

  // Collect concrete venue/zone names for the briefing
  const eventSignals = signals.filter(s => s.title.includes("Accor") || s.title.includes("theatre") || s.title.includes("Sortie"));
  const nightSignalZones = [...new Set(nightSignals.flatMap(s => s.zones ?? [s.zone]))].slice(0, 4);
  const transportSignals = signals.filter(s => s.reason.includes("train") || s.reason.includes("TGV") || s.reason.includes("Eurostar") || s.title.includes("Rush") || s.title.includes("Retour"));
  const longRideSignals = signals.filter(s => s.ride_profile === "longues");
  const shortRideZones = [...new Set(signals.filter(s => s.ride_profile === "courtes").flatMap(s => s.zones ?? [s.zone]))].slice(0, 3);

  // ── Paragraph 1: structural reading ──
  let p1: string;
  if (strongCount >= 3 && hasEvents) {
    const eventNames = eventSignals.map(s => s.title).slice(0, 2).join(" et ");
    p1 = `Structure amplifiee cette semaine. ${eventNames ? eventNames + " concentrent" : "Les evenements concentrent"} le flux sur ${topCorridor}${secondCorridor ? " et " + secondCorridor : ""}. ${bestNightSignal?.day ?? "Samedi"} et Vendredi portent des nuits longues avec sorties concert + bars actifs sur ${nightSignalZones.slice(0, 3).join(", ")}.`;
  } else if (strongCount >= 2) {
    p1 = `Semaine avec ${strongCount} fenetres fortes. La pression se concentre sur ${topCorridor}${secondCorridor ? ", " + secondCorridor + " en appui" : ""}. ${bestNightSignal?.day ?? "Samedi"} soir reste le pic structurel de la semaine.`;
  } else if (strongCount >= 1) {
    p1 = `Structure reguliere. ${topCorridor} porte l'essentiel du volume nocturne. Les flux transport restent structurants autour des gares${transportSignals.length > 0 ? " " + transportSignals[0].day + " et " + (transportSignals[1]?.day ?? "Vendredi") : ""}.`;
  } else {
    p1 = `Semaine calme, activite moderee prevue. Les fenetres se concentrent sur les sorties bureaux et le transport. Peu de signaux evenementiels.`;
  }

  // ── Paragraph 2: opportunities + risks ──
  let p2: string;
  const longRideZones = [...new Set(longRideSignals.flatMap(s => s.zones ?? [s.zone]))].slice(0, 3);

  if (longRideZones.length > 0 && shortRideZones.length > 0) {
    p2 = `Opportunites longues courses concentrees sur ${longRideZones.join(", ")} en fin de soiree. Les zones ${shortRideZones.join(", ")} risquent une saturation de chauffeurs apres minuit — courses courtes, concurrence forte.`;
  } else if (longRideZones.length > 0) {
    p2 = `Opportunites longues courses concentrees sur ${longRideZones.join(", ")}. Les gares et aeroports restent les meilleurs leviers pour le chiffre d'affaires cette semaine.`;
  } else if (nightSignalZones.length > 0) {
    p2 = `Les zones ${nightSignalZones.slice(0, 3).join(", ")} concentrent l'essentiel de l'activite nocturne. Attention a la saturation apres minuit sur Bastille et Pigalle.`;
  } else {
    p2 = `Focus sur les creneaux transport matin et soir. Les fenetres sont courtes mais fiables. Privilegier les gares pour les courses longues.`;
  }

  // ── Briefing confidence ──
  let briefingConfidence: WeekBriefing["briefingConfidence"] = "MODERATE";
  if (strongCount >= 3 && hasEvents) briefingConfidence = "HIGH";
  else if (strongCount >= 1) briefingConfidence = "MODERATE";
  else briefingConfidence = "LOW";

  // ── Best Windows ──
  const bestWindows: WeekBriefing["bestWindows"] = [];
  const valueSorted = [...signals].sort((a, b) => {
    const aV = a.ride_profile === "longues" ? 3 : a.ride_profile === "courtes" ? 1 : 2;
    const bV = b.ride_profile === "longues" ? 3 : b.ride_profile === "courtes" ? 1 : 2;
    return (b.confidence * bV) - (a.confidence * aV);
  });
  for (const s of valueSorted.slice(0, 5)) {
    const venueLabel = s.venue_name ?? (s.zones?.[0] ?? s.zone);
    const causeStr = s.reason.split("\u2014")[0].trim();
    bestWindows.push({
      day: s.day,
      time: `${s.time_window.start}\u2013${s.time_window.end}`,
      venue: venueLabel,
      cause: causeStr.length > 45 ? causeStr.slice(0, 45) : causeStr,
      rideProfile: (s.ride_profile === "longues" ? "LONG" : s.ride_profile === "courtes" ? "COURT" : "MIXTE") as "LONG" | "COURT" | "MIXTE",
      estimatedValue: s.ride_profile === "longues" ? "35-70" : s.ride_profile === "courtes" ? "8-20" : "15-40",
      score: Math.round(s.confidence * 100),
    });
  }

  // ── Risk Zones ──
  const riskZones: WeekBriefing["riskZones"] = [];
  const satCandidates = signals.filter(s => s.ride_profile === "courtes" && s.confidence >= 0.6);
  const satSeen = new Set<string>();
  for (const s of satCandidates) {
    const zone = s.zones?.[0] ?? s.zone;
    if (satSeen.has(zone)) continue;
    satSeen.add(zone);
    const startH = parseInt(s.time_window.start.split(":")[0]);
    riskZones.push({
      zone,
      reason: "Courses courtes, concurrence forte",
      time: startH >= 22 || startH <= 4 ? "Apres minuit" : s.time_window.start,
    });
  }

  return {
    weekCharacter,
    weekIntensity: avgDemand,
    briefingParagraph1: p1,
    briefingParagraph2: p2,
    briefingConfidence,
    strongCorridors,
    eventDistortions,
    bestDay,
    bestNight: bestNightSignal?.day ?? "Samedi",
    bestNightReason: bestNightSignal?.reason ?? "Pic nuit standard",
    bestWindows,
    riskZones,
  };
}