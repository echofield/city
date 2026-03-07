/**
 * FLIGHT ARRIVALS API
 *
 * GET /api/flow/flights
 *
 * Returns flight arrival data for Paris airports (CDG, ORY).
 * Includes passenger release waves for the Forced Mobility system.
 *
 * Query params:
 *   airport: 'CDG' | 'ORY' | 'all' (default: 'all')
 *   format: 'full' | 'waves' (default: 'waves')
 *
 * Response includes:
 *   - Raw flight arrivals
 *   - Clustered release windows
 *   - Forced Mobility waves for positioning
 *
 * Cached server-side for 30 minutes to minimize API calls.
 */

import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import {
  getAllParisAirportArrivals,
  getAirportArrivals,
  getFlightClusters,
  getAirportForcedMobilityWaves,
  formatReleaseWaveDisplay,
  PARIS_AIRPORTS,
} from '@/lib/signal-fetchers/aviationstack'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
          'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        },
      }
    )
  }

  const { searchParams } = new URL(request.url)
  const airport = searchParams.get('airport') ?? 'all'
  const format = searchParams.get('format') ?? 'waves'

  try {
    // Validate airport param
    if (airport !== 'all' && airport !== 'CDG' && airport !== 'ORY') {
      return NextResponse.json(
        { error: { code: 'INVALID_AIRPORT', message: 'Airport must be CDG, ORY, or all' } },
        { status: 400 }
      )
    }

    // Get data based on format
    if (format === 'waves') {
      // Simplified response: just the forced mobility waves
      const waves = await getAirportForcedMobilityWaves()

      // Filter by airport if specified
      const filteredWaves = airport === 'all'
        ? waves
        : waves.filter(w => w.venue?.includes(airport))

      // Format for UI
      const formatted = filteredWaves.map(wave => ({
        ...formatReleaseWaveDisplay(wave),
        score: wave.final_score,
        confidence: wave.confidence,
        factors: wave.factors,
        corridor: wave.corridor,
        lat: wave.lat,
        lng: wave.lng,
      }))

      return NextResponse.json({
        waves: formatted,
        count: formatted.length,
        airports: airport === 'all' ? ['CDG', 'ORY'] : [airport],
        cached: true,
        generated_at: new Date().toISOString(),
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300', // 5 min edge cache
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        },
      })
    }

    // Full format: include raw data
    if (airport === 'all') {
      const data = await getAllParisAirportArrivals()

      return NextResponse.json({
        airports: PARIS_AIRPORTS.map(a => ({
          iata: a.iata,
          name: a.name,
          corridor: a.corridor,
        })),
        cdg: {
          arrivals: data.cdg.length,
          flights: data.cdg.map(f => ({
            flight: f.flight_number,
            airline: f.airline,
            origin: f.origin_iata,
            terminal: f.terminal,
            scheduled: f.scheduled_arrival.toISOString(),
            estimated: f.estimated_arrival.toISOString(),
            passenger_release: f.passenger_release_time.toISOString(),
            is_international: f.is_international,
            is_long_haul: f.is_long_haul,
          })),
        },
        ory: {
          arrivals: data.ory.length,
          flights: data.ory.map(f => ({
            flight: f.flight_number,
            airline: f.airline,
            origin: f.origin_iata,
            terminal: f.terminal,
            scheduled: f.scheduled_arrival.toISOString(),
            estimated: f.estimated_arrival.toISOString(),
            passenger_release: f.passenger_release_time.toISOString(),
            is_international: f.is_international,
            is_long_haul: f.is_long_haul,
          })),
        },
        clusters: data.clusters.map(c => ({
          airport: c.airport_iata,
          terminal: c.terminal,
          flight_count: c.flights.length,
          passenger_estimate: c.total_passengers_estimate,
          release_window: {
            start: c.passenger_release_start.toISOString(),
            end: c.passenger_release_end.toISOString(),
          },
          is_international_heavy: c.is_international_heavy,
        })),
        waves: data.waves,
        generated_at: new Date().toISOString(),
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        },
      })
    }

    // Single airport full format
    const arrivals = await getAirportArrivals(airport as 'CDG' | 'ORY')
    const clusters = await getFlightClusters(airport as 'CDG' | 'ORY')
    const waves = await getAirportForcedMobilityWaves()
    const airportWaves = waves.filter(w => w.venue?.includes(airport))

    return NextResponse.json({
      airport: PARIS_AIRPORTS.find(a => a.iata === airport),
      arrivals: arrivals.length,
      flights: arrivals.map(f => ({
        flight: f.flight_number,
        airline: f.airline,
        origin: f.origin_iata,
        terminal: f.terminal,
        scheduled: f.scheduled_arrival.toISOString(),
        estimated: f.estimated_arrival.toISOString(),
        passenger_release: f.passenger_release_time.toISOString(),
        is_international: f.is_international,
        is_long_haul: f.is_long_haul,
      })),
      clusters: clusters.map(c => ({
        terminal: c.terminal,
        flight_count: c.flights.length,
        passenger_estimate: c.total_passengers_estimate,
        release_window: {
          start: c.passenger_release_start.toISOString(),
          end: c.passenger_release_end.toISOString(),
        },
        is_international_heavy: c.is_international_heavy,
      })),
      waves: airportWaves,
      generated_at: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300',
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    })

  } catch (err) {
    console.error('[/api/flow/flights] Error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch flight data' } },
      { status: 500 }
    )
  }
}
