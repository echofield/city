/**
 * Exit Wave Detector
 *
 * Detects exit waves from enriched venue data based on closing times
 * and crowd patterns. Produces signals for the TonightPack compiler.
 */

import {
  EnrichedVenue,
  NightlifeDistrict,
  Corridor,
  CrowdLabel,
  loadEnrichedVenues,
  loadNightlifeDistricts,
  getSensorCapableVenues,
  isVenueOpenOnDay,
  getVenueCloseTime,
  haversineDistance,
  parseTimeToMinutes
} from './venue-sensors'
import type { ExitWaveSignal } from '../signal-fetchers/types'

export type { ExitWaveSignal }

export interface ExitWaveDetectorConfig {
  lookaheadMinutes: number        // How far ahead to look for exit waves
  clusterRadiusMeters: number     // Radius for clustering nearby venues
  minIntensity: number            // Minimum intensity to generate signal
  minConfidence: number           // Minimum confidence to include
}

const DEFAULT_CONFIG: ExitWaveDetectorConfig = {
  lookaheadMinutes: 120,          // 2 hours
  clusterRadiusMeters: 500,
  minIntensity: 0.3,
  minConfidence: 0.3
}

// ── Core Detection ──

/**
 * Detect exit waves for a given timestamp
 */
export function detectExitWaves(
  now: Date,
  config: Partial<ExitWaveDetectorConfig> = {}
): ExitWaveSignal[] {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const signals: ExitWaveSignal[] = []

  // Load data
  const allVenues = loadEnrichedVenues()
  const sensorVenues = getSensorCapableVenues(allVenues)
  const districts = loadNightlifeDistricts()

  // Day of week for filtering
  const dayOfWeek = now.getDay()
  const isWeekendNight = dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6 // Thu, Fri, Sat

  // 1. Detect venue-based exit waves
  const venueSignals = detectVenueExitWaves(now, sensorVenues, dayOfWeek, cfg)
  signals.push(...venueSignals)

  // 2. Detect district cloud exit waves (Thu/Fri/Sat only)
  if (isWeekendNight) {
    const districtSignals = detectDistrictExitWaves(now, districts, dayOfWeek, cfg)
    signals.push(...districtSignals)
  }

  // Filter by minimum intensity and confidence
  return signals
    .filter(s => s.intensity >= cfg.minIntensity && s.confidence >= cfg.minConfidence)
    .sort((a, b) => b.intensity * b.confidence - a.intensity * a.confidence)
}

/**
 * Detect exit waves from individual venues
 */
function detectVenueExitWaves(
  now: Date,
  venues: EnrichedVenue[],
  dayOfWeek: number,
  config: ExitWaveDetectorConfig
): ExitWaveSignal[] {
  const signals: ExitWaveSignal[] = []
  const processed = new Set<string>()

  // Find venues closing within lookahead window
  const lookaheadEnd = new Date(now.getTime() + config.lookaheadMinutes * 60 * 1000)

  for (const venue of venues) {
    if (processed.has(venue.id)) continue
    if (!isVenueOpenOnDay(venue, dayOfWeek)) continue

    const closeTime = getVenueCloseTime(venue, now)
    if (!closeTime) continue

    // Check if closing within window
    const exitStart = new Date(closeTime.getTime() - 15 * 60 * 1000) // 15 min before close
    const exitEnd = new Date(closeTime.getTime() + (venue.vtc_profile?.exit_duration_min || 30) * 60 * 1000)

    // Skip if exit wave is entirely in the past
    if (exitEnd < now) continue

    // Skip if exit wave starts after lookahead window
    if (exitStart > lookaheadEnd) continue

    // Find nearby venues closing at similar times (cluster)
    const cluster = findVenueCluster(venue, venues, config.clusterRadiusMeters, now, dayOfWeek)
    cluster.forEach(v => processed.add(v.id))

    // Calculate intensity based on cluster
    const intensity = calculateClusterIntensity(cluster)
    const avgConfidence = cluster.reduce((sum, v) => sum + v.confidence, 0) / cluster.length

    // Determine crowd label from dominant type
    const crowdCounts: Record<CrowdLabel, number> = {
      young_metro: 0, premium: 0, mixed: 0, tourist: 0, unknown: 0
    }
    cluster.forEach(v => {
      const crowd = v.vtc_profile?.crowd || 'unknown'
      crowdCounts[crowd] += v.capacity || 500
    })
    const dominantCrowd = Object.entries(crowdCounts)
      .sort((a, b) => b[1] - a[1])[0][0] as CrowdLabel

    signals.push({
      type: 'exit_wave',
      id: `ew-venue-${venue.zone}-${closeTime.getHours()}${closeTime.getMinutes()}`,
      zone: venue.zone,
      corridor: venue.corridor,
      window: {
        start: exitStart.toISOString(),
        end: exitEnd.toISOString()
      },
      crowd: dominantCrowd,
      intensity,
      confidence: avgConfidence,
      source: 'venue_sensors',
      venues: cluster.map(v => v.id),
      explanation: generateVenueExplanation(cluster, closeTime)
    })
  }

  return signals
}

/**
 * Detect exit waves from district clouds (nightlife zones)
 */
function detectDistrictExitWaves(
  now: Date,
  districts: NightlifeDistrict[],
  dayOfWeek: number,
  config: ExitWaveDetectorConfig
): ExitWaveSignal[] {
  const signals: ExitWaveSignal[] = []
  const isWeekend = dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6

  const exitWaveStrings = isWeekend
    ? districts.map(d => ({ district: d, waves: d.exit_waves_thu_fri_sat }))
    : districts.map(d => ({ district: d, waves: d.exit_waves_weekdays }))

  const currentHour = now.getHours()
  const currentMinutes = now.getMinutes()
  const nowMinutes = currentHour * 60 + currentMinutes

  for (const { district, waves } of exitWaveStrings) {
    for (const wave of waves) {
      // Parse "HH:MM-HH:MM" format
      const [startStr, endStr] = wave.split('-')
      if (!startStr || !endStr) continue

      const startMinutes = parseTimeToMinutes(startStr)
      let endMinutes = parseTimeToMinutes(endStr)

      // Handle cross-midnight windows
      if (endMinutes < startMinutes) {
        endMinutes += 24 * 60
      }

      // Adjust now for cross-midnight comparison
      let adjustedNow = nowMinutes
      if (nowMinutes < 6 * 60) {
        adjustedNow += 24 * 60 // Treat early morning as late night
      }

      // Check if wave is active or upcoming within lookahead
      const windowStart = startMinutes < 6 * 60 ? startMinutes + 24 * 60 : startMinutes
      const windowEnd = endMinutes

      if (adjustedNow > windowEnd) continue // Wave already passed
      if (windowStart - adjustedNow > config.lookaheadMinutes) continue // Too far ahead

      // Create signal
      const startDate = new Date(now)
      const endDate = new Date(now)

      // Set times
      const startH = Math.floor(startMinutes / 60) % 24
      const startM = startMinutes % 60
      const endH = Math.floor(endMinutes / 60) % 24
      const endM = endMinutes % 60

      startDate.setHours(startH, startM, 0, 0)
      endDate.setHours(endH, endM, 0, 0)

      // Adjust for cross-midnight
      if (startMinutes < 6 * 60 && currentHour >= 18) {
        startDate.setDate(startDate.getDate() + 1)
      }
      if (endMinutes >= 24 * 60 || endMinutes < 6 * 60) {
        if (currentHour >= 18) {
          endDate.setDate(endDate.getDate() + 1)
        }
      }

      signals.push({
        type: 'exit_wave',
        id: `ew-district-${district.id}-${wave.replace(/[:-]/g, '')}`,
        zone: district.name,
        corridor: district.corridor,
        window: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        crowd: crowdLabelFromString(district.crowd_label),
        intensity: district.vtc_likelihood,
        confidence: 0.7, // District clouds have moderate confidence
        source: 'district_cloud',
        explanation: `${district.name} — sortie bars ${wave}`
      })
    }
  }

  return signals
}

// ── Helpers ──

function findVenueCluster(
  anchor: EnrichedVenue,
  venues: EnrichedVenue[],
  radiusMeters: number,
  now: Date,
  dayOfWeek: number
): EnrichedVenue[] {
  const cluster: EnrichedVenue[] = [anchor]
  const anchorClose = getVenueCloseTime(anchor, now)
  if (!anchorClose) return cluster

  for (const venue of venues) {
    if (venue.id === anchor.id) continue
    if (!isVenueOpenOnDay(venue, dayOfWeek)) continue

    const venueClose = getVenueCloseTime(venue, now)
    if (!venueClose) continue

    // Check proximity
    const distance = haversineDistance(anchor.lat, anchor.lon, venue.lat, venue.lon)
    if (distance > radiusMeters) continue

    // Check similar closing time (within 1 hour)
    const timeDiff = Math.abs(anchorClose.getTime() - venueClose.getTime())
    if (timeDiff > 60 * 60 * 1000) continue

    cluster.push(venue)
  }

  return cluster
}

function calculateClusterIntensity(cluster: EnrichedVenue[]): number {
  // Sum weighted capacity
  let totalWeight = 0
  let maxCapacity = 0

  for (const venue of cluster) {
    const capacity = venue.capacity || 500 // Default capacity
    const vtcProb = venue.vtc_profile?.probability || 0.5
    totalWeight += capacity * vtcProb
    maxCapacity = Math.max(maxCapacity, capacity)
  }

  // Normalize: single 1000-cap venue at 1.0 vtc = 0.5 intensity
  // 3 venues of 500 each at 0.8 = 0.6 intensity
  const normalized = Math.min(1, totalWeight / 2000)

  // Cluster bonus
  const clusterBonus = Math.min(0.2, (cluster.length - 1) * 0.05)

  return Math.min(1, normalized + clusterBonus)
}

function crowdLabelFromString(label: string): CrowdLabel {
  if (label.includes('premium')) return 'premium'
  if (label.includes('young') || label.includes('metro') || label.includes('student')) return 'young_metro'
  if (label.includes('tourist')) return 'tourist'
  if (label.includes('mixed') || label.includes('volume') || label.includes('bar') || label.includes('club')) return 'mixed'
  return 'unknown'
}

function generateVenueExplanation(cluster: EnrichedVenue[], closeTime: Date): string {
  const timeStr = closeTime.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris'
  })

  if (cluster.length === 1) {
    const venue = cluster[0]
    const crowd = venue.vtc_profile?.crowd || 'mixed'
    return `${venue.name} ferme ${timeStr} — ${crowd}`
  }

  const totalCapacity = cluster.reduce((sum, v) => sum + (v.capacity || 500), 0)
  const primaryVenue = cluster.reduce((a, b) => ((a.capacity || 0) > (b.capacity || 0) ? a : b))

  return `${cluster.length} lieux ~${timeStr} — ${primaryVenue.name} + ${cluster.length - 1} autres (${totalCapacity} places)`
}

/**
 * Get top N exit wave signals by score
 */
export function getTopExitWaves(
  signals: ExitWaveSignal[],
  n: number = 5,
  now: Date = new Date()
): ExitWaveSignal[] {
  const nowMs = now.getTime()

  return signals
    .map(signal => {
      const start = new Date(signal.window.start).getTime()
      const end = new Date(signal.window.end).getTime()

      // Time proximity weight: closer = higher
      let timeProximity = 1
      if (start > nowMs) {
        // Future signal
        const minutesAway = (start - nowMs) / 60000
        timeProximity = Math.max(0.3, 1 - minutesAway / 120)
      } else if (nowMs < end) {
        // Currently active
        timeProximity = 1.2
      }

      return {
        signal,
        score: signal.intensity * signal.confidence * timeProximity
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(item => item.signal)
}
