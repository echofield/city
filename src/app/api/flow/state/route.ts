import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
import type { FlowState, Ramification, DriverPosition } from '@/types/flow-state'
import type { CitySignalsPackV1 } from '@/types/city-signals-pack'
import type { CompiledBrief } from '@/lib/prompts/contracts'

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

/** Get city signals with caching — falls back to live compilation if no pack stored */
async function getCachedCitySignals(): Promise<{ pack: CitySignalsPackV1 | null; liveCompiled: boolean }> {
  const today = new Date().toISOString().split('T')[0]
  const cacheKey = CACHE_KEYS.citySignals(today)

  // Check cache first
  const cached = cache.get<CitySignalsPackV1>(cacheKey)
  if (cached) {
    return { pack: cached, liveCompiled: false }
  }

  // Load from Supabase storage
  const rawPack = await loadCitySignals()
  if (rawPack) {
    const normalized = normalizeCitySignalsPack(rawPack)
    cache.set(cacheKey, normalized, CACHE_TTL.citySignals)
    return { pack: normalized, liveCompiled: false }
  }

  // No pack in storage → compile signals live (self-healing)
  console.log('[flow/state] No pack in storage — compiling live tonight pack...')
  try {
    const livePack = await compileLiveTonightPack()
    if (livePack) {
      const normalized = normalizeCitySignalsPack(livePack)
      // Cache for shorter TTL — this is a live compilation, will be replaced by cron
      cache.set(cacheKey, normalized, Math.min(CACHE_TTL.citySignals, 300))
      return { pack: normalized, liveCompiled: true }
    }
  } catch (err) {
    console.error('[flow/state] Live compilation failed:', err)
  }

  return { pack: null, liveCompiled: false }
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

  // Load city signals (cached, with live compilation fallback)
  const { pack, liveCompiled } = await getCachedCitySignals()
  // Use real compiled brief or honest empty state - NEVER mock data
  const brief = pack ? compiledFromCitySignalsPackV1(pack) : createEmptyBrief()

  // Load weekly skeleton
  const weeklySkeleton = await loadWeeklySignals()

  // Extract ramifications from pack
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ramifications: Ramification[] = (pack as any)?.ramifications ?? []

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

  return NextResponse.json(flowState, {
    headers: {
      'Cache-Control': 'no-store',
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-Flow-Source': pack ? (liveCompiled ? 'live-compiled' : 'storage-pack') : 'empty-brief',
    },
  })
}
