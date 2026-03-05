/**
 * Live Tonight Pack Compiler
 *
 * Called by /api/flow/state when no pack exists in Supabase Storage.
 * Fetches signals from OpenAgenda, OpenWeather, PRIM → compiles ramifications →
 * converts to CitySignalsPackV1 for the existing pipeline.
 *
 * Also writes the pack to Supabase Storage (background, non-blocking) so subsequent
 * requests don't need to recompile.
 */

import { fetchEventSignals, createUnknownEventPlaceholder } from '@/lib/signal-fetchers/events'
import { fetchWeatherSignal, createUnknownWeatherSignal } from '@/lib/signal-fetchers/weather'
import { fetchTransportSignals } from '@/lib/signal-fetchers/transport'
import { computeRamifications } from '@/lib/signal-fetchers/ramification-engine'
import { tonightPackToCitySignalsPack } from './tonightPackAdapter'
import { storageWriteJson, isStorageConfigured } from '@/lib/supabase/storageFetchJson'
import type { TonightPack, WeeklyWindow, EventSignal, WeatherSignal, TransportSignal } from '@/lib/signal-fetchers/types'
import type { CitySignalsPackV1 } from '@/types/city-signals-pack'

/** Inline fallback skeleton (same as cron route) */
const FALLBACK_SKELETON: WeeklyWindow[] = [
  { id: 'fb-nord', name: 'Gare du Nord', dayOfWeek: [0, 1, 2, 3, 4, 5, 6], window: { start: '21:00', end: '00:30' }, zones: ['Gare du Nord', "Gare de l'Est"], corridors: ['nord'], confidence: 0.7, intensity: 4, description: 'Arrivées TGV/Thalys — sortie voyageurs' },
  { id: 'fb-bastille', name: 'Bastille / bars', dayOfWeek: [4, 5, 6], window: { start: '22:00', end: '02:00' }, zones: ['Bastille', 'République'], corridors: ['est'], confidence: 0.75, intensity: 3, description: 'Bars IX/XI — sorties nocturnes' },
  { id: 'fb-chatelet', name: 'Châtelet / Marais', dayOfWeek: [4, 5, 6], window: { start: '22:30', end: '01:30' }, zones: ['Châtelet', 'Marais'], corridors: ['est'], confidence: 0.7, intensity: 3, description: 'Marais — dernier métro' },
]

function getTonightDate(): string {
  const now = new Date()
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const hour = parisTime.getHours()
  if (hour < 6) parisTime.setDate(parisTime.getDate() - 1)
  return parisTime.toISOString().slice(0, 10)
}

/**
 * Compile a tonight pack on-the-fly by fetching all signal sources.
 * Returns a CitySignalsPackV1 ready for the existing pipeline.
 * Also writes to Supabase Storage in the background for caching.
 */
export async function compileLiveTonightPack(): Promise<CitySignalsPackV1 | null> {
  const date = getTonightDate()
  console.log(`[compileLive] Compiling live tonight pack for ${date}`)

  try {
    // Fetch all signals in parallel with aggressive timeouts
    const [events, weather, transport] = await Promise.all([
      fetchEventSignals(date).catch((e) => {
        console.error('[compileLive] Events fetch failed:', e)
        return [createUnknownEventPlaceholder()]
      }),
      fetchWeatherSignal().catch((e) => {
        console.error('[compileLive] Weather fetch failed:', e)
        return createUnknownWeatherSignal()
      }),
      fetchTransportSignals().catch((e) => {
        console.error('[compileLive] Transport fetch failed:', e)
        return [] as TransportSignal[]
      }),
    ])

    // Use fallback skeleton filtered to today's day-of-week
    const dayOfWeek = new Date(date).getDay()
    const skeleton = FALLBACK_SKELETON.filter((s) => {
      const days = Array.isArray(s.dayOfWeek) ? s.dayOfWeek : [s.dayOfWeek]
      return days.includes(dayOfWeek)
    })

    // Compute ramifications
    const ramifications = computeRamifications(events, weather, transport, FALLBACK_SKELETON, date)

    // Build TonightPack
    const compiledAt = new Date().toISOString()
    const allSignals: (EventSignal | WeatherSignal | TransportSignal)[] = [
      ...events,
      ...(weather ? [weather] : []),
      ...transport,
    ]

    const allConfidences = [
      ...events.map((e) => e.confidence),
      weather?.confidence ?? 0,
      ...transport.map((t) => t.confidence),
    ].filter((c) => c > 0)

    const overallConfidence = allConfidences.length
      ? allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length
      : 0

    const sources: Record<string, number> = {}
    for (const event of events) sources[event.source] = (sources[event.source] || 0) + 1
    if (weather) sources[weather.source] = (sources[weather.source] || 0) + 1
    for (const t of transport) sources[t.source] = (sources[t.source] || 0) + 1

    const pack: TonightPack = {
      date,
      compiledAt,
      signals: allSignals,
      ramifications,
      weeklySkeleton: skeleton,
      meta: {
        signalCount: allSignals.length,
        overallConfidence,
        sources,
        stale: false,
        lastUpdate: compiledAt,
      },
    }

    console.log(`[compileLive] Pack compiled: ${allSignals.length} signals, ${ramifications.length} ramifications`)

    // Write to Supabase in background (don't block response)
    if (isStorageConfigured()) {
      const storagePath = `tonight/${date}.paris-idf.json`
      storageWriteJson('flow-packs', storagePath, pack).catch((err) => {
        console.error('[compileLive] Background storage write failed:', err)
      })
    }

    // Convert to CitySignalsPackV1 for the existing pipeline
    return tonightPackToCitySignalsPack(pack)
  } catch (err) {
    console.error('[compileLive] Compilation failed:', err)
    return null
  }
}
