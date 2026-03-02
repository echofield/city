import { NextResponse } from 'next/server'
import { MOCK_COMPILED_BRIEF } from '@/lib/flow-engine/mock-data'
import { compiledFromCitySignalsPackV1 } from '@/lib/flow-engine/compile-from-pack'
import { loadCitySignals } from '@/lib/city-signals/loadCitySignals'

export async function GET() {
  const pack = loadCitySignals()
  const brief = pack ? compiledFromCitySignalsPackV1(pack) : MOCK_COMPILED_BRIEF
  return NextResponse.json(brief, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
