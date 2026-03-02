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

const STORAGE_BUCKET = 'flow-packs'
const SIGNALS_DIR = path.join(process.cwd(), 'data', 'city-signals')
const DAILY_DIR = path.join(SIGNALS_DIR, 'daily')

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
