/**
 * Signal Fetcher Types - v1.5
 * All signals must include source, compiledAt, confidence, ttl
 */

export type CorridorDirection = 'nord' | 'est' | 'sud' | 'ouest'

// ── Event Signal ──

export interface EventSignal {
  id: string
  type: 'event'
  title: string
  venue: string
  zone: string
  corridor: CorridorDirection
  startTime: string // ISO
  endTime: string // ISO
  exitWindow: { start: string; end: string } // The actual signal
  estimatedAttendance: number | null
  confidence: number // 0-1
  source: string
  compiledAt: string // ISO
  ttl: number // seconds
}

// ── Weather Signal ──

export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'heavy_rain' | 'snow'
export type WeatherImpact = 'neutral' | 'fragmented' | 'amplified'

export interface WeatherSignal {
  type: 'weather'
  condition: WeatherCondition
  temperature: number
  rainProbability: number
  windSpeed: number
  impact: WeatherImpact
  confidence: number // always 1 for weather
  source: string
  compiledAt: string
  ttl: number
}

// ── Transport Signal ──

export type TransportStatus = 'normal' | 'delayed' | 'disrupted' | 'closed'

export interface TransportSignal {
  type: 'transport'
  line: string
  status: TransportStatus
  corridor: CorridorDirection | 'unknown'
  affectedZones: string[]
  since: string // ISO
  estimatedResolution: string | null // ISO or null
  confidence: number
  source: string
  compiledAt: string
  ttl: number
}

// ── Ramification ──

export type RamificationRegime = 'directed' | 'fragmented' | 'herded' | 'social_spill'

export interface Ramification {
  id: string
  regime: RamificationRegime
  corridor: CorridorDirection | null
  pressureZones: string[]
  effectZones: string[]
  window: { start: string; end: string }
  confidence: number
  ttl: number
  explanation: string // Shown to driver
}

// ── Weekly Skeleton ──

export interface WeeklyWindow {
  id: string
  name: string
  dayOfWeek: number | number[]
  window: { start: string; end: string }
  zones: string[]
  corridors: CorridorDirection[]
  confidence: number
  intensity: number
  description: string
}

// ── Exit Wave Signal (from Sensor Mode v1.6) ──

export type CrowdLabel = 'young_metro' | 'premium' | 'mixed' | 'tourist' | 'unknown'

export interface ExitWaveSignal {
  type: 'exit_wave'
  id: string
  zone: string
  corridor: CorridorDirection | 'centre'
  window: { start: string; end: string }
  crowd: CrowdLabel
  intensity: number       // 0-1 normalized
  confidence: number      // 0-1
  source: 'venue_sensors' | 'district_cloud'
  venues?: string[]       // Contributing venue IDs
  explanation: string
}

// ── Return Magnet Signal (from Sensor Mode v1.6) ──
// Tracks where arrivals flow TO from major hubs (airports, stations, expo centers)
// Display as notification/radar style - never a command, always a magnet + reason

export type HubType = 'airport' | 'station' | 'business_hub' | 'expo_hub'

export interface ReturnMagnetSignal {
  type: 'return_magnet'
  id: string
  hubId: string               // Source hub (cdg, orly, gare_du_nord, etc.)
  hubName: string             // Human-readable name
  hubType: HubType
  corridor: string            // Flow pattern (e.g., "nord->centre")
  originCorridor: CorridorDirection | 'centre'
  targetCorridor: CorridorDirection | 'centre'
  window: { start: string; end: string }
  crowd: CrowdLabel
  intensity: number           // 0-1 from hub data
  confidence: number          // 0-1
  reason: string              // Why this flow exists
  explanation: string         // Human-readable notification text
  modifiers?: {               // Applied boosts
    weather_rain?: boolean
    transport_disruption?: boolean
    regime_active?: boolean
  }
}

// ── Source Status (PASS 4 - API failure tracking) ──

export type SourceStatusValue = 'ok' | 'failed' | 'partial'

export interface SourceStatus {
  openagenda: SourceStatusValue
  openweather: SourceStatusValue
  prim: SourceStatusValue
}

// ── Tonight Pack ──

export interface TonightPack {
  date: string // YYYY-MM-DD
  compiledAt: string // ISO
  signals: (EventSignal | WeatherSignal | TransportSignal)[]
  exitWaves?: ExitWaveSignal[]  // Sensor mode exit waves
  returnMagnets?: ReturnMagnetSignal[]  // Return corridor patterns from hubs
  ramifications: Ramification[]
  weeklySkeleton: WeeklyWindow[]
  meta: {
    signalCount: number
    overallConfidence: number
    sources: Record<string, number>
    stale: boolean
    lastUpdate: string
    /** API source status for failure tracking (PASS 4) */
    sourceStatus?: SourceStatus
  }
}

// ── Venue Registry ──

export interface Venue {
  id: string
  name: string
  aliases: string[]
  zone: string
  corridor: CorridorDirection
  lat: number
  lon: number
  capacity: number | null
  type: string
}

// ── Confidence Rubric ──

export const CONFIDENCE_RUBRIC = {
  REALTIME_AUTHORITATIVE: 1.0, // e.g., official API
  RELIABLE_STRUCTURED: 0.8, // e.g., OpenAgenda
  SCRAPED: 0.6, // e.g., web scraping
  MANUAL_OPERATOR: 0.4, // e.g., manual-events.json
  INFERRED: 0.2, // e.g., pattern-based
  UNKNOWN: 0.0,
} as const

// ── Exit Window Rules ──

export const EXIT_WINDOW_RULES: Record<string, { before: number; after: number }> = {
  concert: { before: 15, after: 30 },
  theatre: { before: 10, after: 25 },
  exhibition: { before: 10, after: 20 },
  sport: { before: 0, after: 45 },
  nightlife: { before: 0, after: 180 }, // 23:30 → 02:30 typical
  opera: { before: 10, after: 25 },
  festival: { before: 15, after: 45 },
  other: { before: 10, after: 30 },
}
