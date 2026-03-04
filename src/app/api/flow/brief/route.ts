import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { compiledFromCitySignalsPackV1 } from '@/lib/flow-engine/compile-from-pack'
import { loadCitySignals } from '@/lib/city-signals/loadCitySignals'
import type { CompiledBrief } from '@/lib/prompts/contracts'

/**
 * Returns honest degraded state when no data available
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
      confidence_overall: 0.2, // Very low - no real data
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

export async function GET() {
  const pack = await loadCitySignals()
  // Return real compiled brief or honest empty state - NEVER mock data
  const brief = pack ? compiledFromCitySignalsPackV1(pack) : createEmptyBrief()
  return NextResponse.json(brief, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
