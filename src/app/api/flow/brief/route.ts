import { NextResponse } from 'next/server'
import { MOCK_COMPILED_BRIEF } from '@/lib/flow-engine/mock-data'
import { compiledFromCitySignalsPackV1 } from '@/lib/flow-engine/compile-from-pack'
import { loadCitySignals } from '@/lib/city-signals/loadCitySignals'
import { normalizeCitySignalsPack } from '@/lib/city-signals/normalize-pack'

export async function GET() {
  const rawPack = loadCitySignals()
  const pack = rawPack ? normalizeCitySignalsPack(rawPack) : null
  const brief = pack ? compiledFromCitySignalsPackV1(pack) : MOCK_COMPILED_BRIEF
  return NextResponse.json(brief, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
