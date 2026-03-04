/**
 * POST /api/cron/compile-tonight
 *
 * Vercel Cron endpoint to compile tonight pack
 * Runs at 18:00, 21:00, 06:00 Paris time
 *
 * Authorization: CRON_SECRET header required
 * Always returns 200 with ok + stats + warnings (never 500 for env/disk issues).
 */

import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import { fetchEventSignals, createUnknownEventPlaceholder } from '@/lib/signal-fetchers/events'
import { fetchWeatherSignal, createUnknownWeatherSignal } from '@/lib/signal-fetchers/weather'
import { fetchTransportSignals } from '@/lib/signal-fetchers/transport'
import { computeRamifications } from '@/lib/signal-fetchers/ramification-engine'
import type { TonightPack, WeeklyWindow, EventSignal, WeatherSignal, TransportSignal } from '@/lib/signal-fetchers/types'
import { storageWriteJson, isStorageConfigured } from '@/lib/supabase/storageFetchJson'

/**
 * Get tonight's date (YYYY-MM-DD)
 */
function getTonightDate(): string {
  const now = new Date()
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const hour = parisTime.getHours()
  if (hour < 6) parisTime.setDate(parisTime.getDate() - 1)
  return parisTime.toISOString().slice(0, 10)
}

/** Inline fallback skeleton when file is missing (e.g. Vercel build without repo file). Ensures cron never fails for missing data. */
const FALLBACK_SKELETON: WeeklyWindow[] = [
  { id: 'fb-nord', name: 'Gare du Nord', dayOfWeek: [0, 1, 2, 3, 4, 5, 6], window: { start: '21:00', end: '00:30' }, zones: ['Gare du Nord', "Gare de l'Est"], corridors: ['nord'], confidence: 0.7, intensity: 4, description: 'Arrivées TGV/Thalys — sortie voyageurs' },
  { id: 'fb-bastille', name: 'Bastille / bars', dayOfWeek: [4, 5, 6], window: { start: '22:00', end: '02:00' }, zones: ['Bastille', 'République'], corridors: ['est'], confidence: 0.75, intensity: 3, description: 'Bars IX/XI — sorties nocturnes' },
  { id: 'fb-chatelet', name: 'Châtelet / Marais', dayOfWeek: [4, 5, 6], window: { start: '22:30', end: '01:30' }, zones: ['Châtelet', 'Marais'], corridors: ['est'], confidence: 0.7, intensity: 3, description: 'Marais — dernier métro' },
]

/**
 * Load weekly skeleton from JSON; on failure use inline fallback so cron never 500s for missing file.
 */
function loadWeeklySkeleton(): { patterns: WeeklyWindow[]; fromFile: boolean } {
  try {
    const skeletonPath = path.join(process.cwd(), 'data', 'city-signals', 'weekly', 'skeleton.json')
    const raw = fs.readFileSync(skeletonPath, 'utf-8')
    const data = JSON.parse(raw)
    const patterns = Array.isArray(data.patterns) ? data.patterns : []
    return { patterns: patterns.length ? patterns : FALLBACK_SKELETON, fromFile: true }
  } catch {
    console.warn('[cron] Skeleton file missing or invalid, using inline fallback')
    return { patterns: FALLBACK_SKELETON, fromFile: false }
  }
}

/**
 * Calculate overall confidence
 */
function calculateOverallConfidence(
  events: EventSignal[],
  weather: WeatherSignal | null,
  transport: TransportSignal[]
): number {
  const allSignals = [
    ...events.map((e) => e.confidence),
    weather?.confidence ?? 0,
    ...transport.map((t) => t.confidence),
  ].filter((c) => c > 0)

  if (allSignals.length === 0) return 0
  return allSignals.reduce((sum, c) => sum + c, 0) / allSignals.length
}

/**
 * Count sources
 */
function countSources(
  events: EventSignal[],
  weather: WeatherSignal | null,
  transport: TransportSignal[]
): Record<string, number> {
  const sources: Record<string, number> = {}

  for (const event of events) {
    sources[event.source] = (sources[event.source] || 0) + 1
  }

  if (weather) {
    sources[weather.source] = (sources[weather.source] || 0) + 1
  }

  for (const t of transport) {
    sources[t.source] = (sources[t.source] || 0) + 1
  }

  return sources
}

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const date = getTonightDate()

  console.log(`[cron] Starting tonight pack compilation for ${date}`)

  try {
    // Fetch all signals in parallel
    const [events, weather, transport] = await Promise.all([
      fetchEventSignals(date).catch((e) => {
        console.error('[cron] Events fetch failed:', e)
        return [createUnknownEventPlaceholder()]
      }),
      fetchWeatherSignal().catch((e) => {
        console.error('[cron] Weather fetch failed:', e)
        return createUnknownWeatherSignal()
      }),
      fetchTransportSignals().catch((e) => {
        console.error('[cron] Transport fetch failed:', e)
        return []
      }),
    ])

    // Load weekly skeleton (file or inline fallback)
    const { patterns: skeleton, fromFile: skeletonFromFile } = loadWeeklySkeleton()

    // Compute ramifications
    const ramifications = computeRamifications(events, weather, transport, skeleton, date)

    // Build pack
    const compiledAt = new Date().toISOString()
    const allSignals: (EventSignal | WeatherSignal | TransportSignal)[] = [
      ...events,
      ...(weather ? [weather] : []),
      ...transport,
    ]

    const pack: TonightPack = {
      date,
      compiledAt,
      signals: allSignals,
      ramifications,
      weeklySkeleton: skeleton.filter((s) => {
        const days = Array.isArray(s.dayOfWeek) ? s.dayOfWeek : [s.dayOfWeek]
        return days.includes(new Date(date).getDay())
      }),
      meta: {
        signalCount: allSignals.length,
        overallConfidence: calculateOverallConfidence(events, weather, transport),
        sources: countSources(events, weather, transport),
        stale: false,
        lastUpdate: compiledAt,
      },
    }

    const warnings: string[] = []
    if (!skeletonFromFile) warnings.push('skeleton_from_fallback')

    // Write to disk (dev / local) — skip on Vercel if read-only
    try {
      const root = path.join(process.cwd(), 'data', 'city-signals', 'tonight')
      fs.mkdirSync(root, { recursive: true })
      const filePath = path.join(root, `${date}.paris-idf.json`)
      fs.writeFileSync(filePath, JSON.stringify(pack, null, 2), 'utf-8')
    } catch (diskErr) {
      console.warn('[cron] Disk write skipped (e.g. read-only):', diskErr)
      warnings.push('disk_write_skipped')
    }

    // Write to Supabase Storage (production — API reads from here)
    const STORAGE_BUCKET = 'flow-packs'
    const storagePath = `tonight/${date}.paris-idf.json`
    let storageOk = false
    if (isStorageConfigured()) {
      try {
        await storageWriteJson(STORAGE_BUCKET, storagePath, pack)
        storageOk = true
      } catch (err) {
        console.error('[cron] Supabase Storage write failed:', err)
        warnings.push('storage_write_failed')
      }
    } else {
      warnings.push('storage_not_configured')
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`[cron] Pack compiled: ${pack.meta.signalCount} signals, ${ramifications.length} ramifications, storage=${storageOk}`)

    return NextResponse.json({
      ok: true,
      date,
      compiledAt,
      storageOk,
      warnings,
      stats: {
        signals: pack.meta.signalCount,
        ramifications: ramifications.length,
        confidence: pack.meta.overallConfidence,
        duration: `${duration}s`,
      },
    })
  } catch (error) {
    console.error('[cron] Compilation failed:', error)
    return NextResponse.json(
      {
        ok: false,
        error: 'Compilation failed',
        details: String(error),
        hint: 'Check Vercel function logs for stack trace.',
      },
      { status: 500 }
    )
  }
}

// Also allow GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request)
}
