/**
 * POST /api/flow/simulation-state
 * Same pipeline as LIVE, but input is a synthetic daily pack (no DB).
 * Used for simulation mode: pack → normalize → compile → orchestrate → FlowState.
 */

import { NextResponse } from 'next/server'
import { compiledFromCitySignalsPackV1 } from '@/lib/flow-engine/compile-from-pack'
import { orchestrate } from '@/lib/shift-conductor/orchestrator'
import { compiledBriefAndMoveToFlowState } from '@/lib/flow-engine/flow-state-adapter'
import { buildDayTemplates } from '@/lib/flow-engine/day-templates'
import { normalizeCitySignalsPack } from '@/lib/city-signals/normalize-pack'
import type { FlowState } from '@/types/flow-state'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rawPack = body?.pack ?? null
    const sessionStart = typeof body?.sessionStart === 'number' ? body.sessionStart : undefined

    if (!rawPack || typeof rawPack !== 'object') {
      return NextResponse.json(
        { error: 'Missing or invalid pack' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const pack = normalizeCitySignalsPack(rawPack)
    const brief = compiledFromCitySignalsPackV1(pack)
    const input = {
      brief_id: 'simulation',
      now_block: brief.now_block,
      driver: {
        id: 'sim-user',
        profile_variant: brief.meta.profile_variant,
        current_zone: brief.now_block.zones?.[0] ?? 'Châtelet',
        shift_started_at: new Date((sessionStart ?? Date.now() - 15 * 60 * 1000)).toISOString(),
      },
      signals: {
        fleet_density: {},
        surge_active: [],
        events_ending_soon: [],
      },
    }
    const { move } = orchestrate(input)
    const flowState = compiledBriefAndMoveToFlowState(brief, move, sessionStart) as FlowState
    flowState.templates = buildDayTemplates(pack)

    return NextResponse.json(flowState, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    console.error('Simulation state error:', e)
    return NextResponse.json(
      { error: 'Simulation failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
