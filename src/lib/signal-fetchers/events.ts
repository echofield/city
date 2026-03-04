/**
 * Events Signal Fetcher - OpenAgenda API
 * Fallback: manual-events.json
 */

import type { EventSignal, CorridorDirection, Venue } from './types'
import { CONFIDENCE_RUBRIC, EXIT_WINDOW_RULES } from './types'
import * as fs from 'fs'
import * as path from 'path'

const TTL_EVENTS = 3600 // 1 hour

// Load venue registry
function loadVenueRegistry(): Map<string, Venue> {
  const registry = new Map<string, Venue>()
  try {
    const venuePath = path.join(process.cwd(), 'data', 'venues', 'paris-idf-venues.json')
    const raw = fs.readFileSync(venuePath, 'utf-8')
    const data = JSON.parse(raw)
    for (const venue of data.venues) {
      registry.set(venue.id, venue)
      registry.set(venue.name.toLowerCase(), venue)
      for (const alias of venue.aliases) {
        registry.set(alias.toLowerCase(), venue)
      }
    }
  } catch {
    console.warn('[events] Could not load venue registry')
  }
  return registry
}

/**
 * Match venue name to registry
 */
function matchVenue(venueName: string, registry: Map<string, Venue>): Venue | null {
  const nameLower = venueName.toLowerCase()

  // Direct match
  if (registry.has(nameLower)) {
    return registry.get(nameLower)!
  }

  // Partial match
  for (const [key, venue] of registry.entries()) {
    if (nameLower.includes(key) || key.includes(nameLower)) {
      return venue
    }
  }

  return null
}

/**
 * Calculate exit window based on event type
 */
function calculateExitWindow(
  endTime: string,
  eventType: string
): { start: string; end: string } {
  const rules = EXIT_WINDOW_RULES[eventType] || EXIT_WINDOW_RULES.other
  const endDate = new Date(endTime)

  const start = new Date(endDate.getTime() - rules.before * 60000)
  const end = new Date(endDate.getTime() + rules.after * 60000)

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

/**
 * Map event category to exit window rule key
 */
function mapEventType(category: string): string {
  const categoryLower = category.toLowerCase()
  if (categoryLower.includes('concert') || categoryLower.includes('music')) return 'concert'
  if (categoryLower.includes('sport') || categoryLower.includes('match')) return 'sport'
  if (categoryLower.includes('theatre') || categoryLower.includes('theater')) return 'theatre'
  if (categoryLower.includes('opera')) return 'opera'
  if (categoryLower.includes('expo') || categoryLower.includes('exhibition')) return 'exhibition'
  if (categoryLower.includes('festival')) return 'festival'
  if (categoryLower.includes('club') || categoryLower.includes('night')) return 'nightlife'
  return 'other'
}

interface OpenAgendaEvent {
  uid: string
  title: { fr?: string; en?: string }
  location?: {
    name?: string
    address?: string
    city?: string
  }
  timings?: Array<{
    begin: string
    end: string
  }>
  keywords?: { fr?: string[] }
  attendance?: number
}

/**
 * Fetch events from OpenAgenda API
 */
export async function fetchEventSignals(date: string): Promise<EventSignal[]> {
  const apiKey = process.env.OPENAGENDA_API_KEY
  const venueRegistry = loadVenueRegistry()
  const signals: EventSignal[] = []

  // Always load manual events first
  const manualEvents = loadManualEvents(date, venueRegistry)
  signals.push(...manualEvents)

  if (!apiKey) {
    console.warn('[events] OPENAGENDA_API_KEY not configured')
    return signals
  }

  try {
    // OpenAgenda API - Paris events
    // Agenda IDs for Paris:
    // - paris-fr: 5765238
    // - quefaire-paris: 65883830
    const agendaIds = ['5765238', '65883830']

    for (const agendaId of agendaIds) {
      const url = `https://api.openagenda.com/v2/agendas/${agendaId}/events?key=${apiKey}&timings[gte]=${date}T00:00:00&timings[lte]=${date}T23:59:59&size=50`

      const res = await fetch(url, { next: { revalidate: TTL_EVENTS } })
      if (!res.ok) continue

      const data = await res.json()
      const events: OpenAgendaEvent[] = data.events || []

      for (const event of events) {
        const title = event.title?.fr || event.title?.en || 'Unknown Event'
        const venueName = event.location?.name || 'Unknown Venue'
        const venue = matchVenue(venueName, venueRegistry)

        // Skip if venue not in registry and no location
        const zone = venue?.zone || 'unknown'
        const corridor = venue?.corridor || 'unknown'

        // Get timing
        const timing = event.timings?.[0]
        if (!timing) continue

        const eventType = mapEventType(event.keywords?.fr?.[0] || 'other')
        const exitWindow = calculateExitWindow(timing.end, eventType)

        // Adjust confidence based on venue match
        let confidence = CONFIDENCE_RUBRIC.RELIABLE_STRUCTURED
        if (!venue) {
          confidence *= 0.6 // Reduce confidence if venue unknown
        }

        signals.push({
          id: `oa-${event.uid}`,
          type: 'event',
          title,
          venue: venueName,
          zone,
          corridor: corridor as CorridorDirection,
          startTime: timing.begin,
          endTime: timing.end,
          exitWindow,
          estimatedAttendance: event.attendance || venue?.capacity || null,
          confidence,
          source: 'openagenda',
          compiledAt: new Date().toISOString(),
          ttl: TTL_EVENTS,
        })
      }
    }

    return signals
  } catch (error) {
    console.error('[events] OpenAgenda fetch error:', error)
    return signals
  }
}

/**
 * Load manual events from JSON file
 */
function loadManualEvents(date: string, venueRegistry: Map<string, Venue>): EventSignal[] {
  const signals: EventSignal[] = []

  try {
    const manualPath = path.join(process.cwd(), 'data', 'signals', 'manual-override.json')
    if (!fs.existsSync(manualPath)) return signals

    const raw = fs.readFileSync(manualPath, 'utf-8')
    const data = JSON.parse(raw)
    const events = data.events || []

    for (const event of events) {
      // Check if event is for today
      if (event.date && event.date !== date) continue

      const venue = matchVenue(event.venue || '', venueRegistry)
      const zone = event.zone || venue?.zone || 'unknown'
      const corridor = event.corridor || venue?.corridor || 'unknown'

      const eventType = mapEventType(event.type || 'other')

      // Build full timestamps
      const startTime = event.startTime
        ? `${date}T${event.startTime}:00`
        : `${date}T20:00:00`
      const endTime = event.endTime
        ? `${date}T${event.endTime}:00`
        : `${date}T23:00:00`

      const exitWindow = event.exitWindow || calculateExitWindow(endTime, eventType)

      signals.push({
        id: `manual-${event.id || Date.now()}`,
        type: 'event',
        title: event.title,
        venue: event.venue || 'Unknown',
        zone,
        corridor: corridor as CorridorDirection,
        startTime,
        endTime,
        exitWindow: typeof exitWindow === 'object'
          ? exitWindow
          : { start: `${date}T${exitWindow.start}:00`, end: `${date}T${exitWindow.end}:00` },
        estimatedAttendance: event.attendance || null,
        confidence: CONFIDENCE_RUBRIC.MANUAL_OPERATOR,
        source: 'manual',
        compiledAt: new Date().toISOString(),
        ttl: TTL_EVENTS,
      })
    }
  } catch (error) {
    console.warn('[events] Could not load manual events:', error)
  }

  return signals
}

/**
 * Create unknown event placeholder
 */
export function createUnknownEventPlaceholder(): EventSignal {
  const now = new Date()
  return {
    id: 'unknown-placeholder',
    type: 'event',
    title: 'Aucun evenement detecte',
    venue: 'unknown',
    zone: 'unknown',
    corridor: 'nord',
    startTime: now.toISOString(),
    endTime: now.toISOString(),
    exitWindow: { start: now.toISOString(), end: now.toISOString() },
    estimatedAttendance: null,
    confidence: CONFIDENCE_RUBRIC.UNKNOWN,
    source: 'none',
    compiledAt: now.toISOString(),
    ttl: 1800,
  }
}
