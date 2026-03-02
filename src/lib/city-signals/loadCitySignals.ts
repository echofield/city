/**
 * Load daily city-signals pack: Supabase (LIVE) first with TTL cache, then fallback to local JSON.
 * LIVE reads use anon client only — RLS applies (demo-today / paywall).
 */

import { createServerAnonClient } from '@/lib/supabase/server-admin'
import { getTodayParis } from './dateParis'
import { loadCitySignalsFromFile } from './loadCitySignalsFromFile'

const DEFAULT_TERRITORY_ID = 'paris-idf'
const CACHE_TTL_MS = 45_000 // 45s

let cache: { pack: unknown; expiresAt: number } | null = null

/** public.city_signal_daily: pack is in row.payload. */
function packFromRow(row: Record<string, unknown> | null): unknown {
  if (!row || row.payload == null) return null
  const p = row.payload
  if (p != null && typeof p === 'object' && 'date' in (p as Record<string, unknown>)) return p
  return null
}

async function loadFromSupabase(territoryId: string, dateOverride?: string): Promise<unknown> {
  const supabase = createServerAnonClient()
  if (!supabase) return null

  let date: string
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('current_date_for_territory', {
      territory_id: territoryId,
    })
    if (rpcError || rpcData == null) {
      date = dateOverride ?? getTodayParis()
    } else {
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
      const d =
        row && typeof row === 'object' && 'date' in row
          ? (row as { date: string }).date
          : typeof rpcData === 'string'
            ? rpcData
            : Object.values(row ?? {})[0]
      date =
        typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : (dateOverride ?? getTodayParis())
    }
  } catch {
    date = dateOverride ?? getTodayParis()
  }

  try {
    const { data: row, error } = await supabase
      .from('city_signal_daily')
      .select('payload, generated_at, schema_version, source, is_demo, current_version')
      .eq('territory_id', territoryId)
      .eq('date', date)
      .maybeSingle()

    if (error || row == null) return null
    return packFromRow(row as Record<string, unknown>)
  } catch {
    return null
  }
}

/**
 * Async: Supabase (RPC + city_signal_daily) with 45s TTL, then file fallback.
 * Use in API routes for LIVE mode.
 */
export async function loadCitySignalsAsync(
  date?: string,
  territoryId: string = DEFAULT_TERRITORY_ID,
  rootDir: string = process.cwd()
): Promise<unknown> {
  const now = Date.now()
  if (cache && now < cache.expiresAt) return cache.pack

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  if (url?.trim()) {
    const pack = await loadFromSupabase(territoryId, date)
    if (pack != null) {
      cache = { pack, expiresAt: now + CACHE_TTL_MS }
      return pack
    }
  }

  const filePack = loadCitySignalsFromFile(date, rootDir)
  if (filePack != null) {
    cache = { pack: filePack, expiresAt: now + CACHE_TTL_MS }
    return filePack
  }
  return null
}

/**
 * Sync: file-only. Use when async is not possible or as fallback.
 * For LIVE API route, use loadCitySignalsAsync() instead.
 */
export function loadCitySignals(
  date?: string,
  rootDir: string = process.cwd()
): unknown {
  return loadCitySignalsFromFile(date, rootDir)
}
