/**
 * Transport Signal Fetcher - PRIM API (Ile-de-France Mobilites)
 * Fallback: RATP Open Data
 */

import type { TransportSignal, TransportStatus, CorridorDirection } from './types'
import { CONFIDENCE_RUBRIC } from './types'
import * as fs from 'fs'
import * as path from 'path'

const TTL_TRANSPORT = 900 // 15 minutes

// Load corridor map
function loadCorridorMap(): Record<string, { corridor: CorridorDirection; zones: string[] }> {
  try {
    const mapPath = path.join(process.cwd(), 'data', 'transport', 'corridor-map.json')
    const raw = fs.readFileSync(mapPath, 'utf-8')
    const data = JSON.parse(raw)
    return data.lines
  } catch {
    console.warn('[transport] Could not load corridor map')
    return {}
  }
}

/**
 * Map PRIM status to our TransportStatus
 */
function mapStatus(primStatus: string): TransportStatus {
  const statusLower = primStatus.toLowerCase()
  if (statusLower.includes('interrompu') || statusLower.includes('closed')) return 'closed'
  if (statusLower.includes('perturbe') || statusLower.includes('disrupted')) return 'disrupted'
  if (statusLower.includes('retard') || statusLower.includes('delayed')) return 'delayed'
  return 'normal'
}

/**
 * Get corridor for a transport line
 */
function getLineCorridor(line: string, corridorMap: Record<string, { corridor: CorridorDirection; zones: string[] }>): CorridorDirection | 'unknown' {
  const lineData = corridorMap[line]
  if (lineData) return lineData.corridor

  // Try to match partial (e.g., "RER A" from "RER A - Direction...")
  for (const [key, data] of Object.entries(corridorMap)) {
    if (line.includes(key) || key.includes(line)) {
      return data.corridor
    }
  }

  return 'unknown'
}

/**
 * Get affected zones for a transport line
 */
function getAffectedZones(line: string, corridorMap: Record<string, { corridor: CorridorDirection; zones: string[] }>): string[] {
  const lineData = corridorMap[line]
  if (lineData) return lineData.zones

  for (const [key, data] of Object.entries(corridorMap)) {
    if (line.includes(key) || key.includes(line)) {
      return data.zones
    }
  }

  return []
}

/**
 * Fetch transport disruptions from PRIM API
 */
export async function fetchTransportSignals(): Promise<TransportSignal[]> {
  const apiKey = process.env.PRIM_API_KEY
  const corridorMap = loadCorridorMap()
  const signals: TransportSignal[] = []

  if (!apiKey) {
    console.warn('[transport] PRIM_API_KEY not configured, using fallback')
    return fetchTransportFallback(corridorMap)
  }

  try {
    // PRIM API endpoint for traffic info
    const url = 'https://prim.iledefrance-mobilites.fr/marketplace/general-message'
    const res = await fetch(url, {
      headers: {
        'apikey': apiKey,
        'Accept': 'application/json',
      },
      next: { revalidate: TTL_TRANSPORT },
    })

    if (!res.ok) {
      console.error('[transport] PRIM API error:', res.status)
      return fetchTransportFallback(corridorMap)
    }

    const data = await res.json()
    const messages = data?.Siri?.ServiceDelivery?.GeneralMessageDelivery?.[0]?.InfoMessage || []

    for (const msg of messages) {
      const content = msg.Content?.Message?.[0]?.MessageText?.value || ''
      const lineRef = msg.InfoChannel?.LineRef?.value || ''

      // Only process RER and major metro lines
      if (!lineRef.match(/RER|Metro|M\d+/i)) continue

      const status = mapStatus(content)
      if (status === 'normal') continue // Only report disruptions

      const corridor = getLineCorridor(lineRef, corridorMap)
      const zones = getAffectedZones(lineRef, corridorMap)

      signals.push({
        type: 'transport',
        line: lineRef,
        status,
        corridor,
        affectedZones: zones,
        since: msg.RecordedAtTime || new Date().toISOString(),
        estimatedResolution: null,
        confidence: corridor === 'unknown'
          ? CONFIDENCE_RUBRIC.RELIABLE_STRUCTURED * 0.8
          : CONFIDENCE_RUBRIC.RELIABLE_STRUCTURED,
        source: 'prim',
        compiledAt: new Date().toISOString(),
        ttl: TTL_TRANSPORT,
      })
    }

    return signals
  } catch (error) {
    console.error('[transport] PRIM fetch error:', error)
    return fetchTransportFallback(corridorMap)
  }
}

/**
 * Fallback: Check RATP open data or return empty
 */
async function fetchTransportFallback(
  corridorMap: Record<string, { corridor: CorridorDirection; zones: string[] }>
): Promise<TransportSignal[]> {
  // Try RATP API as fallback
  try {
    const url = 'https://api-ratp.pierre-music.com/v3/traffic'
    const res = await fetch(url, { next: { revalidate: TTL_TRANSPORT } })

    if (!res.ok) return []

    const data = await res.json()
    const signals: TransportSignal[] = []

    for (const line of data.result?.rers || []) {
      if (line.slug === 'normal') continue

      const lineName = `RER ${line.line}`
      const corridor = getLineCorridor(lineName, corridorMap)
      const zones = getAffectedZones(lineName, corridorMap)

      signals.push({
        type: 'transport',
        line: lineName,
        status: mapStatus(line.slug),
        corridor,
        affectedZones: zones,
        since: new Date().toISOString(),
        estimatedResolution: null,
        confidence: CONFIDENCE_RUBRIC.SCRAPED,
        source: 'ratp-fallback',
        compiledAt: new Date().toISOString(),
        ttl: TTL_TRANSPORT,
      })
    }

    return signals
  } catch {
    return []
  }
}

/**
 * Create manual transport signal (for operator override)
 */
export function createManualTransportSignal(
  line: string,
  status: TransportStatus,
  corridor: CorridorDirection,
  zones: string[]
): TransportSignal {
  return {
    type: 'transport',
    line,
    status,
    corridor,
    affectedZones: zones,
    since: new Date().toISOString(),
    estimatedResolution: null,
    confidence: CONFIDENCE_RUBRIC.MANUAL_OPERATOR,
    source: 'manual',
    compiledAt: new Date().toISOString(),
    ttl: 3600,
  }
}
