/**
 * GET /api/flow/viewmodel — FlowViewModel v1.6
 *
 * Returns clean FlowViewModel with full sourceRefs traceability.
 * Every UI element links back to real signals.
 *
 * Query params:
 *   - lat, lng: Driver position (optional)
 *   - nocache: Skip cache (debug)
 *   - recompile: Force live recompilation (debug)
 *   - debug: Include full trace data
 */

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { tonightPackToFlowViewModel } from '@/lib/flow-engine/flow-view-model-adapter'
import { compileLiveTonightPack } from '@/lib/city-signals/compileLive'
import { storageFetchJson, isStorageConfigured } from '@/lib/supabase/storageFetchJson'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { cache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache'
import type { TonightPack } from '@/lib/signal-fetchers/types'
import { isTonightPack } from '@/lib/city-signals/tonightPackAdapter'
import type { FlowViewModel, DebugTrace } from '@/types/flow-view-model'

/** Get tonight's date (handles cross-midnight: before 06:00 = yesterday) */
function getTonightDate(): string {
  const now = new Date()
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const hour = parisTime.getHours()
  if (hour < 6) parisTime.setDate(parisTime.getDate() - 1)
  return parisTime.toISOString().slice(0, 10)
}

/** Get cached tonight pack with live compilation fallback */
async function getCachedTonightPack(
  skipCache = false,
  forceRecompile = false
): Promise<{ pack: TonightPack | null; source: string }> {
  const tonightDate = getTonightDate()
  const cacheKey = `viewmodel-pack-${tonightDate}`

  // Check cache first
  if (!skipCache && !forceRecompile) {
    const cached = cache.get<TonightPack>(cacheKey)
    if (cached) {
      return { pack: cached, source: 'cache' }
    }
  }

  // Force recompile: skip storage
  if (forceRecompile) {
    console.log('[viewmodel] Force recompile requested')
    try {
      const livePack = await compileLiveTonightPack()
      if (livePack) {
        // We need the raw TonightPack, but compileLiveTonightPack returns CitySignalsPackV1
        // For now, try to fetch from storage after compilation
        const storagePath = `tonight/${tonightDate}.paris-idf.json`
        const stored = await storageFetchJson<TonightPack>('flow-packs', storagePath)
        if (stored && isTonightPack(stored)) {
          cache.set(cacheKey, stored, 300)
          return { pack: stored, source: 'live-recompiled' }
        }
      }
    } catch (err) {
      console.error('[viewmodel] Force recompile failed:', err)
    }
  }

  // Try Supabase Storage
  if (isStorageConfigured()) {
    try {
      const storagePath = `tonight/${tonightDate}.paris-idf.json`
      const pack = await storageFetchJson<TonightPack>('flow-packs', storagePath)
      if (pack && isTonightPack(pack)) {
        cache.set(cacheKey, pack, CACHE_TTL.citySignals)
        return { pack, source: 'storage-tonight' }
      }
    } catch (err) {
      console.error('[viewmodel] Storage fetch failed:', err)
    }
  }

  // Live compilation fallback
  console.log('[viewmodel] No pack in storage — compiling live...')
  try {
    // compileLiveTonightPack also writes to storage
    await compileLiveTonightPack()
    // Fetch the freshly written pack
    const storagePath = `tonight/${tonightDate}.paris-idf.json`
    const pack = await storageFetchJson<TonightPack>('flow-packs', storagePath)
    if (pack && isTonightPack(pack)) {
      cache.set(cacheKey, pack, 300)
      return { pack, source: 'live-compiled' }
    }
  } catch (err) {
    console.error('[viewmodel] Live compilation failed:', err)
  }

  return { pack: null, source: 'none' }
}

/** Build debug trace from pack */
function buildDebugTrace(pack: TonightPack): DebugTrace {
  const now = new Date()
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const dayOfWeek = parisTime.getDay()
  const currentTimeStr = parisTime.toTimeString().slice(0, 5)

  return {
    signals: pack.signals.map(s => ({
      id: s.type === 'event' ? s.id : `${s.type}-${s.compiledAt}`,
      type: s.type,
      label: s.type === 'event' ? s.title : s.type === 'weather' ? s.condition : s.line,
      confidence: s.confidence,
      raw: s,
    })),
    ramifications: pack.ramifications.map(r => ({
      id: r.id,
      regime: r.regime,
      explanation: r.explanation,
      confidence: r.confidence,
      zones: [...r.pressureZones, ...r.effectZones],
    })),
    skeletonWindows: pack.weeklySkeleton
      .filter(s => {
        const days = Array.isArray(s.dayOfWeek) ? s.dayOfWeek : [s.dayOfWeek]
        if (!days.includes(dayOfWeek)) return false
        return currentTimeStr >= s.window.start && currentTimeStr <= s.window.end
      })
      .map(s => ({
        id: s.id,
        name: s.name,
        window: `${s.window.start}-${s.window.end}`,
        zones: s.zones,
      })),
    compiledAt: pack.compiledAt,
  }
}

/** Create empty FlowViewModel when no data available */
function createEmptyViewModel(): FlowViewModel {
  return {
    version: 2,
    meta: {
      compiledAt: new Date().toISOString(),
      overallConfidence: 0,
      stale: true,
      timezone: 'Europe/Paris',
      source: 'empty',
      signalCounts: { events: 0, weather: 0, transport: 0, ramifications: 0, skeleton: 0 },
    },
    action: {
      mode: 'rest',
      zone: '',
      arrondissement: '',
      corridor: 'centre',
      confidence: 0,
      why: 'Aucun signal disponible',
      sourceRefs: [],
      timer: null,
      entrySide: null,
      opportunityScore: 0,
      frictionRisk: 0,
    },
    map: {
      zoneHeat: {},
      zoneState: {},
      zoneWhy: {},
      banlieueMagnets: [],
    },
    next: { upcoming: [] },
    tonight: { peaks: [], activeSkeletonWindows: [] },
    activeFrictions: [],
    alternatives: [],
    generatedAt: new Date().toISOString(),
  }
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
  const latStr = searchParams.get('lat')
  const lngStr = searchParams.get('lng')
  const nocache = searchParams.get('nocache') === '1'
  const recompile = searchParams.get('recompile') === '1'
  const debug = searchParams.get('debug') === '1'

  // Build driver position if provided
  let driverPosition: { lat: number; lng: number } | undefined
  if (latStr && lngStr) {
    const lat = parseFloat(latStr)
    const lng = parseFloat(lngStr)
    if (!isNaN(lat) && !isNaN(lng)) {
      driverPosition = { lat, lng }
    }
  }

  // Get tonight pack
  const { pack, source } = await getCachedTonightPack(nocache, recompile)

  // Build FlowViewModel
  let viewModel: FlowViewModel
  if (pack) {
    viewModel = tonightPackToFlowViewModel(pack, source, driverPosition)
  } else {
    viewModel = createEmptyViewModel()
  }

  // Optionally include debug trace
  let response: FlowViewModel & { _debug?: DebugTrace } = viewModel
  if (debug && pack) {
    response = { ...viewModel, _debug: buildDebugTrace(pack) }
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'no-store',
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-Flow-Source': source,
      'X-Flow-Version': '2',
    },
  })
}
