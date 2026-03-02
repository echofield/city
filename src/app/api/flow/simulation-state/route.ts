/**
 * POST /api/flow/simulation-state
 *
 * Simulate FlowState from provided packs without loading from disk.
 * Used for instant UI testing and pack validation.
 *
 * Request body:
 * {
 *   territory?: string,           // e.g. "paris-idf" (default)
 *   date?: string,                // e.g. "2026-03-02" (for fallback loading)
 *   dailyPack?: CitySignalsPackV1,// if provided, use this instead of loading
 *   weeklyPack?: WeeklySkeleton,  // if provided, use this instead of loading
 *   sessionStart?: number         // optional session start timestamp
 * }
 *
 * Response: FlowState (same shape as GET /api/flow/state)
 */

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { MOCK_COMPILED_BRIEF } from '@/lib/flow-engine/mock-data'
import { orchestrate } from '@/lib/shift-conductor/orchestrator'
import { compiledBriefAndMoveToFlowState } from '@/lib/flow-engine/flow-state-adapter'
import { compiledFromCitySignalsPackV1 } from '@/lib/flow-engine/compile-from-pack'
import { buildDayTemplates } from '@/lib/flow-engine/day-templates'
import { loadCitySignals } from '@/lib/city-signals/loadCitySignals'
import { loadWeeklySignals } from '@/lib/city-signals/loadWeeklySignals'
import { normalizeCitySignalsPack } from '@/lib/city-signals/normalize-pack'
import type { Ramification, WeeklySkeleton } from '@/types/flow-state'
import type { CitySignalsPackV1 } from '@/types/city-signals-pack'

interface SimulationRequest {
  territory?: string
  date?: string
  dailyPack?: CitySignalsPackV1
  weeklyPack?: WeeklySkeleton
  sessionStart?: number
}

export async function POST(request: Request) {
  let body: SimulationRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { date, dailyPack, weeklyPack, sessionStart } = body

  // Resolve daily pack: use provided or load from Storage
  let rawPack: CitySignalsPackV1 | null = null
  if (dailyPack) {
    rawPack = dailyPack
  } else if (date) {
    rawPack = await loadCitySignals(date)
  } else {
    rawPack = await loadCitySignals()
  }

  const pack = rawPack ? normalizeCitySignalsPack(rawPack) : null
  const brief = pack ? compiledFromCitySignalsPackV1(pack) : MOCK_COMPILED_BRIEF

  // Resolve weekly skeleton: use provided or load from Storage
  const weeklySkeleton: WeeklySkeleton | null = weeklyPack ?? await loadWeeklySignals()

  // Extract ramifications from pack (pass-through strategy)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ramifications: Ramification[] = (rawPack as any)?.ramifications ?? []

  const input = {
    brief_id: 'simulation-brief',
    now_block: {
      zones: brief.now_block.zones,
      rule: brief.now_block.rule,
      confidence: brief.now_block.confidence,
    },
    driver: {
      id: 'simulation-driver',
      profile_variant: brief.meta.profile_variant,
      current_zone: brief.now_block.zones?.[0] ?? 'Châtelet',
      shift_started_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    signals: {
      fleet_density: {},
      surge_active: [],
      events_ending_soon: [],
    },
  }

  const { move } = orchestrate(input)
  const flowState = compiledBriefAndMoveToFlowState(
    brief,
    move,
    sessionStart,
    ramifications,
    weeklySkeleton
  )
  flowState.templates = buildDayTemplates(pack)

  return NextResponse.json(flowState, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
