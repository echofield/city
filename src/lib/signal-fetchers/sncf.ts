/**
 * SNCF Station Arrivals — Real-time train signal fetcher
 *
 * Uses Navitia/SNCF API to fetch:
 * - Next arrivals at tracked stations
 * - Delays and disruptions
 * - Computes pressure windows for Flow signals
 *
 * API: https://api.sncf.com/v1/coverage/sncf/
 */

import type { CorridorDirection } from './types'

// ── Types ──

export interface StationConfig {
  id: string
  name: string
  stop_area_id: string
  uic_code: string
  flow_zone: string
  corridor: CorridorDirection | 'centre'
  lat: number
  lng: number
  entry_hint: string
  ride_profile: string
  train_types: string[]
  peak_hours: string[]
  capacity_factor: number
}

export interface StationArrival {
  trainNumber: string
  trainType: 'tgv' | 'eurostar' | 'thalys' | 'ice' | 'intercites' | 'ter' | 'transilien' | 'unknown'
  origin: string
  scheduledArrival: string  // ISO
  realtimeArrival: string   // ISO (includes delays)
  delayMinutes: number
  platform?: string
  isInternational: boolean
  estimatedPassengers: number
}

export interface StationPressure {
  stationId: string
  stationName: string
  corridor: CorridorDirection | 'centre'
  zone: string
  windowStart: string       // ISO
  windowEnd: string         // ISO
  arrivalCount: number
  totalPassengers: number
  score: number             // 0-100 normalized
  intensity: 'low' | 'medium' | 'high' | 'very_high'
  entryHint: string
  rideProfile: string
  lat: number
  lng: number
  arrivals: StationArrival[]
  hasDelay: boolean
  hasInternational: boolean
}

export interface StationSignal {
  type: 'station_arrival'
  id: string
  stationId: string
  stationName: string
  zone: string
  corridor: CorridorDirection | 'centre'
  window: { start: string; end: string }
  intensity: number         // 0-1
  confidence: number        // 0-1
  source: 'sncf_realtime'
  compiledAt: string
  ttl: number
  // Flow-specific
  arrivalCount: number
  estimatedPassengers: number
  hasInternational: boolean
  hasDelay: boolean
  entryHint: string
  rideProfile: string
  lat: number
  lng: number
}

// ── Station Config Loader ──

let stationsCache: StationConfig[] | null = null

// Static station config (embedded to avoid fs issues in serverless)
// stop_area IDs verified via SNCF API /stop_areas?q=gare
const PARIS_STATIONS: StationConfig[] = [
  {
    id: "gare_du_nord",
    name: "Gare du Nord",
    stop_area_id: "stop_area:SNCF:87271007",  // Verified UIC: 8727100
    uic_code: "87271007",
    flow_zone: "10",
    corridor: "nord",
    lat: 48.8809,
    lng: 2.3553,
    entry_hint: "Sortie rue de Dunkerque",
    ride_profile: "Eurostar, Thalys — courses longues",
    train_types: ["tgv", "eurostar", "thalys", "ter", "transilien"],
    peak_hours: ["07:00-09:30", "17:30-20:00"],
    capacity_factor: 1.5,
  },
  {
    id: "gare_de_lyon",
    name: "Gare de Lyon",
    stop_area_id: "stop_area:SNCF:87686006",
    uic_code: "87686006",
    flow_zone: "12",
    corridor: "est",
    lat: 48.8448,
    lng: 2.3735,
    entry_hint: "Hall 1 — Rue de Bercy",
    ride_profile: "TGV Sud-Est — courses longues",
    train_types: ["tgv", "ter", "transilien"],
    peak_hours: ["07:00-09:30", "17:00-20:30"],
    capacity_factor: 1.4,
  },
  {
    id: "gare_montparnasse",
    name: "Gare Montparnasse",
    stop_area_id: "stop_area:SNCF:87391003",
    uic_code: "87391003",
    flow_zone: "14",
    corridor: "sud",
    lat: 48.8408,
    lng: 2.3212,
    entry_hint: "Hall 1 — Place Raoul Dautry",
    ride_profile: "TGV Atlantique — ouest Paris",
    train_types: ["tgv", "ter", "transilien"],
    peak_hours: ["07:00-09:30", "17:30-20:00"],
    capacity_factor: 1.2,
  },
  {
    id: "gare_saint_lazare",
    name: "Gare Saint-Lazare",
    stop_area_id: "stop_area:SNCF:87384008",
    uic_code: "87384008",
    flow_zone: "8",
    corridor: "ouest",
    lat: 48.8766,
    lng: 2.3250,
    entry_hint: "Cour de Rome",
    ride_profile: "Normandie — courses courtes/moyennes",
    train_types: ["intercites", "ter", "transilien"],
    peak_hours: ["07:30-09:30", "17:30-19:30"],
    capacity_factor: 1.0,
  },
]

export async function loadStations(): Promise<StationConfig[]> {
  if (stationsCache) return stationsCache
  stationsCache = PARIS_STATIONS
  return stationsCache
}

// ── SNCF API Client ──

const SNCF_API_BASE = 'https://api.sncf.com/v1/coverage/sncf'

interface NavitiaArrival {
  stop_date_time: {
    arrival_date_time: string
    base_arrival_date_time: string
    departure_date_time?: string
  }
  display_informations: {
    commercial_mode: string
    network: string
    direction: string
    headsign: string
    code: string
  }
  stop_point: {
    name: string
  }
  links?: Array<{
    type: string
    id: string
  }>
}

interface NavitiaResponse {
  arrivals?: NavitiaArrival[]
  departures?: NavitiaArrival[]
  error?: {
    id: string
    message: string
  }
}

function getTrainType(commercialMode: string, network: string): StationArrival['trainType'] {
  const mode = commercialMode.toLowerCase()
  const net = network.toLowerCase()

  if (mode.includes('tgv') || net.includes('tgv')) return 'tgv'
  if (mode.includes('eurostar') || net.includes('eurostar')) return 'eurostar'
  if (mode.includes('thalys') || net.includes('thalys')) return 'thalys'
  if (mode.includes('ice')) return 'ice'
  if (mode.includes('intercit') || net.includes('intercit')) return 'intercites'
  if (mode.includes('ter')) return 'ter'
  if (mode.includes('transilien') || net.includes('transilien')) return 'transilien'
  return 'unknown'
}

function estimatePassengers(trainType: StationArrival['trainType']): number {
  // Rough estimates per train type
  switch (trainType) {
    case 'tgv': return 500
    case 'eurostar': return 750
    case 'thalys': return 400
    case 'ice': return 400
    case 'intercites': return 350
    case 'ter': return 200
    case 'transilien': return 600
    default: return 200
  }
}

function isInternational(trainType: StationArrival['trainType']): boolean {
  return ['eurostar', 'thalys', 'ice'].includes(trainType)
}

function parseNavitiaDateTime(dt: string): Date {
  // Format: 20260307T194500
  const year = parseInt(dt.slice(0, 4))
  const month = parseInt(dt.slice(4, 6)) - 1
  const day = parseInt(dt.slice(6, 8))
  const hour = parseInt(dt.slice(9, 11))
  const minute = parseInt(dt.slice(11, 13))
  const second = parseInt(dt.slice(13, 15)) || 0
  return new Date(year, month, day, hour, minute, second)
}

export async function fetchStationArrivals(
  station: StationConfig,
  windowMinutes: number = 90
): Promise<StationArrival[]> {
  const apiKey = process.env.SNCF_API_KEY

  if (!apiKey) {
    console.warn('[SNCF] No API key configured (SNCF_API_KEY)')
    return []
  }

  const now = new Date()
  const fromDatetime = now.toISOString().replace(/[-:]/g, '').split('.')[0]

  try {
    const url = `${SNCF_API_BASE}/stop_areas/${station.stop_area_id}/arrivals?from_datetime=${fromDatetime}&count=30&data_freshness=realtime`

    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
      },
      next: { revalidate: 120 }, // Cache for 2 minutes
    })

    if (!response.ok) {
      console.error(`[SNCF] API error for ${station.name}:`, response.status)
      return []
    }

    const data: NavitiaResponse = await response.json()

    if (data.error) {
      console.error(`[SNCF] API error for ${station.name}:`, data.error.message)
      return []
    }

    const arrivals: StationArrival[] = []
    const cutoff = new Date(now.getTime() + windowMinutes * 60 * 1000)

    for (const arr of data.arrivals || []) {
      const realtimeArrival = parseNavitiaDateTime(arr.stop_date_time.arrival_date_time)
      const scheduledArrival = parseNavitiaDateTime(arr.stop_date_time.base_arrival_date_time)

      // Skip if outside window
      if (realtimeArrival > cutoff) continue

      const trainType = getTrainType(
        arr.display_informations.commercial_mode,
        arr.display_informations.network
      )

      const delayMinutes = Math.round(
        (realtimeArrival.getTime() - scheduledArrival.getTime()) / 60000
      )

      arrivals.push({
        trainNumber: arr.display_informations.headsign || arr.display_informations.code,
        trainType,
        origin: arr.display_informations.direction,
        scheduledArrival: scheduledArrival.toISOString(),
        realtimeArrival: realtimeArrival.toISOString(),
        delayMinutes,
        isInternational: isInternational(trainType),
        estimatedPassengers: estimatePassengers(trainType),
      })
    }

    return arrivals
  } catch (err) {
    console.error(`[SNCF] Fetch error for ${station.name}:`, err)
    return []
  }
}

// ── Forced Mobility Detection ──
// The real intelligence: demand is strongest when people are FORCED to use VTC
// Formula: people_released × transport_weakness × time_pressure = forced_mobility

function computeTransportWeakness(hour: number): number {
  // Metro runs ~05:30-00:30, weakens after 23:00
  // Highest weakness: 00:30 - 05:30 (no metro)
  // Medium weakness: 23:00 - 00:30 (last metros, unreliable)
  // Low weakness: 05:30 - 23:00 (full service)

  if (hour >= 1 && hour < 5) return 1.0    // No metro at all
  if (hour >= 0 && hour < 1) return 0.8    // Last metros gone
  if (hour >= 23 || hour === 0) return 0.6 // Weakening service
  if (hour >= 22) return 0.3               // Reduced frequency
  return 0.1                                // Full metro service
}

function computeTimePressure(hour: number, isWeekend: boolean): number {
  // Late arrivals = higher pressure (people want to get home)
  // Weekend late = slightly lower (less urgency)

  const baseMultiplier = isWeekend ? 0.8 : 1.0

  if (hour >= 22 || hour < 2) return 1.0 * baseMultiplier   // Late night = high pressure
  if (hour >= 20) return 0.7 * baseMultiplier               // Evening
  if (hour >= 7 && hour < 10) return 0.8 * baseMultiplier   // Morning rush
  if (hour >= 17 && hour < 20) return 0.7 * baseMultiplier  // Evening rush
  return 0.4 * baseMultiplier                                // Daytime = low pressure
}

// ── Pressure Computation ──

export function computeStationPressure(
  station: StationConfig,
  arrivals: StationArrival[]
): StationPressure | null {
  if (arrivals.length === 0) return null

  // Group arrivals into pressure windows (15-minute clusters)
  const now = new Date()
  const windowMinutes = 45 // Pressure window after first arrival

  // Find earliest arrival
  const sortedArrivals = [...arrivals].sort(
    (a, b) => new Date(a.realtimeArrival).getTime() - new Date(b.realtimeArrival).getTime()
  )

  const firstArrival = new Date(sortedArrivals[0].realtimeArrival)
  const windowStart = firstArrival
  const windowEnd = new Date(firstArrival.getTime() + windowMinutes * 60 * 1000)

  // Filter arrivals in this window
  const windowArrivals = sortedArrivals.filter(arr => {
    const arrTime = new Date(arr.realtimeArrival)
    return arrTime >= windowStart && arrTime <= windowEnd
  })

  const totalPassengers = windowArrivals.reduce(
    (sum, arr) => sum + arr.estimatedPassengers,
    0
  )

  // ═══════════════════════════════════════════════════════════════
  // FORCED MOBILITY SCORING
  // Not just "demand" but "demand where VTC is the only good option"
  // ═══════════════════════════════════════════════════════════════

  const hour = firstArrival.getHours()
  const isWeekend = firstArrival.getDay() === 0 || firstArrival.getDay() === 6

  // 1. Base score from volume
  let baseScore = Math.min(50, windowArrivals.length * 8)

  // 2. International trains = longer rides, less metro-friendly destinations
  const internationalCount = windowArrivals.filter(a => a.isInternational).length
  const internationalBoost = internationalCount * 8

  // 3. Delays = concentrated wave, people are tired/frustrated
  const hasDelay = windowArrivals.some(a => a.delayMinutes > 5)
  const delayBoost = hasDelay ? 12 : 0

  // 4. Transport weakness multiplier (the key insight)
  const transportWeakness = computeTransportWeakness(hour)

  // 5. Time pressure multiplier
  const timePressure = computeTimePressure(hour, isWeekend)

  // 6. Station capacity factor
  const capacityFactor = station.capacity_factor

  // Final formula: base + boosts, then multiply by weakness and pressure
  const rawScore = baseScore + internationalBoost + delayBoost
  let score = rawScore * (1 + transportWeakness) * (1 + timePressure * 0.3) * capacityFactor

  // Normalize to 0-100
  score = Math.round(Math.min(100, Math.max(0, score)))

  // Determine intensity label
  let intensity: StationPressure['intensity'] = 'low'
  if (score >= 70) intensity = 'very_high'
  else if (score >= 50) intensity = 'high'
  else if (score >= 30) intensity = 'medium'

  // Log for debugging forced mobility detection
  if (transportWeakness > 0.5) {
    console.log(`[SNCF] Forced mobility detected at ${station.name}: weakness=${transportWeakness.toFixed(2)}, pressure=${timePressure.toFixed(2)}, score=${score}`)
  }

  return {
    stationId: station.id,
    stationName: station.name,
    corridor: station.corridor,
    zone: station.flow_zone,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    arrivalCount: windowArrivals.length,
    totalPassengers,
    score,
    intensity,
    entryHint: station.entry_hint,
    rideProfile: station.ride_profile,
    lat: station.lat,
    lng: station.lng,
    arrivals: windowArrivals,
    hasDelay,
    hasInternational: internationalCount > 0,
  }
}

// ── Convert to Flow Signal ──

export function pressureToSignal(pressure: StationPressure): StationSignal {
  const now = new Date()
  const windowStart = new Date(pressure.windowStart)
  const hour = windowStart.getHours()

  // Detect forced mobility scenario
  const transportWeakness = computeTransportWeakness(hour)
  const isForcedMobility = transportWeakness >= 0.5

  // Enhance ride profile for forced mobility
  let rideProfile = pressure.rideProfile
  if (isForcedMobility && pressure.hasInternational) {
    rideProfile = "Metro fermé + international — courses longues garanties"
  } else if (isForcedMobility) {
    rideProfile = "Alternatives faibles — VTC privilégié"
  }

  return {
    type: 'station_arrival',
    id: `station-${pressure.stationId}-${Date.now()}`,
    stationId: pressure.stationId,
    stationName: pressure.stationName,
    zone: pressure.zone,
    corridor: pressure.corridor,
    window: {
      start: pressure.windowStart,
      end: pressure.windowEnd,
    },
    intensity: pressure.score / 100,
    confidence: 0.95, // SNCF realtime is authoritative
    source: 'sncf_realtime',
    compiledAt: now.toISOString(),
    ttl: 180, // 3 minutes - trains move fast
    arrivalCount: pressure.arrivalCount,
    estimatedPassengers: pressure.totalPassengers,
    hasInternational: pressure.hasInternational,
    hasDelay: pressure.hasDelay,
    entryHint: pressure.entryHint,
    rideProfile,
    lat: pressure.lat,
    lng: pressure.lng,
  }
}

// ── Main Fetch Function ──

export async function fetchAllStationSignals(): Promise<StationSignal[]> {
  const stations = await loadStations()
  const signals: StationSignal[] = []

  for (const station of stations) {
    try {
      const arrivals = await fetchStationArrivals(station)
      const pressure = computeStationPressure(station, arrivals)

      if (pressure && pressure.score >= 20) {
        signals.push(pressureToSignal(pressure))
      }
    } catch (err) {
      console.error(`[SNCF] Error processing ${station.name}:`, err)
    }
  }

  // Sort by score descending
  signals.sort((a, b) => b.intensity - a.intensity)

  return signals
}

// ── Cache Layer ──

interface StationCache {
  signals: StationSignal[]
  fetchedAt: number
  ttl: number
}

let stationSignalCache: StationCache | null = null
const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes

export async function getStationSignals(): Promise<StationSignal[]> {
  const now = Date.now()

  // Return cached if fresh
  if (stationSignalCache && (now - stationSignalCache.fetchedAt) < CACHE_TTL_MS) {
    return stationSignalCache.signals
  }

  // Fetch fresh
  const signals = await fetchAllStationSignals()

  stationSignalCache = {
    signals,
    fetchedAt: now,
    ttl: CACHE_TTL_MS,
  }

  return signals
}
