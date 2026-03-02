import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { MOCK_COMPILED_BRIEF } from '@/lib/flow-engine/mock-data'
import { orchestrate } from '@/lib/shift-conductor/orchestrator'
import { compiledBriefAndMoveToFlowState, TERRITORY_IDS } from '@/lib/flow-engine/flow-state-adapter'
import { compiledFromCitySignalsPackV1 } from '@/lib/flow-engine/compile-from-pack'
import { buildDayTemplates } from '@/lib/flow-engine/day-templates'
import { loadCitySignals } from '@/lib/city-signals/loadCitySignals'
import { loadWeeklySignals } from '@/lib/city-signals/loadWeeklySignals'
import { normalizeCitySignalsPack } from '@/lib/city-signals/normalize-pack'
import type { FlowState, Ramification } from '@/types/flow-state'

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionStartParam = searchParams.get('sessionStart')
  const zone = searchParams.get('zone') ?? undefined
  const mock = searchParams.get('mock') === '1'

  const sessionStart = sessionStartParam
    ? Number(sessionStartParam)
    : undefined

  if (mock) {
    const flowState = getMockFlowState(
      Number.isNaN(sessionStart as number) ? undefined : (sessionStart as number)
    )
    return NextResponse.json(flowState, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const rawPack = await loadCitySignals()
  const pack = rawPack ? normalizeCitySignalsPack(rawPack) : null
  const brief = pack ? compiledFromCitySignalsPackV1(pack) : MOCK_COMPILED_BRIEF

  // Load weekly skeleton
  const weeklySkeleton = await loadWeeklySignals()

  // Extract ramifications from pack (pass-through strategy)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ramifications: Ramification[] = (rawPack as any)?.ramifications ?? []

  const input = {
    brief_id: 'mock-brief',
    now_block: {
      zones: brief.now_block.zones,
      rule: brief.now_block.rule,
      confidence: brief.now_block.confidence,
    },
    driver: {
      id: 'mock-driver',
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
  const flowState = compiledBriefAndMoveToFlowState(brief, move, sessionStart, ramifications, weeklySkeleton)
  flowState.templates = buildDayTemplates(pack)

  return NextResponse.json(flowState, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
