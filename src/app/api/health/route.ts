import { NextResponse } from 'next/server'
import { isStorageConfigured, storageFetchJson } from '@/lib/supabase/storageFetchJson'

function getTonightDate(): string {
  const now = new Date()
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const hour = parisTime.getHours()
  if (hour < 6) parisTime.setDate(parisTime.getDate() - 1)
  return parisTime.toISOString().slice(0, 10)
}

/** GET /api/health — backend health check and deploy/cron debugging. */
export async function GET() {
  const storageConfigured = isStorageConfigured()
  const tonightDate = getTonightDate()
  const storagePath = `tonight/${tonightDate}.paris-idf.json`

  // Check if tonight pack exists in Supabase
  let packExists = false
  let packSignals = 0
  let packRamifications = 0
  let packCompiledAt: string | null = null
  if (storageConfigured) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pack = await storageFetchJson<any>('flow-packs', storagePath)
      if (pack) {
        packExists = true
        packSignals = pack.meta?.signalCount ?? pack.signals?.length ?? 0
        packRamifications = pack.ramifications?.length ?? 0
        packCompiledAt = pack.compiledAt ?? null
      }
    } catch {
      // Storage error - leave defaults
    }
  }

  const envCheck = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAGENDA_API_KEY: !!process.env.OPENAGENDA_API_KEY,
    OPENWEATHERMAP_API_KEY: !!process.env.OPENWEATHERMAP_API_KEY,
    PRIM_API_KEY: !!process.env.PRIM_API_KEY,
    CRON_SECRET: !!process.env.CRON_SECRET,
  }

  return NextResponse.json(
    {
      ok: true,
      now: new Date().toISOString(),
      tonightDate,
      storageConfigured,
      pack: {
        exists: packExists,
        path: storagePath,
        signals: packSignals,
        ramifications: packRamifications,
        compiledAt: packCompiledAt,
      },
      env: envCheck,
      selfHealing: 'If no pack in storage, /api/flow/state now compiles signals live.',
      cronHint: storageConfigured
        ? 'POST /api/cron/compile-tonight with Authorization: Bearer <CRON_SECRET>'
        : 'Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY so cron can persist packs.',
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    }
  )
}
