/**
 * Ramification Engine v1.5
 * Converts signals → driver intelligence
 *
 * Ramification regimes:
 * - directed: Clear surge corridor (event exit, transit hub)
 * - fragmented: Scattered demand (rain, multiple small events)
 * - herded: Everyone going same direction (stadium exit)
 * - social_spill: Gradual dispersal (restaurant/bar closing time)
 */

import type {
  EventSignal,
  WeatherSignal,
  TransportSignal,
  Ramification,
  RamificationRegime,
  CorridorDirection,
  WeeklyWindow,
} from './types'

let ramificationIdCounter = 0

function generateId(date: string): string {
  return `ram-${date}-${++ramificationIdCounter}`
}

/**
 * Generate ramifications from event signals
 */
function processEventSignals(events: EventSignal[], date: string): Ramification[] {
  const ramifications: Ramification[] = []

  for (const event of events) {
    if (event.confidence < 0.2) continue // Skip very low confidence

    const attendance = event.estimatedAttendance ?? 0

    // Determine regime based on event characteristics
    let regime: RamificationRegime = 'directed'
    if (attendance >= 30000) {
      regime = 'herded' // Large crowd = herding behavior
    } else if (attendance >= 10000) {
      regime = 'directed' // Medium crowd = directed flow
    } else {
      regime = 'social_spill' // Small crowd = gradual dispersal
    }

    // Main exit ramification
    ramifications.push({
      id: generateId(date),
      regime,
      corridor: event.corridor,
      pressureZones: [event.zone],
      effectZones: getEffectZones(event.zone, event.corridor),
      window: event.exitWindow,
      confidence: event.confidence,
      ttl: event.ttl,
      explanation: buildEventExplanation(event, attendance),
    })

    // Secondary ramification for large events (pre-event arrival)
    if (attendance >= 20000) {
      const arrivalWindow = {
        start: new Date(new Date(event.startTime).getTime() - 90 * 60000).toISOString(),
        end: event.startTime,
      }
      ramifications.push({
        id: generateId(date),
        regime: 'directed',
        corridor: event.corridor,
        pressureZones: getEffectZones(event.zone, event.corridor), // Reverse direction
        effectZones: [event.zone],
        window: arrivalWindow,
        confidence: event.confidence * 0.8, // Slightly lower confidence for arrival
        ttl: event.ttl,
        explanation: `Arrivées ${event.title} — flux vers ${event.venue}`,
      })
    }
  }

  return ramifications
}

/**
 * Generate ramifications from weather signal
 */
function processWeatherSignal(weather: WeatherSignal | null, date: string): Ramification[] {
  if (!weather || weather.impact === 'neutral') return []

  const ramifications: Ramification[] = []
  const now = new Date()
  const windowEnd = new Date(now.getTime() + 4 * 3600000) // 4 hours window

  if (weather.impact === 'fragmented') {
    // Rain = fragmented demand across all corridors
    ramifications.push({
      id: generateId(date),
      regime: 'fragmented',
      corridor: null, // All corridors affected
      pressureZones: ['all'],
      effectZones: ['all'],
      window: {
        start: now.toISOString(),
        end: windowEnd.toISOString(),
      },
      confidence: weather.confidence,
      ttl: weather.ttl,
      explanation: `Météo ${weather.condition} — demande fragmentée, courses courtes`,
    })
  } else if (weather.impact === 'amplified') {
    // Bad weather = amplified demand everywhere
    ramifications.push({
      id: generateId(date),
      regime: 'directed',
      corridor: null,
      pressureZones: ['all'],
      effectZones: ['all'],
      window: {
        start: now.toISOString(),
        end: windowEnd.toISOString(),
      },
      confidence: weather.confidence,
      ttl: weather.ttl,
      explanation: `Météo ${weather.condition} ${weather.temperature}°C — demande amplifiée`,
    })
  }

  return ramifications
}

/**
 * Generate ramifications from transport signals
 */
function processTransportSignals(transport: TransportSignal[], date: string): Ramification[] {
  const ramifications: Ramification[] = []

  for (const signal of transport) {
    if (signal.status === 'normal') continue

    // Severity determines regime
    let regime: RamificationRegime = 'fragmented'
    let explanation = ''

    switch (signal.status) {
      case 'closed':
        regime = 'herded'
        explanation = `${signal.line} fermé — report massif VTC`
        break
      case 'disrupted':
        regime = 'directed'
        explanation = `${signal.line} perturbé — demande accrue aux gares`
        break
      case 'delayed':
        regime = 'fragmented'
        explanation = `${signal.line} retardé — demande dispersée`
        break
    }

    const now = new Date()
    const estimatedEnd = signal.estimatedResolution
      ? new Date(signal.estimatedResolution)
      : new Date(now.getTime() + 3 * 3600000) // Default 3h if unknown

    ramifications.push({
      id: generateId(date),
      regime,
      corridor: signal.corridor === 'unknown' ? null : signal.corridor,
      pressureZones: signal.affectedZones,
      effectZones: signal.affectedZones,
      window: {
        start: signal.since,
        end: estimatedEnd.toISOString(),
      },
      confidence: signal.confidence,
      ttl: signal.ttl,
      explanation,
    })
  }

  return ramifications
}

/**
 * Generate ramifications from weekly skeleton
 */
function processWeeklySkeleton(skeleton: WeeklyWindow[], date: string): Ramification[] {
  const ramifications: Ramification[] = []
  const targetDate = new Date(date)
  const dayOfWeek = targetDate.getDay()

  for (const pattern of skeleton) {
    // Check if pattern applies to this day
    const patternDays = Array.isArray(pattern.dayOfWeek) ? pattern.dayOfWeek : [pattern.dayOfWeek]
    if (!patternDays.includes(dayOfWeek)) continue

    // Build full timestamps from time strings
    const startParts = pattern.window.start.split(':')
    const endParts = pattern.window.end.split(':')

    const startDate = new Date(date)
    startDate.setHours(parseInt(startParts[0]), parseInt(startParts[1]), 0, 0)

    const endDate = new Date(date)
    endDate.setHours(parseInt(endParts[0]), parseInt(endParts[1]), 0, 0)

    // Handle overnight patterns (e.g., 22:00 → 03:00)
    if (endDate < startDate) {
      endDate.setDate(endDate.getDate() + 1)
    }

    // Determine regime from pattern intensity
    let regime: RamificationRegime = 'social_spill'
    if (pattern.intensity >= 4) {
      regime = 'directed'
    } else if (pattern.intensity >= 3) {
      regime = 'social_spill'
    }

    ramifications.push({
      id: generateId(date),
      regime,
      corridor: pattern.corridors[0] || null,
      pressureZones: pattern.zones,
      effectZones: pattern.zones,
      window: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      confidence: pattern.confidence,
      ttl: 3600, // 1 hour for skeleton patterns
      explanation: `${pattern.name} — ${pattern.description}`,
    })
  }

  return ramifications
}

/**
 * Get effect zones based on pressure zone and corridor
 */
function getEffectZones(zone: string, corridor: CorridorDirection): string[] {
  // Effect zones are typically the corridor-aligned suburbs
  const corridorZones: Record<CorridorDirection, string[]> = {
    nord: ['Gare du Nord', 'Saint-Denis', 'La Plaine'],
    est: ['Gare de Lyon', 'Nation', 'Vincennes', 'Montreuil'],
    sud: ['Montparnasse', 'Denfert', 'Issy', 'Orly'],
    ouest: ['La Defense', 'Neuilly', 'Levallois', 'Saint-Cloud'],
  }

  return corridorZones[corridor] || [zone]
}

/**
 * Build human-readable explanation for event
 */
function buildEventExplanation(event: EventSignal, attendance: number): string {
  const attendanceStr = attendance >= 1000
    ? `${Math.round(attendance / 1000)}k pers.`
    : `${attendance} pers.`

  if (attendance >= 30000) {
    return `Sortie ${event.title} (${attendanceStr}) — flux massif ${event.corridor.toUpperCase()}`
  } else if (attendance >= 10000) {
    return `Sortie ${event.title} (${attendanceStr}) — demande soutenue ${event.zone}`
  } else {
    return `Sortie ${event.title} — ${event.venue}`
  }
}

/**
 * Merge and deduplicate ramifications
 */
function mergeRamifications(all: Ramification[]): Ramification[] {
  // Sort by confidence (highest first), then by window start
  const sorted = [...all].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return new Date(a.window.start).getTime() - new Date(b.window.start).getTime()
  })

  // Remove duplicates with overlapping windows and same corridor
  const merged: Ramification[] = []
  for (const ram of sorted) {
    const isDuplicate = merged.some((existing) => {
      if (existing.corridor !== ram.corridor) return false

      const existingStart = new Date(existing.window.start).getTime()
      const existingEnd = new Date(existing.window.end).getTime()
      const ramStart = new Date(ram.window.start).getTime()
      const ramEnd = new Date(ram.window.end).getTime()

      // Check for overlap
      return ramStart < existingEnd && ramEnd > existingStart
    })

    if (!isDuplicate) {
      merged.push(ram)
    }
  }

  return merged
}

/**
 * Main ramification engine
 * Converts all signals into driver-actionable ramifications
 */
export function computeRamifications(
  events: EventSignal[],
  weather: WeatherSignal | null,
  transport: TransportSignal[],
  skeleton: WeeklyWindow[],
  date: string
): Ramification[] {
  // Reset counter for this compilation
  ramificationIdCounter = 0

  const allRamifications: Ramification[] = [
    ...processEventSignals(events, date),
    ...processWeatherSignal(weather, date),
    ...processTransportSignals(transport, date),
    ...processWeeklySkeleton(skeleton, date),
  ]

  return mergeRamifications(allRamifications)
}
