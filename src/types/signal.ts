/**
 * FLOW Unified Signal Model
 *
 * Every surfaced intelligence item follows this schema.
 * Signals are ranked by decision value, not category.
 * All 3 screens (LIVE, CARTE, SEMAINE) consume signals from this model.
 *
 * A signal answers 5 questions:
 * - WHAT: type + title
 * - WHERE: zone + arrondissement
 * - WHEN: time_window
 * - WHY: reason
 * - ACTION: action suggestion
 */

// ═══════════════════════════════════════════════════════════════════
// SIGNAL KIND — Where the signal appears in the UI
// ═══════════════════════════════════════════════════════════════════

export type SignalKind =
  | 'live'      // happening now or very soon (<30 min)
  | 'nearby'    // close to driver position
  | 'soon'      // coming up (30 min - 2h)
  | 'week'      // planning horizon (today+)
  | 'alert'     // friction/warning (weather, block, saturation)
  | 'compound'  // multiple overlapping triggers

// ═══════════════════════════════════════════════════════════════════
// SIGNAL TYPE — What caused this signal
// ═══════════════════════════════════════════════════════════════════

export type SignalType =
  | 'event_exit'      // concert, show, match ending
  | 'transport_wave'  // train/flight arrivals (gare, aeroport)
  | 'nightlife'       // bars/clubs activity
  | 'hotel_outflow'   // hotel district movement
  | 'restaurant'      // restaurant district closing
  | 'office'          // bureau district exit
  | 'weather'         // rain, cold, storm
  | 'friction'        // block, traffic, police
  | 'transport_disruption' // metro off, strike
  | 'banlieue_pressure'    // CDG, Orly, La Défense wave
  | 'skeleton'        // recurring weekly pattern
  | 'compound'        // multiple triggers overlapping

// ═══════════════════════════════════════════════════════════════════
// SIGNAL INTENSITY — Visual encoding (1-4 dots/pulses)
// ═══════════════════════════════════════════════════════════════════

export type SignalIntensity = 1 | 2 | 3 | 4
// 1 = LOW      (small neutral dot)
// 2 = MEDIUM   (soft glow)
// 3 = HIGH     (bright pulse)
// 4 = VERY_HIGH (strong pulse)

export type SignalIntensityLabel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'

export function intensityToLabel(intensity: SignalIntensity): SignalIntensityLabel {
  switch (intensity) {
    case 1: return 'LOW'
    case 2: return 'MEDIUM'
    case 3: return 'HIGH'
    case 4: return 'VERY_HIGH'
  }
}

// ═══════════════════════════════════════════════════════════════════
// DRIVER DENSITY — Zone saturation state
// ═══════════════════════════════════════════════════════════════════

export type DriverDensity = 'opportunity' | 'balanced' | 'saturated'
// opportunity = demand high, drivers low (green)
// balanced    = demand ≈ drivers (yellow)
// saturated   = too many drivers (red)

// ═══════════════════════════════════════════════════════════════════
// CORRIDOR — Direction for spatial context
// ═══════════════════════════════════════════════════════════════════

export type Corridor = 'nord' | 'est' | 'sud' | 'ouest' | 'centre'

// ═══════════════════════════════════════════════════════════════════
// CONFIDENCE — Trust level
// ═══════════════════════════════════════════════════════════════════

export type ConfidenceLevel = 'high' | 'medium' | 'low'

// ═══════════════════════════════════════════════════════════════════
// THE SIGNAL — Unified schema for all intelligence
// ═══════════════════════════════════════════════════════════════════

export interface Signal {
  // ── Identity ──
  id: string                    // unique signal ID for dedup
  kind: SignalKind              // where it appears (live/nearby/soon/week/alert)
  type: SignalType              // what caused it

  // ── Core content (WHAT/WHERE/WHEN/WHY/ACTION) ──
  title: string                 // "Concert exit", "Rain starting", "Hotel outflow"
  zone: string                  // "Bercy", "George V", "Gare du Nord"
  arrondissement?: string       // "XII", "VIII", "X"
  time_window: {
    start: string               // ISO timestamp or "22:40"
    end?: string                // ISO timestamp or "23:30"
    label?: string              // "22:40 – 23:30" for display
  }
  reason: string                // "Accor Arena concert ending"
  action: string                // "Position: Bercy / Gare de Lyon"

  // ── Ranking (decision value) ──
  priority_score: number        // 0-100, computed from multiple factors
  intensity: SignalIntensity    // 1-4, for visual encoding
  confidence: ConfidenceLevel   // high/medium/low

  // ── Proximity (when driver position known) ──
  proximity_minutes?: number    // travel time to zone
  distance_km?: number          // raw distance
  direction?: Corridor          // relative direction from driver

  // ── Time decay ──
  minutes_until_start?: number  // if not yet active
  minutes_until_end?: number    // if active, time remaining
  is_active: boolean            // currently within window
  is_expiring: boolean          // < 10 min remaining
  is_forming: boolean           // starts within 30 min

  // ── Saturation (dead zone prevention) ──
  zone_saturation?: number      // 0-100
  driver_density?: DriverDensity // opportunity/balanced/saturated

  // ── Compound signals (ramification) ──
  is_compound: boolean          // multiple triggers overlap
  overlapping_factors?: string[] // ["rain", "metro_disruption", "event_exit"]
  ramification_score?: number   // 0-100, strength of overlap

  // ── Source tracking (for debugging) ──
  source: string                // "tonight_pack" | "weather" | "weekly_skeleton" | "ramification"
  raw_event_id?: string         // original event ID if applicable

  // ── Display hints ──
  display_label?: string        // "SIGNAL FORT", "PROCHE DE TOI", "ALERTE"
  display_sublabel?: string     // "6 min", "EXIT NOW", "dans 22 min"

  // ── Navigation coordinates (optional — falls back to zone lookup) ──
  lat?: number
  lng?: number
}

// ═══════════════════════════════════════════════════════════════════
// SIGNAL FEED — Ranked list for LIVE screen
// ═══════════════════════════════════════════════════════════════════

export interface SignalFeed {
  signals: Signal[]             // ranked by priority_score descending
  generated_at: string          // ISO timestamp
  driver_position?: {
    lat: number
    lng: number
  }
  total_count: number
  live_count: number            // kind === 'live'
  nearby_count: number          // kind === 'nearby'
  alert_count: number           // kind === 'alert'
}

// ═══════════════════════════════════════════════════════════════════
// WEEK SIGNALS — For SEMAINE screen (money calendar)
// ═══════════════════════════════════════════════════════════════════

export interface WeekSignal extends Signal {
  day_of_week: number           // 0-6 (Sunday = 0)
  day_label: string             // "Lundi", "Mardi", etc.
  is_premium_night: boolean     // high earning potential
  earning_potential: 'low' | 'medium' | 'high' | 'very_high'
  strategy?: string             // "Position 15 min before exit"
}

export interface WeekCalendar {
  week_of: string               // "2026-W10"
  best_night: {
    day: string                 // "Samedi"
    reason: string              // "Concert + Rain + Nightlife"
    expected_demand: 'low' | 'medium' | 'high' | 'very_high'
  } | null
  days: {
    day_of_week: number
    day_label: string
    date: string                // "2026-03-07"
    signals: WeekSignal[]
    is_premium: boolean
  }[]
  generated_at: string
}

// ═══════════════════════════════════════════════════════════════════
// MAP SIGNALS — For CARTE screen (spatial view)
// ═══════════════════════════════════════════════════════════════════

export interface MapSignal extends Signal {
  // Coordinates for pin placement
  lat?: number
  lng?: number
  // Or zone-based placement
  zone_center?: { lat: number; lng: number }
}

export interface MapView {
  signals: MapSignal[]          // top 5 signal pins
  hot_zones: string[]           // zone IDs with high heat
  friction_zones: string[]      // zone IDs with blocks/friction
  driver_position?: { lat: number; lng: number }
  generated_at: string
}

// ═══════════════════════════════════════════════════════════════════
// RANKING CONFIG — Weights for priority_score computation
// ═══════════════════════════════════════════════════════════════════

export interface RankingWeights {
  immediacy: number             // how soon (closer = higher)
  confidence: number            // trust level
  overlap_strength: number      // compound signal bonus
  proximity: number             // closer to driver = higher
  earning_potential: number     // expected revenue
  inverse_saturation: number    // less saturated = higher
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  immediacy: 0.25,
  confidence: 0.15,
  overlap_strength: 0.20,
  proximity: 0.15,
  earning_potential: 0.15,
  inverse_saturation: 0.10,
}
