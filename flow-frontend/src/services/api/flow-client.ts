/**
 * FLOW API CLIENT
 *
 * Fetches data from the Flow backend API.
 * Provides typed access to FlowState, signals, and other endpoints.
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES — API Response shapes
// ═══════════════════════════════════════════════════════════════════════════

export interface FlowCard {
  ou: {
    zone: string
    arrondissement: string
    corridor: string
    entry: string
    saturation: number
  }
  quand: {
    window: string
    countdown: string
    countdownSec: number
    minutes: number
  }
  quoi: {
    headline: string
    action: string
    intensity: 'FORT' | 'MODERE' | 'FAIBLE'
    confidence: number
    alerts: string[]
  }
  meta: {
    compiledAt: string
    stale: boolean
    source: string
  }
}

export interface FlowStateDepth {
  windowState: string
  windowLabel: string
  windowCountdown: string
  windowMinutes: number
  shiftPhase: string
  shiftProgress: number
  action: string
  actionLabel: string
  confidence: number
  fieldMessage: string
  temporalMessage: string
  targetZone: string
  targetZoneArr: string
  favoredCorridor: string
  favoredZoneIds: string[]
  alternatives: string[]
  zoneHeat: Record<string, number>
  zoneSaturation: Record<string, number>
  zoneState: Record<string, string>
  zoneStates: Record<string, string>
  earningsEstimate: [number, number]
  earningsIntensity: 'FORT' | 'MODERE' | 'FAIBLE'
  sessionEarnings: number
  signals: Array<{ text: string; type: string }>
  upcoming: Array<{
    time: string
    zone: string
    saturation: number
    earnings: number
    distance_km?: number
    eta_min?: number
  }>
  peaks: Array<{
    time: string
    zone: string
    reason: string
    score: number
    distance_km?: number
    eta_min?: number
  }>
  templates?: unknown[]
  ramifications?: unknown[]
  weeklySkeleton?: unknown
  primaryAction?: {
    zone: string
    arrondissement: string
    distance_km: number
    eta_min: number
    entry_side: string
    optimal_window: string
    opportunity_score: number
    friction_risk: number
    reason: string
    reposition_cost: number
    saturation_risk_delta: number
  }
  activeFrictions?: Array<{
    type: string
    label: string
    implication: string
    corridor?: string
  }>
  alternativeActions?: Array<{
    zone: string
    distance_km: number
    eta_min: number
    condition: string
  }>
  driverContext?: {
    corridor: string
    same_corridor: boolean
    corridor_hint?: string
  }
  banlieueHubs?: Record<string, {
    id: string
    heat: number
    status: string
    nextPic?: string
    corridor: string
  }>
  signalFeed?: {
    signals: unknown[]
    generated_at: string
    total_count: number
    live_count: number
    nearby_count: number
    alert_count: number
  }
  weekCalendar?: unknown
  weeklyPulse?: {
    day: string
    active_waves: Array<{
      category: string
      name: string
      strength: number
      minutes_remaining: number
      core_zones: string[]
      ride_profile: string
    }>
    upcoming_waves: Array<{
      category: string
      name: string
      strength: number
      minutes_until_start: number
      typical_start: string
      core_zones: string[]
    }>
    best_window: string
    peak_strength: number
    strategic_notes: string[]
  }
}

export interface FlowStateResponse {
  card: FlowCard
  depth?: FlowStateDepth
  meta: {
    source: string
    stale: boolean
    lastUpdate: string
  }
}

export interface StationSignal {
  station_id: string
  station_name: string
  corridor: string
  arrivals: Array<{
    train_number: string
    arrival_time: string
    passengers_estimate: number
    has_delay: boolean
  }>
  wave_start: string
  wave_end: string
  total_passengers: number
}

export interface FlightWave {
  id: string
  airport_iata: string
  airport_name: string
  terminal: string | null
  corridor: string
  wave_start: string
  wave_end: string
  total_passengers_estimate: number
  final_score: number
  likely_ride_profile: string
  positioning_hint: string
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export interface FlowClientConfig {
  /** Base URL for the API (e.g., https://flow-api.example.com or empty for same origin) */
  baseUrl: string
  /** City ID (default: paris) */
  cityId: string
}

// ═══════════════════════════════════════════════════════════════════════════
// FLOW CLIENT
// ═══════════════════════════════════════════════════════════════════════════

export class FlowClient {
  private config: FlowClientConfig

  constructor(config: Partial<FlowClientConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? '',
      cityId: config.cityId ?? 'paris',
    }
  }

  /**
   * Fetch FlowState from the API
   */
  async getFlowState(params?: {
    lat?: number
    lng?: number
    depth?: boolean
    nocache?: boolean
  }): Promise<FlowStateResponse> {
    const url = new URL(`${this.config.baseUrl}/api/flow/state`, window.location.origin)
    url.searchParams.set('city', this.config.cityId)

    if (params?.lat !== undefined) url.searchParams.set('lat', String(params.lat))
    if (params?.lng !== undefined) url.searchParams.set('lng', String(params.lng))
    if (params?.depth) url.searchParams.set('depth', '1')
    if (params?.nocache) url.searchParams.set('nocache', '1')

    const response = await fetch(url.toString())

    if (!response.ok) {
      throw new Error(`Flow API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Fetch station signals (SNCF train arrivals)
   */
  async getStationSignals(): Promise<StationSignal[]> {
    const url = new URL(`${this.config.baseUrl}/api/flow/stations/live`, window.location.origin)

    const response = await fetch(url.toString())

    if (!response.ok) {
      console.warn('[FlowClient] Station signals unavailable')
      return []
    }

    const data = await response.json()
    return data.signals ?? []
  }

  /**
   * Fetch flight waves (airport arrivals)
   */
  async getFlightWaves(airport?: 'CDG' | 'ORY' | 'all'): Promise<FlightWave[]> {
    const url = new URL(`${this.config.baseUrl}/api/flow/flights`, window.location.origin)
    if (airport) url.searchParams.set('airport', airport)
    url.searchParams.set('format', 'waves')

    const response = await fetch(url.toString())

    if (!response.ok) {
      console.warn('[FlowClient] Flight waves unavailable')
      return []
    }

    const data = await response.json()
    return data.waves ?? []
  }

  /**
   * Fetch banlieue hub states
   */
  async getBanlieueHubs(): Promise<Record<string, unknown>> {
    const url = new URL(`${this.config.baseUrl}/api/flow/hubs`, window.location.origin)

    const response = await fetch(url.toString())

    if (!response.ok) {
      console.warn('[FlowClient] Banlieue hubs unavailable')
      return {}
    }

    const data = await response.json()
    return data.hubs ?? {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default Flow client for Paris
 */
export const flowClient = new FlowClient({
  baseUrl: import.meta.env.VITE_API_URL ?? '',
  cityId: 'paris',
})

// ═══════════════════════════════════════════════════════════════════════════
// REACT HOOK (optional)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'

export interface UseFlowStateOptions {
  /** Include depth payload (for RADAR mode) */
  depth?: boolean
  /** Driver coordinates for proximity calculations */
  position?: { lat: number; lng: number }
  /** Refresh interval in ms (default: 60000 = 1 min) */
  refreshInterval?: number
  /** Skip initial fetch */
  skip?: boolean
}

export interface UseFlowStateResult {
  card: FlowCard | null
  depth: FlowStateDepth | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  lastUpdated: Date | null
}

/**
 * React hook for FlowState
 */
export function useFlowState(options: UseFlowStateOptions = {}): UseFlowStateResult {
  const [card, setCard] = useState<FlowCard | null>(null)
  const [depth, setDepth] = useState<FlowStateDepth | null>(null)
  const [loading, setLoading] = useState(!options.skip)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchFlowState = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await flowClient.getFlowState({
        lat: options.position?.lat,
        lng: options.position?.lng,
        depth: options.depth,
      })

      setCard(response.card)
      setDepth(response.depth ?? null)
      setLastUpdated(new Date())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('[useFlowState] Error:', err)
    } finally {
      setLoading(false)
    }
  }, [options.depth, options.position?.lat, options.position?.lng])

  // Initial fetch
  useEffect(() => {
    if (!options.skip) {
      fetchFlowState()
    }
  }, [fetchFlowState, options.skip])

  // Auto-refresh
  useEffect(() => {
    if (options.skip) return

    const interval = options.refreshInterval ?? 60000
    const timer = setInterval(fetchFlowState, interval)

    return () => clearInterval(timer)
  }, [fetchFlowState, options.refreshInterval, options.skip])

  return {
    card,
    depth,
    loading,
    error,
    refresh: fetchFlowState,
    lastUpdated,
  }
}
