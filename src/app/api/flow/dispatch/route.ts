import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { MOCK_COMPILED_BRIEF } from '@/lib/flow-engine/mock-data'
import { compiledFromCitySignalsPackV1 } from '@/lib/flow-engine/compile-from-pack'
import { buildDispatchView } from '@/lib/flow-engine/dispatch-builder'
import { loadCitySignals } from '@/lib/city-signals/loadCitySignals'
import { normalizeCitySignalsPack } from '@/lib/city-signals/normalize-pack'
import type { Ramification } from '@/types/flow-state'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  // Session params (optional - for tracking)
  const sessionStartParam = searchParams.get('sessionStart')
  const coursesParam = searchParams.get('courses')
  const earningsParam = searchParams.get('earnings')

  const sessionStart = sessionStartParam ? Number(sessionStartParam) : undefined
  const coursesCount = coursesParam ? Number(coursesParam) : undefined
  const earnings = earningsParam ? Number(earningsParam) : undefined

  // Load city signals
  const rawPack = await loadCitySignals()
  const pack = rawPack ? normalizeCitySignalsPack(rawPack) : null
  const brief = pack ? compiledFromCitySignalsPackV1(pack) : MOCK_COMPILED_BRIEF

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
