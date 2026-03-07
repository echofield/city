/**
 * AVIATIONSTACK FLIGHT PROVIDER
 *
 * Fetches real-time flight arrivals for Paris airports (CDG, ORY).
 * Transforms into Passenger Release Waves for the Forced Mobility system.
 *
 * API: http://api.aviationstack.com/v1/flights
 * Docs: https://aviationstack.com/documentation
 *
 * Caching: 30 minute server-side cache to minimize API calls.
 * One API call serves all drivers.
 */

import { cache, CACHE_TTL } from '@/lib/cache'
import {
  ForcedMobilityWave,
  computePeopleReleasedScore,
  computeTransportWeakness,
  computeTimePressure,
  computeRideQuality,
  computeFinalForcedMobilityScore,
  inferRideProfile,
  type RideQualityFactors,
  type TransportContext,
} from '@/lib/flow-engine/forced-mobility'

// ═══════════════════════════════════════════════════════════════════
// TYPES — Aviationstack API Response
// ═══════════════════════════════════════════════════════════════════

interface AviationstackFlight {
  flight_date: string
  flight_status: string
  departure: {
    airport: string
    timezone: string
    iata: string
    icao: string
    terminal: string | null
    gate: string | null
    delay: number | null
    scheduled: string
    estimated: string | null
    actual: string | null
  }
  arrival: {
    airport: string
    timezone: string
    iata: string
    icao: string
    terminal: string | null
    gate: string | null
    baggage: string | null
    delay: number | null
    scheduled: string
    estimated: string | null
    actual: string | null
  }
  airline: {
    name: string
    iata: string
    icao: string
  }
  flight: {
    number: string
    iata: string
    icao: string
  }
}

interface AviationstackResponse {
  pagination: {
    limit: number
    offset: number
    count: number
    total: number
  }
  data: AviationstackFlight[]
}

// ═══════════════════════════════════════════════════════════════════
// AIRPORT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

export interface AirportConfig {
  iata: string
  name: string
  corridor: 'nord' | 'sud'
  lat: number
  lng: number
  terminals: string[]
  avg_passengers_per_flight: number
  customs_delay_minutes: number
  baggage_delay_minutes: number
  positioning_hint: string
  ride_profile_hint: string
}

export const PARIS_AIRPORTS: AirportConfig[] = [
  {
    iata: 'CDG',
    name: 'Charles de Gaulle',
    corridor: 'nord',
    lat: 49.0097,
    lng: 2.5479,
    terminals: ['1', '2A', '2B', '2C', '2D', '2E', '2F', '2G', '3'],
    avg_passengers_per_flight: 180,
    customs_delay_minutes: 20,
    baggage_delay_minutes: 15,
    positioning_hint: 'Terminal 2E/2F pour international long-courrier',
    ride_profile_hint: 'Courses longues vers Paris centre ou banlieue ouest',
  },
  {
    iata: 'ORY',
    name: 'Orly',
    corridor: 'sud',
    lat: 48.7262,
    lng: 2.3652,
    terminals: ['1', '2', '3', '4'],
    avg_passengers_per_flight: 150,
    customs_delay_minutes: 15,
    baggage_delay_minutes: 12,
    positioning_hint: 'Terminal Sud pour vols domestiques',
    ride_profile_hint: 'Mix courses moyennes, clientèle affaires',
  },
]

// ═══════════════════════════════════════════════════════════════════
// PROCESSED FLIGHT DATA
// ═══════════════════════════════════════════════════════════════════

export interface ProcessedFlight {
  flight_number: string
  airline: string
  origin_iata: string
  arrival_airport: string
  terminal: string | null
  scheduled_arrival: Date
  estimated_arrival: Date
  delay_minutes: number
  passenger_release_time: Date
  is_international: boolean
  is_long_haul: boolean
}

export interface FlightCluster {
  airport_iata: string
  airport_name: string
  terminal: string | null
  flights: ProcessedFlight[]
  cluster_start: Date
  cluster_end: Date
  passenger_release_start: Date
  passenger_release_end: Date
  total_passengers_estimate: number
  is_international_heavy: boolean
}

// ═══════════════════════════════════════════════════════════════════
// CACHE KEYS
// ═══════════════════════════════════════════════════════════════════

const CACHE_KEY_CDG = 'aviationstack:arrivals:CDG'
const CACHE_KEY_ORY = 'aviationstack:arrivals:ORY'
const CACHE_TTL_FLIGHTS = 30 * 60 // 30 minutes in seconds

// ═══════════════════════════════════════════════════════════════════
// API CLIENT
// ═══════════════════════════════════════════════════════════════════

const AVIATIONSTACK_API_URL = 'http://api.aviationstack.com/v1/flights'

/**
 * Fetch arrivals from Aviationstack API
 */
async function fetchArrivalsFromApi(airportIata: string): Promise<AviationstackFlight[]> {
  const apiKey = process.env.AVIATIONSTACK_API_KEY

  if (!apiKey) {
    console.warn('[aviationstack] AVIATIONSTACK_API_KEY not configured')
    return []
  }

  const url = new URL(AVIATIONSTACK_API_URL)
  url.searchParams.set('access_key', apiKey)
  url.searchParams.set('arr_iata', airportIata)
  url.searchParams.set('flight_status', 'scheduled,active,landed')
  url.searchParams.set('limit', '100')

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: CACHE_TTL_FLIGHTS },
    })

    if (!response.ok) {
      console.error(`[aviationstack] API error: ${response.status} ${response.statusText}`)
      return []
    }

    const data: AviationstackResponse = await response.json()

    if (!data.data) {
      console.warn('[aviationstack] No data in response')
      return []
    }

    console.log(`[aviationstack] Fetched ${data.data.length} flights for ${airportIata}`)
    return data.data
  } catch (err) {
    console.error('[aviationstack] Fetch error:', err)
    return []
  }
}

// ═══════════════════════════════════════════════════════════════════
// FLIGHT PROCESSING
// ═══════════════════════════════════════════════════════════════════

/**
 * Determine if a flight is international based on origin
 */
function isInternationalFlight(originIata: string): boolean {
  // French domestic airports start with L (LFPG, LFPO, etc. in ICAO)
  // But we use IATA codes here
  const frenchDomestic = [
    'NCE', 'LYS', 'MRS', 'TLS', 'NTE', 'BOD', 'SXB', 'MPL', 'RNS', 'LIL',
    'BIQ', 'BES', 'ETZ', 'MLH', 'TLN', 'CFR', 'PGF', 'LDE', 'XCR', 'URO',
  ]
  return !frenchDomestic.includes(originIata)
}

/**
 * Determine if a flight is long-haul (>4h flight time)
 */
function isLongHaulFlight(originIata: string): boolean {
  // Long-haul origins (Americas, Asia, Africa, Oceania)
  const longHaulPrefixes = ['J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'Y', 'Z']
  // More specific: US, Canada, Asia, etc.
  const longHaulOrigins = [
    // US major hubs
    'JFK', 'LAX', 'ORD', 'DFW', 'ATL', 'MIA', 'SFO', 'BOS', 'EWR', 'IAD',
    // Canada
    'YYZ', 'YVR', 'YUL',
    // Asia
    'NRT', 'HND', 'PEK', 'PVG', 'HKG', 'SIN', 'BKK', 'ICN', 'KIX', 'DEL', 'BOM', 'DXB', 'DOH', 'AUH',
    // South America
    'GRU', 'EZE', 'BOG', 'SCL', 'LIM',
    // Africa
    'JNB', 'CPT', 'CAI', 'CMN', 'ALG', 'TUN', 'ABJ', 'DKR', 'LOS', 'ADD',
    // Oceania
    'SYD', 'MEL', 'AKL',
  ]
  return longHaulOrigins.includes(originIata) || longHaulPrefixes.includes(originIata[0])
}

/**
 * Process raw flight into structured format
 */
function processFlightData(flight: AviationstackFlight, airportConfig: AirportConfig): ProcessedFlight | null {
  const scheduled = new Date(flight.arrival.scheduled)
  const estimated = flight.arrival.estimated ? new Date(flight.arrival.estimated) : scheduled
  const delay = flight.arrival.delay || 0

  // Calculate passenger release time
  // = arrival + baggage + customs (if international)
  const isIntl = isInternationalFlight(flight.departure.iata)
  const releaseDelay = airportConfig.baggage_delay_minutes + (isIntl ? airportConfig.customs_delay_minutes : 0)
  const releaseTime = new Date(estimated.getTime() + releaseDelay * 60 * 1000)

  return {
    flight_number: flight.flight.iata || flight.flight.number,
    airline: flight.airline.name,
    origin_iata: flight.departure.iata,
    arrival_airport: airportConfig.iata,
    terminal: flight.arrival.terminal,
    scheduled_arrival: scheduled,
    estimated_arrival: estimated,
    delay_minutes: delay,
    passenger_release_time: releaseTime,
    is_international: isIntl,
    is_long_haul: isLongHaulFlight(flight.departure.iata),
  }
}

/**
 * Cluster flights by terminal and time window
 */
function clusterFlights(
  flights: ProcessedFlight[],
  airportConfig: AirportConfig,
  windowMinutes: number = 30
): FlightCluster[] {
  if (flights.length === 0) return []

  // Sort by passenger release time
  const sorted = [...flights].sort(
    (a, b) => a.passenger_release_time.getTime() - b.passenger_release_time.getTime()
  )

  const clusters: FlightCluster[] = []
  let currentCluster: ProcessedFlight[] = [sorted[0]]
  let currentTerminal = sorted[0].terminal

  for (let i = 1; i < sorted.length; i++) {
    const flight = sorted[i]
    const lastFlight = currentCluster[currentCluster.length - 1]
    const timeDiff = (flight.passenger_release_time.getTime() - lastFlight.passenger_release_time.getTime()) / 60000

    // Same terminal and within window? Add to cluster
    if (flight.terminal === currentTerminal && timeDiff <= windowMinutes) {
      currentCluster.push(flight)
    } else {
      // Finalize current cluster
      if (currentCluster.length >= 2) {
        clusters.push(buildCluster(currentCluster, airportConfig))
      }
      // Start new cluster
      currentCluster = [flight]
      currentTerminal = flight.terminal
    }
  }

  // Don't forget last cluster
  if (currentCluster.length >= 2) {
    clusters.push(buildCluster(currentCluster, airportConfig))
  }

  return clusters
}

/**
 * Build a cluster from a group of flights
 */
function buildCluster(flights: ProcessedFlight[], airportConfig: AirportConfig): FlightCluster {
  const firstRelease = flights[0].passenger_release_time
  const lastRelease = flights[flights.length - 1].passenger_release_time

  // Extend release window by 15 minutes for stragglers
  const releaseEnd = new Date(lastRelease.getTime() + 15 * 60 * 1000)

  const internationalCount = flights.filter(f => f.is_international).length
  const isInternationalHeavy = internationalCount / flights.length > 0.5

  const totalPassengers = flights.length * airportConfig.avg_passengers_per_flight

  return {
    airport_iata: airportConfig.iata,
    airport_name: airportConfig.name,
    terminal: flights[0].terminal,
    flights,
    cluster_start: flights[0].estimated_arrival,
    cluster_end: flights[flights.length - 1].estimated_arrival,
    passenger_release_start: firstRelease,
    passenger_release_end: releaseEnd,
    total_passengers_estimate: totalPassengers,
    is_international_heavy: isInternationalHeavy,
  }
}

// ═══════════════════════════════════════════════════════════════════
// FORCED MOBILITY WAVE BUILDER
// ═══════════════════════════════════════════════════════════════════

/**
 * Convert a flight cluster into a ForcedMobilityWave
 */
export function clusterToForcedMobilityWave(
  cluster: FlightCluster,
  transportContext?: TransportContext
): ForcedMobilityWave {
  const airportConfig = PARIS_AIRPORTS.find(a => a.iata === cluster.airport_iata)!
  const hour = cluster.passenger_release_start.getHours()
  const minute = cluster.passenger_release_start.getMinutes()
  const isWeekend = cluster.passenger_release_start.getDay() === 0 || cluster.passenger_release_start.getDay() === 6

  // Compute 4-dimension scores
  const peopleReleased = computePeopleReleasedScore(
    cluster.total_passengers_estimate,
    'waves' // Flights release in waves as passengers deplane
  )

  const transportWeakness = transportContext
    ? computeTransportWeakness(hour, minute) + (transportContext.isRaining ? 15 : 0)
    : computeTransportWeakness(hour, minute)

  const timePressure = computeTimePressure(hour, isWeekend, hour >= 22 || hour < 6)

  const rideQualityFactors: RideQualityFactors = {
    hasLuggage: true,
    isInternational: cluster.is_international_heavy,
    isRemoteLocation: true, // Airports are outside Paris
    averageRideDistance: cluster.is_international_heavy ? 'very_long' : 'long',
    competitionLevel: 'medium',
  }
  const rideQuality = computeRideQuality(rideQualityFactors)

  // Compound if late night + international
  const isCompound = transportWeakness >= 50 && cluster.is_international_heavy
  const finalScore = computeFinalForcedMobilityScore(
    peopleReleased,
    Math.min(100, transportWeakness),
    timePressure,
    rideQuality,
    isCompound
  )

  // Build factors list
  const factors: string[] = ['arrivées_aéroport']
  if (cluster.is_international_heavy) factors.push('international')
  if (cluster.flights.some(f => f.is_long_haul)) factors.push('long_courrier')
  if (transportWeakness >= 60) factors.push('transport_faible')
  if (cluster.flights.length >= 5) factors.push('vague_concentrée')

  // Subtype based on characteristics
  let subtype = 'airport_arrival_wave'
  if (cluster.is_international_heavy && transportWeakness >= 60) {
    subtype = 'airport_international_late_release'
  } else if (cluster.is_international_heavy) {
    subtype = 'airport_international_release'
  } else if (transportWeakness >= 60) {
    subtype = 'airport_late_release'
  }

  // Build terminal hint
  const terminalHint = cluster.terminal
    ? `Terminal ${cluster.terminal}`
    : airportConfig.positioning_hint

  return {
    id: `fm-airport-${cluster.airport_iata}-${cluster.terminal || 'all'}-${Date.now()}`,
    category: isCompound ? 'compound' : 'airport_release',
    subtype,
    zone: `${airportConfig.name} ${terminalHint}`,
    corridor: airportConfig.corridor,
    venue: `${cluster.airport_iata} ${cluster.terminal ? `T${cluster.terminal}` : ''}`,
    wave_start: cluster.passenger_release_start.toISOString(),
    wave_end: cluster.passenger_release_end.toISOString(),
    people_released_score: peopleReleased,
    transport_weakness_score: Math.min(100, transportWeakness),
    time_pressure_score: timePressure,
    ride_quality_score: rideQuality,
    final_score: finalScore,
    likely_ride_profile: inferRideProfile('airport_release', rideQuality, rideQualityFactors),
    positioning_hint: terminalHint,
    entry_hint: airportConfig.positioning_hint,
    confidence: finalScore >= 60 ? 'high' : finalScore >= 40 ? 'medium' : 'low',
    factors,
    lat: airportConfig.lat,
    lng: airportConfig.lng,
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN API
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch and cache arrivals for a specific airport
 */
export async function getAirportArrivals(airportIata: 'CDG' | 'ORY'): Promise<ProcessedFlight[]> {
  const cacheKey = airportIata === 'CDG' ? CACHE_KEY_CDG : CACHE_KEY_ORY
  const airportConfig = PARIS_AIRPORTS.find(a => a.iata === airportIata)!

  // Check cache first
  const cached = cache.get<ProcessedFlight[]>(cacheKey)
  if (cached) {
    console.log(`[aviationstack] Cache hit for ${airportIata}`)
    return cached
  }

  // Fetch from API
  console.log(`[aviationstack] Cache miss for ${airportIata}, fetching from API...`)
  const rawFlights = await fetchArrivalsFromApi(airportIata)

  // Process flights
  const processed = rawFlights
    .map(f => processFlightData(f, airportConfig))
    .filter((f): f is ProcessedFlight => f !== null)
    // Filter to next 6 hours only
    .filter(f => {
      const now = Date.now()
      const releaseTime = f.passenger_release_time.getTime()
      const hoursAhead = (releaseTime - now) / (1000 * 60 * 60)
      return hoursAhead >= -0.5 && hoursAhead <= 6
    })
    .sort((a, b) => a.passenger_release_time.getTime() - b.passenger_release_time.getTime())

  // Cache for 30 minutes
  cache.set(cacheKey, processed, CACHE_TTL_FLIGHTS)

  return processed
}

/**
 * Get flight clusters for an airport
 */
export async function getFlightClusters(airportIata: 'CDG' | 'ORY'): Promise<FlightCluster[]> {
  const flights = await getAirportArrivals(airportIata)
  const airportConfig = PARIS_AIRPORTS.find(a => a.iata === airportIata)!
  return clusterFlights(flights, airportConfig)
}

/**
 * Get forced mobility waves from airport arrivals
 */
export async function getAirportForcedMobilityWaves(
  transportContext?: TransportContext
): Promise<ForcedMobilityWave[]> {
  const [cdgClusters, oryClusters] = await Promise.all([
    getFlightClusters('CDG'),
    getFlightClusters('ORY'),
  ])

  const waves: ForcedMobilityWave[] = []

  for (const cluster of [...cdgClusters, ...oryClusters]) {
    waves.push(clusterToForcedMobilityWave(cluster, transportContext))
  }

  // Sort by final score descending
  return waves.sort((a, b) => b.final_score - a.final_score)
}

/**
 * Get all Paris airport arrivals (both CDG and ORY)
 */
export async function getAllParisAirportArrivals(): Promise<{
  cdg: ProcessedFlight[]
  ory: ProcessedFlight[]
  clusters: FlightCluster[]
  waves: ForcedMobilityWave[]
}> {
  const [cdg, ory] = await Promise.all([
    getAirportArrivals('CDG'),
    getAirportArrivals('ORY'),
  ])

  const cdgConfig = PARIS_AIRPORTS.find(a => a.iata === 'CDG')!
  const oryConfig = PARIS_AIRPORTS.find(a => a.iata === 'ORY')!

  const cdgClusters = clusterFlights(cdg, cdgConfig)
  const oryClusters = clusterFlights(ory, oryConfig)
  const allClusters = [...cdgClusters, ...oryClusters]

  const waves = allClusters.map(c => clusterToForcedMobilityWave(c))
    .sort((a, b) => b.final_score - a.final_score)

  return {
    cdg,
    ory,
    clusters: allClusters,
    waves,
  }
}

// ═══════════════════════════════════════════════════════════════════
// DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Format a release wave for UI display
 */
export function formatReleaseWaveDisplay(wave: ForcedMobilityWave): {
  location: string
  action: string
  window: string
  hint: string
} {
  const start = new Date(wave.wave_start)
  const end = new Date(wave.wave_end)

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

  let hint = 'Courses probables'
  if (wave.likely_ride_profile === 'premium_long') {
    hint = 'Courses longues garanties'
  } else if (wave.likely_ride_profile === 'long') {
    hint = 'Courses longues probables'
  }

  return {
    location: wave.venue || wave.zone,
    action: wave.final_score >= 60 ? 'HOLD POSITION' : 'APPROACH',
    window: `${formatTime(start)} – ${formatTime(end)}`,
    hint,
  }
}
