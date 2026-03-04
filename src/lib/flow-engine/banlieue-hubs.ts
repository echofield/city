/**
 * Banlieue Hub State Computation
 *
 * Computes the state of external pressure hubs (CDG, Orly, La Defense, etc.)
 * from city signals events and ramifications.
 */

import type { BanlieueHubState } from '@/types/flow-state'
import type { CitySignalsPackV1 } from '@/types/city-signals-pack'

/** Hub definitions matching frontend parisData.ts */
export const BANLIEUE_HUBS: { id: string; name: string; corridor: 'nord' | 'est' | 'sud' | 'ouest' }[] = [
  { id: 'saint-denis', name: 'Saint-Denis', corridor: 'nord' },
  { id: 'villepinte', name: 'Villepinte', corridor: 'nord' },
  { id: 'cdg', name: 'CDG', corridor: 'nord' },
  { id: 'la-defense', name: 'La Defense', corridor: 'ouest' },
  { id: 'orly', name: 'Orly', corridor: 'sud' },
  { id: 'montreuil', name: 'Montreuil', corridor: 'est' },
]

/** Zone names that correspond to each hub */
const HUB_ZONE_MAPPING: Record<string, string[]> = {
  'saint-denis': ['Saint-Denis', 'Stade de France', 'La Plaine'],
  'villepinte': ['Villepinte', 'Parc des Expositions', 'Tremblay'],
  'cdg': ['CDG', 'Charles de Gaulle', 'Roissy', 'Aeroport CDG'],
  'la-defense': ['La Defense', 'La Défense', 'Nanterre', 'CNIT', 'La Defense'],
  'orly': ['Orly', 'Aeroport Orly'],
  'montreuil': ['Montreuil', 'Vincennes', 'Pantin'],
}

/** Corridor zones mapping for ramification pressure */
const CORRIDOR_HUB_MAPPING: Record<string, string[]> = {
  nord: ['saint-denis', 'villepinte', 'cdg'],
  est: ['montreuil'],
  sud: ['orly'],
  ouest: ['la-defense'],
}

interface EventLike {
  zoneImpact?: string[]
  start_time?: string | null
  end_time?: string | null
  startTime?: string | null
  endTime?: string | null
}

interface RamificationLike {
  corridor?: string
  pressureZones?: string[]
  effectZones?: string[]
  window?: string | { start?: string; end?: string }
  window_start?: string
  window_end?: string
  regime?: string
  confidence?: number | string // Can be number 0-1 or string "high" | "medium" | "low"
  explanation?: string
}

function computeHubState(
  hubId: string,
  corridor: 'nord' | 'est' | 'sud' | 'ouest',
  events: EventLike[],
  ramifications: RamificationLike[]
): BanlieueHubState {
  const currentHour = new Date().getHours()
  const hubZones = HUB_ZONE_MAPPING[hubId] || []

  // Check if any current events affect this hub
  const relevantEvents = events.filter(e => {
    const zones = e.zoneImpact || []
    return zones.some(z => hubZones.some(hz => z.toLowerCase().includes(hz.toLowerCase())))
  })

  // Check ramifications for corridor pressure
  const relevantRams = ramifications.filter(r => {
    if (r.corridor === corridor) return true
    const zones = [...(r.pressureZones || []), ...(r.effectZones || [])]
    return zones.some(z => hubZones.some(hz => z.toLowerCase().includes(hz.toLowerCase())))
  })

  let heat = 0
  let status: BanlieueHubState['status'] = 'dormant'
  let nextPic: string | undefined

  // Helper to normalize confidence (can be number 0-1 or string "high" | "medium" | "low")
  const normalizeConfidence = (conf: number | string | undefined): number => {
    if (typeof conf === 'number') return conf
    if (conf === 'high') return 0.9
    if (conf === 'medium') return 0.6
    if (conf === 'low') return 0.3
    return 0.5
  }

  // Priority 1: Ramifications (from tonight pack)
  if (relevantRams.length > 0) {
    // Find highest confidence ramification
    const bestRam = relevantRams.sort((a, b) => normalizeConfidence(b.confidence) - normalizeConfidence(a.confidence))[0]
    heat = normalizeConfidence(bestRam.confidence) * 0.8

    // Parse window from ramification (can be string "HH:MM-HH:MM" or object)
    let windowStart: Date | null = null
    let windowEnd: Date | null = null

    if (bestRam.window && typeof bestRam.window === 'object') {
      if (bestRam.window.start) windowStart = new Date(bestRam.window.start)
      if (bestRam.window.end) windowEnd = new Date(bestRam.window.end)
    } else if (bestRam.window_start || bestRam.window_end) {
      if (bestRam.window_start) windowStart = new Date(bestRam.window_start)
      if (bestRam.window_end) windowEnd = new Date(bestRam.window_end)
    } else if (typeof bestRam.window === 'string' && bestRam.window.includes('-')) {
      // Parse "HH:MM-HH:MM" format
      const [startStr, endStr] = bestRam.window.split('-')
      const today = new Date().toISOString().split('T')[0]
      if (startStr) windowStart = new Date(`${today}T${startStr.trim()}:00`)
      if (endStr) windowEnd = new Date(`${today}T${endStr.trim()}:00`)
    }

    // Check if we're within the ramification window
    if (windowStart && windowEnd) {
      const now = new Date()

      if (now >= windowStart && now <= windowEnd) {
        // Currently in window
        status = 'active'
        heat = Math.max(heat, 0.7)
        nextPic = windowEnd.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Paris'
        })
      } else if (now < windowStart) {
        // Window forming
        status = 'forming'
        heat = Math.max(heat, 0.4)
        nextPic = windowStart.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Paris'
        })
      }
    } else if (heat > 0.5) {
      status = 'active'
    } else if (heat > 0.2) {
      status = 'forming'
    }
  }

  // Priority 2: Events affecting hub
  if (relevantEvents.length > 0 && status === 'dormant') {
    heat = 0.4 + relevantEvents.length * 0.2
    status = heat > 0.6 ? 'active' : 'forming'

    // Find next peak time from events
    for (const event of relevantEvents) {
      const endTime = event.end_time || event.endTime
      if (endTime) {
        nextPic = endTime
        break
      }
    }
  }

  // Priority 3: Default behavior based on hub type and time
  if (status === 'dormant') {
    switch (hubId) {
      case 'cdg':
      case 'orly': {
        // Airports: active during travel hours
        const isTravel = (currentHour >= 5 && currentHour <= 10) || (currentHour >= 16 && currentHour <= 22)
        heat = isTravel ? 0.5 : 0.1
        status = heat > 0.4 ? 'active' : heat > 0.15 ? 'forming' : 'dormant'
        if (isTravel) {
          nextPic = `${String((currentHour + 1) % 24).padStart(2, '0')}:00`
        }
        break
      }
      case 'saint-denis': {
        // Event-driven, default low
        heat = 0.1
        status = 'dormant'
        break
      }
      case 'la-defense': {
        // Business hours
        const isBusiness = currentHour >= 7 && currentHour <= 20
        heat = isBusiness ? 0.35 : 0.05
        status = heat > 0.3 ? 'active' : heat > 0.1 ? 'forming' : 'dormant'
        if (isBusiness && currentHour >= 17) {
          nextPic = '19:00'
        }
        break
      }
      case 'villepinte': {
        // Expo-driven, default low
        heat = 0.08
        status = 'dormant'
        break
      }
      case 'montreuil': {
        // Evening activity
        const isEvening = currentHour >= 18 && currentHour <= 23
        heat = isEvening ? 0.25 : 0.1
        status = heat > 0.2 ? 'forming' : 'dormant'
        break
      }
      default:
        heat = 0.1
        status = 'dormant'
    }
  }

  return {
    id: hubId,
    heat: Math.min(1, heat),
    status,
    nextPic,
    corridor,
  }
}

/**
 * Compute banlieue hub states from city signals pack
 */
export function computeBanlieueHubs(
  pack: CitySignalsPackV1 | null,
  ramifications: RamificationLike[] = []
): Record<string, BanlieueHubState> {
  const events = pack?.events || []
  const hubs: Record<string, BanlieueHubState> = {}

  for (const hub of BANLIEUE_HUBS) {
    hubs[hub.id] = computeHubState(hub.id, hub.corridor, events, ramifications)
  }

  return hubs
}
