/**
 * Adapter to convert TonightPack (v1.5) → CitySignalsPackV1
 * This allows the existing compile-from-pack.ts to work with the new format
 */

import type { CitySignalsPackV1, CitySignalsEventV1, CitySignalsTransportV1, CitySignalsWeatherV1 } from '@/types/city-signals-pack'
import type { TonightPack, EventSignal, WeatherSignal, TransportSignal } from '@/lib/signal-fetchers/types'

/**
 * Convert TonightPack to CitySignalsPackV1
 */
export function tonightPackToCitySignalsPack(pack: TonightPack): CitySignalsPackV1 {
  const events: CitySignalsEventV1[] = []
  const transport: CitySignalsTransportV1[] = []
  const weather: CitySignalsWeatherV1[] = []

  for (const signal of pack.signals) {
    if (signal.type === 'event') {
      const eventSignal = signal as EventSignal
      events.push({
        name: eventSignal.title,
        venue: eventSignal.venue,
        zoneImpact: [eventSignal.zone, ...getCorridorZones(eventSignal.corridor)],
        startTime: formatTime(eventSignal.startTime),
        endTime: formatTime(eventSignal.endTime),
        expectedAttendance: eventSignal.estimatedAttendance ?? undefined,
        type: mapEventType(eventSignal),
        category: 'concert', // Default, can be refined
        intensity: calculateIntensity(eventSignal.estimatedAttendance),
        notes: `Confidence: ${Math.round(eventSignal.confidence * 100)}% | Source: ${eventSignal.source}`,
      })
    } else if (signal.type === 'weather') {
      const weatherSignal = signal as WeatherSignal
      weather.push({
        type: mapWeatherType(weatherSignal.condition),
        expectedAt: formatTime(pack.compiledAt),
        impactLevel: weatherSignal.impact === 'amplified' ? 3 : weatherSignal.impact === 'fragmented' ? 2 : 1,
      })
    } else if (signal.type === 'transport') {
      const transportSignal = signal as TransportSignal
      transport.push({
        line: transportSignal.line,
        type: mapTransportType(transportSignal.status),
        impactZones: transportSignal.affectedZones,
        startTime: formatTime(transportSignal.since),
        endTime: transportSignal.estimatedResolution ? formatTime(transportSignal.estimatedResolution) : undefined,
      })
    }
  }

  // Add events from ramifications that don't have direct event signals
  for (const ram of pack.ramifications) {
    // Only add if there's no matching event already
    const hasMatchingEvent = events.some(e =>
      e.zoneImpact.some(z => ram.pressureZones.includes(z))
    )

    if (!hasMatchingEvent && ram.regime !== 'fragmented') {
      // This ramification represents a structural pattern (from skeleton)
      events.push({
        name: ram.explanation,
        venue: ram.pressureZones[0] || 'Paris',
        zoneImpact: [...ram.pressureZones, ...ram.effectZones].filter((v, i, a) => a.indexOf(v) === i),
        startTime: formatTime(ram.window.start),
        endTime: formatTime(ram.window.end),
        expectedAttendance: undefined,
        type: 'other',
        category: 'other',
        intensity: Math.round(ram.confidence * 5),
        notes: `Structural pattern | Confidence: ${Math.round(ram.confidence * 100)}%`,
      })
    }
  }

  return {
    date: pack.date,
    generatedAt: pack.compiledAt,
    events,
    transport,
    weather,
    social: [],
    // Pass through source status for API failure indication (PASS 4)
    sourceStatus: pack.meta.sourceStatus,
  }
}

/**
 * Format ISO timestamp to HH:mm
 */
function formatTime(isoOrTime: string): string {
  if (!isoOrTime) return '20:00'

  // If already HH:mm format
  if (/^\d{2}:\d{2}$/.test(isoOrTime)) return isoOrTime

  try {
    const date = new Date(isoOrTime)
    if (isNaN(date.getTime())) return '20:00'
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris'
    })
  } catch {
    return '20:00'
  }
}

/**
 * Map EventSignal to CitySignalsEventV1 type
 */
function mapEventType(event: EventSignal): CitySignalsEventV1['type'] {
  const title = event.title.toLowerCase()
  if (title.includes('concert') || title.includes('music')) return 'concert'
  if (title.includes('sport') || title.includes('match') || title.includes('psg')) return 'sport'
  if (title.includes('expo')) return 'expo'
  if (title.includes('festival')) return 'festival'
  return 'other'
}

/**
 * Map weather condition to CitySignalsWeatherV1 type
 */
function mapWeatherType(condition: string): CitySignalsWeatherV1['type'] {
  if (condition === 'heavy_rain') return 'heavy_rain'
  if (condition === 'rain') return 'rain_start'
  if (condition === 'snow') return 'cold_spike'
  return 'rain_start'
}

/**
 * Map transport status to CitySignalsTransportV1 type
 */
function mapTransportType(status: string): CitySignalsTransportV1['type'] {
  if (status === 'closed') return 'closure'
  if (status === 'disrupted') return 'incident'
  return 'incident'
}

/**
 * Get zones associated with a corridor
 */
function getCorridorZones(corridor: string): string[] {
  const corridorZones: Record<string, string[]> = {
    nord: ['Gare du Nord', 'Montmartre', 'Pigalle'],
    est: ['Gare de Lyon', 'Bastille', 'Nation', 'Bercy'],
    sud: ['Montparnasse', 'Denfert'],
    ouest: ['La Defense', 'Champs-Elysees', 'Opera'],
  }
  return corridorZones[corridor] || []
}

/**
 * Calculate intensity from attendance
 */
function calculateIntensity(attendance: number | null): number {
  if (!attendance) return 2
  if (attendance >= 40000) return 5
  if (attendance >= 20000) return 4
  if (attendance >= 10000) return 3
  if (attendance >= 5000) return 2
  return 1
}

/**
 * Check if data is a TonightPack (vs CitySignalsPackV1)
 */
export function isTonightPack(data: unknown): data is TonightPack {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return (
    'signals' in obj &&
    'ramifications' in obj &&
    'weeklySkeleton' in obj &&
    'meta' in obj
  )
}
