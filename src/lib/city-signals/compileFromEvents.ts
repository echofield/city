/**
 * Compile BanlieueEvents → CitySignalsPack + Ramifications
 * Transforms raw event calendar into daily pack format
 */

import type { BanlieueEvent, ParsedPressureWindow } from './event-types'
import { parsePressureWindow } from './event-types'
import type { CitySignalsPackV1, CitySignalsEventV1, EventCategory } from '@/types/city-signals-pack'
import type { Ramification, RamificationKind, ConfidenceLevel } from '@/types/flow-state'

/**
 * Filter events for a specific date
 */
export function getEventsForDate(events: BanlieueEvent[], date: string): BanlieueEvent[] {
  return events.filter((e) => {
    const start = e.start_date
    const end = e.end_date
    return date >= start && date <= end
  })
}

/**
 * Map BanlieueEvent category to CitySignalsEventV1 type
 */
function mapEventType(category: BanlieueEvent['category']): CitySignalsEventV1['type'] {
  switch (category) {
    case 'concert':
      return 'concert'
    case 'sport':
      return 'sport'
    case 'expo':
      return 'expo'
    case 'festival':
      return 'festival'
    default:
      return 'other'
  }
}

/**
 * Calculate intensity (1-5) based on attendance and event type
 */
function calculateIntensity(event: BanlieueEvent): number {
  const attendance = event.expected_attendance ?? 0

  // Base intensity from attendance
  let intensity = 3
  if (attendance >= 50000) intensity = 5
  else if (attendance >= 30000) intensity = 4
  else if (attendance >= 10000) intensity = 3
  else if (attendance >= 5000) intensity = 2
  else if (attendance > 0) intensity = 1

  // Boost for certain categories
  if (event.category === 'sport' && attendance >= 40000) intensity = 5
  if (event.category === 'festival') intensity = Math.min(5, intensity + 1)

  return intensity
}

/**
 * Get best time window for event
 */
function getEventTimes(event: BanlieueEvent): { startTime: string | null; endTime: string | null } {
  // Use explicit times if available
  if (event.start_time && event.end_time) {
    return { startTime: event.start_time, endTime: event.end_time }
  }

  // Parse from pressure windows
  const windows = event.typical_pressure_windows
    .map(parsePressureWindow)
    .filter((w): w is ParsedPressureWindow => w !== null)

  if (windows.length === 0) {
    return { startTime: null, endTime: null }
  }

  // Find arrival and exit windows
  const arrival = windows.find((w) => w.type.includes('arrival'))
  const exit = windows.find((w) => w.type.includes('exit'))

  return {
    startTime: arrival?.start ?? windows[0].start,
    endTime: exit?.end ?? windows[windows.length - 1].end,
  }
}

/**
 * Convert BanlieueEvent to CitySignalsEventV1
 */
function convertToCitySignalsEvent(event: BanlieueEvent): CitySignalsEventV1 {
  const times = getEventTimes(event)
  const attendanceStr = event.expected_attendance
    ? ` (${Math.round(event.expected_attendance / 1000)}k pers.)`
    : ''

  return {
    name: event.name + attendanceStr,
    venue: event.venue,
    zoneImpact: event.zoneImpact,
    startTime: times.startTime,
    endTime: times.endTime,
    expectedAttendance: event.expected_attendance,
    type: mapEventType(event.category),
    category: event.category as EventCategory,
    intensity: calculateIntensity(event),
    notes: `Corridor ${event.flow_corridor.toUpperCase()}. ${event.infra_corridors.slice(0, 3).join(', ')}.`,
  }
}

/**
 * Generate ramifications from events
 */
function generateRamifications(events: BanlieueEvent[], date: string): Ramification[] {
  const ramifications: Ramification[] = []
  let idCounter = 1

  for (const event of events) {
    const attendance = event.expected_attendance ?? 0
    const intensity = calculateIntensity(event)
    const times = getEventTimes(event)

    // Banlieue pressure (for high-attendance events)
    if (attendance >= 20000 || intensity >= 4) {
      ramifications.push({
        id: `ram-${date}-${idCounter++}`,
        kind: 'banlieue_pressure' as RamificationKind,
        effect_zone: event.zoneImpact[0] || event.city,
        explanation: `${event.name} — forte demande ${event.city}/${event.zoneImpact[1] || 'Paris'}`,
        confidence: event.confidence as ConfidenceLevel,
        zone: event.city,
        corridor: event.flow_corridor,
        window_start: times.startTime || undefined,
        window_end: times.endTime || undefined,
        tone: `Pic sortie vers Paris intramuros via ${event.infra_corridors[0] || 'axes principaux'}`,
      })
    }

    // Event dispersion (for evening/night events)
    if (times.endTime && parseInt(times.endTime.split(':')[0]) >= 21) {
      ramifications.push({
        id: `ram-${date}-${idCounter++}`,
        kind: 'event_dispersion' as RamificationKind,
        effect_zone: event.zoneImpact[0] || event.city,
        explanation: `Sortie ${event.name} — dispersion ${event.flow_corridor}`,
        confidence: event.confidence as ConfidenceLevel,
        zone: event.city,
        corridor: event.flow_corridor,
        window_start: times.endTime || undefined,
        tone: `Retours banlieue ${event.flow_corridor.toUpperCase()} post-événement`,
      })
    }

    // Fleet saturation (for multi-event corridors)
    const sameCorridorEvents = events.filter((e) => e.flow_corridor === event.flow_corridor)
    if (sameCorridorEvents.length >= 2 && event === sameCorridorEvents[0]) {
      const totalAttendance = sameCorridorEvents.reduce((sum, e) => sum + (e.expected_attendance ?? 0), 0)
      if (totalAttendance >= 50000) {
        ramifications.push({
          id: `ram-${date}-${idCounter++}`,
          kind: 'fleet_saturation' as RamificationKind,
          effect_zone: `Corridor ${event.flow_corridor.toUpperCase()}`,
          explanation: `Multi-événements corridor ${event.flow_corridor} — saturation probable`,
          confidence: 'medium' as ConfidenceLevel,
          corridor: event.flow_corridor,
          tone: `${sameCorridorEvents.length} événements simultanés, ~${Math.round(totalAttendance / 1000)}k personnes`,
        })
      }
    }
  }

  return ramifications
}

/**
 * Compile events for a date into CitySignalsPack + Ramifications
 */
export function compileEventsForDate(
  events: BanlieueEvent[],
  date: string
): { pack: CitySignalsPackV1; ramifications: Ramification[] } {
  const dayEvents = getEventsForDate(events, date)

  const pack: CitySignalsPackV1 = {
    date,
    generatedAt: new Date().toISOString(),
    events: dayEvents.map(convertToCitySignalsEvent),
    transport: [], // Can be added separately
    weather: [], // Can be added separately
    social: [],
  }

  const ramifications = generateRamifications(dayEvents, date)

  return { pack, ramifications }
}

/**
 * Merge compiled pack with ramifications for API consumption
 */
export function mergePackWithRamifications(
  pack: CitySignalsPackV1,
  ramifications: Ramification[]
): CitySignalsPackV1 & { ramifications: Ramification[] } {
  return {
    ...pack,
    ramifications,
  }
}
