/**
 * Load daily pack from filesystem only (fallback when Supabase missing/denied/error).
 */

import * as fs from 'fs'
import * as path from 'path'
import { getTodayParis } from './dateParis'

const DAILY_DIR = 'data/city-signals'
const DATE_RE = /^\d{4}-\d{2}-\d{2}\.json$/

export function loadCitySignalsFromFile(
  date?: string,
  rootDir: string = process.cwd()
): unknown {
  const dir = path.join(rootDir, DAILY_DIR)
  if (!fs.existsSync(dir)) return null

  const requested = date ?? getTodayParis()
  const filePath = path.join(dir, `${requested}.json`)

  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(raw) as unknown
    } catch {
      return null
    }
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const dailyFiles = entries
    .filter((e) => e.isFile() && DATE_RE.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => b.localeCompare(a))

  if (dailyFiles.length === 0) return null

  const fallbackPath = path.join(dir, dailyFiles[0])
  try {
    const raw = fs.readFileSync(fallbackPath, 'utf-8')
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}
