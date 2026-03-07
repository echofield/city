/**
 * USE FLOW API HOOK
 *
 * Fetches FlowState from the backend API and transforms it
 * to match the local FlowEngine interface.
 *
 * This allows gradual migration from local engine to API.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { flowClient, type FlowStateDepth, type FlowCard } from '../services/api/flow-client'
import { CONFIG } from '../config'
import type {
  FlowState,
  FlowSignal,
  DriverOpportunity,
  BanlieueHubState,
  CorridorStatus,
  ShiftPhase,
} from '../app/components/FlowEngine'
import type { TrainWave } from '../app/components/SncfService'
import type { ForcedMobilitySnapshot } from '../app/components/ForcedMobilityEngine'

// ═══════════════════════════════════════════════════════════════════════════
// TRANSFORM FUNCTIONS — API response to local types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Transform API FlowStateDepth to local FlowState
 */
function transformToLocalFlowState(
  depth: FlowStateDepth,
  card: FlowCard,
  sessionStart: number
): FlowState {
  const now = Date.now()
  const elapsed = now - sessionStart
  const shiftDur = 4 * 60 * 60 * 1000 // 4 hours

  // Map shift phase
  let shiftPhase: ShiftPhase = 'calme'
  if (depth.shiftPhase === 'montee') shiftPhase = 'montee'
  else if (depth.shiftPhase === 'pic') shiftPhase = 'pic'
  else if (depth.shiftPhase === 'dispersion') shiftPhase = 'sortie'

  // Build best opportunity from primary action
  let bestNow: DriverOpportunity | null = null
  if (depth.primaryAction) {
    const pa = depth.primaryAction
    bestNow = {
      id: `pa-${pa.zone}`,
      kind: 'confirme',
      action: pa.distance_km < 2 ? 'maintenir' : 'rejoindre',
      placeId: pa.zone.toLowerCase().replace(/\s+/g, '-'),
      placeLabel: pa.zone,
      corridor: pa.arrondissement as 'nord' | 'est' | 'sud' | 'ouest' | undefined,
      window: { start: pa.optimal_window, end: '' },
      timerLabel: `${pa.eta_min} min`,
      timerMinutes: pa.eta_min,
      why: pa.reason,
      distanceMinutes: pa.eta_min,
      distanceKm: pa.distance_km,
      confidence: pa.opportunity_score / 100,
      evidence: [{ source: 'event', ref: 'api' }],
      freshness: { compiledAt: card.meta.compiledAt, stale: card.meta.stale },
      entryPoint: pa.entry_side,
    }
  }

  // Build alternatives
  const alternatives: DriverOpportunity[] = (depth.alternativeActions ?? []).map((alt, i) => ({
    id: `alt-${i}`,
    kind: 'piste' as const,
    action: 'tenter' as const,
    placeId: alt.zone.toLowerCase().replace(/\s+/g, '-'),
    placeLabel: alt.zone,
    window: { start: '', end: '' },
    timerLabel: `${alt.eta_min} min`,
    timerMinutes: alt.eta_min,
    why: alt.condition,
    distanceMinutes: alt.eta_min,
    distanceKm: alt.distance_km,
    confidence: 0.5,
    evidence: [],
    freshness: { compiledAt: card.meta.compiledAt, stale: card.meta.stale },
  }))

  // Build upcoming from peaks
  const upcoming: DriverOpportunity[] = (depth.peaks ?? []).slice(0, 3).map((peak, i) => ({
    id: `upcoming-${i}`,
    kind: 'piste' as const,
    action: 'anticiper' as const,
    placeId: peak.zone.toLowerCase().replace(/\s+/g, '-'),
    placeLabel: peak.zone,
    window: { start: peak.time, end: '' },
    timerLabel: peak.time,
    timerMinutes: 30,
    why: peak.reason,
    distanceMinutes: peak.eta_min,
    distanceKm: peak.distance_km,
    confidence: peak.score / 100,
    evidence: [],
    freshness: { compiledAt: card.meta.compiledAt, stale: card.meta.stale },
  }))

  // Map corridors
  const corridors: CorridorStatus[] = [
    { direction: 'nord', status: 'fluide' },
    { direction: 'est', status: 'fluide' },
    { direction: 'sud', status: 'fluide' },
    { direction: 'ouest', status: 'fluide' },
  ]

  // Map zone states
  const zoneStates: Record<string, 'dormant' | 'forming' | 'active' | 'peak' | 'fading'> = {}
  for (const [zoneId, state] of Object.entries(depth.zoneStates ?? {})) {
    if (state === 'hot') zoneStates[zoneId] = 'peak'
    else if (state === 'warm') zoneStates[zoneId] = 'active'
    else zoneStates[zoneId] = 'dormant'
  }

  // Build forced mobility snapshot
  let forcedMobility: ForcedMobilitySnapshot | undefined
  if (depth.weeklyPulse && depth.weeklyPulse.active_waves.length > 0) {
    forcedMobility = {
      waves: depth.weeklyPulse.active_waves.map((w, i) => ({
        id: `wave-${i}`,
        category: w.category as 'station_release' | 'airport_release' | 'event_exit' | 'nightlife_closure' | 'compound',
        subtype: w.name,
        zone: w.core_zones[0] ?? '',
        corridor: 'centre' as const,
        wave_start: new Date().toISOString(),
        wave_end: new Date(Date.now() + w.minutes_remaining * 60000).toISOString(),
        people_released_score: w.strength,
        transport_weakness_score: 50,
        time_pressure_score: 50,
        ride_quality_score: 50,
        final_score: w.strength,
        likely_ride_profile: w.ride_profile as 'short_fast' | 'mixed' | 'long' | 'premium_long',
        positioning_hint: w.core_zones.join(', '),
        confidence: 'medium' as const,
        factors: [],
      })),
      bestWave: null,
      activeCount: depth.weeklyPulse.active_waves.length,
      hasCompound: depth.weeklyPulse.active_waves.some(w => w.category === 'compound'),
      computedAt: new Date().toISOString(),
    }
  }

  return {
    meta: {
      compiledAt: card.meta.compiledAt,
      stale: card.meta.stale,
      overallConfidence: depth.confidence,
      source: card.meta.source as 'live' | 'skeleton' | 'degraded',
    },
    opportunities: {
      bestNow,
      alternatives,
      upcoming,
      tonightPeaks: [],
    },
    map: {
      zoneHeat: depth.zoneHeat ?? {},
      zoneStates,
      magnets: Object.keys(depth.banlieueHubs ?? {}).filter(
        id => depth.banlieueHubs?.[id]?.status === 'active'
      ),
    },
    copy: {
      phaseLabel: card.quoi.headline,
      timerLabel: card.quand.countdown,
    },
    shiftPhase,
    shiftProgress: Math.min(1, elapsed / shiftDur),
    sessionEarnings: depth.sessionEarnings ?? 0,
    corridors,
    forcedMobility,
  }
}

/**
 * Transform API signals to local FlowSignal format
 */
function transformToLocalSignals(depth: FlowStateDepth): FlowSignal[] {
  if (!depth.signalFeed?.signals) return []

  return (depth.signalFeed.signals as Array<{
    id: string
    kind: string
    type: string
    title: string
    zone: string
    time_window?: { start: string; end: string; label?: string }
    reason: string
    action: string
    priority_score: number
    intensity: number
    confidence: string
    is_active: boolean
    lat?: number
    lng?: number
  }>).map(signal => ({
    id: signal.id,
    kind: signal.kind as 'live' | 'nearby' | 'soon' | 'week',
    type: signal.type,
    title: signal.title,
    zone: signal.zone,
    corridor: 'centre' as const,
    when: signal.time_window?.label ?? '',
    why: signal.reason,
    action: signal.action,
    score: signal.priority_score,
    intensity: signal.intensity as 1 | 2 | 3 | 4,
    confidence: signal.confidence as 'low' | 'medium' | 'high',
    isLive: signal.is_active,
    lat: signal.lat,
    lng: signal.lng,
  }))
}

/**
 * Transform banlieue hubs from API
 */
function transformBanlieueHubs(
  hubs: FlowStateDepth['banlieueHubs']
): Record<string, BanlieueHubState> {
  if (!hubs) return {}

  const result: Record<string, BanlieueHubState> = {}
  for (const [id, hub] of Object.entries(hubs)) {
    result[id] = {
      id: hub.id,
      heat: hub.heat,
      status: hub.status as 'dormant' | 'forming' | 'active',
      nextPic: hub.nextPic,
      corridor: hub.corridor as 'nord' | 'est' | 'sud' | 'ouest',
    }
  }
  return result
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

export interface UseFlowApiOptions {
  /** Session start timestamp */
  sessionStart: number
  /** Driver position */
  position?: { lat: number; lng: number }
  /** Refresh interval in ms */
  refreshInterval?: number
  /** Skip fetching (use local engine instead) */
  skip?: boolean
}

export interface UseFlowApiResult {
  /** FlowState in local format */
  flow: FlowState | null
  /** Signals in local format */
  signals: FlowSignal[]
  /** Banlieue hubs */
  banlieueHubs: Record<string, BanlieueHubState>
  /** Train waves (from API) */
  trainWaves: TrainWave[]
  /** Loading state */
  loading: boolean
  /** Error message */
  error: string | null
  /** Manual refresh */
  refresh: () => Promise<void>
  /** Last update timestamp */
  lastUpdated: Date | null
  /** Data source */
  source: string
}

export function useFlowApi(options: UseFlowApiOptions): UseFlowApiResult {
  const [flow, setFlow] = useState<FlowState | null>(null)
  const [signals, setSignals] = useState<FlowSignal[]>([])
  const [banlieueHubs, setBanlieueHubs] = useState<Record<string, BanlieueHubState>>({})
  const [trainWaves] = useState<TrainWave[]>([]) // TODO: fetch from API
  const [loading, setLoading] = useState(!options.skip)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [source, setSource] = useState<string>('none')

  const sessionStartRef = useRef(options.sessionStart)

  const fetchData = useCallback(async () => {
    if (options.skip) return

    try {
      setLoading(true)
      setError(null)

      const response = await flowClient.getFlowState({
        lat: options.position?.lat,
        lng: options.position?.lng,
        depth: true, // Always request depth for full data
      })

      if (response.depth) {
        const localFlow = transformToLocalFlowState(
          response.depth,
          response.card,
          sessionStartRef.current
        )
        setFlow(localFlow)
        setSignals(transformToLocalSignals(response.depth))
        setBanlieueHubs(transformBanlieueHubs(response.depth.banlieueHubs))
      }

      setSource(response.meta.source)
      setLastUpdated(new Date())

      if (CONFIG.DEBUG) {
        console.log('[useFlowApi] Fetched:', response.meta.source)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'API error'
      setError(message)
      console.error('[useFlowApi] Error:', err)
    } finally {
      setLoading(false)
    }
  }, [options.position?.lat, options.position?.lng, options.skip])

  // Initial fetch
  useEffect(() => {
    if (!options.skip) {
      fetchData()
    }
  }, [fetchData, options.skip])

  // Auto-refresh
  useEffect(() => {
    if (options.skip) return

    const interval = options.refreshInterval ?? CONFIG.REFRESH_INTERVAL
    const timer = setInterval(fetchData, interval)

    return () => clearInterval(timer)
  }, [fetchData, options.refreshInterval, options.skip])

  return {
    flow,
    signals,
    banlieueHubs,
    trainWaves,
    loading,
    error,
    refresh: fetchData,
    lastUpdated,
    source,
  }
}
