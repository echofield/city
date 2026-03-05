/**
 * Corridor Pressure Engine — v1.7
 *
 * The physics of the city.
 * Converts raw signals into pressure propagation through corridors.
 *
 * signals → pressure → corridor flow → zoneHeat → recommended positioning
 */

import type { CorridorDirection } from '@/lib/signal-fetchers/types'

// ════════════════════════════════════════════════════════════════
// CORRIDOR GRAPH — How pressure propagates through Paris
// ════════════════════════════════════════════════════════════════

/**
 * Each corridor is a movement vector.
 * Pressure starts at origin and decays as it propagates.
 */
export const CORRIDOR_GRAPH: Record<CorridorDirection, string[]> = {
  nord: ['Gare du Nord', "Gare de l'Est", 'République', 'Oberkampf', 'Bastille'],
  est: ['Nation', 'Bastille', 'République', 'Oberkampf', 'Montreuil'],
  sud: ['Montparnasse', 'Denfert', 'Gare de Lyon', 'Bercy', 'Ivry'],
  ouest: ['Saint-Lazare', 'Opéra', 'Madeleine', 'Champs-Élysées', 'La Défense'],
}

/**
 * Zone to arrondissement mapping
 */
export const ZONE_ARRONDISSEMENT: Record<string, string> = {
  'Châtelet': '1er',
  'Louvre': '1er',
  'Marais': '3ème/4ème',
  'Bastille': '11ème/12ème',
  'République': '10ème/11ème',
  'Oberkampf': '11ème',
  'Opéra': '9ème',
  'Saint-Lazare': '8ème',
  'Madeleine': '8ème',
  'Gare du Nord': '10ème',
  "Gare de l'Est": '10ème',
  'Gare de Lyon': '12ème',
  'Montparnasse': '14ème/15ème',
  'Pigalle': '18ème',
  'Nation': '11ème/12ème',
  'Bercy': '12ème',
  'Denfert': '14ème',
  'Champs-Élysées': '8ème',
  'La Défense': '92',
  'Montreuil': '93',
  'Ivry': '94',
}

// ════════════════════════════════════════════════════════════════
// SIGNAL WEIGHTS — How much pressure each signal type generates
// ════════════════════════════════════════════════════════════════

export const SIGNAL_WEIGHTS = {
  event: 0.8,        // Concert, show, match
  transport: 0.5,    // Metro disruption
  weather: 0.3,      // Rain increases demand
  skeleton: 0.4,     // Recurring pattern
  train_arrival: 0.6, // TGV/Thalys arrival
} as const

// ════════════════════════════════════════════════════════════════
// MAGNITUDE ESTIMATES — Exit counts by event type
// ════════════════════════════════════════════════════════════════

export interface MagnitudeRange {
  low: number
  high: number
  label: string
}

export const EXIT_MAGNITUDES: Record<string, MagnitudeRange> = {
  // Transport hubs
  tgv_arrival: { low: 800, high: 1500, label: 'sorties TGV' },
  thalys_arrival: { low: 400, high: 800, label: 'sorties Thalys' },
  eurostar_arrival: { low: 300, high: 600, label: 'sorties Eurostar' },
  rer_peak: { low: 2000, high: 5000, label: 'sorties RER' },

  // Events
  concert_large: { low: 3000, high: 8000, label: 'sorties concert' },
  concert_medium: { low: 800, high: 2000, label: 'sorties concert' },
  concert_small: { low: 200, high: 600, label: 'sorties concert' },
  theatre: { low: 300, high: 800, label: 'sorties théâtre' },
  opera: { low: 500, high: 1500, label: 'sorties opéra' },
  sport_match: { low: 5000, high: 20000, label: 'sorties match' },
  cinema: { low: 100, high: 400, label: 'sorties cinéma' },

  // Nightlife
  nightclub_exit: { low: 200, high: 800, label: 'sorties club' },
  bar_district: { low: 500, high: 2000, label: 'sorties bars' },
  restaurant_peak: { low: 300, high: 1000, label: 'sorties restaurants' },

  // Generic
  unknown: { low: 200, high: 500, label: 'sorties estimées' },
}

/**
 * Estimate magnitude from event type and attendance
 */
export function estimateMagnitude(
  eventType: string,
  estimatedAttendance: number | null
): MagnitudeRange {
  // If we have attendance, use it
  if (estimatedAttendance && estimatedAttendance > 0) {
    // 60-80% of attendees typically exit during peak window
    const exitRate = 0.7
    const exits = Math.round(estimatedAttendance * exitRate)
    return {
      low: Math.round(exits * 0.6),
      high: Math.round(exits * 1.2),
      label: 'sorties estimées',
    }
  }

  // Otherwise use type-based estimates
  const typeKey = eventType.toLowerCase().replace(/[^a-z_]/g, '_')
  if (EXIT_MAGNITUDES[typeKey]) {
    return EXIT_MAGNITUDES[typeKey]
  }

  // Check for keywords
  if (eventType.includes('concert')) {
    return EXIT_MAGNITUDES.concert_medium
  }
  if (eventType.includes('match') || eventType.includes('sport')) {
    return EXIT_MAGNITUDES.sport_match
  }
  if (eventType.includes('theatre') || eventType.includes('théâtre')) {
    return EXIT_MAGNITUDES.theatre
  }

  return EXIT_MAGNITUDES.unknown
}

// ════════════════════════════════════════════════════════════════
// PRESSURE INPUT — Unified signal for pressure calculation
// ════════════════════════════════════════════════════════════════

export interface PressureSignal {
  id: string
  type: 'event' | 'weather' | 'transport' | 'skeleton'
  zone: string
  corridor: CorridorDirection | 'centre'
  magnitude: MagnitudeRange
  confidence: number
  window: { start: string; end: string }
  /** Human explanation of this signal */
  cause: string
}

// ════════════════════════════════════════════════════════════════
// PRESSURE OUTPUT — Result with flow direction
// ════════════════════════════════════════════════════════════════

export interface CorridorPressure {
  /** Origin zone of pressure */
  origin: string
  /** Corridor direction of flow */
  corridor: CorridorDirection
  /** Flow description (e.g., "nord→est") */
  flowDirection: string
  /** Zones receiving pressure, in order */
  pressureZones: string[]
  /** Heat values for each zone */
  zoneHeat: Record<string, number>
  /** Recommended zone for positioning */
  recommendedZone: string
  /** Recommended action */
  action: 'BOUGER' | 'MAINTENIR' | 'PREPARER'
  /** Why this action */
  actionReason: string
  /** Total pressure magnitude */
  totalMagnitude: MagnitudeRange
  /** Combined confidence */
  confidence: number
  /** Contributing signals */
  sourceIds: string[]
}

// ════════════════════════════════════════════════════════════════
// CORRIDOR PRESSURE ENGINE — The 30-line brain
// ════════════════════════════════════════════════════════════════

export type ZoneHeat = Record<string, number>

/**
 * Compute corridor pressure from signals.
 * This is the physics of the city.
 */
export function computeCorridorPressure(signals: PressureSignal[]): {
  zoneHeat: ZoneHeat
  corridorPressures: CorridorPressure[]
  topZone: string
  topCorridor: CorridorDirection | null
  dominantFlow: string
} {
  const heat: ZoneHeat = {}
  const corridorTotals: Record<CorridorDirection, number> = {
    nord: 0,
    est: 0,
    sud: 0,
    ouest: 0,
  }
  const corridorPressures: CorridorPressure[] = []

  for (const signal of signals) {
    // Skip centre signals for corridor propagation
    if (signal.corridor === 'centre') {
      // Centre signals just add heat to their zone
      heat[signal.zone] = (heat[signal.zone] || 0) + signal.confidence * 0.5
      continue
    }

    // Get weight based on signal type
    const weight = SIGNAL_WEIGHTS[signal.type] || 0.3

    // Normalize magnitude to 0-1 scale (based on 5000 as "large" event)
    const magnitudeNorm = Math.min(1, (signal.magnitude.low + signal.magnitude.high) / 2 / 5000)
    const pressure = weight * magnitudeNorm * signal.confidence

    // Get corridor zones
    const corridorZones = CORRIDOR_GRAPH[signal.corridor] || []

    // Find starting index (where the signal originates)
    let startIdx = corridorZones.findIndex(z =>
      z.toLowerCase() === signal.zone.toLowerCase()
    )
    if (startIdx === -1) startIdx = 0

    // Propagate pressure along corridor with decay
    const affectedZones: string[] = []
    corridorZones.slice(startIdx).forEach((zone, i) => {
      const decay = Math.pow(0.7, i) // 30% decay per step
      const contribution = pressure * decay

      heat[zone] = (heat[zone] || 0) + contribution
      affectedZones.push(zone)
    })

    // Track corridor totals
    corridorTotals[signal.corridor] += pressure

    // Build corridor pressure record
    const recommendedIdx = Math.min(1, affectedZones.length - 1) // Usually 2nd zone
    corridorPressures.push({
      origin: signal.zone,
      corridor: signal.corridor,
      flowDirection: `${signal.corridor}→centre`,
      pressureZones: affectedZones,
      zoneHeat: Object.fromEntries(
        affectedZones.map((z, i) => [z, pressure * Math.pow(0.7, i)])
      ),
      recommendedZone: affectedZones[recommendedIdx] || signal.zone,
      action: pressure > 0.5 ? 'BOUGER' : pressure > 0.3 ? 'PREPARER' : 'MAINTENIR',
      actionReason: signal.cause,
      totalMagnitude: signal.magnitude,
      confidence: signal.confidence,
      sourceIds: [signal.id],
    })
  }

  // Normalize heat to 0-1
  const normalizedHeat = normalizeHeat(heat)

  // Find top zone and corridor
  const sortedZones = Object.entries(normalizedHeat).sort((a, b) => b[1] - a[1])
  const topZone = sortedZones[0]?.[0] || 'Châtelet'

  const topCorridor = (Object.entries(corridorTotals) as [CorridorDirection, number][])
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null

  // Build dominant flow description
  let dominantFlow = 'stable'
  if (topCorridor && corridorTotals[topCorridor] > 0.3) {
    dominantFlow = `${topCorridor}→centre`
  }

  return {
    zoneHeat: normalizedHeat,
    corridorPressures,
    topZone,
    topCorridor,
    dominantFlow,
  }
}

/**
 * Normalize heat values to 0-1 scale
 */
function normalizeHeat(heat: ZoneHeat): ZoneHeat {
  const values = Object.values(heat)
  if (values.length === 0) return {}

  const max = Math.max(...values, 0.1) // Avoid division by zero

  const normalized: ZoneHeat = {}
  for (const [zone, value] of Object.entries(heat)) {
    normalized[zone] = Math.min(1, value / max)
  }

  return normalized
}

// ════════════════════════════════════════════════════════════════
// FULL RAMIFICATION — Complete cause → consequence → action
// ════════════════════════════════════════════════════════════════

export interface FullRamification {
  id: string
  /** The source signal */
  source: {
    type: 'event' | 'weather' | 'transport' | 'skeleton'
    id: string
    venue?: string
    zone: string
  }
  /** Estimated magnitude */
  magnitude: MagnitudeRange
  /** Pressure flow */
  flow: {
    origin: string
    corridor: CorridorDirection | 'centre'
    direction: string // "nord→est"
    pressureZones: string[]
  }
  /** Recommended action */
  action: {
    type: 'BOUGER' | 'MAINTENIR' | 'PREPARER'
    target: string
    arrondissement: string
    reason: string
  }
  /** Timing */
  window: {
    start: string
    end: string
    minutesUntil: number
  }
  /** Confidence */
  confidence: number
}

/**
 * Build full ramifications from signals
 */
export function buildFullRamifications(
  signals: PressureSignal[],
  corridorPressures: CorridorPressure[]
): FullRamification[] {
  const now = Date.now()

  return signals.map((signal, idx) => {
    const cp = corridorPressures[idx]

    const windowStart = new Date(signal.window.start)
    const minutesUntil = Math.max(0, Math.round((windowStart.getTime() - now) / 60000))

    return {
      id: `ram-${signal.id}`,
      source: {
        type: signal.type,
        id: signal.id,
        zone: signal.zone,
      },
      magnitude: signal.magnitude,
      flow: {
        origin: signal.zone,
        corridor: signal.corridor === 'centre' ? 'centre' : signal.corridor,
        direction: cp?.flowDirection || 'stable',
        pressureZones: cp?.pressureZones || [signal.zone],
      },
      action: {
        type: cp?.action || 'MAINTENIR',
        target: cp?.recommendedZone || signal.zone,
        arrondissement: ZONE_ARRONDISSEMENT[cp?.recommendedZone || signal.zone] || '',
        reason: signal.cause,
      },
      window: {
        start: signal.window.start,
        end: signal.window.end,
        minutesUntil,
      },
      confidence: signal.confidence,
    }
  })
}
