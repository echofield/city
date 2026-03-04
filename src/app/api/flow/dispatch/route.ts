import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { compiledFromCitySignalsPackV1 } from '@/lib/flow-engine/compile-from-pack'
import { buildDispatchView } from '@/lib/flow-engine/dispatch-builder'
import { loadCitySignals } from '@/lib/city-signals/loadCitySignals'
import { normalizeCitySignalsPack } from '@/lib/city-signals/normalize-pack'
import type { Ramification } from '@/types/flow-state'
import type { CompiledBrief } from '@/lib/prompts/contracts'

/**
 * Returns honest degraded state when no data available (PASS 4)
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  // Session params (optional - for tracking)
  const sessionStartParam = searchParams.get('sessionStart')
  const coursesParam = searchParams.get('courses')
  const earningsParam = searchParams.get('earnings')

  const sessionStart = sessionStartParam ? Number(sessionStartParam) : undefined
  const coursesCount = coursesParam ? Number(coursesParam) : undefined
  const earnings = earningsParam ? Number(earningsParam) : undefined

  // Load city signals - use honest empty state if unavailable (PASS 4)
  const rawPack = await loadCitySignals()
  const pack = rawPack ? normalizeCitySignalsPack(rawPack) : null
  const brief = pack ? compiledFromCitySignalsPackV1(pack) : createEmptyBrief()

  // Extract ramifications from pack
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ramifications: Ramification[] = (rawPack as any)?.ramifications ?? []

  // Build dispatch view
  const dispatch = buildDispatchView(
    brief,
    ramifications,
    sessionStart,
    coursesCount,
    earnings
  )

  return NextResponse.json(dispatch, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
