import { NextResponse } from 'next/server'

/** GET /api/health — backend health check. CORS/headers consistent with other API routes. */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      now: new Date().toISOString(),
      version: process.env.npm_package_version ?? undefined,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      },
    }
  )
}
