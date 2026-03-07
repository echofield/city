import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getCityConfig, getDefaultCityId, isSupportedCity } from '@/cities'
import { orchestrate } from '@/lib/shift-conductor/orchestrator'
import { compiledBriefAndMoveToFlowState, TERRITORY_IDS } from '@/lib/flow-engine/flow-state-adapter'
import { compiledFromCitySignalsPackV1 } from '@/lib/flow-engine/compile-from-pack'
import { buildDayTemplates } from '@/lib/flow-engine/day-templates'
import { buildPrimaryAction, buildActiveFrictions, buildAlternatives, buildDriverContext } from '@/lib/flow-engine/primary-action-builder'
import { computeBanlieueHubs } from '@/lib/flow-engine/banlieue-hubs'
import { loadCitySignals } from '@/lib/city-signals/loadCitySignals'
import { loadWeeklySignals } from '@/lib/city-signals/loadWeeklySignals'
import { normalizeCitySignalsPack } from '@/lib/city-signals/normalize-pack'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { flowStateParamsSchema, parseQueryParams } from '@/lib/validation'
import { cache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache'
import { compileLiveTonightPack } from '@/lib/city-signals/compileLive'
import { storageFetchJson, isStorageConfigured } from '@/lib/supabase/storageFetchJson'
import { buildFlowCard } from '@/lib/flow-engine/card-emitter'
import type { TonightPack } from '@/lib/signal-fetchers/types'
import { tonightPackToCitySignalsPack, isTonightPack } from '@/lib/city-signals/tonightPackAdapter'
import type { FlowState, Ramification, DriverPosition } from '@/types/flow-state'
import { buildSignalFeed, buildWeekCalendar } from '@/lib/flow-engine/signal-builder'
import { getStationSignals } from '@/lib/signal-fetchers/sncf'
import { getAirportForcedMobilityWaves } from '@/lib/signal-fetchers/aviationstack'
import { buildWeeklyPulse } from '@/lib/flow-engine/weekly-pulse-builder'
import type { CitySignalsPackV1 } from '@/types/city-signals-pack'
import type { CompiledBrief } from '@/lib/prompts/contracts'
import type { FlowCard } from '@/types/flow-card'

/**
 * FLOW v1.6 Response — card-first architecture
 *
 * card: FlowCard — the compressed living card (OÙ/QUAND/QUOI)
 *       This is what READ mode renders. This is what WhatsApp sends.
 *
 * depth: FlowState — optional detailed state for RADAR mode
 *        Only included when ?depth=1 or ?radar=1
 */
export interface FlowStateResponse {
  card: FlowCard
  depth?: FlowState
  meta: {
    source: string
    stale: boolean
    lastUpdate: string
  }
}

/**
 * Returns honest degraded brief when no data available
 * No fake signals - just empty with low confidence
 */
function createEmptyBrief(): CompiledBrief {
  const now = new Date().toISOString()
  return {
    meta: {
      timezone: 'Europe/Paris',
      generated_at: now,
      run_mode: 'daily',
      profile_variant: 'NIGHT_CHASER',
      confidence_overall: 0.2,
    },
    now_block: {
      window: '0-15min',
      actions: ['Pas de signal fort — attente données'],
      zones: [],
      rule: 'Attente signaux',
      micro_alerts: [],
      confidence: 0.2,
    },
    next_block: {
      slots: [],
      key_transition: 'Données non disponibles',
    },
    horizon_block: {
      hotspots: [],
      rules: [],
      expected_peaks: [],
    },
    summary: ['Signaux en attente de compilation'],
    timeline: [],
    hotspots: [],
    alerts: [],
    rules: [],
    anti_clustering: {
      principle: '',
      dispatch_hint: [],
    },
    validation: {
      unknowns: ['Données tonight pack non disponibles'],
      do_not_assume: [],
    },
  }
}

/**
 * Deterministic empty/degraded FlowState for mock=1 mode
 * WARNING: This is for development testing only, clearly marked
 */
function getMockFlowState(sessionStart?: number): FlowState {
  const now = Date.now()
  const start = sessionStart ?? now - 15 * 60 * 1000
  const elapsed = (now - start) / 1000
  const shiftDur = 25 * 60
  const progress = Math.min(1, Math.max(0, elapsed / shiftDur))
  let shiftPhase: FlowState['shiftPhase'] = 'calme'
  if (progress < 0.2) shiftPhase = 'calme'
  else if (progress < 0.5) shiftPhase = 'montee'
  else if (progress < 0.75) shiftPhase = 'pic'
  else shiftPhase = 'dispersion'

  // All zones dormant - no fake heat patterns
  const zoneHeat: Record<string, number> = {}
  const zoneSaturation: Record<string, number> = {}
  const zoneState: Record<string, FlowState['zoneState'][string]> = {}
  for (const id of TERRITORY_IDS) {
    zoneHeat[id] = 0 // Dormant - no data
    zoneSaturation[id] = 0
    zoneState[id] = 'cold'
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    windowState: 'stable',
    windowLabel: 'MODE TEST — DONNÉES SIMULÉES',
    windowCountdownSec: 0,
    windowCountdown: '00:00',
    windowMinutes: 0,
    shiftPhase,
    shiftProgress: progress,
    action: 'rest',
    actionLabel: 'TEST',
    confidence: 0, // Zero confidence - this is test mode
    fieldMessage: 'Mode test activé — données non réelles',
    temporalMessage: 'Utilisez mock=0 pour données réelles',
    targetZone: '',
    targetZoneArr: '',
    favoredCorridor: 'centre',
    favoredZoneIds: [],
    alternatives: [],
    zoneHeat,
    zoneSaturation,
    zoneState,
    zoneStates: zoneState,
    earningsEstimate: [0, 0],
    earningsIntensity: 'FAIBLE',
    sessionEarnings: 0,
    signals: [
      { text: '⚠️ MODE TEST — données simulées', type: 'event' },
    ],
    upcoming: [],
    peaks: [],
    templates: [],
  }
}

/** Get tonight's date (handles cross-midnight: before 06:00 = yesterday) */
function getTonightDate(timezone: string = 'Europe/Paris'): string {
  const now = new Date()
  const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
  const hour = localTime.getHours()
  if (hour < 6) localTime.setDate(localTime.getDate() - 1)
  return localTime.toISOString().slice(0, 10)
}

/** Get city signals with caching — PRIORITIZES live compilation when no tonight pack in storage */
async function getCachedCitySignals(skipCache = false, forceRecompile = false): Promise<{ pack: CitySignalsPackV1 | null; liveCompiled: boolean; source: string }> {
  const tonightDate = getTonightDate()
  const cacheKey = CACHE_KEYS.citySignals(tonightDate)

  // Check cache first (unless bypassed)
  if (!skipCache && !forceRecompile) {
    const cached = cache.get<CitySignalsPackV1>(cacheKey)
    if (cached) {
      return { pack: cached, liveCompiled: false, source: 'cache' }
    }
  }

  // Force recompile: skip storage check and go straight to live compilation
  if (forceRecompile) {
    console.log('[flow/state] Force recompile requested — compiling live...')
    try {
      const livePack = await compileLiveTonightPack()
      if (livePack) {
        const normalized = normalizeCitySignalsPack(livePack)
        cache.set(cacheKey, normalized, Math.min(CACHE_TTL.citySignals, 300))
        return { pack: normalized, liveCompiled: true, source: 'live-recompiled' }
      }
    } catch (err) {
      console.error('[flow/state] Force recompile failed:', err)
    }
  }

  // 1. Try tonight pack from Supabase Storage directly
  if (isStorageConfigured()) {
    try {
      const storagePath = `tonight/${tonightDate}.paris-idf.json`
      const tonightPack = await storageFetchJson<TonightPack>('flow-packs', storagePath)
      if (tonightPack && isTonightPack(tonightPack)) {
        console.log(`[flow/state] Source: Supabase tonight pack (${tonightDate})`)
        const pack = tonightPackToCitySignalsPack(tonightPack)
        const normalized = normalizeCitySignalsPack(pack)
        cache.set(cacheKey, normalized, CACHE_TTL.citySignals)
        return { pack: normalized, liveCompiled: false, source: 'storage-tonight' }
      }
    } catch (err) {
      console.error('[flow/state] Tonight pack fetch error:', err)
    }
  }

  // 2. No tonight pack → compile signals LIVE (self-healing)
  console.log('[flow/state] No tonight pack in storage — compiling live...')
  try {
    const livePack = await compileLiveTonightPack()
    if (livePack) {
      const normalized = normalizeCitySignalsPack(livePack)
      // Cache for shorter TTL — live compilation, will be replaced by cron
      cache.set(cacheKey, normalized, Math.min(CACHE_TTL.citySignals, 300))
      return { pack: normalized, liveCompiled: true, source: 'live-compiled' }
    }
  } catch (err) {
    console.error('[flow/state] Live compilation failed:', err)
  }

  // 3. Fallback to loadCitySignals (events compilation, daily pack, etc.)
  console.log('[flow/state] Live compilation failed — falling back to loadCitySignals')
  const rawPack = await loadCitySignals()
  if (rawPack) {
    const normalized = normalizeCitySignalsPack(rawPack)
    cache.set(cacheKey, normalized, CACHE_TTL.citySignals)
    return { pack: normalized, liveCompiled: false, source: 'fallback' }
  }

  return { pack: null, liveCompiled: false, source: 'none' }
}

export async function GET(request: Request) {
  // Rate limiting
  const clientIp = getClientIp(request)
  const rateLimit = checkRateLimit(clientIp, RATE_LIMITS.flowApi)

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': String(rateLimit.resetAt),
          'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        },
      }
    )
  }

  // Input validation
  const { searchParams } = new URL(request.url)
  const validation = parseQueryParams(searchParams, flowStateParamsSchema)

  if (!validation.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_PARAMS', message: validation.error } },
      { status: 400 }
    )
  }

  const { lat, lng, sessionStart, zone, mock } = validation.data
  const nocache = searchParams.get('nocache') === '1'
  const recompile = searchParams.get('recompile') === '1'

  // City selection (default: paris)
  const cityParam = searchParams.get('city') ?? getDefaultCityId()
  const cityId = isSupportedCity(cityParam) ? cityParam : getDefaultCityId()
  const cityConfig = getCityConfig(cityId)

  // Build driver position if coordinates provided
  let driverPosition: DriverPosition | undefined
  if (lat !== undefined && lng !== undefined) {
    driverPosition = { lat, lng }
  }

  // Mock mode
  if (mock === '1') {
    const flowState = getMockFlowState(sessionStart)
    return NextResponse.json(flowState, {
      headers: {
        'Cache-Control': 'no-store',
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    })
  }

  // Check if depth (radar mode) is requested
  const includeDepth = searchParams.get('depth') === '1' || searchParams.get('radar') === '1'

  // Load city signals (cached, with live compilation fallback)
  const { pack, liveCompiled, source } = await getCachedCitySignals(nocache, recompile)
  // Use real compiled brief or honest empty state - NEVER mock data
  const brief = pack ? compiledFromCitySignalsPackV1(pack) : createEmptyBrief()

  // Load weekly skeleton
  const weeklySkeleton = await loadWeeklySignals()

  // Extract ramifications from pack
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ramifications: Ramification[] = (pack as any)?.ramifications ?? []

  // ═══════════════════════════════════════════════════════════════════
  // BUILD FLOW CARD — The primary artifact (v1.6 compression-first)
  // ═══════════════════════════════════════════════════════════════════
  const card = buildFlowCard(
    brief,
    ramifications,
    null, // driver profile (TODO: load from session)
    null, // previous card (TODO: load from session state)
    0,    // shift revision count
  )

  // Check pack staleness (>6h since compilation)
  const packCompiledAt = brief.meta.generated_at ? new Date(brief.meta.generated_at) : new Date()
  const hoursSinceCompile = (Date.now() - packCompiledAt.getTime()) / (1000 * 60 * 60)
  const isStale = hoursSinceCompile > 6

  // Update card meta with staleness
  if (isStale) {
    card.meta.stale = true
  }

  // Build response — card is always included, depth is optional
  const response: FlowStateResponse = {
    card,
    meta: {
      source: pack ? source : 'empty-brief',
      stale: isStale,
      lastUpdate: brief.meta.generated_at ?? new Date().toISOString(),
    },
  }

  // Only include depth payload if explicitly requested (for RADAR mode)
  if (includeDepth) {
    const input = {
      brief_id: 'flow-brief',
      now_block: {
        zones: brief.now_block.zones,
        rule: brief.now_block.rule,
        confidence: brief.now_block.confidence,
      },
      driver: {
        id: 'driver',
        profile_variant: brief.meta.profile_variant,
        current_zone: zone ?? brief.now_block.zones?.[0] ?? 'Châtelet',
        shift_started_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      signals: {
        fleet_density: {},
        surge_active: [],
        events_ending_soon: [],
      },
    }

    const { move } = orchestrate(input)
    const flowState = compiledBriefAndMoveToFlowState(brief, move, sessionStart, ramifications, weeklySkeleton, driverPosition)
    flowState.templates = buildDayTemplates(pack)

    // Build structured action recommendations
    const primaryAction = buildPrimaryAction(brief, ramifications, driverPosition)
    if (primaryAction) {
      flowState.primaryAction = primaryAction
      flowState.alternativeActions = buildAlternatives(brief, primaryAction.zone, driverPosition)
      flowState.driverContext = buildDriverContext(driverPosition, primaryAction.zone)
    }
    flowState.activeFrictions = buildActiveFrictions(brief, ramifications)

    // Compute banlieue hub states from pack and ramifications
    flowState.banlieueHubs = computeBanlieueHubs(pack, ramifications)

    // Fetch station signals and airport waves (cached, non-blocking)
    const [stationSignals, airportWaves] = await Promise.all([
      getStationSignals().catch((err) => {
        console.warn('[flow/state] Station signals unavailable:', err)
        return []
      }),
      getAirportForcedMobilityWaves().catch((err) => {
        console.warn('[flow/state] Airport waves unavailable:', err)
        return []
      }),
    ])

    // Build unified signal feed (v2.0 signal model for LIVE screen)
    flowState.signalFeed = buildSignalFeed({
      flowState,
      driverPosition,
      stationSignals,
      airportWaves,
    })

    // Build week calendar (for SEMAINE screen)
    flowState.weekCalendar = buildWeekCalendar(weeklySkeleton, flowState.peaks)

    // Build weekly pulse rhythm (for PULSE display)
    flowState.weeklyPulse = buildWeeklyPulse()

    response.depth = flowState
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'no-store',
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-Flow-Source': pack ? source : 'empty-brief',
      'X-Flow-Stale': isStale ? '1' : '0',
    },
  })
}
