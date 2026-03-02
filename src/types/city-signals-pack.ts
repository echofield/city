/**
 * CitySignalsPack v1 — daily artifact (facts only, no scoring).
 * Produced by the engine run; consumed by compile-from-pack to build CompiledBrief.
 * Optional fields (category, intensity, severity, summary, etc.) are backward compatible.
 */

export type EventCategory =
  | 'concert'
  | 'sport'
  | 'expo'
  | 'festival'
  | 'protest'
  | 'nightlife'
  | 'airport'
  | 'other'

export interface CitySignalsEventV1 {
  name: string
  venue: string
  zoneImpact: string[]
  startTime?: string | null
  endTime?: string | null
  expectedAttendance?: number | null
  type: 'concert' | 'sport' | 'expo' | 'festival' | 'cluster' | 'marathon' | 'other'
  notes?: string
  category?: EventCategory
  intensity?: number // 1..5
}

export interface CitySignalsTransportV1 {
  line: string
  type: 'closure' | 'incident' | 'strike'
  impactZones: string[]
  startTime?: string | null
  endTime?: string | null
  notes?: string
  severity?: number // 1..5
}

export interface CitySignalsWeatherV1 {
  type: 'rain_start' | 'heavy_rain' | 'cold_spike' | 'wind_strong' | 'heat_spike'
  expectedAt?: string | null
  impactLevel: number
  notes?: string
  summary?: string
  precipProb?: number // 0..100
  tempMin?: number
  tempMax?: number
}

export interface CitySignalsSocialV1 {
  type: 'demonstration' | 'rally' | 'strike_action' | 'other'
  title: string
  zoneImpact: string[]
  startTime?: string | null
  endTime?: string | null
  notes?: string
}

export interface CitySignalsPackV1 {
  date: string
  generatedAt: string
  events: CitySignalsEventV1[]
  transport: CitySignalsTransportV1[]
  weather: CitySignalsWeatherV1[]
  social?: CitySignalsSocialV1[]
}
