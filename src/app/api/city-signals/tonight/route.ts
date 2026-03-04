/**
 * GET /api/city-signals/tonight
 *
 * Returns the tonight pack (18:00 → 06:00)
 * This is the primary data source for the FLOW UI
 */

import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import type { TonightPack } from '@/lib/signal-fetchers/types'

/**
 * Get tonight's date (YYYY-MM-DD)
 */
function getTonightDate(): string {
  const now = new Date()
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const hour = parisTime.getHours()

  if (hour < 6) {
    parisTime.setDate(parisTime.getDate() - 1)
  }

  return parisTime.toISOString().slice(0, 10)
}

/**
 * Check if pack is stale
 */
function checkStale(pack: TonightPack): boolean {
  const compiledTime = new Date(pack.compiledAt).getTime()
  const now = Date.now()

  // Pack is stale if older than 2 hours
  const maxAge = 2 * 60 * 60 * 1000
  return now - compiledTime > maxAge
}

export async function GET() {
  const date = getTonightDate()
  const filePath = path.join(process.cwd(), 'data', 'city-signals', 'tonight', `${date}.paris-idf.json`)

  // Check if tonight pack exists
  if (!fs.existsSync(filePath)) {
    // Try yesterday's pack (for early morning before 18:00 compilation)
    const yesterday = new Date(date)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayPath = path.join(
      process.cwd(),
      'data',
      'city-signals',
      'tonight',
      `${yesterday.toISOString().slice(0, 10)}.paris-idf.json`
    )

    if (fs.existsSync(yesterdayPath)) {
      const raw = fs.readFileSync(yesterdayPath, 'utf-8')
      const pack: TonightPack = JSON.parse(raw)
      pack.meta.stale = true
      return NextResponse.json(pack, {
        headers: {
          'Cache-Control': 'public, max-age=300', // 5 min cache
          'Content-Type': 'application/json',
        },
      })
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'no_pack',
        message: `No tonight pack found for ${date}. Run /api/cron/compile-tonight to generate.`,
      },
      {
        status: 404,
        headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
      }
    )
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const pack: TonightPack = JSON.parse(raw)

    // Update stale flag
    pack.meta.stale = checkStale(pack)

    return NextResponse.json(pack, {
      headers: {
        'Cache-Control': pack.meta.stale ? 'no-store' : 'public, max-age=300',
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('[tonight] Error reading pack:', error)
    return NextResponse.json(
      { ok: false, error: 'read_error' },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
      }
    )
  }
}
