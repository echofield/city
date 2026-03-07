/**
 * GET /api/flow/stations/live
 *
 * Returns real-time station pressure signals from SNCF.
 * Cached for 2 minutes server-side.
 */

import { NextResponse } from 'next/server'
import { getStationSignals, type StationSignal } from '@/lib/signal-fetchers/sncf'

interface StationsLiveResponse {
  stations: StationSignal[]
  count: number
  generatedAt: string
  cached: boolean
  meta: {
    source: 'sncf_realtime'
    ttl: number
  }
}

export async function GET(): Promise<NextResponse<StationsLiveResponse>> {
  try {
    const signals = await getStationSignals()

    const response: StationsLiveResponse = {
      stations: signals,
      count: signals.length,
      generatedAt: new Date().toISOString(),
      cached: false, // Could track this in getStationSignals
      meta: {
        source: 'sncf_realtime',
        ttl: 120,
      },
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
      },
    })
  } catch (err) {
    console.error('[/api/flow/stations/live] Error:', err)

    return NextResponse.json(
      {
        stations: [],
        count: 0,
        generatedAt: new Date().toISOString(),
        cached: false,
        meta: {
          source: 'sncf_realtime',
          ttl: 120,
        },
      },
      { status: 200 } // Return empty array, not error
    )
  }
}
