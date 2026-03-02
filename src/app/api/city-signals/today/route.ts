import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import { getTodayParis } from '@/lib/city-signals/dateParis'
import { normalizeCitySignalsPack } from '@/lib/city-signals/normalize-pack'

/**
 * GET /api/city-signals/today
 * Returns the daily pack used by /api/flow/state for today (Europe/Paris).
 * If no pack exists for today, returns 404 with { ok: false, error: "no_pack" }.
 */
export async function GET() {
  const today = getTodayParis()
  const filePath = path.join(process.cwd(), 'data', 'city-signals', `${today}.json`)

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { ok: false, error: 'no_pack' },
      {
        status: 404,
        headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
      }
    )
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const pack = JSON.parse(raw)
    const normalized = normalizeCitySignalsPack(pack)
    return NextResponse.json(normalized, {
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
    })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'no_pack' },
      {
        status: 404,
        headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
      }
    )
  }
}
