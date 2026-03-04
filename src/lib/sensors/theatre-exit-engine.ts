/**
 * Theatre Exit Engine
 *
 * Generates exit wave signals from Paris theatre schedules.
 * Uses inferred end times from typical show patterns.
 * Confidence reflects uncertainty in end time estimation.
 */

import * as fs from 'fs'
import * as path from 'path'
import type { ExitWaveSignal, CrowdLabel, CorridorDirection } from '../signal-fetchers/types'
import { resolveLocation, getLocationEvidence, type ResolvedLocation } from './location-resolver'

// ── Types ──

export interface TheatreShowPattern {
  days: number[]                    // 0=Sun, 1=Mon, etc.
  typical_start_times: string[]     // "20:00", "20:30"
  typical_duration_min: number      // 120, 150, etc.
}

export interface TheatreVtcProfile {
  probability: number               // 0-1
  crowd: CrowdLabel
  exit_duration_min: number
}

export interface TheatreExitWaveConfig {
  end_minus_min: number             // window starts before estimated end
  end_plus_min: number              // window extends after estimated end
}

export interface TheatreSensor {
  id: string
  name: string
  category: 'theatre' | 'opera' | 'comedy' | 'show' | 'concert'
  arrondissement: string
  corridor: CorridorDirection | 'centre'
  zone_hint: string
  capacity: number
  lat?: number
  lon?: number
  show_patterns: TheatreShowPattern[]
  exit_wave: TheatreExitWaveConfig
  vtc_profile: TheatreVtcProfile
  confidence: number
  notes?: string
}

// Extended signal with evidence metadata
export interface TheatreExitWaveSignal extends ExitWaveSignal {
  evidence?: string[]
  resolvedLocation?: {
    lat: number
    lon: number
    source: string
    isApproximate: boolean
  }
}

export interface TheatreSensorsData {
  version: string
  city: string
  generated_at: string
  items: TheatreSensor[]
}

export interface TheatreExitEngineConfig {
  lookaheadMinutes: number          // How far ahead to look
  minConfidence: number             // Minimum confidence to emit
  clusterBoostThreshold: number     // Min venues in zone for cluster boost
  clusterBoostAmount: number        // Confidence boost for clusters
}

const DEFAULT_CONFIG: TheatreExitEngineConfig = {
  lookaheadMinutes: 240,            // 4 hours
  minConfidence: 0.3,
  clusterBoostThreshold: 2,
  clusterBoostAmount: 0.08
}

// ── Data Loading ──

let cachedTheatreSensors: TheatreSensor[] | null = null

export function loadTheatreSensors(): TheatreSensor[] {
  if (cachedTheatreSensors) return cachedTheatreSensors

  const filePath = path.join(process.cwd(), 'data', 'sensors', 'theatre-exit-sensors.paris.json')

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const data: TheatreSensorsData = JSON.parse(raw)
    cachedTheatreSensors = data.items
    return cachedTheatreSensors
  } catch (error) {
    console.warn('[theatre-exit-engine] Could not load theatre sensors:', error)
    return []
  }
}

// ── Time Utilities ──

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function minutesToDate(minutes: number, baseDate: Date): Date {
  const result = new Date(baseDate)
  const hours = Math.floor(minutes / 60) % 24
  const mins = minutes % 60
  result.setHours(hours, mins, 0, 0)

  // If time wrapped to next day
  if (minutes >= 24 * 60) {
    result.setDate(result.getDate() + 1)
  }

  return result
}

// ── Core Engine ──

/**
 * Get the next show end time for a theatre on a given date
 */
function getNextShowEndTime(
  sensor: TheatreSensor,
  now: Date
): { endTime: Date; startTime: Date } | null {
  const dayOfWeek = now.getDay()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  // Find matching pattern for today
  const pattern = sensor.show_patterns.find(p => p.days.includes(dayOfWeek))
  if (!pattern) return null

  // Find next start time that hasn't ended yet
  for (const startStr of pattern.typical_start_times) {
    const startMinutes = parseTimeToMinutes(startStr)
    const endMinutes = startMinutes + pattern.typical_duration_min

    // Exit wave window extends past end time
    const waveEndMinutes = endMinutes + sensor.exit_wave.end_plus_min

    // Skip if wave already passed
    if (waveEndMinutes < currentMinutes) continue

    const startTime = minutesToDate(startMinutes, now)
    const endTime = minutesToDate(endMinutes, now)

    return { startTime, endTime }
  }

  return null
}

/**
 * Calculate intensity from capacity and VTC probability
 */
function calculateIntensity(sensor: TheatreSensor): number {
  const capacity = sensor.capacity || 500
  const vtcProb = sensor.vtc_profile?.probability || 0.5

  // Normalize: 2000-cap venue at 1.0 vtc = 1.0 intensity
  const normalized = Math.min(1, (capacity * vtcProb) / 2000)

  return normalized
}

/**
 * Calculate time proximity weight for scoring
 */
function calculateTimeProximity(windowStart: Date, windowEnd: Date, now: Date): number {
  const nowMs = now.getTime()
  const startMs = windowStart.getTime()
  const endMs = windowEnd.getTime()

  if (nowMs >= startMs && nowMs <= endMs) {
    // Currently active
    return 1.2
  } else if (startMs > nowMs) {
    // Future
    const minutesAway = (startMs - nowMs) / 60000
    return Math.max(0.3, 1 - minutesAway / 120)
  }

  return 0.5
}

/**
 * Detect theatre exit waves
 */
export function detectTheatreExitWaves(
  now: Date,
  config: Partial<TheatreExitEngineConfig> = {}
): TheatreExitWaveSignal[] {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const sensors = loadTheatreSensors()
  const signals: TheatreExitWaveSignal[] = []

  const lookaheadEnd = new Date(now.getTime() + cfg.lookaheadMinutes * 60 * 1000)

  // Group by zone_hint for cluster detection
  const zoneGroups: Map<string, TheatreExitWaveSignal[]> = new Map()

  for (const sensor of sensors) {
    const showTimes = getNextShowEndTime(sensor, now)
    if (!showTimes) continue

    const { endTime } = showTimes

    // Calculate exit wave window
    const windowStart = new Date(endTime.getTime() - sensor.exit_wave.end_minus_min * 60 * 1000)
    const windowEnd = new Date(endTime.getTime() + sensor.exit_wave.end_plus_min * 60 * 1000)

    // Skip if window is entirely in the past
    if (windowEnd < now) continue

    // Skip if window starts after lookahead
    if (windowStart > lookaheadEnd) continue

    // Resolve location with fallback chain
    const resolvedLoc = resolveLocation({
      id: sensor.id,
      name: sensor.name,
      lat: sensor.lat,
      lon: sensor.lon,
      arrondissement: sensor.arrondissement,
      zone_hint: sensor.zone_hint
    })

    // Build evidence array
    const evidence: string[] = ['estimated_end_time']
    if (resolvedLoc) {
      evidence.push(...getLocationEvidence(resolvedLoc))
    }

    const intensity = calculateIntensity(sensor)
    const crowd = sensor.vtc_profile?.crowd || 'mixed'

    // Apply confidence penalty for approximate locations
    let adjustedConfidence = sensor.confidence
    if (resolvedLoc?.isApproximate) {
      adjustedConfidence = Math.max(0.1, adjustedConfidence - resolvedLoc.confidencePenalty)
    }

    const signal: TheatreExitWaveSignal = {
      type: 'exit_wave',
      id: `ew-theatre-${sensor.id}-${endTime.getHours()}${endTime.getMinutes()}`,
      zone: sensor.arrondissement,
      corridor: sensor.corridor,
      window: {
        start: windowStart.toISOString(),
        end: windowEnd.toISOString()
      },
      crowd,
      intensity,
      confidence: adjustedConfidence,
      source: 'venue_sensors',
      venues: [sensor.id],
      explanation: generateExplanation(sensor, endTime, resolvedLoc?.isApproximate),
      evidence,
      resolvedLocation: resolvedLoc ? {
        lat: resolvedLoc.lat,
        lon: resolvedLoc.lon,
        source: resolvedLoc.source,
        isApproximate: resolvedLoc.isApproximate
      } : undefined
    }

    signals.push(signal)

    // Track for cluster boost
    const zoneKey = sensor.zone_hint
    if (!zoneGroups.has(zoneKey)) {
      zoneGroups.set(zoneKey, [])
    }
    zoneGroups.get(zoneKey)!.push(signal)
  }

  // Apply cluster boost for zones with multiple theatres
  for (const [_zone, zoneSignals] of zoneGroups) {
    if (zoneSignals.length >= cfg.clusterBoostThreshold) {
      for (const signal of zoneSignals) {
        signal.confidence = Math.min(0.9, signal.confidence + cfg.clusterBoostAmount)
      }
    }
  }

  // Filter by minimum confidence
  return signals.filter(s => s.confidence >= cfg.minConfidence)
}

/**
 * Generate human-readable explanation
 */
function generateExplanation(
  sensor: TheatreSensor,
  endTime: Date,
  isApproxLocation: boolean = false
): string {
  const timeStr = endTime.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris'
  })

  const category = sensor.category === 'opera' ? 'Opera'
    : sensor.category === 'comedy' ? 'Comedie'
    : sensor.category === 'show' ? 'Spectacle'
    : sensor.category === 'concert' ? 'Concert'
    : 'Theatre'

  const crowd = sensor.vtc_profile?.crowd || 'mixed'
  const locationNote = isApproxLocation ? ' (loc. approx.)' : ''

  return `${sensor.name} ferme ${timeStr} — ${crowd}${locationNote}`
}

/**
 * Get top N theatre exit waves by score
 */
export function getTopTheatreExitWaves(
  signals: ExitWaveSignal[],
  n: number = 5,
  now: Date = new Date()
): ExitWaveSignal[] {
  return signals
    .map(signal => {
      const windowStart = new Date(signal.window.start)
      const windowEnd = new Date(signal.window.end)
      const timeProximity = calculateTimeProximity(windowStart, windowEnd, now)

      return {
        signal,
        score: signal.intensity * signal.confidence * timeProximity
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(item => item.signal)
}

/**
 * Merge theatre exit waves with other exit waves, avoiding duplicates
 */
export function mergeTheatreExitWaves(
  existingWaves: ExitWaveSignal[],
  theatreWaves: ExitWaveSignal[]
): ExitWaveSignal[] {
  const existingIds = new Set(existingWaves.map(w => w.venues?.[0]).filter(Boolean))

  // Filter out theatre waves that are already in existing waves
  const newTheatreWaves = theatreWaves.filter(tw => {
    const venueId = tw.venues?.[0]
    return !venueId || !existingIds.has(venueId)
  })

  return [...existingWaves, ...newTheatreWaves]
}
