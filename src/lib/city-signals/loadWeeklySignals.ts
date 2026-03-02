/**
 * Load WeeklySkeleton from Supabase Storage (flow-packs bucket).
 * Falls back to local disk in development mode only.
 *
 * Storage path: flow-packs/weekly/{YYYY-Www}.paris-idf.json
 * Uses Europe/Paris timezone for ISO week computation.
 */

import * as fs from 'fs'
import * as path from 'path'
import type { WeeklySkeleton } from '@/types/flow-state'
import { storageFetchJson, isStorageConfigured } from '@/lib/supabase/storageFetchJson'

const STORAGE_BUCKET = 'flow-packs'
const WEEKLY_DIR = path.join(process.cwd(), 'data', 'city-signals', 'weekly')

/**
 * Get current date in Europe/Paris timezone
 */
function getParisDate(): Date {
  const parisDateStr = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
  }).format(new Date())
  return new Date(parisDateStr + 'T12:00:00')
}

/**
 * Compute ISO week number for a date.
 * ISO weeks start on Monday, and week 1 contains the first Thursday.
 */
function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return { year: d.getUTCFullYear(), week: weekNo }
}

/**
 * Format ISO week as YYYY-Www (e.g., 2026-W10)
 */
function formatISOWeek(year: number, week: number): string {
  return `${year}-W${week.toString().padStart(2, '0')}`
}

/**
 * Load weekly skeleton for the current ISO week (Europe/Paris).
 *
 * Priority:
 *   1. Supabase Storage: flow-packs/weekly/{week}.paris-idf.json
 *   2. Local disk (dev only): data/city-signals/weekly/{week}.paris-idf.json
 *
 * Returns null if not found.
 */
export async function loadWeeklySignals(weekOverride?: string): Promise<WeeklySkeleton | null> {
  let weekKey: string

  if (weekOverride) {
    weekKey = weekOverride
  } else {
    const parisDate = getParisDate()
    const { year, week } = getISOWeek(parisDate)
    weekKey = formatISOWeek(year, week)
  }

  const storagePath = `weekly/${weekKey}.paris-idf.json`

  // Try Supabase Storage first
  if (isStorageConfigured()) {
    try {
      const skeleton = await storageFetchJson<WeeklySkeleton>(STORAGE_BUCKET, storagePath)
      if (skeleton) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[loadWeeklySignals] Source: Supabase Storage (${storagePath})`)
        }
        return skeleton
      }
    } catch (err) {
      console.error('[loadWeeklySignals] Storage fetch error:', err)
      // Fall through to disk fallback in dev
    }
  }

  // Disk fallback (development only)
  if (process.env.NODE_ENV === 'development') {
    const diskSkeleton = loadFromDisk(weekKey)
    if (diskSkeleton) {
      console.log(`[loadWeeklySignals] Source: Local disk fallback`)
      return diskSkeleton
    }
  }

  return null
}

/**
 * Synchronous disk loader for development fallback.
 */
function loadFromDisk(weekKey: string): WeeklySkeleton | null {
  const filePath = path.join(WEEKLY_DIR, `${weekKey}.paris-idf.json`)

  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as WeeklySkeleton
  } catch {
    return null
  }
}

/**
 * Get current ISO week string in Europe/Paris timezone.
 * Useful for debugging and seeding.
 */
export function getCurrentISOWeek(): string {
  const parisDate = getParisDate()
  const { year, week } = getISOWeek(parisDate)
  return formatISOWeek(year, week)
}
