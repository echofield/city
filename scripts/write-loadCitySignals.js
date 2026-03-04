const fs = require('fs');

const content = `/**
 * Load CitySignalsPackV1 from Supabase Storage (flow-packs bucket).
 * Falls back to local disk in development mode only.
 *
 * Priority:
 *   1. Tonight pack (v1.5) from Supabase Storage: flow-packs/tonight/{date}.paris-idf.json
 *   2. Tonight pack from local disk (dev only)
 *   3. Daily pack from Supabase Storage: flow-packs/daily/{date}.paris-idf.json
 *   4. Local disk (dev only)
 *   5. Events compilation fallback
 */

import * as fs from 'fs'
import * as path from 'path'
import type { CitySignalsPackV1 } from '@/types/city-signals-pack'
import { storageFetchJson, isStorageConfigured } from '@/lib/supabase/storageFetchJson'
import type { BanlieueEvent } from './event-types'
import { compileEventsForDate, mergePackWithRamifications } from './compileFromEvents'
import { tonightPackToCitySignalsPack, isTonightPack } from './tonightPackAdapter'
import type { TonightPack } from '@/lib/signal-fetchers/types'

const STORAGE_BUCKET = 'flow-packs'
const SIGNALS_DIR = path.join(process.cwd(), 'data', 'city-signals')
const DAILY_DIR = path.join(SIGNALS_DIR, 'daily')
const TONIGHT_DIR = path.join(SIGNALS_DIR, 'tonight')
const EVENTS_DIR = path.join(SIGNALS_DIR, 'events')

function getTodayParis(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
  }).format(new Date())
}

function getTonightParis(): string {
  const now = new Date()
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const hour = parisTime.getHours()
  if (hour < 6) {
    parisTime.setDate(parisTime.getDate() - 1)
  }
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
  }).format(parisTime)
}

export async function loadCitySignals(date?: string): Promise<CitySignalsPackV1 | null> {
  const targetDate = date ?? getTodayParis()
  const tonightDate = getTonightParis()

  // 1. Try tonight pack first - check Supabase then disk
  const tonightPack = await loadTonightPackAsync(tonightDate)
  if (tonightPack) {
    return tonightPackToCitySignalsPack(tonightPack)
  }

  const storagePath = \\\`daily/\\\${targetDate}.paris-idf.json\\\`

  // 2. Try Supabase Storage for daily pack
  if (isStorageConfigured()) {
    try {
      const pack = await storageFetchJson<CitySignalsPackV1>(STORAGE_BUCKET, storagePath)
      if (pack) {
        console.log(\\\`[loadCitySignals] Source: Supabase Storage daily (\\\${storagePath})\\\`)
        return pack
      }
    } catch (err) {
      console.error('[loadCitySignals] Storage fetch error:', err)
    }
  }

  // 3. Disk fallback (development only)
  if (process.env.NODE_ENV === 'development') {
    const diskPack = loadFromDisk(targetDate)
    if (diskPack) {
      console.log('[loadCitySignals] Source: Local disk fallback')
      return diskPack
    }
  }

  // 4. Events compilation fallback
  const compiledPack = await loadAndCompileFromEvents(targetDate)
  if (compiledPack) {
    console.log('[loadCitySignals] Source: Compiled from events calendar')
    return compiledPack
  }

  return null
}

async function loadTonightPackAsync(date: string): Promise<TonightPack | null> {
  // 1. Try Supabase Storage first (production)
  if (isStorageConfigured()) {
    try {
      const storagePath = \\\`tonight/\\\${date}.paris-idf.json\\\`
      const data = await storageFetchJson<TonightPack>(STORAGE_BUCKET, storagePath)
      if (data && isTonightPack(data)) {
        console.log(\\\`[loadCitySignals] Source: Supabase Storage tonight pack (\\\${date})\\\`)
        const compiledAt = new Date(data.compiledAt)
        const ageHours = (Date.now() - compiledAt.getTime()) / (1000 * 60 * 60)
        if (ageHours > 6) {
          console.warn(\\\`[loadCitySignals] Tonight pack is \\\${ageHours.toFixed(1)}h old (stale)\\\`)
          data.meta.stale = true
        }
        return data
      }
    } catch (err) {
      console.error('[loadCitySignals] Supabase Storage tonight pack error:', err)
    }
  }

  // 2. Fallback to local disk
  return loadTonightPackFromDisk(date)
}

function loadTonightPackFromDisk(date: string): TonightPack | null {
  const tonightPath = path.join(TONIGHT_DIR, \\\`\\\${date}.paris-idf.json\\\`)
  if (!fs.existsSync(tonightPath)) {
    return null
  }
  try {
    const raw = fs.readFileSync(tonightPath, 'utf-8')
    const data = JSON.parse(raw)
    if (isTonightPack(data)) {
      console.log(\\\`[loadCitySignals] Source: Local disk tonight pack (\\\${date})\\\`)
      const compiledAt = new Date(data.compiledAt)
      const ageHours = (Date.now() - compiledAt.getTime()) / (1000 * 60 * 60)
      if (ageHours > 6) {
        console.warn(\\\`[loadCitySignals] Tonight pack is \\\${ageHours.toFixed(1)}h old (stale)\\\`)
        data.meta.stale = true
      }
      return data
    }
  } catch (err) {
    console.error('[loadCitySignals] Tonight pack parse error:', err)
  }
  return null
}

async function loadAndCompileFromEvents(targetDate: string): Promise<CitySignalsPackV1 | null> {
  const monthKey = targetDate.slice(0, 7)
  if (isStorageConfigured()) {
    try {
      const eventsPath = \\\`events/\\\${monthKey}-events.json\\\`
      const events = await storageFetchJson<BanlieueEvent[]>(STORAGE_BUCKET, eventsPath)
      if (events && events.length > 0) {
        const { pack, ramifications } = compileEventsForDate(events, targetDate)
        return mergePackWithRamifications(pack, ramifications) as CitySignalsPackV1
      }
      const genericPath = 'events/banlieue-events.json'
      const genericEvents = await storageFetchJson<BanlieueEvent[]>(STORAGE_BUCKET, genericPath)
      if (genericEvents && genericEvents.length > 0) {
        const { pack, ramifications } = compileEventsForDate(genericEvents, targetDate)
        return mergePackWithRamifications(pack, ramifications) as CitySignalsPackV1
      }
    } catch (err) {
      console.error('[loadCitySignals] Events compilation error:', err)
    }
  }
  if (process.env.NODE_ENV === 'development') {
    const events = loadEventsFromDisk(monthKey)
    if (events && events.length > 0) {
      const { pack, ramifications } = compileEventsForDate(events, targetDate)
      console.log(\\\`[loadCitySignals] Compiled \\\${pack.events.length} events, \\\${ramifications.length} ramifications\\\`)
      return mergePackWithRamifications(pack, ramifications) as CitySignalsPackV1
    }
  }
  return null
}

function loadEventsFromDisk(monthKey: string): BanlieueEvent[] | null {
  if (!fs.existsSync(EVENTS_DIR)) {
    fs.mkdirSync(EVENTS_DIR, { recursive: true })
  }
  const monthPath = path.join(EVENTS_DIR, \\\`\\\${monthKey}-events.json\\\`)
  if (fs.existsSync(monthPath)) {
    try {
      const raw = fs.readFileSync(monthPath, 'utf-8')
      return JSON.parse(raw) as BanlieueEvent[]
    } catch {
      // fall through
    }
  }
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

function loadFromDisk(targetDate: string): CitySignalsPackV1 | null {
  const newPath = path.join(DAILY_DIR, \\\`\\\${targetDate}.paris-idf.json\\\`)
  if (fs.existsSync(newPath)) {
    try {
      const raw = fs.readFileSync(newPath, 'utf-8')
      return JSON.parse(raw) as CitySignalsPackV1
    } catch {
      // fall through
    }
  }
  const legacyPath = path.join(SIGNALS_DIR, \\\`\\\${targetDate}.json\\\`)
  if (fs.existsSync(legacyPath)) {
    try {
      const raw = fs.readFileSync(legacyPath, 'utf-8')
      return JSON.parse(raw) as CitySignalsPackV1
    } catch {
      // fall through
    }
  }
  return fallbackToLatest()
}

function fallbackToLatest(): CitySignalsPackV1 | null {
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
`;

// Replace escaped backticks with actual backticks
const finalContent = content.replace(/\\\\\\\`/g, '`');

fs.writeFileSync('src/lib/city-signals/loadCitySignals.ts', finalContent);
console.log('loadCitySignals.ts written successfully');
