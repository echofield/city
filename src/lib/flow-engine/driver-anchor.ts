/**
 * Driver Anchor System — v1.9
 *
 * Position-aware intelligence instead of static zone preferences.
 * "Where do you start?" not "Which arrondissements do you prefer?"
 *
 * The scoring formula:
 *   zone_score = city_pressure + signal_strength - distance_cost
 *
 * Drivers think: "I'm here → where should I go next?"
 */

import type { CorridorDirection } from '@/lib/signal-fetchers/types'

// ════════════════════════════════════════════════════════════════
// DRIVER ANCHOR
// ════════════════════════════════════════════════════════════════

export interface DriverAnchor {
  /** Current position zone (e.g., "Gare de Lyon") */
  zone: string
  /** Position coordinates if available */
  coords?: { lat: number; lng: number }
  /** Timestamp of last update */
  updatedAt: string
  /** Source: 'gps' | 'manual' | 'dropoff' */
  source: 'gps' | 'manual' | 'dropoff'
}

// ════════════════════════════════════════════════════════════════
// DRIVER MODE
// ════════════════════════════════════════════════════════════════

/**
 * Driver operating mode — affects scoring weights
 */
export type DriverMode =
  | 'dense'      // Short city rides, high frequency
  | 'longues'    // Long rides, airport/banlieue
  | 'aeroport'   // Airport priority
  | 'nuit'       // Night club / late night

export const MODE_WEIGHTS: Record<DriverMode, {
  distancePenalty: number  // Higher = prefer closer
  airportBonus: number     // Bonus for CDG/Orly signals
  nightlifeBonus: number   // Bonus for bar/club signals
}> = {
  dense: {
    distancePenalty: 0.15,  // Strong penalty for far zones
    airportBonus: 0,
    nightlifeBonus: 0.1,
  },
  longues: {
    distancePenalty: 0.05,  // Low penalty, willing to travel
    airportBonus: 0.2,
    nightlifeBonus: 0,
  },
  aeroport: {
    distancePenalty: 0.03,  // Almost no penalty
    airportBonus: 0.4,
    nightlifeBonus: 0,
  },
  nuit: {
    distancePenalty: 0.12,
    airportBonus: 0,
    nightlifeBonus: 0.25,
  },
}

// ════════════════════════════════════════════════════════════════
// ZONE DISTANCES (minutes from each anchor)
// ════════════════════════════════════════════════════════════════

/**
 * Approximate driving minutes between zones (night traffic)
 * Symmetric: A→B = B→A
 */
export const ZONE_DISTANCES: Record<string, Record<string, number>> = {
  'Gare du Nord': {
    'Gare de l\'Est': 3,
    'République': 6,
    'Bastille': 10,
    'Opéra': 8,
    'Châtelet': 7,
    'Pigalle': 5,
    'Montmartre': 6,
    'Saint-Lazare': 7,
    'CDG': 35,
    'Orly': 40,
  },
  'Gare de Lyon': {
    'Bastille': 5,
    'Nation': 8,
    'Bercy': 4,
    'Châtelet': 8,
    'République': 10,
    'Opéra': 12,
    'CDG': 40,
    'Orly': 25,
  },
  'Bastille': {
    'République': 6,
    'Nation': 5,
    'Oberkampf': 4,
    'Marais': 5,
    'Châtelet': 7,
    'Gare de Lyon': 5,
    'Pigalle': 12,
  },
  'Opéra': {
    'Madeleine': 3,
    'Saint-Lazare': 4,
    'Châtelet': 6,
    'Pigalle': 8,
    'Champs-Élysées': 7,
    'La Défense': 15,
  },
  'Châtelet': {
    'Marais': 4,
    'République': 7,
    'Bastille': 7,
    'Opéra': 6,
    'Saint-Germain': 5,
    'Montparnasse': 10,
  },
  'CDG': {
    'Saint-Denis': 15,
    'Gare du Nord': 35,
    'Opéra': 40,
    'Bastille': 45,
  },
  'Orly': {
    'Montparnasse': 20,
    'Gare de Lyon': 25,
    'Châtelet': 30,
    'Bastille': 30,
  },
}

/**
 * Get distance in minutes between two zones
 */
export function getZoneDistance(from: string, to: string): number {
  if (from === to) return 0

  // Check direct
  const direct = ZONE_DISTANCES[from]?.[to]
  if (direct) return direct

  // Check reverse
  const reverse = ZONE_DISTANCES[to]?.[from]
  if (reverse) return reverse

  // Default estimate based on Paris geography
  return 15 // Conservative default
}

// ════════════════════════════════════════════════════════════════
// ZONE SCORING
// ════════════════════════════════════════════════════════════════

export interface ZoneScore {
  zone: string
  /** Raw city pressure 0-1 */
  cityPressure: number
  /** Signal strength 0-1 */
  signalStrength: number
  /** Distance from anchor in minutes */
  distanceMin: number
  /** Final computed score 0-1 */
  finalScore: number
  /** Why this score */
  reason: string
  /** Is this an "out of zone" opportunity? */
  isOutOfZone: boolean
}

export interface ScoringInput {
  anchor: DriverAnchor
  mode: DriverMode
  zonePressures: Record<string, number>  // Zone → pressure 0-1
  zoneSignals: Record<string, { strength: number; type: string; reason: string }>
}

/**
 * Compute zone scores based on driver position and preferences
 */
export function computeZoneScores(input: ScoringInput): ZoneScore[] {
  const { anchor, mode, zonePressures, zoneSignals } = input
  const weights = MODE_WEIGHTS[mode]

  const scores: ZoneScore[] = []

  for (const [zone, pressure] of Object.entries(zonePressures)) {
    const distance = getZoneDistance(anchor.zone, zone)
    const signal = zoneSignals[zone]

    // Base score from city pressure
    let score = pressure

    // Add signal strength if present
    if (signal) {
      score += signal.strength * 0.3

      // Apply mode bonuses
      if (signal.type === 'airport' || zone === 'CDG' || zone === 'Orly') {
        score += weights.airportBonus
      }
      if (signal.type === 'nightlife' || signal.type === 'bar_closing') {
        score += weights.nightlifeBonus
      }
    }

    // Apply distance penalty
    const distancePenalty = (distance / 60) * weights.distancePenalty * 2
    score -= distancePenalty

    // Clamp to 0-1
    score = Math.max(0, Math.min(1, score))

    const isOutOfZone = distance > 20 // More than 20 min = "out of zone"

    scores.push({
      zone,
      cityPressure: pressure,
      signalStrength: signal?.strength || 0,
      distanceMin: distance,
      finalScore: score,
      reason: signal?.reason || 'Pression urbaine',
      isOutOfZone,
    })
  }

  // Sort by final score descending
  scores.sort((a, b) => b.finalScore - a.finalScore)

  return scores
}

// ════════════════════════════════════════════════════════════════
// RECOMMENDATION
// ════════════════════════════════════════════════════════════════

export type ActionType = 'maintenir' | 'bouger' | 'opportunite'

export interface Recommendation {
  /** Primary action */
  action: ActionType
  /** Target zone */
  zone: string
  /** Cause (why this action) */
  cause: string
  /** Time window if applicable */
  window?: string
  /** Score 0-1 */
  score: number
  /** Distance from anchor */
  distanceMin: number
}

export interface DualRecommendation {
  /** Local recommendation (within zone preference) */
  local: Recommendation
  /** Strategic recommendation (best opportunity regardless of distance) */
  strategic: Recommendation | null
  /** Should show strategic? (only if significantly better) */
  showStrategic: boolean
}

/**
 * Compute dual recommendations: local + strategic
 */
export function computeRecommendations(
  scores: ZoneScore[],
  anchor: DriverAnchor,
  threshold = 0.15 // Strategic must be 15% better to show
): DualRecommendation {
  const localZones = scores.filter(s => !s.isOutOfZone)
  const strategicZones = scores.filter(s => s.isOutOfZone)

  // Best local
  const bestLocal = localZones[0] || scores[0]
  const localAction: ActionType = bestLocal.zone === anchor.zone ? 'maintenir' : 'bouger'

  const local: Recommendation = {
    action: localAction,
    zone: bestLocal.zone,
    cause: bestLocal.reason,
    score: bestLocal.finalScore,
    distanceMin: bestLocal.distanceMin,
  }

  // Best strategic (out of zone)
  const bestStrategic = strategicZones[0]
  let strategic: Recommendation | null = null
  let showStrategic = false

  if (bestStrategic && bestStrategic.finalScore > bestLocal.finalScore + threshold) {
    strategic = {
      action: 'opportunite',
      zone: bestStrategic.zone,
      cause: bestStrategic.reason,
      score: bestStrategic.finalScore,
      distanceMin: bestStrategic.distanceMin,
    }
    showStrategic = true
  }

  return { local, strategic, showStrategic }
}

// ════════════════════════════════════════════════════════════════
// QUICK ANCHOR PICKS (onboarding)
// ════════════════════════════════════════════════════════════════

export const QUICK_ANCHOR_PICKS = [
  { zone: 'Gare du Nord', corridor: 'nord' as CorridorDirection },
  { zone: 'Gare de Lyon', corridor: 'sud' as CorridorDirection },
  { zone: 'Bastille', corridor: 'est' as CorridorDirection },
  { zone: 'Opéra', corridor: 'ouest' as CorridorDirection },
  { zone: 'Châtelet', corridor: 'centre' as const },
  { zone: 'CDG', corridor: 'nord' as CorridorDirection },
  { zone: 'Orly', corridor: 'sud' as CorridorDirection },
  { zone: 'La Défense', corridor: 'ouest' as CorridorDirection },
]
