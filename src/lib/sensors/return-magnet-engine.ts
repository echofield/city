/**
 * Return Magnet Engine
 *
 * Generates return magnet signals from major Paris hubs (airports, stations, expo centers).
 * These signals track where arrivals flow TO from hubs - the opposite of exit waves.
 *
 * Display: Notification/radar style. Never a command, always a magnet + reason.
 */

import * as fs from 'fs'
import * as path from 'path'
import type { ReturnMagnetSignal, CrowdLabel, CorridorDirection, HubType } from '../signal-fetchers/types'

// ── Types ──

export interface ReturnCorridor {
  corridor: string                // "nord->centre"
  target_corridor: string         // "centre"
  window: { start: string; end: string }
  days: number[]                  // 0=Sun, 1=Mon, etc.
  intensity: number               // 0-1
  crowd: CrowdLabel
  reason: string
}

export interface ReturnMagnetHub {
  id: string
  name: string
  type: HubType
  corridor_origin: CorridorDirection | 'centre'
  lat: number
  lon: number
  return_corridors: ReturnCorridor[]
}

export interface ReturnMagnetModifier {
  intensity_boost: number
  confidence_boost: number
  reason: string
}

export interface ReturnMagnetsData {
  version: string
  city: string
  generated_at: string
  description: string
  hubs: ReturnMagnetHub[]
  modifiers: {
    weather_rain?: ReturnMagnetModifier
    transport_disruption?: ReturnMagnetModifier
    regime_active?: ReturnMagnetModifier
  }
}

export interface ReturnMagnetEngineConfig {
  lookaheadMinutes: number        // How far ahead to look
  minConfidence: number           // Minimum confidence to emit
  baseConfidence: number          // Base confidence for hub data
}

export interface ModifierContext {
  isRaining?: boolean
  hasTransportDisruption?: boolean
  activeRegime?: string | null
}

const DEFAULT_CONFIG: ReturnMagnetEngineConfig = {
  lookaheadMinutes: 120,          // 2 hours
  minConfidence: 0.4,
  baseConfidence: 0.7
}

// ── Data Loading ──

let cachedMagnetsData: ReturnMagnetsData | null = null

export function loadReturnMagnets(): ReturnMagnetsData | null {
  if (cachedMagnetsData) return cachedMagnetsData

  const filePath = path.join(process.cwd(), 'data', 'sensors', 'return-magnets.paris.json')

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    cachedMagnetsData = JSON.parse(raw)
    return cachedMagnetsData
  } catch (error) {
    console.warn('[return-magnet-engine] Could not load return magnets:', error)
    return null
  }
}

// ── Time Utilities ──

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function isTimeInWindow(
  currentMinutes: number,
  windowStart: string,
  windowEnd: string,
  lookaheadMinutes: number
): boolean {
  const startMins = parseTimeToMinutes(windowStart)
  let endMins = parseTimeToMinutes(windowEnd)

  // Handle overnight windows (e.g., 22:00 -> 01:00)
  if (endMins < startMins) {
    endMins += 24 * 60
  }

  // Check if current time is within window or within lookahead of window start
  const windowStartWithLookahead = startMins - lookaheadMinutes

  // Normalize current time for overnight comparison
  let normalizedCurrent = currentMinutes
  if (currentMinutes < windowStartWithLookahead && windowStartWithLookahead < 0) {
    normalizedCurrent += 24 * 60
  }

  return normalizedCurrent >= windowStartWithLookahead && normalizedCurrent <= endMins
}

function getWindowDates(
  baseDate: Date,
  windowStart: string,
  windowEnd: string
): { start: Date; end: Date } {
  const startMins = parseTimeToMinutes(windowStart)
  const endMins = parseTimeToMinutes(windowEnd)

  const start = new Date(baseDate)
  start.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0)

  const end = new Date(baseDate)
  end.setHours(Math.floor(endMins / 60), endMins % 60, 0, 0)

  // Handle overnight: if end is before start, move end to next day
  if (end < start) {
    end.setDate(end.getDate() + 1)
  }

  return { start, end }
}

// ── Core Engine ──

/**
 * Detect active return magnet signals
 */
export function detectReturnMagnets(
  now: Date,
  modifiers: ModifierContext = {},
  config: Partial<ReturnMagnetEngineConfig> = {}
): ReturnMagnetSignal[] {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const data = loadReturnMagnets()

  if (!data) return []

  const signals: ReturnMagnetSignal[] = []
  const dayOfWeek = now.getDay()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  for (const hub of data.hubs) {
    for (const corridor of hub.return_corridors) {
      // Check if today is active
      if (!corridor.days.includes(dayOfWeek)) continue

      // Check if within time window (or lookahead)
      if (!isTimeInWindow(
        currentMinutes,
        corridor.window.start,
        corridor.window.end,
        cfg.lookaheadMinutes
      )) continue

      // Calculate window dates
      const windowDates = getWindowDates(now, corridor.window.start, corridor.window.end)

      // Apply modifiers
      let intensity = corridor.intensity
      let confidence = cfg.baseConfidence
      const appliedModifiers: ReturnMagnetSignal['modifiers'] = {}

      if (modifiers.isRaining && data.modifiers.weather_rain) {
        intensity = Math.min(1, intensity + data.modifiers.weather_rain.intensity_boost)
        confidence = Math.min(1, confidence + data.modifiers.weather_rain.confidence_boost)
        appliedModifiers.weather_rain = true
      }

      if (modifiers.hasTransportDisruption && data.modifiers.transport_disruption) {
        intensity = Math.min(1, intensity + data.modifiers.transport_disruption.intensity_boost)
        confidence = Math.min(1, confidence + data.modifiers.transport_disruption.confidence_boost)
        appliedModifiers.transport_disruption = true
      }

      if (modifiers.activeRegime && data.modifiers.regime_active) {
        intensity = Math.min(1, intensity + data.modifiers.regime_active.intensity_boost)
        confidence = Math.min(1, confidence + data.modifiers.regime_active.confidence_boost)
        appliedModifiers.regime_active = true
      }

      // Skip if below minimum confidence
      if (confidence < cfg.minConfidence) continue

      const signal: ReturnMagnetSignal = {
        type: 'return_magnet',
        id: `rm-${hub.id}-${corridor.target_corridor}-${corridor.window.start.replace(':', '')}`,
        hubId: hub.id,
        hubName: hub.name,
        hubType: hub.type,
        corridor: corridor.corridor,
        originCorridor: hub.corridor_origin,
        targetCorridor: corridor.target_corridor as CorridorDirection | 'centre',
        window: {
          start: windowDates.start.toISOString(),
          end: windowDates.end.toISOString()
        },
        crowd: corridor.crowd as CrowdLabel,
        intensity,
        confidence,
        reason: corridor.reason,
        explanation: generateExplanation(hub, corridor, appliedModifiers),
        modifiers: Object.keys(appliedModifiers).length > 0 ? appliedModifiers : undefined
      }

      signals.push(signal)
    }
  }

  return signals
}

/**
 * Generate human-readable explanation (radar-style notification)
 */
function generateExplanation(
  hub: ReturnMagnetHub,
  corridor: ReturnCorridor,
  modifiers: ReturnMagnetSignal['modifiers']
): string {
  const timeRange = `${corridor.window.start}-${corridor.window.end}`
  const arrow = '→'

  // Format: "CDG → centre (07:00-10:30) — arrivals + business mornings"
  let explanation = `${hub.name} ${arrow} ${corridor.target_corridor} (${timeRange}) — ${corridor.reason}`

  // Add modifier notes
  const modNotes: string[] = []
  if (modifiers?.weather_rain) modNotes.push('pluie')
  if (modifiers?.transport_disruption) modNotes.push('perturbation')
  if (modifiers?.regime_active) modNotes.push('régime actif')

  if (modNotes.length > 0) {
    explanation += ` [${modNotes.join(', ')}]`
  }

  return explanation
}

/**
 * Get top N return magnets by score (intensity * confidence)
 */
export function getTopReturnMagnets(
  signals: ReturnMagnetSignal[],
  n: number = 5,
  now: Date = new Date()
): ReturnMagnetSignal[] {
  return signals
    .map(signal => {
      const windowStart = new Date(signal.window.start)
      const windowEnd = new Date(signal.window.end)
      const nowMs = now.getTime()

      // Time proximity weight
      let timeWeight = 0.5
      if (nowMs >= windowStart.getTime() && nowMs <= windowEnd.getTime()) {
        // Currently active
        timeWeight = 1.2
      } else if (windowStart.getTime() > nowMs) {
        // Upcoming
        const minutesAway = (windowStart.getTime() - nowMs) / 60000
        timeWeight = Math.max(0.3, 1 - minutesAway / 60)
      }

      return {
        signal,
        score: signal.intensity * signal.confidence * timeWeight
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(item => item.signal)
}

/**
 * Group return magnets by target corridor
 */
export function groupByTargetCorridor(
  signals: ReturnMagnetSignal[]
): Map<string, ReturnMagnetSignal[]> {
  const groups = new Map<string, ReturnMagnetSignal[]>()

  for (const signal of signals) {
    const key = signal.targetCorridor
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(signal)
  }

  return groups
}

/**
 * Get summary of active return flows by corridor
 */
export function getCorridorFlowSummary(
  signals: ReturnMagnetSignal[]
): Record<string, { count: number; totalIntensity: number; hubs: string[] }> {
  const summary: Record<string, { count: number; totalIntensity: number; hubs: string[] }> = {}

  for (const signal of signals) {
    const key = signal.targetCorridor
    if (!summary[key]) {
      summary[key] = { count: 0, totalIntensity: 0, hubs: [] }
    }

    summary[key].count++
    summary[key].totalIntensity += signal.intensity
    if (!summary[key].hubs.includes(signal.hubName)) {
      summary[key].hubs.push(signal.hubName)
    }
  }

  return summary
}
