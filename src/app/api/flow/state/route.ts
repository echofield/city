import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { MOCK_COMPILED_BRIEF } from '@/lib/flow-engine/mock-data'
import { orchestrate } from '@/lib/shift-conductor/orchestrator'
import { compiledBriefAndMoveToFlowState, TERRITORY_IDS } from '@/lib/flow-engine/flow-state-adapter'
import { compiledFromCitySignalsPackV1 } from '@/lib/flow-engine/compile-from-pack'
import { buildDayTemplates } from '@/lib/flow-engine/day-templates'
import { buildPrimaryAction, buildActiveFrictions, buildAlternatives, buildDriverContext } from '@/lib/flow-engine/primary-action-builder'
import { loadCitySignals } from '@/lib/city-signals/loadCitySignals'
import { loadWeeklySignals } from '@/lib/city-signals/loadWeeklySignals'
import { normalizeCitySignalsPack } from '@/lib/city-signals/normalize-pack'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { flowStateParamsSchema, parseQueryParams } from '@/lib/validation'
import { cache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache'
import type { FlowState, Ramification, DriverPosition } from '@/types/flow-state'
import type { CitySignalsPackV1 } from '@/types/city-signals-pack'

/** Deterministic mock FlowState for mock=1 */
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

  const zoneHeat: Record<string, number> = {}
  const zoneSaturation: Record<string, number> = {}
  const zoneState: Record<string, FlowState['zoneState'][string]> = {}
  for (const id of TERRITORY_IDS) {
    const favored = ['11', '12', '3', '1'].includes(id)
    zoneHeat[id] = favored ? 0.5 + Math.sin((id.length + 1) * 0.7) * 0.2 : 0.1
    zoneSaturation[id] = favored ? 45 : 15
    zoneState[id] = favored ? (zoneHeat[id] > 0.6 ? 'hot' : 'warm') : 'cold'
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    windowState: 'active',
    windowLabel: 'FENETRE ACTIVE',
    windowCountdownSec: 420,
    windowCountdown: '07:00',
    windowMinutes: 7,
    shiftPhase,
    shiftProgress: progress,
    action: 'move',
    actionLabel: 'BOUGER',
    confidence: 78,
    fieldMessage: 'Bastille actif.',
    temporalMessage: 'Fenêtre ouverte — 7 min restantes.',
    targetZone: 'Bastille',
    targetZoneArr: 'XI',
    favoredCorridor: 'Est',
    favoredZoneIds: ['11', '12', '3', '1'],
    alternatives: ['République', 'Bercy', 'Marais'],
    zoneHeat,
    zoneSaturation,
    zoneState,
    zoneStates: zoneState,
    earningsEstimate: [32, 48],
    sessionEarnings: 12.5,
    signals: [
      { text: 'Surge +1.3x Gare du Nord', type: 'surge' },
      { text: 'Pluie légère dans 20min', type: 'weather' },
      { text: 'Sortie concert Accor Arena ~23h30', type: 'event' },
    ],
    upcoming: [
      { time: '20:00', zone: 'Bercy', saturation: 65, earnings: 38 },
      { time: '21:00', zone: 'Marais', saturation: 50, earnings: 32 },
    ],
    peaks: [
      { time: '22h45', zone: 'Bercy', reason: 'Concert Phoenix', score: 92 },
      { time: '23h15', zone: 'PSG', reason: 'Match', score: 88 },
    ],
    templates: [
      { id: 'day-matin', title: 'Ville Calme', window: 'morning', description: 'Démarrage progressif.', fuelBand: '~12–20€', movement: 2, stress: 1, potential: 2, suggestedZones: ['Gare du Nord', 'Châtelet'], reasons: [] },
      { id: 'day-midi', title: 'Boucles Courtes', window: 'midday', description: 'Corridors pro.', fuelBand: '~15–25€', movement: 3, stress: 2, potential: 3, suggestedZones: ['Châtelet', 'Marais'], reasons: [] },
      { id: 'day-soir', title: 'Stade/Arena', window: 'evening', description: 'Bercy — pic sortie.', fuelBand: '~20–35€', movement: 4, stress: 3, potential: 4, suggestedZones: ['Bercy', 'Accor Arena'], reasons: ['Concert Phoenix 22h45', 'Match PSG 23h15'] },
      { id: 'day-nuit', title: 'Sorties', window: 'night', description: 'Sorties bars et quartiers.', fuelBand: '~20–35€', movement: 4, stress: 2, potential: 4, suggestedZones: ['Gare du Nord', 'Châtelet'], reasons: [] },
    ],
  }
}

/** Get city signals with caching */
async function getCachedCitySignals(): Promise<CitySignalsPackV1 | null> {
  const today = new Date().toISOString().split('T')[0]
  const cacheKey = CACHE_KEYS.citySignals(today)

  // Check cache first
  const cached = cache.get<CitySignalsPackV1>(cacheKey)
  if (cached) {
    return cached
  }

  // Load from source
  const rawPack = await loadCitySignals()
  if (rawPack) {
    const normalized = normalizeCitySignalsPack(rawPack)
    cache.set(cacheKey, normalized, CACHE_TTL.citySignals)
    return normalized
  }

  return null
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

  // Load city signals (cached)
  const pack = await getCachedCitySignals()
  const brief = pack ? compiledFromCitySignalsPackV1(pack) : MOCK_COMPILED_BRIEF

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

  return NextResponse.json(flowState, {
    headers: {
      'Cache-Control': 'no-store',
      'X-RateLimit-Remaining': String(rateLimit.remaining),
    },
  })
}
