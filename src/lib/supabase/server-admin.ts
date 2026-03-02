/**
 * Server-only Supabase clients.
 *
 * - createServerAnonClient(): for LIVE reads (loadCitySignalsAsync). Uses anon key only.
 *   RLS applies — demo-today / paywall gating works. Never use service role for reads.
 *
 * - createServerAdminClient(): for writes only (ingest, webhook). Uses service_role if set.
 *   Bypasses RLS. Do not use for loadCitySignals or any user-facing read path.
 */

import { createClient } from '@supabase/supabase-js'

// Prefer non-public names for server-only; fallback for existing NEXT_PUBLIC_* usage
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/** LIVE reads only. RLS applies. Use in loadCitySignalsAsync. */
export function createServerAnonClient() {
  if (supabaseUrl && anonKey) {
    return createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    })
  }
  return null
}

/** Writes / ingest / webhook only. Bypasses RLS. Do not use for user-facing reads. */
export function createServerAdminClient() {
  if (supabaseUrl && serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })
  }
  return null
}
