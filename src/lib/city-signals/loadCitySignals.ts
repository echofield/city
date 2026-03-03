/**
 * Load CitySignalsPackV1 from Supabase Storage (flow-packs bucket).
 * Falls back to local disk in development mode only.
 *
 * Storage path: flow-packs/daily/{YYYY-MM-DD}.paris-idf.json
 */

import * as fs from 'fs'
import * as path from 'path'
import type { CitySignalsPackV1 } from '@/types/city-signals-pack'
import { storageFetchJson, isStorageConfigured } from '@/lib/supabase/storageFetchJson'
import type { BanlieueEvent } from './event-types'
import { compileEventsForDate, mergePackWithRamifications } from './compileFromEvents'

const STORAGE_BUCKET = 'flow-packs'
const SIGNALS_DIR = path.join(process.cwd(), 'data', 'city-signals')
const DAILY_DIR = path.join(SIGNALS_DIR, 'daily')
const EVENTS_DIR = path.join(SIGNALS_DIR, 'events')

/**
 * Get today's date in Europe/Paris timezone as YYYY-MM-DD
 */
function getTodayParis(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
  }).format(new Date())
}

/**
 * Load daily pack for the given date (YYYY-MM-DD).
 * If date omitted, use today (Europe/Paris).
 *
 * Priority:
 *   1. Supabase Storage: flow-packs/daily/{date}.paris-idf.json
 *   2. Local disk (dev only): data/city-signals/daily/{date}.paris-idf.json
 *   3. Local disk legacy (dev only): data/city-signals/{date}.json
 */
export async function loadCitySignals(date?: string): Promise<CitySignalsPackV1 | null> {
  const targetDate = date ?? getTodayParis()
  const storagePath = `daily/${targetDate}.paris-idf.json`

  // Try Supabase Storage first
  if (isStorageConfigured()) {
    try {
      const pack = await storageFetchJson<CitySignalsPackV1>(STORAGE_BUCKET, storagePath)
      if (pack) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[loadCitySignals] Source: Supabase Storage (${storagePath})`)
        }
        return pack
      }
    } catch (err) {
      console.error('[loadCitySignals] Storage fetch error:', err)
      // Fall through to disk fallback in dev
    }
  }

  // Disk fallback (development only)
  if (process.env.NODE_ENV === 'development') {
    const diskPack = loadFromDisk(targetDate)
    if (diskPack) {
      console.log(`[loadCitySignals] Source: Local disk fallback`)
      return diskPack
    }
  }

  // Events compilation fallback — try to compile from events calendar
  const compiledPack = await loadAndCompileFromEvents(targetDate)
  if (compiledPack) {
    console.log(`[loadCitySignals] Source: Compiled from events calendar`)
    return compiledPack
  }

  return null
}

/**
 * Load events calendar and compile for the given date
 */
async function loadAndCompileFromEvents(targetDate: string): Promise<CitySignalsPackV1 | null> {
  // Extract month for events file lookup (e.g., "2026-03")
  const monthKey = targetDate.slice(0, 7)

  // Try Supabase Storage first
  if (isStorageConfigured()) {
    try {
      // Try month-specific events file
      const eventsPath = `events/${monthKey}-events.json`
      const events = await storageFetchJson<BanlieueEvent[]>(STORAGE_BUCKET, eventsPath)
      if (events && events.length > 0) {
        const { pack, ramifications } = compileEventsForDate(events, targetDate)
        return mergePackWithRamifications(pack, ramifications) as CitySignalsPackV1
      }

      // Try generic banlieue events file
      const genericPath = `events/banlieue-events.json`
      const genericEvents = await storageFetchJson<BanlieueEvent[]>(STORAGE_BUCKET, genericPath)
      if (genericEvents && genericEvents.length > 0) {
        const { pack, ramifications } = compileEventsForDate(genericEvents, targetDate)
        return mergePackWithRamifications(pack, ramifications) as CitySignalsPackV1
      }
    } catch (err) {
      console.error('[loadCitySignals] Events compilation error:', err)
    }
  }

  // Disk fallback for events (development only)
  if (process.env.NODE_ENV === 'development') {
    const events = loadEventsFromDisk(monthKey)
    if (events && events.length > 0) {
      const { pack, ramifications } = compileEventsForDate(events, targetDate)
      console.log(`[loadCitySignals] Compiled ${pack.events.length} events, ${ramifications.length} ramifications`)
      return mergePackWithRamifications(pack, ramifications) as CitySignalsPackV1
    }
  }

  return null
}

/**
 * Load events from local disk
 */
function loadEventsFromDisk(monthKey: string): BanlieueEvent[] | null {
  // Ensure events directory exists
  if (!fs.existsSync(EVENTS_DIR)) {
    fs.mkdirSync(EVENTS_DIR, { recursive: true })
  }

  // Try month-specific file
  const monthPath = path.join(EVENTS_DIR, `${monthKey}-events.json`)
  if (fs.existsSync(monthPath)) {
    try {
      const raw = fs.readFileSync(monthPath, 'utf-8')
      return JSON.parse(raw) as BanlieueEvent[]
    } catch {
      // fall through
    }
  }

  // Try generic banlieue file
  const genericPath = path.join(EVENTS_DIR, 'banlieue-events.json')
  if (fs.existsSync(genericPath)) {
    try {
      const raw = fs.readFileSync(genericPath, 'utf-8')
      return JSON.parse(raw) as BanlieueEvent[]
    } catch {
      // fall through
    }
  }

  return null
}

/**
 * Synchronous disk loader for development fallback.
 */
function loadFromDisk(targetDate: string): CitySignalsPackV1 | null {
  // Try new path first
  const newPath = path.join(DAILY_DIR, `${targetDate}.paris-idf.json`)
  if (fs.existsSync(newPath)) {
    try {
      const raw = fs.readFileSync(newPath, 'utf-8')
      return JSON.parse(raw) as CitySignalsPackV1
    } catch {
      // fall through
    }
  }

  // Try legacy path
  const legacyPath = path.join(SIGNALS_DIR, `${targetDate}.json`)
  if (fs.existsSync(legacyPath)) {
    try {
      const raw = fs.readFileSync(legacyPath, 'utf-8')
      return JSON.parse(raw) as CitySignalsPackV1
    } catch {
      // fall through
    }
  }

  // Fallback to most recent pack
  return fallbackToLatest()
}

function fallbackToLatest(): CitySignalsPackV1 | null {
  // Try daily/ folder first
  if (fs.existsSync(DAILY_DIR)) {
    const files = fs.readdirSync(DAILY_DIR).filter((f) => f.endsWith('.json'))
    if (files.length > 0) {
      files.sort((a, b) => b.localeCompare(a))
      const filePath = path.join(DAILY_DIR, files[0])
      try {
        const raw = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(raw) as CitySignalsPackV1
      } catch {
        // fall through to root
      }
    }
  }

  // Fallback to root signals dir (legacy)
  if (!fs.existsSync(SIGNALS_DIR)) return null
  const files = fs.readdirSync(SIGNALS_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('.'))
  if (files.length === 0) return null
  files.sort((a, b) => b.localeCompare(a))
  const filePath = path.join(SIGNALS_DIR, files[0])
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as CitySignalsPackV1
  } catch {
    return null
  }
}
