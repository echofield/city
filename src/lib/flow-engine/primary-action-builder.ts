/**
 * Primary Action Builder
 * Builds the structured action recommendation for "instrument décisionnel"
 */

import type {
  PrimaryAction,
  ActiveFriction,
  Alternative,
  DriverPosition,
  Ramification,
  DriverContext,
  DriverCorridor,
} from '@/types/flow-state'
import type { CompiledBrief } from '@/lib/prompts/contracts'
import {
  haversineMeters,
  estimateDriveMinutes,
  getZoneCentroid,
  getCorridorsByDirection,
  bearingDegrees,
  bearingToDirection,
} from '@/lib/geo'

/** Zone name aliases for centroid lookup */
const ZONE_ALIASES: Record<string, string> = {
  'gare du nord': 'gare-nord',
  'gare de l\'est': 'gare-est',
  'gare de lyon': 'gare-lyon',
  'bercy': 'bercy',
  'accor arena': 'bercy',
  'parc des princes': 'boulogne',
  'porte de saint-cloud': 'boulogne',
  'la défense': 'defense',
  'la defense': 'defense',
  'châtelet': 'chatelet',
  'chatelet': 'chatelet',
  'nation': 'nation',
  'bastille': 'bastille',
  'république': 'republique',
  'republique': 'republique',
  'opéra': 'opera',
  'opera': 'opera',
}

/** Entry side recommendations based on zone and approach direction */
const ENTRY_SIDES: Record<string, Record<string, string>> = {
  bercy: {
    nord: 'côté Gare de Lyon',
    est: 'côté Nation',
    sud: 'côté Charenton',
    ouest: 'côté Gare de Lyon',
  },
  boulogne: {
    nord: 'côté Porte de Saint-Cloud',
    est: 'côté Auteuil',
    sud: 'côté Issy',
    ouest: 'côté Boulogne centre',
  },
  'gare-nord': {
    nord: 'côté La Chapelle',
    est: 'côté Magenta',
    sud: 'côté Gare de l\'Est',
    ouest: 'côté Barbès',
  },
  'gare-lyon': {
    nord: 'côté Bastille',
    est: 'côté Bercy',
    sud: 'côté Austerlitz',
    ouest: 'côté Quai de la Rapée',
  },
  chatelet: {
    nord: 'côté Les Halles',
    est: 'côté Hôtel de Ville',
    sud: 'côté Saint-Michel',
    ouest: 'côté Pont Neuf',
  },
  nation: {
    nord: 'côté Père Lachaise',
    est: 'côté Vincennes',
    sud: 'côté Picpus',
    ouest: 'côté Bastille',
  },
}

/**
 * Get zone centroid by name with alias support
 */
function getZoneCentroidByName(zoneName: string): { lat: number; lng: number } | null {
  const lower = zoneName.toLowerCase()
  const aliasId = ZONE_ALIASES[lower]
  if (aliasId) {
    return getZoneCentroid(aliasId)
  }
  const zoneId = lower.replace(/['\s]/g, '-').replace(/--+/g, '-')
  return getZoneCentroid(zoneId)
}

/**
 * Calculate entry side based on driver approach direction
 */
function calculateEntrySide(
  driverPos: DriverPosition,
  targetZone: string
): string {
  const centroid = getZoneCentroidByName(targetZone)
  if (!centroid) return 'entrée principale'

  // Calculate bearing from driver to target
  const bearing = bearingDegrees(driverPos.lat, driverPos.lng, centroid.lat, centroid.lng)
  const direction = bearingToDirection(bearing)

  // Get entry side for this zone and direction
  const zoneId = ZONE_ALIASES[targetZone.toLowerCase()] || targetZone.toLowerCase()
  const zoneSides = ENTRY_SIDES[zoneId]
  if (zoneSides && zoneSides[direction]) {
    return zoneSides[direction]
  }

  // Fallback based on direction
  const fallbacks: Record<string, string> = {
    nord: 'entrée nord',
    est: 'entrée est',
    sud: 'entrée sud',
    ouest: 'entrée ouest',
  }
  return fallbacks[direction] || 'entrée principale'
}

/**
 * Calculate optimal window based on event times
 */
function calculateOptimalWindow(
  brief: CompiledBrief,
  targetZone: string,
  etaMin: number
): string {
  const now = new Date()
  const currentHour = now.getHours()
  const currentMin = now.getMinutes()

  // Find relevant hotspot/peak for this zone
  const zoneNorm = targetZone.toLowerCase()
  const relevantHotspot = brief.horizon_block?.hotspots?.find(
    (h) => h.zone.toLowerCase().includes(zoneNorm) || zoneNorm.includes(h.zone.toLowerCase())
  )

  if (relevantHotspot?.window) {
    // Parse window like "20:00-23:00"
    const [start, end] = relevantHotspot.window.split('-')
    if (start && end) {
      // Recommend arrival 15-30 min before peak
      const [startH, startM] = start.split(':').map(Number)
      const arrivalH = startM >= 30 ? startH : startH - 1
      const arrivalM = startM >= 30 ? startM - 30 : startM + 30

      const arrivalTime = `${String(arrivalH).padStart(2, '0')}:${String(arrivalM).padStart(2, '0')}`
      return `${arrivalTime}–${end.trim()}`
    }
  }

  // Default: current time + ETA to +90 min
  const arrivalMin = currentMin + etaMin
  const arrivalH = currentHour + Math.floor(arrivalMin / 60)
  const arrivalM = arrivalMin % 60
  const endH = arrivalH + 1
  const endM = arrivalM + 30

  return `${String(arrivalH % 24).padStart(2, '0')}:${String(arrivalM).padStart(2, '0')}–${String(endH % 24).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
}

/**
 * Calculate opportunity score based on signals
 */
function calculateOpportunityScore(
  brief: CompiledBrief,
  targetZone: string
): number {
  let score = 50 // base

  const zoneNorm = targetZone.toLowerCase()

  // Check hotspots
  const hotspot = brief.horizon_block?.hotspots?.find(
    (h) => h.zone.toLowerCase().includes(zoneNorm)
  )
  if (hotspot) {
    score = Math.max(score, hotspot.score || 70)
  }

  // Check if it's in favored zones
  if (brief.now_block.zones?.some((z) => z.toLowerCase().includes(zoneNorm))) {
    score += 10
  }

  // Confidence factor
  score = Math.round(score * (brief.meta.confidence_overall || 0.8))

  return Math.min(100, Math.max(0, score))
}

/**
 * Calculate friction risk from ramifications
 */
function calculateFrictionRisk(
  ramifications: Ramification[],
  targetZone: string
): number {
  const zoneNorm = targetZone.toLowerCase()
  let risk = 15 // base risk

  for (const ram of ramifications) {
    const effectZone = ram.effect_zone?.toLowerCase() || ''
    if (!effectZone.includes(zoneNorm) && !zoneNorm.includes(effectZone)) continue

    switch (ram.kind) {
      case 'fleet_saturation':
        risk += 25
        break
      case 'banlieue_x_friction':
      case 'transport_disruption':
        risk += 20
        break
      case 'event_dispersion':
        risk += 10
        break
    }
  }

  return Math.min(100, Math.max(0, risk))
}

/** Paris center coordinates */
const PARIS_CENTER = { lat: 48.8566, lng: 2.3522 }

/**
 * Calculate driver's current corridor based on position relative to Paris center
 */
export function calculateDriverCorridor(driverPos: DriverPosition): DriverCorridor {
  // Calculate bearing from Paris center to driver
  const bearing = bearingDegrees(PARIS_CENTER.lat, PARIS_CENTER.lng, driverPos.lat, driverPos.lng)

  // Distance from center
  const distFromCenter = haversineMeters(PARIS_CENTER.lat, PARIS_CENTER.lng, driverPos.lat, driverPos.lng)

  // If within ~2km of center, consider "centre"
  if (distFromCenter < 2000) {
    return 'centre'
  }

  return bearingToDirection(bearing)
}

/**
 * Calculate which corridor a target zone is in
 */
function getZoneCorridor(zoneName: string): DriverCorridor {
  const centroid = getZoneCentroidByName(zoneName)
  if (!centroid) return 'centre'

  const distFromCenter = haversineMeters(PARIS_CENTER.lat, PARIS_CENTER.lng, centroid.lat, centroid.lng)
  if (distFromCenter < 2000) return 'centre'

  const bearing = bearingDegrees(PARIS_CENTER.lat, PARIS_CENTER.lng, centroid.lat, centroid.lng)
  return bearingToDirection(bearing)
}

/**
 * Calculate reposition cost score (0-100, lower is better)
 * Combines: distance, time, friction on route
 */
function calculateRepositionCost(
  driverPos: DriverPosition,
  targetZone: string,
  driverCorridor: DriverCorridor,
  frictionRisk: number
): number {
  const centroid = getZoneCentroidByName(targetZone)
  if (!centroid) return 50

  const meters = haversineMeters(driverPos.lat, driverPos.lng, centroid.lat, centroid.lng)
  const etaMin = estimateDriveMinutes(meters)

  // Base cost from distance (0-40 points)
  // 0km = 0, 5km = 20, 10km+ = 40
  const distanceCost = Math.min(40, (meters / 1000) * 4)

  // Time cost (0-30 points)
  // 0min = 0, 15min = 15, 30min+ = 30
  const timeCost = Math.min(30, etaMin)

  // Corridor penalty (0 or 15 points)
  // If driver needs to cross Paris, add penalty
  const targetCorridor = getZoneCorridor(targetZone)
  const sameCorridor = driverCorridor === targetCorridor || driverCorridor === 'centre' || targetCorridor === 'centre'
  const corridorPenalty = sameCorridor ? 0 : 15

  // Friction factor (0-15 points)
  const frictionCost = (frictionRisk / 100) * 15

  return Math.min(100, Math.round(distanceCost + timeCost + corridorPenalty + frictionCost))
}

/**
 * Calculate saturation risk delta
 * Positive = opportunity outweighs saturation (good)
 * Negative = saturation risk is high (caution)
 */
function calculateSaturationDelta(
  opportunityScore: number,
  frictionRisk: number,
  ramifications: Ramification[],
  targetZone: string
): number {
  // Get saturation from ramifications
  let saturationRisk = 30 // base

  const zoneNorm = targetZone.toLowerCase()
  for (const ram of ramifications) {
    if (ram.kind !== 'fleet_saturation') continue
    const effectZone = ram.effect_zone?.toLowerCase() || ''
    if (effectZone.includes(zoneNorm) || zoneNorm.includes(effectZone)) {
      saturationRisk += 30
    }
  }

  // Combine friction into saturation estimate
  saturationRisk = Math.min(100, saturationRisk + frictionRisk * 0.3)

  // Delta: positive means opportunity > risk
  return Math.round(opportunityScore - saturationRisk)
}

/**
 * Build driver context
 */
export function buildDriverContext(
  driverPos: DriverPosition | undefined,
  targetZone: string
): DriverContext | undefined {
  if (!driverPos) return undefined

  const driverCorridor = calculateDriverCorridor(driverPos)
  const targetCorridor = getZoneCorridor(targetZone)

  const sameCorridor = driverCorridor === targetCorridor ||
    driverCorridor === 'centre' ||
    targetCorridor === 'centre'

  let corridorHint: string | undefined
  if (sameCorridor && driverCorridor !== 'centre') {
    corridorHint = `Tu es dans le corridor ${driverCorridor.toUpperCase()}. Opportunité naturelle.`
  }

  return {
    corridor: driverCorridor,
    same_corridor: sameCorridor,
    corridor_hint: corridorHint,
  }
}

/**
 * Build PrimaryAction from brief and driver position
 */
export function buildPrimaryAction(
  brief: CompiledBrief,
  ramifications: Ramification[],
  driverPos?: DriverPosition
): PrimaryAction | null {
  // Determine target zone
  const targetZone = brief.now_block.zones?.[0] ||
    brief.horizon_block?.hotspots?.[0]?.zone ||
    'Châtelet'

  // Get centroid
  const centroid = getZoneCentroidByName(targetZone)
  if (!centroid) {
    return null
  }

  // Calculate distance and ETA
  let distance_km = 5 // default
  let eta_min = 12 // default

  if (driverPos) {
    const meters = haversineMeters(driverPos.lat, driverPos.lng, centroid.lat, centroid.lng)
    distance_km = Math.round(meters / 100) / 10
    eta_min = estimateDriveMinutes(meters)
  }

  // Calculate entry side
  const entry_side = driverPos
    ? calculateEntrySide(driverPos, targetZone)
    : 'entrée principale'

  // Calculate optimal window
  const optimal_window = calculateOptimalWindow(brief, targetZone, eta_min)

  // Calculate scores
  const opportunity_score = calculateOpportunityScore(brief, targetZone)
  const friction_risk = calculateFrictionRisk(ramifications, targetZone)

  // Calculate new metrics
  const driverCorridor = driverPos ? calculateDriverCorridor(driverPos) : 'centre'
  const reposition_cost = driverPos
    ? calculateRepositionCost(driverPos, targetZone, driverCorridor, friction_risk)
    : 50
  const saturation_risk_delta = calculateSaturationDelta(
    opportunity_score,
    friction_risk,
    ramifications,
    targetZone
  )

  // Get reason
  const hotspot = brief.horizon_block?.hotspots?.find(
    (h) => h.zone.toLowerCase().includes(targetZone.toLowerCase())
  )
  const reason = hotspot?.why || brief.now_block.rule || 'Zone active'

  // Get arrondissement
  const ZONE_TO_ARR: Record<string, string> = {
    bercy: 'XII',
    'gare-lyon': 'XII',
    nation: 'XII',
    bastille: 'XI',
    republique: 'XI',
    chatelet: 'I',
    opera: 'IX',
    'gare-nord': 'X',
    'gare-est': 'X',
    boulogne: '92',
    defense: '92',
  }
  const zoneId = ZONE_ALIASES[targetZone.toLowerCase()] || targetZone.toLowerCase()
  const arrondissement = ZONE_TO_ARR[zoneId] || ''

  return {
    zone: targetZone,
    arrondissement,
    distance_km,
    eta_min,
    entry_side,
    optimal_window,
    opportunity_score,
    friction_risk,
    reason,
    reposition_cost,
    saturation_risk_delta,
  }
}

/**
 * Build active frictions from ramifications and alerts
 */
export function buildActiveFrictions(
  brief: CompiledBrief,
  ramifications: Ramification[]
): ActiveFriction[] {
  const frictions: ActiveFriction[] = []

  // From ramifications
  for (const ram of ramifications) {
    if (ram.kind === 'transport_disruption' || ram.kind === 'banlieue_x_friction') {
      frictions.push({
        type: 'transit',
        label: ram.explanation?.slice(0, 40) || 'Perturbation',
        implication: ram.tone || 'Report VTC possible',
        corridor: ram.corridor,
      })
    }
  }

  // From alerts
  for (const alert of brief.alerts ?? []) {
    if (alert.type === 'TRANSIT' || alert.type === 'STRIKE') {
      frictions.push({
        type: 'transit',
        label: `${alert.area}: ${alert.notes?.[0] || 'Perturbation'}`,
        implication: 'Bonus VTC possible',
      })
    }
    if (alert.type === 'WEATHER') {
      frictions.push({
        type: 'weather',
        label: alert.notes?.[0] || 'Météo',
        implication: 'Demande VTC accrue',
      })
    }
  }

  return frictions.slice(0, 2) // Max 2 frictions
}

/**
 * Build alternatives from brief
 */
export function buildAlternatives(
  brief: CompiledBrief,
  primaryZone: string,
  driverPos?: DriverPosition
): Alternative[] {
  const alternatives: Alternative[] = []
  const primaryNorm = primaryZone.toLowerCase()

  // Get other zones from brief
  const otherZones = [
    ...(brief.now_block.zones?.filter((z) => z.toLowerCase() !== primaryNorm) || []),
    ...(brief.horizon_block?.hotspots
      ?.filter((h) => h.zone.toLowerCase() !== primaryNorm)
      .map((h) => h.zone) || []),
  ].slice(0, 3)

  for (const zone of otherZones) {
    const centroid = getZoneCentroidByName(zone)

    let distance_km = 4
    let eta_min = 10

    if (centroid && driverPos) {
      const meters = haversineMeters(driverPos.lat, driverPos.lng, centroid.lat, centroid.lng)
      distance_km = Math.round(meters / 100) / 10
      eta_min = estimateDriveMinutes(meters)
    }

    alternatives.push({
      zone,
      distance_km,
      eta_min,
      condition: `si saturation ${primaryZone}`,
    })
  }

  return alternatives.slice(0, 2)
}
