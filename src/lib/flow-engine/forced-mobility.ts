/**
 * FORCED MOBILITY SYSTEM
 *
 * The core intelligence model for Flow.
 *
 * Formula:
 *   people_released × transport_weakness × time_pressure × ride_quality = forced_mobility
 *
 * This models the difference between ACTIVITY and RIDE CONVERSION.
 * A concert ending is not enough. But:
 *   people_released + weak_alternatives + urgency = real VTC demand
 *
 * Categories:
 * 1. Station Release Waves
 * 2. Airport Release Waves
 * 3. Event Exit + Transit Weakness
 * 4. Nightlife Closure Waves
 * 5. Banlieue Return Constraint Waves
 * 6. Office Release Waves
 * 7. Transport Disruption Spill Waves
 * 8. Compound Forced Mobility Waves
 */

import type { CorridorDirection } from '@/lib/signal-fetchers/types'
import type { TransportRules } from '@/core/types'

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type ForcedMobilityCategory =
  | 'station_release'
  | 'airport_release'
  | 'event_exit'
  | 'nightlife_closure'
  | 'banlieue_return_constraint'
  | 'office_release'
  | 'transport_disruption'
  | 'compound'

export type RideProfile =
  | 'short_fast'    // Many short rides, high frequency
  | 'mixed'         // Medium fare, regular demand
  | 'long'          // Long rides, good fare
  | 'premium_long'  // Very long, high-value rides

export type ConfidenceLevel = 'low' | 'medium' | 'high'

export interface ForcedMobilityWave {
  id: string
  category: ForcedMobilityCategory
  subtype: string
  zone: string
  corridor: CorridorDirection | 'centre'
  venue?: string
  wave_start: string  // ISO timestamp
  wave_end: string    // ISO timestamp

  // 4-dimension scoring (0-100 each)
  people_released_score: number
  transport_weakness_score: number
  time_pressure_score: number
  ride_quality_score: number

  // Final computed score
  final_score: number

  // Ride characteristics
  likely_ride_profile: RideProfile
  positioning_hint: string
  entry_hint?: string

  // Metadata
  confidence: ConfidenceLevel
  factors: string[]  // Contributing factors for compound signals

  // Coordinates for navigation
  lat?: number
  lng?: number
}

// ═══════════════════════════════════════════════════════════════════
// SCORING WEIGHTS
// ═══════════════════════════════════════════════════════════════════

export const SCORING_WEIGHTS = {
  people_released: 0.35,
  transport_weakness: 0.30,
  time_pressure: 0.20,
  ride_quality: 0.15,
} as const

// Compound boost: multiply by this when 2+ factors overlap
export const COMPOUND_BOOST = 1.3

// ═══════════════════════════════════════════════════════════════════
// TRANSPORT WEAKNESS COMPUTATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse time string "HH:MM" to decimal hours
 */
function parseTimeToDecimal(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours + minutes / 60
}

/**
 * Compute transport weakness using city-specific transport rules.
 * Returns 0-100 where higher = weaker public transport = better for VTC.
 */
export function computeTransportWeaknessWithRules(
  hour: number,
  minute: number,
  rules: TransportRules,
  isWeekend: boolean = false
): number {
  const timeDecimal = hour + minute / 60
  const metroStart = parseTimeToDecimal(rules.metroStart)
  const metroEnd = parseTimeToDecimal(isWeekend ? rules.weekendMetroEnd : rules.metroEnd)

  // Fully closed period (between end and start)
  if (metroEnd < metroStart) {
    // Normal case: metro ends after midnight (e.g., 00:30)
    if (timeDecimal >= metroEnd + 0.5 && timeDecimal < metroStart) {
      return 100 // No service at all
    }
  }

  // Just closed (within 30 min after close)
  const justClosedEnd = metroEnd + 0.5
  if (timeDecimal >= metroEnd && timeDecimal < justClosedEnd) {
    return 90
  }

  // Last service period (within 30 min before close)
  const lastServiceStart = metroEnd > 0.5 ? metroEnd - 0.5 : 23.5
  if (timeDecimal >= lastServiceStart && timeDecimal < metroEnd) {
    return 75
  }

  // After weakness threshold (strong)
  if (hour >= rules.weaknessThresholds.strong) {
    return 60
  }

  // One hour before strong weakness
  if (hour >= rules.weaknessThresholds.strong - 1) {
    return 35
  }

  // Two hours before strong weakness
  if (hour >= rules.weaknessThresholds.strong - 2) {
    return 20
  }

  // Early morning sparse service
  if (timeDecimal >= metroStart && timeDecimal < metroStart + 1) {
    return 40
  }

  // Full service
  return 10
}

/**
 * Compute transport weakness based on time of day.
 * Uses default Paris metro hours: ~05:30-00:30, weakens after 23:00
 * @deprecated Use computeTransportWeaknessWithRules with city config instead
 */
export function computeTransportWeakness(hour: number, minute: number = 0): number {
  const timeDecimal = hour + minute / 60

  // 01:00-05:30: No metro at all
  if (timeDecimal >= 1 && timeDecimal < 5.5) return 100

  // 00:30-01:00: Metro just closed
  if (timeDecimal >= 0.5 && timeDecimal < 1) return 90

  // 00:00-00:30: Last metros running
  if (timeDecimal >= 0 && timeDecimal < 0.5) return 75

  // 23:00-00:00: Weakening service, last metro rush
  if (timeDecimal >= 23) return 60

  // 22:00-23:00: Reduced frequency
  if (timeDecimal >= 22) return 35

  // 21:00-22:00: Still running but less frequent
  if (timeDecimal >= 21) return 20

  // 05:30-06:30: Early morning, sparse service
  if (timeDecimal >= 5.5 && timeDecimal < 6.5) return 40

  // Daytime: Full service
  return 10
}

/**
 * Additional transport weakness factors
 */
export interface TransportContext {
  isStrike?: boolean
  metroDisruption?: string[]  // Affected lines
  rerDisruption?: string[]
  isRaining?: boolean
  isWeekend?: boolean
}

export function computeTransportWeaknessWithContext(
  hour: number,
  minute: number,
  context: TransportContext
): number {
  let base = computeTransportWeakness(hour, minute)

  // Strike: major boost
  if (context.isStrike) {
    base = Math.min(100, base + 40)
  }

  // Metro disruption: significant boost
  if (context.metroDisruption && context.metroDisruption.length > 0) {
    base = Math.min(100, base + context.metroDisruption.length * 10)
  }

  // RER disruption
  if (context.rerDisruption && context.rerDisruption.length > 0) {
    base = Math.min(100, base + context.rerDisruption.length * 8)
  }

  // Rain: people avoid waiting outside for transport
  if (context.isRaining) {
    base = Math.min(100, base + 15)
  }

  // Weekend late night: slightly stronger effect
  if (context.isWeekend && hour >= 23 || hour < 5) {
    base = Math.min(100, base + 5)
  }

  return base
}

// ═══════════════════════════════════════════════════════════════════
// TIME PRESSURE COMPUTATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute time pressure - urgency to get a ride
 */
export function computeTimePressure(
  hour: number,
  isWeekend: boolean,
  isLateRelease: boolean = false
): number {
  // Late night = highest pressure (people want to get home)
  if (hour >= 23 || hour < 5) {
    return isWeekend ? 85 : 95
  }

  // Post-midnight: very high
  if (hour >= 0 && hour < 2) {
    return 90
  }

  // Evening rush (17-20): work pressure
  if (hour >= 17 && hour < 20) {
    return isWeekend ? 40 : 70
  }

  // Morning rush (7-10): commute pressure
  if (hour >= 7 && hour < 10) {
    return isWeekend ? 30 : 75
  }

  // Early morning (5-7): airport/train travelers
  if (hour >= 5 && hour < 7) {
    return 65
  }

  // Daytime: lower pressure
  return 30
}

// ═══════════════════════════════════════════════════════════════════
// RIDE QUALITY SCORING
// ═══════════════════════════════════════════════════════════════════

export interface RideQualityFactors {
  hasLuggage?: boolean
  isInternational?: boolean
  isPremiumDistrict?: boolean
  isRemoteLocation?: boolean
  averageRideDistance?: 'short' | 'medium' | 'long' | 'very_long'
  competitionLevel?: 'low' | 'medium' | 'high'
}

export function computeRideQuality(factors: RideQualityFactors): number {
  let score = 50 // baseline

  // Luggage = longer rides, easier loading
  if (factors.hasLuggage) score += 15

  // International = hotel/suburb destinations, premium
  if (factors.isInternational) score += 20

  // Premium district = higher fares
  if (factors.isPremiumDistrict) score += 10

  // Remote location = longer rides, less competition
  if (factors.isRemoteLocation) score += 15

  // Distance expectation
  switch (factors.averageRideDistance) {
    case 'very_long': score += 25; break
    case 'long': score += 15; break
    case 'medium': score += 5; break
    case 'short': score -= 5; break
  }

  // Competition level (inverse)
  switch (factors.competitionLevel) {
    case 'low': score += 15; break
    case 'medium': score += 0; break
    case 'high': score -= 10; break
  }

  return Math.max(0, Math.min(100, score))
}

// ═══════════════════════════════════════════════════════════════════
// PEOPLE RELEASED SCORING
// ═══════════════════════════════════════════════════════════════════

export function computePeopleReleasedScore(
  estimatedCount: number,
  releaseConcentration: 'instant' | 'gradual' | 'waves'
): number {
  // Base from count
  let score = 0

  if (estimatedCount >= 10000) score = 100
  else if (estimatedCount >= 5000) score = 85
  else if (estimatedCount >= 2000) score = 70
  else if (estimatedCount >= 1000) score = 55
  else if (estimatedCount >= 500) score = 40
  else if (estimatedCount >= 200) score = 30
  else if (estimatedCount >= 100) score = 20
  else score = Math.min(20, estimatedCount / 5)

  // Concentration multiplier
  switch (releaseConcentration) {
    case 'instant':
      score = Math.min(100, score * 1.2)
      break
    case 'waves':
      score = Math.min(100, score * 1.0)
      break
    case 'gradual':
      score = Math.min(100, score * 0.8)
      break
  }

  return Math.round(score)
}

// ═══════════════════════════════════════════════════════════════════
// FINAL SCORE COMPUTATION
// ═══════════════════════════════════════════════════════════════════

export function computeFinalForcedMobilityScore(
  peopleReleased: number,
  transportWeakness: number,
  timePressure: number,
  rideQuality: number,
  isCompound: boolean = false
): number {
  const weighted =
    peopleReleased * SCORING_WEIGHTS.people_released +
    transportWeakness * SCORING_WEIGHTS.transport_weakness +
    timePressure * SCORING_WEIGHTS.time_pressure +
    rideQuality * SCORING_WEIGHTS.ride_quality

  // Apply compound boost if multiple factors overlap
  const boosted = isCompound ? weighted * COMPOUND_BOOST : weighted

  return Math.round(Math.min(100, Math.max(0, boosted)))
}

// ═══════════════════════════════════════════════════════════════════
// RIDE PROFILE INFERENCE
// ═══════════════════════════════════════════════════════════════════

export function inferRideProfile(
  category: ForcedMobilityCategory,
  rideQualityScore: number,
  factors: RideQualityFactors
): RideProfile {
  // Airport and remote banlieue = premium long
  if (category === 'airport_release' || category === 'banlieue_return_constraint') {
    return rideQualityScore >= 70 ? 'premium_long' : 'long'
  }

  // Station releases with luggage/international
  if (category === 'station_release') {
    if (factors.isInternational || factors.hasLuggage) {
      return rideQualityScore >= 60 ? 'premium_long' : 'long'
    }
    return 'mixed'
  }

  // Nightlife = mostly short fast
  if (category === 'nightlife_closure') {
    return rideQualityScore >= 50 ? 'mixed' : 'short_fast'
  }

  // Events depend on venue and time
  if (category === 'event_exit') {
    return rideQualityScore >= 60 ? 'long' : 'mixed'
  }

  // Office = mixed
  if (category === 'office_release') {
    return 'mixed'
  }

  // Transport disruption = chaotic mixed
  if (category === 'transport_disruption') {
    return 'mixed'
  }

  // Compound = depends on strongest factor
  return rideQualityScore >= 70 ? 'long' : 'mixed'
}

// ═══════════════════════════════════════════════════════════════════
// WAVE BUILDERS
// ═══════════════════════════════════════════════════════════════════

export interface StationReleaseInput {
  stationId: string
  stationName: string
  zone: string
  corridor: CorridorDirection | 'centre'
  arrivalCount: number
  estimatedPassengers: number
  hasInternational: boolean
  hasDelay: boolean
  waveStart: Date
  waveEnd: Date
  entryHint: string
  lat: number
  lng: number
  transportContext?: TransportContext
}

export function buildStationReleaseWave(input: StationReleaseInput): ForcedMobilityWave {
  const hour = input.waveStart.getHours()
  const minute = input.waveStart.getMinutes()

  const peopleReleased = computePeopleReleasedScore(
    input.estimatedPassengers,
    input.hasDelay ? 'instant' : 'waves'
  )

  const transportWeakness = input.transportContext
    ? computeTransportWeaknessWithContext(hour, minute, input.transportContext)
    : computeTransportWeakness(hour, minute)

  const timePressure = computeTimePressure(hour, false, hour >= 22 || hour < 5)

  const rideQualityFactors: RideQualityFactors = {
    hasLuggage: true,
    isInternational: input.hasInternational,
    averageRideDistance: input.hasInternational ? 'long' : 'medium',
    competitionLevel: 'medium',
  }
  const rideQuality = computeRideQuality(rideQualityFactors)

  const isCompound = transportWeakness >= 60 && input.hasInternational
  const finalScore = computeFinalForcedMobilityScore(
    peopleReleased,
    transportWeakness,
    timePressure,
    rideQuality,
    isCompound
  )

  const factors: string[] = []
  if (input.hasInternational) factors.push('international')
  if (input.hasDelay) factors.push('retards')
  if (transportWeakness >= 60) factors.push('metro_faible')
  if (input.arrivalCount >= 5) factors.push('vague_concentrée')

  let subtype = 'station_release'
  if (input.hasInternational && transportWeakness >= 60) {
    subtype = 'station_international_late_release'
  } else if (input.hasInternational) {
    subtype = 'station_international_release'
  } else if (transportWeakness >= 60) {
    subtype = 'station_late_release'
  } else if (input.hasDelay) {
    subtype = 'station_delay_release'
  }

  return {
    id: `fm-station-${input.stationId}-${Date.now()}`,
    category: isCompound ? 'compound' : 'station_release',
    subtype,
    zone: input.stationName,
    corridor: input.corridor,
    wave_start: input.waveStart.toISOString(),
    wave_end: input.waveEnd.toISOString(),
    people_released_score: peopleReleased,
    transport_weakness_score: transportWeakness,
    time_pressure_score: timePressure,
    ride_quality_score: rideQuality,
    final_score: finalScore,
    likely_ride_profile: inferRideProfile('station_release', rideQuality, rideQualityFactors),
    positioning_hint: input.entryHint,
    entry_hint: input.entryHint,
    confidence: finalScore >= 60 ? 'high' : finalScore >= 40 ? 'medium' : 'low',
    factors,
    lat: input.lat,
    lng: input.lng,
  }
}

export interface EventExitInput {
  eventId: string
  venue: string
  zone: string
  corridor: CorridorDirection | 'centre'
  estimatedAttendance: number
  exitStart: Date
  exitEnd: Date
  positioningHint: string
  lat?: number
  lng?: number
  transportContext?: TransportContext
}

export function buildEventExitWave(input: EventExitInput): ForcedMobilityWave {
  const hour = input.exitStart.getHours()
  const minute = input.exitStart.getMinutes()
  const isWeekend = input.exitStart.getDay() === 0 || input.exitStart.getDay() === 6

  const peopleReleased = computePeopleReleasedScore(
    input.estimatedAttendance,
    'instant' // Events release everyone at once
  )

  const transportWeakness = input.transportContext
    ? computeTransportWeaknessWithContext(hour, minute, input.transportContext)
    : computeTransportWeakness(hour, minute)

  const timePressure = computeTimePressure(hour, isWeekend, hour >= 22)

  const rideQualityFactors: RideQualityFactors = {
    averageRideDistance: 'medium',
    competitionLevel: 'medium',
  }
  const rideQuality = computeRideQuality(rideQualityFactors)

  const isCompound = transportWeakness >= 50 && peopleReleased >= 50
  const finalScore = computeFinalForcedMobilityScore(
    peopleReleased,
    transportWeakness,
    timePressure,
    rideQuality,
    isCompound
  )

  const factors: string[] = ['sortie_event']
  if (transportWeakness >= 50) factors.push('metro_faible')
  if (input.estimatedAttendance >= 5000) factors.push('grande_capacité')

  let subtype = 'event_exit'
  if (transportWeakness >= 60) {
    subtype = 'event_exit_forced'
  }

  return {
    id: `fm-event-${input.eventId}-${Date.now()}`,
    category: isCompound ? 'compound' : 'event_exit',
    subtype,
    zone: input.zone,
    corridor: input.corridor,
    venue: input.venue,
    wave_start: input.exitStart.toISOString(),
    wave_end: input.exitEnd.toISOString(),
    people_released_score: peopleReleased,
    transport_weakness_score: transportWeakness,
    time_pressure_score: timePressure,
    ride_quality_score: rideQuality,
    final_score: finalScore,
    likely_ride_profile: inferRideProfile('event_exit', rideQuality, rideQualityFactors),
    positioning_hint: input.positioningHint,
    confidence: finalScore >= 60 ? 'high' : finalScore >= 40 ? 'medium' : 'low',
    factors,
    lat: input.lat,
    lng: input.lng,
  }
}

export interface NightlifeClosureInput {
  districtId: string
  districtName: string
  zone: string
  corridor: CorridorDirection | 'centre'
  venueCount: number
  estimatedCapacity: number
  closureStart: Date
  closureEnd: Date
  positioningHint: string
  lat?: number
  lng?: number
}

export function buildNightlifeClosureWave(input: NightlifeClosureInput): ForcedMobilityWave {
  const hour = input.closureStart.getHours()
  const minute = input.closureStart.getMinutes()
  const isWeekend = input.closureStart.getDay() === 0 || input.closureStart.getDay() === 6

  const peopleReleased = computePeopleReleasedScore(
    input.estimatedCapacity,
    'gradual' // Nightlife releases in waves
  )

  // Nightlife closures always happen when metro is weak/closed
  const transportWeakness = computeTransportWeakness(hour, minute)

  const timePressure = computeTimePressure(hour, isWeekend, true)

  const rideQualityFactors: RideQualityFactors = {
    averageRideDistance: 'short',
    competitionLevel: 'high', // Many drivers know this pattern
  }
  const rideQuality = computeRideQuality(rideQualityFactors)

  const finalScore = computeFinalForcedMobilityScore(
    peopleReleased,
    transportWeakness,
    timePressure,
    rideQuality,
    false
  )

  const factors: string[] = ['fermeture_clubs']
  if (transportWeakness >= 80) factors.push('metro_fermé')
  if (input.venueCount >= 10) factors.push('zone_dense')

  let subtype = 'nightlife_closure'
  if (hour >= 2 && hour < 5) {
    subtype = 'club_closure_wave'
  } else {
    subtype = 'bar_closure_wave'
  }

  return {
    id: `fm-nightlife-${input.districtId}-${Date.now()}`,
    category: 'nightlife_closure',
    subtype,
    zone: input.districtName,
    corridor: input.corridor,
    wave_start: input.closureStart.toISOString(),
    wave_end: input.closureEnd.toISOString(),
    people_released_score: peopleReleased,
    transport_weakness_score: transportWeakness,
    time_pressure_score: timePressure,
    ride_quality_score: rideQuality,
    final_score: finalScore,
    likely_ride_profile: 'short_fast',
    positioning_hint: input.positioningHint,
    confidence: finalScore >= 50 ? 'high' : 'medium',
    factors,
    lat: input.lat,
    lng: input.lng,
  }
}

// ═══════════════════════════════════════════════════════════════════
// PRIORITY ORDERING
// ═══════════════════════════════════════════════════════════════════

const CATEGORY_PRIORITY: Record<ForcedMobilityCategory, number> = {
  compound: 100,
  airport_release: 90,
  station_release: 80,
  banlieue_return_constraint: 75,
  event_exit: 70,
  nightlife_closure: 60,
  transport_disruption: 55,
  office_release: 40,
}

export function sortWavesByPriority(waves: ForcedMobilityWave[]): ForcedMobilityWave[] {
  return [...waves].sort((a, b) => {
    // First by final score
    if (b.final_score !== a.final_score) {
      return b.final_score - a.final_score
    }
    // Then by category priority
    return CATEGORY_PRIORITY[b.category] - CATEGORY_PRIORITY[a.category]
  })
}

// ═══════════════════════════════════════════════════════════════════
// DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════════

export function getWaveDisplayLabel(wave: ForcedMobilityWave): string {
  if (wave.category === 'compound') {
    return 'SIGNAL COMPOSÉ'
  }

  switch (wave.category) {
    case 'station_release':
      return wave.transport_weakness_score >= 60 ? 'GARE + METRO FAIBLE' : 'VAGUE GARE'
    case 'airport_release':
      return 'ARRIVÉES AÉROPORT'
    case 'event_exit':
      return wave.transport_weakness_score >= 60 ? 'SORTIE + METRO FAIBLE' : 'SORTIE EVENT'
    case 'nightlife_closure':
      return 'FIN NUIT'
    case 'banlieue_return_constraint':
      return 'BANLIEUE — RETOUR FAIBLE'
    case 'office_release':
      return 'SORTIE BUREAUX'
    case 'transport_disruption':
      return 'PERTURBATION TRANSPORT'
    default:
      return 'SIGNAL'
  }
}

export function getWaveRideProfileLabel(profile: RideProfile): string {
  switch (profile) {
    case 'premium_long': return 'Courses longues garanties'
    case 'long': return 'Courses longues probables'
    case 'mixed': return 'Courses mixtes'
    case 'short_fast': return 'Courses courtes rapides'
  }
}
