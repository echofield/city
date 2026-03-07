/**
 * GET /api/flow/briefing — City Briefing AI Layer
 *
 * Returns a tactical French summary of the top 5 active signals.
 * Uses DeepSeek API with caching and graceful fallback.
 *
 * Query params:
 *   - zone: Driver's current zone (optional)
 *   - nocache: Skip cache (debug)
 */

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { generateCityBriefing, getCurrentParisTime, type CityBriefingInput } from '@/lib/flow-engine/city-briefing'
import { tonightPackToFlowViewModel } from '@/lib/flow-engine/flow-view-model-adapter'
import { storageFetchJson, isStorageConfigured } from '@/lib/supabase/storageFetchJson'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { cache } from '@/lib/cache'
import type { TonightPack } from '@/lib/signal-fetchers/types'
import { isTonightPack } from '@/lib/city-signals/tonightPackAdapter'

/** Get tonight's date (handles cross-midnight: before 06:00 = yesterday) */
function getTonightDate(): string {
  const now = new Date()
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const hour = parisTime.getHours()
  if (hour < 6) parisTime.setDate(parisTime.getDate() - 1)
  return parisTime.toISOString().slice(0, 10)
}

/** Get cached tonight pack */
async function getCachedTonightPack(): Promise<TonightPack | null> {
  const tonightDate = getTonightDate()
  const cacheKey = `briefing-pack-${tonightDate}`

  // Check cache first
  const cached = cache.get<TonightPack>(cacheKey)
  if (cached) return cached

  // Try Supabase Storage
  if (isStorageConfigured()) {
    try {
      const storagePath = `tonight/${tonightDate}.paris-idf.json`
      const pack = await storageFetchJson<TonightPack>('flow-packs', storagePath)
      if (pack && isTonightPack(pack)) {
        cache.set(cacheKey, pack, 300) // 5 min cache
        return pack
      }
    } catch (err) {
      console.error('[briefing] Storage fetch failed:', err)
    }
  }

  return null
}

/** Extract top 5 signals from FlowViewModel */
function extractTopSignals(pack: TonightPack): CityBriefingInput['signals'] {
  const viewModel = tonightPackToFlowViewModel(pack, 'storage', undefined, undefined, undefined)

  // Convert peaks to simplified signal format
  const peakSignals = (viewModel.tonight?.peaks || []).map((peak, i) => ({
    id: `peak-${i}`,
    kind: 'live' as const,
    type: 'event_exit' as const,
    title: peak.venue || peak.reason || 'Signal',
    zone: peak.zone || '',
    arrondissement: undefined,
    time_window: {
      start: peak.time || '',
      end: undefined,
      label: peak.time || '',
    },
    reason: peak.reason || '',
    action: '',
    priority_score: 80 - i * 5,
    intensity: (peak.magnitude > 0.7 ? 4 : peak.magnitude > 0.4 ? 3 : 2) as 1 | 2 | 3 | 4,
    confidence: 'high' as const,
    is_active: true,
    is_expiring: false,
    is_forming: false,
    is_compound: false,
    source: 'tonight_pack',
    driver_density: undefined,
  }))

  // Convert upcoming windows to simplified signal format
  const upcomingSignals = (viewModel.next?.upcoming || []).map((window, i) => ({
    id: `upcoming-${i}`,
    kind: 'soon' as const,
    type: 'event_exit' as const,
    title: window.label || 'Signal',
    zone: window.zone || '',
    arrondissement: undefined,
    time_window: {
      start: window.time || '',
      end: undefined,
      label: window.time || '',
    },
    reason: window.label || '',
    action: '',
    priority_score: 60 - i * 5,
    intensity: (window.intensity > 0.7 ? 4 : window.intensity > 0.4 ? 3 : 2) as 1 | 2 | 3 | 4,
    confidence: 'medium' as const,
    is_active: false,
    is_expiring: false,
    is_forming: window.minutesUntil < 30,
    is_compound: false,
    source: 'tonight_pack',
    driver_density: undefined,
  }))

  // Combine and return top 5
  return [...peakSignals, ...upcomingSignals].slice(0, 5)
}

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
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': String(rateLimit.resetAt),
          'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        },
      }
    )
  }

  // Parse query params
  const { searchParams } = new URL(request.url)
  const driverZone = searchParams.get('zone') || undefined
  const nocache = searchParams.get('nocache') === '1'

  // Get tonight pack
  const pack = await getCachedTonightPack()

  if (!pack) {
    return NextResponse.json({
      briefing: {
        lines: ['Donnees non disponibles — reessayer'],
        generatedAt: new Date().toISOString(),
        signalCount: 0,
        cached: false,
      },
      error: 'no_pack',
    }, {
      headers: {
        'Cache-Control': 'no-store',
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    })
  }

  // Extract top signals
  const signals = extractTopSignals(pack)

  // Get shift phase from viewModel
  const viewModel = tonightPackToFlowViewModel(pack, 'storage', undefined, undefined, undefined)
  const shiftPhase = viewModel.shiftArc?.currentPhase || 'calme'

  // Generate briefing
  const briefingInput: CityBriefingInput = {
    signals,
    currentTime: getCurrentParisTime(),
    driverZone,
    shiftPhase,
  }

  const briefing = await generateCityBriefing(briefingInput)

  return NextResponse.json({
    briefing,
    signalCount: signals.length,
    shiftPhase,
    currentTime: getCurrentParisTime(),
  }, {
    headers: {
      'Cache-Control': nocache ? 'no-store' : 'max-age=60',
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-Briefing-Cached': briefing.cached ? '1' : '0',
    },
  })
}
