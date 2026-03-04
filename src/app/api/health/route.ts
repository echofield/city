import { NextResponse } from 'next/server'
import { isStorageConfigured } from '@/lib/supabase/storageFetchJson'

/** GET /api/health — backend health check and deploy/cron debugging. */
export async function GET() {
  const storageConfigured = isStorageConfigured()
  return NextResponse.json(
    {
      ok: true,
      now: new Date().toISOString(),
      version: process.env.npm_package_version ?? undefined,
      storageConfigured,
      cronHint: storageConfigured
        ? 'Cron can write tonight pack to Supabase. Trigger: POST /api/cron/compile-tonight with Authorization: Bearer <CRON_SECRET>.'
        : 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY so cron can persist tonight pack.',
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    }
  )
}
