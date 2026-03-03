import { NextResponse } from 'next/server'
import type { BanlieueHubState, BanlieueHubsResponse } from '@/types/flow-state'
import { loadCitySignals } from '@/lib/city-signals/loadCitySignals'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Hub definitions matching frontend parisData.ts */
const BANLIEUE_HUBS: { id: string; name: string; corridor: 'nord' | 'est' | 'sud' | 'ouest' }[] = [
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
  'la-defense': ['La Defense', 'La Défense', 'Nanterre', 'CNIT'],
  'orly': ['Orly', 'Aeroport Orly'],
  'montreuil': ['Montreuil', 'Vincennes', 'Pantin'],
}

function computeHubState(
  hubId: string,
  corridor: 'nord' | 'est' | 'sud' | 'ouest',
  events: { zoneImpact?: string[]; start_time?: string | null; end_time?: string | null }[]
): BanlieueHubState {
  const currentHour = new Date().getHours()
  const hubZones = HUB_ZONE_MAPPING[hubId] || []

  // Check if any current events affect this hub
  const relevantEvents = events.filter(e => {
    const zones = e.zoneImpact || []
    return zones.some(z => hubZones.some(hz => z.toLowerCase().includes(hz.toLowerCase())))
  })

  let heat = 0
  let status: BanlieueHubState['status'] = 'dormant'
  let nextPic: string | undefined

  if (relevantEvents.length > 0) {
    // Events are affecting this hub
    heat = 0.4 + relevantEvents.length * 0.2
    status = heat > 0.6 ? 'active' : 'forming'

    // Find next peak time from events
    for (const event of relevantEvents) {
      if (event.end_time) {
        nextPic = event.end_time
        break
      }
    }
  } else {
    // Default behavior based on hub type and time
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

export async function GET() {
  // Load city signals to check for events affecting banlieue hubs
  const pack = await loadCitySignals()
  const events = pack?.events || []

  const hubs: Record<string, BanlieueHubState> = {}

  for (const hub of BANLIEUE_HUBS) {
    hubs[hub.id] = computeHubState(hub.id, hub.corridor, events)
  }

  const response: BanlieueHubsResponse = {
    hubs,
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
