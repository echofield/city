// FLOW — Shared signal display helpers
// Single source for glyphs, labels, colors used across all screens.
// No duplication. Terminal-grade symbols. Zero emoji.

import { C } from "./theme";
import type { FlowSignal, VenueType } from "./FlowEngine";

// ── Venue glyph ──
// Terminal symbols. Drivers learn the pattern after 2-3 nights.

export function venueGlyph(venueType?: VenueType): string {
  switch (venueType) {
    case "station":    return "\u2192";  // arrow
    case "airport":    return "\u21E1";  // up arrow
    case "concert":    return "\u25B2";  // filled triangle
    case "theatre":    return "\u25C7";  // diamond
    case "stadium":    return "\u25B2";  // filled triangle
    case "office":     return "\u25A3";  // square
    case "restaurant": return "\u25C9";  // bullseye
    case "bar_area":   return "\u25C9";  // bullseye
    case "club":       return "\u25C9";  // bullseye
    case "metro":      return "\u2192";  // arrow
    default:           return "\u25CB";  // circle
  }
}

// ── Cause label ──

export function causeLabel(venueType?: VenueType): string {
  switch (venueType) {
    case "theatre":    return "Sortie theatre";
    case "concert":    return "Sortie concert";
    case "club":       return "Fermeture club";
    case "station":    return "Arrivees trains";
    case "airport":    return "Departs / arrivees";
    case "bar_area":   return "Fermeture bars";
    case "stadium":    return "Sortie match";
    case "office":     return "Sortie bureaux";
    case "restaurant": return "Fermeture restos";
    case "metro":      return "Derniers metros";
    default:           return "";
  }
}

// ── Signal type color ──

export function signalTypeColor(type: FlowSignal["type"]): string {
  switch (type) {
    case "signal_fort": return C.green;
    case "proche":      return C.greenBright;
    case "alerte":      return C.red;
    case "bientot":     return C.amber;
  }
}

// ── Wave phase color ──

export function wavePhaseColor(phase?: FlowSignal["wave_phase"]): string {
  switch (phase) {
    case "ACTIVE":    return C.green;
    case "FORMATION": return C.amber;
    case "DECAY":     return C.textDim;
    default:          return C.textGhost;
  }
}

// ── Demand labels ──

export function demandLabel(level?: FlowSignal["demand_level"]): string {
  switch (level) {
    case "very_high": return "Demande tres forte";
    case "high":      return "Demande forte";
    case "moderate":  return "Demande moderee";
    case "low":       return "Demande faible";
    default:          return "";
  }
}

export function demandLabelShort(level?: FlowSignal["demand_level"]): string {
  switch (level) {
    case "very_high": return "TRES FORTE";
    case "high":      return "FORTE";
    case "moderate":  return "MODEREE";
    case "low":       return "FAIBLE";
    default:          return "";
  }
}

// ── Ride labels ──

export function rideLabel(profile?: FlowSignal["ride_profile"]): string {
  switch (profile) {
    case "longues": return "Courses longues probables";
    case "courtes": return "Courses courtes probables";
    case "mixte":   return "Courses mixtes";
    default:        return "";
  }
}

export function rideLabelShort(profile?: FlowSignal["ride_profile"]): string {
  switch (profile) {
    case "longues": return "Courses longues";
    case "courtes": return "Courses courtes";
    default:        return "";
  }
}

// ── Confidence label ──

export function confidenceLevel(conf: number): { text: string; color: string } {
  if (conf >= 0.8) return { text: "HIGH", color: C.green };
  if (conf >= 0.6) return { text: "MODERATE", color: C.amber };
  return { text: "LOW", color: C.textDim };
}

// ── Competition label ──

export function competitionLabel(concurrence?: FlowSignal["concurrence"]): { text: string; color: string } {
  switch (concurrence) {
    case "faible":  return { text: "FAIBLE", color: C.green };
    case "moderee": return { text: "MODEREE", color: C.amber };
    case "forte":   return { text: "FORTE", color: C.red };
    default:        return { text: "", color: C.textDim };
  }
}

// ── Waze deep link ──

export function wazeUrl(lat?: number, lng?: number): string | null {
  if (!lat || !lng) return null;
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}
