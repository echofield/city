/**
 * Tonight Pack Compiler v1.5
 *
 * Runs: 18:00, 21:00, 06:00 (via Vercel cron)
 *
 * Steps:
 * 1. Fetch APIs (OpenAgenda, OpenWeatherMap, PRIM)
 * 2. Normalize to signals
 * 3. Apply ramification engine
 * 4. Merge weekly skeleton
 * 5. Write artifact
 *
 * Output: data/city-signals/tonight/YYYY-MM-DD.paris-idf.json
 */

import * as fs from 'fs'
import * as path from 'path'
import { fetchEventSignals, createUnknownEventPlaceholder } from '../src/lib/signal-fetchers/events'
import { fetchWeatherSignal, createUnknownWeatherSignal } from '../src/lib/signal-fetchers/weather'
import { fetchTransportSignals } from '../src/lib/signal-fetchers/transport'
import { computeRamifications } from '../src/lib/signal-fetchers/ramification-engine'
import { detectExitWaves, getTopExitWaves } from '../src/lib/sensors/exit-wave-detector'
import { detectTheatreExitWaves, mergeTheatreExitWaves } from '../src/lib/sensors/theatre-exit-engine'
import { detectReturnMagnets, getTopReturnMagnets, type ModifierContext } from '../src/lib/sensors/return-magnet-engine'
import type { TonightPack, WeeklyWindow, EventSignal, WeatherSignal, TransportSignal, ExitWaveSignal, ReturnMagnetSignal } from '../src/lib/signal-fetchers/types'

/**
 * Get tonight's date (YYYY-MM-DD)
 * Tonight = 18:00 today → 06:00 tomorrow
 */
function getTonightDate(): string {
  const now = new Date()
  const hour = now.getHours()

  // If it's before 06:00, we're still in "last night"
  if (hour < 6) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toISOString().slice(0, 10)
  }

  return now.toISOString().slice(0, 10)
}

/**
 * Load weekly skeleton from JSON
 */
function loadWeeklySkeleton(): WeeklyWindow[] {
  try {
    const skeletonPath = path.join(process.cwd(), 'data', 'city-signals', 'weekly', 'skeleton.json')
    const raw = fs.readFileSync(skeletonPath, 'utf-8')
    const data = JSON.parse(raw)
    return data.patterns || []
  } catch (error) {
    console.warn('[compiler] Could not load weekly skeleton:', error)
    return []
  }
}

/**
 * Calculate overall confidence from signals
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

/**
 * Check if pack is stale (based on TTL)
 */
function isPackStale(compiledAt: string, signals: (EventSignal | WeatherSignal | TransportSignal)[]): boolean {
  const compiledTime = new Date(compiledAt).getTime()
  const now = Date.now()

  // Find minimum TTL
  const minTTL = signals.reduce((min, s) => Math.min(min, s.ttl), 3600)

  return now - compiledTime > minTTL * 1000
}

/**
 * Source status tracking for API failures (PASS 4)
 */
interface SourceStatus {
  openagenda: 'ok' | 'failed' | 'partial'
  openweather: 'ok' | 'failed' | 'partial'
  prim: 'ok' | 'failed' | 'partial'
}

/**
 * Main compiler function
 */
async function compileTonightPack(): Promise<TonightPack> {
  const date = getTonightDate()
  console.log(`[compiler] Compiling tonight pack for ${date}`)

  // Track source failures (PASS 4)
  const sourceStatus: SourceStatus = {
    openagenda: 'ok',
    openweather: 'ok',
    prim: 'ok',
  }

  // Fetch all signals in parallel
  console.log('[compiler] Fetching signals...')
  const [events, weather, transport] = await Promise.all([
    fetchEventSignals(date).catch((e) => {
      console.error('[compiler] Events fetch failed:', e)
      sourceStatus.openagenda = 'failed'
      return [createUnknownEventPlaceholder()]
    }),
    fetchWeatherSignal().catch((e) => {
      console.error('[compiler] Weather fetch failed:', e)
      sourceStatus.openweather = 'failed'
      return createUnknownWeatherSignal()
    }),
    fetchTransportSignals().catch((e) => {
      console.error('[compiler] Transport fetch failed:', e)
      sourceStatus.prim = 'failed'
      return []
    }),
  ])

  console.log(`[compiler] Fetched: ${events.length} events, weather: ${weather?.condition || 'unknown'}, ${transport.length} transport disruptions`)

  // Detect exit waves from venue sensors
  console.log('[compiler] Detecting exit waves...')
  const now = new Date()
  const venueExitWaves = detectExitWaves(now, { lookaheadMinutes: 480 }) // 8 hours lookahead for tonight
  console.log(`[compiler] Detected ${venueExitWaves.length} venue exit waves`)

  // Detect theatre exit waves
  console.log('[compiler] Detecting theatre exit waves...')
  const theatreExitWaves = detectTheatreExitWaves(now, { lookaheadMinutes: 480 })
  console.log(`[compiler] Detected ${theatreExitWaves.length} theatre exit waves`)

  // Merge and get top waves (avoiding duplicates)
  // PASS 3: Signal cap of 15 total signals per night - scarcity creates authority
  const MAX_SIGNALS_PER_NIGHT = 15

  const allExitWaves = mergeTheatreExitWaves(venueExitWaves, theatreExitWaves)
  // Reserve slots: 8 for exit waves, 5 for return magnets, 2 for ramification peaks
  const exitWaves = getTopExitWaves(allExitWaves, 8, now)
  console.log(`[compiler] Total ${allExitWaves.length} exit waves, keeping top ${exitWaves.length}`)

  // Detect return magnets from hubs
  console.log('[compiler] Detecting return magnets...')
  const magnetModifiers: ModifierContext = {
    isRaining: weather?.condition === 'rain' || weather?.condition === 'heavy_rain',
    hasTransportDisruption: transport.some(t => t.status === 'disrupted' || t.status === 'closed'),
    activeRegime: null // Could be set from regime detection
  }
  const allReturnMagnets = detectReturnMagnets(now, magnetModifiers, { lookaheadMinutes: 240 })
  const returnMagnets = getTopReturnMagnets(allReturnMagnets, 5, now) // Top 5 return magnets (part of 15-signal cap)
  console.log(`[compiler] Detected ${allReturnMagnets.length} return magnets, keeping top ${returnMagnets.length}`)

  // Load weekly skeleton
  const skeleton = loadWeeklySkeleton()
  console.log(`[compiler] Loaded ${skeleton.length} weekly patterns`)

  // Compute ramifications
  console.log('[compiler] Computing ramifications...')
  const ramifications = computeRamifications(events, weather, transport, skeleton, date)
  console.log(`[compiler] Generated ${ramifications.length} ramifications`)

  // Build tonight pack
  const compiledAt = new Date().toISOString()
  const allSignals: (EventSignal | WeatherSignal | TransportSignal)[] = [
    ...events,
    ...(weather ? [weather] : []),
    ...transport,
  ]

  // Count sources including exit waves and return magnets
  const sources = countSources(events, weather, transport)
  if (exitWaves.length > 0) {
    sources['venue_sensors'] = exitWaves.filter(ew => ew.source === 'venue_sensors').length
    sources['district_cloud'] = exitWaves.filter(ew => ew.source === 'district_cloud').length
  }
  if (returnMagnets.length > 0) {
    sources['return_magnets'] = returnMagnets.length
  }

  // Degrade confidence based on source failures (PASS 4)
  let confidenceDegradation = 1.0
  const failedSources: string[] = []
  if (sourceStatus.openagenda === 'failed') {
    confidenceDegradation *= 0.7
    failedSources.push('OpenAgenda')
  }
  if (sourceStatus.openweather === 'failed') {
    confidenceDegradation *= 0.85
    failedSources.push('OpenWeather')
  }
  if (sourceStatus.prim === 'failed') {
    confidenceDegradation *= 0.9
    failedSources.push('PRIM')
  }

  if (failedSources.length > 0) {
    console.log(`[compiler] Source failures: ${failedSources.join(', ')} — confidence degraded to ${Math.round(confidenceDegradation * 100)}%`)
  }

  const pack: TonightPack = {
    date,
    compiledAt,
    signals: allSignals,
    exitWaves,  // Add exit wave signals
    returnMagnets,  // Add return magnet signals
    ramifications,
    weeklySkeleton: skeleton.filter((s) => {
      const days = Array.isArray(s.dayOfWeek) ? s.dayOfWeek : [s.dayOfWeek]
      return days.includes(new Date(date).getDay())
    }),
    meta: {
      signalCount: allSignals.length + exitWaves.length + returnMagnets.length,
      overallConfidence: calculateOverallConfidence(events, weather, transport) * confidenceDegradation,
      sources,
      stale: false,
      lastUpdate: compiledAt,
      sourceStatus,
    },
  }

  return pack
}

/**
 * Write pack to disk
 */
function writePack(pack: TonightPack): string {
  const root = path.join(process.cwd(), 'data', 'city-signals', 'tonight')
  fs.mkdirSync(root, { recursive: true })

  const filePath = path.join(root, `${pack.date}.paris-idf.json`)
  fs.writeFileSync(filePath, JSON.stringify(pack, null, 2), 'utf-8')

  return filePath
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const startTime = Date.now()

  try {
    const pack = await compileTonightPack()
    const filePath = writePack(pack)

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`[compiler] Pack written to ${filePath}`)
    console.log(`[compiler] Completed in ${duration}s`)
    console.log(`[compiler] Stats: ${pack.meta.signalCount} signals, ${pack.ramifications.length} ramifications, ${pack.exitWaves?.length || 0} exit waves, ${pack.returnMagnets?.length || 0} return magnets, confidence: ${(pack.meta.overallConfidence * 100).toFixed(0)}%`)
  } catch (error) {
    console.error('[compiler] Fatal error:', error)
    process.exit(1)
  }
}

// Run if called directly
main()

// Export for API route use
export { compileTonightPack, writePack, getTonightDate }
