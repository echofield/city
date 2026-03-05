/**
 * Swarm Feedback Engine — v1.8
 *
 * Drivers become live sensors of the city.
 * Every pickup/dropoff/idle event feeds the demand heatmap.
 *
 * This is the layer that makes FLOW impossible for Uber to replicate easily.
 * More drivers → more signals → better predictions → more earnings → more drivers.
 */

import type { CorridorDirection } from '@/lib/signal-fetchers/types'
import { ZONE_ARRONDISSEMENT } from './corridor-pressure'

// ════════════════════════════════════════════════════════════════
// DRIVER EVENT TYPES
// ════════════════════════════════════════════════════════════════

export type DriverEventType = 'pickup' | 'dropoff' | 'idle' | 'moving' | 'online' | 'offline'

export interface DriverEvent {
  id: string
  driverId: string
  type: DriverEventType
  zone: string
  corridor: CorridorDirection | 'centre'
  timestamp: number // Unix ms
  /** For dropoff: where the passenger was dropped */
  destinationZone?: string
  /** Estimated fare for pickups */
  fareEstimate?: number
}

// ════════════════════════════════════════════════════════════════
// DEMAND HEAT — Computed from driver events
// ════════════════════════════════════════════════════════════════

export interface DemandHeat {
  /** Heat by zone (0-1 normalized) */
  zoneHeat: Record<string, number>
  /** Raw pickup counts (last 20 min) */
  pickupCounts: Record<string, number>
  /** Active drivers by zone */
  activeDrivers: Record<string, number>
  /** Computed at */
  computedAt: string
  /** Event count used */
  eventCount: number
}

/**
 * Compute demand heat from driver events.
 * Events older than 20 minutes decay to zero.
 *
 * This is the core swarm algorithm:
 * - Recent pickups = high demand
 * - Decay over time = adapts to changing conditions
 */
export function computeDemandHeat(events: DriverEvent[]): DemandHeat {
  const heat: Record<string, number> = {}
  const pickupCounts: Record<string, number> = {}
  const activeDrivers: Record<string, Set<string>> = {}

  const now = Date.now()
  const DECAY_WINDOW_MS = 20 * 60 * 1000 // 20 minutes

  for (const event of events) {
    const ageMs = now - event.timestamp

    // Skip events older than decay window
    if (ageMs > DECAY_WINDOW_MS) continue

    // Track active drivers
    if (!activeDrivers[event.zone]) {
      activeDrivers[event.zone] = new Set()
    }
    activeDrivers[event.zone].add(event.driverId)

    // Pickups are the primary demand signal
    if (event.type === 'pickup') {
      // Linear decay: 1.0 at t=0, 0.0 at t=20min
      const decay = 1 - (ageMs / DECAY_WINDOW_MS)

      heat[event.zone] = (heat[event.zone] || 0) + decay
      pickupCounts[event.zone] = (pickupCounts[event.zone] || 0) + 1
    }

    // Dropoffs indicate where passengers are going (destination demand)
    if (event.type === 'dropoff' && event.destinationZone) {
      const decay = 1 - (ageMs / DECAY_WINDOW_MS)
      // Destination zones get weaker signal (people leaving, not arriving)
      heat[event.destinationZone] = (heat[event.destinationZone] || 0) + decay * 0.3
    }
  }

  // Normalize heat to 0-1
  const maxHeat = Math.max(...Object.values(heat), 1)
  const normalizedHeat: Record<string, number> = {}
  for (const [zone, h] of Object.entries(heat)) {
    normalizedHeat[zone] = Math.min(1, h / maxHeat)
  }

  // Convert Sets to counts
  const driverCounts: Record<string, number> = {}
  for (const [zone, drivers] of Object.entries(activeDrivers)) {
    driverCounts[zone] = drivers.size
  }

  return {
    zoneHeat: normalizedHeat,
    pickupCounts,
    activeDrivers: driverCounts,
    computedAt: new Date().toISOString(),
    eventCount: events.filter(e => now - e.timestamp <= DECAY_WINDOW_MS).length,
  }
}

// ════════════════════════════════════════════════════════════════
// LOST MONEY RADAR — Show missed opportunities
// ════════════════════════════════════════════════════════════════

export interface LostOpportunity {
  zone: string
  arrondissement: string
  /** Heat delta (how much hotter than driver's zone) */
  heatDelta: number
  /** Estimated pickups missed */
  pickupsEstimate: number
  /** Estimated EUR missed */
  revenueEstimate: { low: number; high: number }
  /** Distance in minutes */
  distanceMin: number
  /** Why this zone is hot */
  reason: string
}

/**
 * Compute lost opportunities for a driver.
 * Shows what they're missing by being in their current zone.
 *
 * This is psychologically powerful:
 * "You missed ~80€ by not being in République"
 */
export function computeLostOpportunities(
  driverZone: string,
  combinedHeat: Record<string, number>,
  demandHeat: DemandHeat,
  zoneReasons: Record<string, string[]>
): LostOpportunity[] {
  const opportunities: LostOpportunity[] = []
  const driverHeat = combinedHeat[driverZone] || 0

  // Zone distance estimates (simplified)
  const ZONE_DISTANCES: Record<string, Record<string, number>> = {
    'Bastille': { 'République': 6, 'Opéra': 10, 'Gare du Nord': 8, 'Châtelet': 5 },
    'République': { 'Bastille': 6, 'Opéra': 8, 'Gare du Nord': 5, 'Châtelet': 6 },
    'Opéra': { 'Bastille': 10, 'République': 8, 'Gare du Nord': 7, 'Saint-Lazare': 3 },
    'Gare du Nord': { 'République': 5, 'Bastille': 8, 'Opéra': 7, 'Châtelet': 8 },
    'Châtelet': { 'Bastille': 5, 'République': 6, 'Marais': 3, 'Opéra': 6 },
  }

  const driverDistances = ZONE_DISTANCES[driverZone] || {}

  for (const [zone, heat] of Object.entries(combinedHeat)) {
    if (zone === driverZone) continue

    const delta = heat - driverHeat

    // Only show zones significantly better (>25% heat difference)
    if (delta < 0.25) continue

    // Estimate pickups from demand heat
    const pickups = demandHeat.pickupCounts[zone] || 0
    const estimatedPickups = Math.max(1, Math.round(pickups * delta * 2))

    // Revenue estimate (15-25€ per pickup average)
    const revenueLow = estimatedPickups * 15
    const revenueHigh = estimatedPickups * 25

    // Distance
    const distanceMin = driverDistances[zone] || 8

    // Reason
    const reasons = zoneReasons[zone] || []
    const reason = reasons[0] || 'Forte demande détectée'

    opportunities.push({
      zone,
      arrondissement: ZONE_ARRONDISSEMENT[zone] || '',
      heatDelta: delta,
      pickupsEstimate: estimatedPickups,
      revenueEstimate: { low: revenueLow, high: revenueHigh },
      distanceMin,
      reason,
    })
  }

  // Sort by heat delta (best opportunities first)
  opportunities.sort((a, b) => b.heatDelta - a.heatDelta)

  // Return top 2 opportunities
  return opportunities.slice(0, 2)
}

// ════════════════════════════════════════════════════════════════
// HYBRID HEATMAP — Combine corridor pressure + swarm demand
// ════════════════════════════════════════════════════════════════

/**
 * Merge corridor pressure heat with live demand heat.
 *
 * Formula:
 *   finalHeat = corridorPressure * 0.7 + demandHeat * 0.3
 *
 * When no swarm data:
 *   finalHeat = corridorPressure * 1.0
 *
 * This allows the system to work with or without driver feedback.
 */
export function computeHybridHeat(
  corridorPressureHeat: Record<string, number>,
  demandHeat: DemandHeat
): Record<string, number> {
  const hybridHeat: Record<string, number> = {}

  // If we have significant swarm data, blend it
  const hasSwarmData = demandHeat.eventCount >= 5

  const corridorWeight = hasSwarmData ? 0.7 : 1.0
  const demandWeight = hasSwarmData ? 0.3 : 0.0

  // Get all zones
  const allZones = new Set([
    ...Object.keys(corridorPressureHeat),
    ...Object.keys(demandHeat.zoneHeat),
  ])

  for (const zone of allZones) {
    const corridor = corridorPressureHeat[zone] || 0
    const demand = demandHeat.zoneHeat[zone] || 0

    hybridHeat[zone] = corridor * corridorWeight + demand * demandWeight
  }

  return hybridHeat
}

// ════════════════════════════════════════════════════════════════
// METRO CLOSING SIGNAL — Huge demand multiplier
// ════════════════════════════════════════════════════════════════

export interface MetroClosingSignal {
  /** Is metro currently closed? */
  isClosed: boolean
  /** Minutes until metro closes (null if already closed or >60 min) */
  minutesUntilClose: number | null
  /** Demand multiplier to apply */
  demandMultiplier: number
  /** Human message */
  message: string
}

/**
 * Compute metro closing signal.
 *
 * Paris Metro closing times:
 * - Sunday-Thursday: ~01:15 (last departure)
 * - Friday-Saturday: ~02:15 (last departure)
 *
 * Effect:
 * - 30 min before: +20% demand
 * - 15 min before: +40% demand
 * - After closing: +60% demand (peak)
 * - 1h after closing: +30% demand
 * - 2h+ after: back to normal
 */
export function computeMetroClosingSignal(): MetroClosingSignal {
  const now = new Date()
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))

  const dayOfWeek = parisTime.getDay()
  const hour = parisTime.getHours()
  const minutes = parisTime.getMinutes()
  const currentMinutes = hour * 60 + minutes

  // Metro closing time in minutes from midnight
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 // Friday or Saturday
  const closingTimeMinutes = isWeekend ? 2 * 60 + 15 : 1 * 60 + 15 // 02:15 or 01:15

  // Handle cross-midnight
  let minutesUntilClose: number
  if (currentMinutes < closingTimeMinutes) {
    minutesUntilClose = closingTimeMinutes - currentMinutes
  } else if (currentMinutes > 5 * 60) {
    // After 05:00, metro is open
    return {
      isClosed: false,
      minutesUntilClose: null,
      demandMultiplier: 1.0,
      message: 'Métro en service',
    }
  } else {
    // Between closing and 05:00 = metro closed
    minutesUntilClose = 0
  }

  // Metro is open and not closing soon
  if (minutesUntilClose > 60) {
    return {
      isClosed: false,
      minutesUntilClose: null,
      demandMultiplier: 1.0,
      message: 'Métro en service',
    }
  }

  // Compute multiplier based on time to closing
  let demandMultiplier: number
  let message: string
  let isClosed = false

  if (minutesUntilClose <= 0) {
    // Metro closed
    isClosed = true
    const minutesSinceClosed = Math.abs(minutesUntilClose)

    if (minutesSinceClosed < 60) {
      demandMultiplier = 1.6 // Peak demand
      message = 'Métro fermé — demande maximale'
    } else if (minutesSinceClosed < 120) {
      demandMultiplier = 1.3
      message = 'Métro fermé — forte demande'
    } else {
      demandMultiplier = 1.1
      message = 'Métro fermé'
    }
  } else if (minutesUntilClose <= 15) {
    demandMultiplier = 1.4
    message = `Derniers métros dans ${minutesUntilClose} min — demande forte`
  } else if (minutesUntilClose <= 30) {
    demandMultiplier = 1.2
    message = `Métro ferme dans ${minutesUntilClose} min`
  } else {
    demandMultiplier = 1.1
    message = `Métro ferme dans ${minutesUntilClose} min`
  }

  return {
    isClosed,
    minutesUntilClose: minutesUntilClose > 0 ? minutesUntilClose : null,
    demandMultiplier,
    message,
  }
}

// ════════════════════════════════════════════════════════════════
// TRAIN ARRIVAL SIGNAL — Mass passenger waves
// ════════════════════════════════════════════════════════════════

export interface TrainArrival {
  id: string
  station: string
  zone: string
  corridor: CorridorDirection
  trainType: 'TGV' | 'Thalys' | 'Eurostar' | 'TER' | 'RER'
  origin: string
  arrivalTime: string // ISO
  /** Estimated passengers */
  passengers: { low: number; high: number }
  /** Exit window (arrival + buffer) */
  exitWindow: { start: string; end: string }
}

/**
 * Paris major stations and their zones
 */
export const PARIS_STATIONS: Record<string, { zone: string; corridor: CorridorDirection }> = {
  'Gare du Nord': { zone: 'Gare du Nord', corridor: 'nord' },
  "Gare de l'Est": { zone: "Gare de l'Est", corridor: 'nord' },
  'Gare de Lyon': { zone: 'Gare de Lyon', corridor: 'sud' },
  'Gare Montparnasse': { zone: 'Montparnasse', corridor: 'sud' },
  'Gare Saint-Lazare': { zone: 'Saint-Lazare', corridor: 'ouest' },
  'Gare d\'Austerlitz': { zone: 'Gare de Lyon', corridor: 'sud' },
}

/**
 * Passenger estimates by train type
 */
export const TRAIN_PASSENGERS: Record<string, { low: number; high: number }> = {
  TGV: { low: 500, high: 1200 },
  Thalys: { low: 300, high: 600 },
  Eurostar: { low: 400, high: 800 },
  TER: { low: 200, high: 500 },
  RER: { low: 1000, high: 3000 },
}

// ════════════════════════════════════════════════════════════════
// SHIFT ARC — Night economy progression
// ════════════════════════════════════════════════════════════════

export type ShiftPhase = 'calme' | 'montee' | 'pic' | 'dispersion' | 'nuit_profonde'

export interface ShiftArc {
  currentPhase: ShiftPhase
  nextPhase: ShiftPhase | null
  minutesUntilNext: number | null
  /** Where the night is moving */
  flowDirection: string
  /** Recommended positioning */
  recommendation: string
}

/**
 * Compute shift arc based on time and signals.
 *
 * Paris night economy phases:
 * - 19:00-21:00: Calme (restaurants filling)
 * - 21:00-23:00: Montée (shows ending, bars starting)
 * - 23:00-02:00: Pic (peak nightlife)
 * - 02:00-04:00: Dispersion (clubs closing)
 * - 04:00-06:00: Nuit profonde (airport runs)
 */
export function computeShiftArc(): ShiftArc {
  const now = new Date()
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const hour = parisTime.getHours()
  const minutes = parisTime.getMinutes()
  const currentMinutes = hour * 60 + minutes

  const dayOfWeek = parisTime.getDay()
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0

  // Phase boundaries (in minutes from midnight)
  const phases = isWeekend
    ? {
        calme: { start: 19 * 60, end: 22 * 60 },
        montee: { start: 22 * 60, end: 24 * 60 },
        pic: { start: 0, end: 3 * 60 },
        dispersion: { start: 3 * 60, end: 5 * 60 },
        nuit_profonde: { start: 5 * 60, end: 7 * 60 },
      }
    : {
        calme: { start: 19 * 60, end: 21 * 60 },
        montee: { start: 21 * 60, end: 23 * 60 },
        pic: { start: 23 * 60, end: 2 * 60 },
        dispersion: { start: 2 * 60, end: 4 * 60 },
        nuit_profonde: { start: 4 * 60, end: 6 * 60 },
      }

  // Normalize current time for cross-midnight comparison
  const normalizedMinutes = currentMinutes < 6 * 60 ? currentMinutes + 24 * 60 : currentMinutes

  // Determine current phase
  let currentPhase: ShiftPhase = 'calme'
  let nextPhase: ShiftPhase | null = null
  let minutesUntilNext: number | null = null

  for (const [phase, bounds] of Object.entries(phases)) {
    const normalizedStart = bounds.start < 6 * 60 ? bounds.start + 24 * 60 : bounds.start
    const normalizedEnd = bounds.end < 6 * 60 ? bounds.end + 24 * 60 : bounds.end

    if (normalizedMinutes >= normalizedStart && normalizedMinutes < normalizedEnd) {
      currentPhase = phase as ShiftPhase
      minutesUntilNext = normalizedEnd - normalizedMinutes
      break
    }
  }

  // Determine next phase
  const phaseOrder: ShiftPhase[] = ['calme', 'montee', 'pic', 'dispersion', 'nuit_profonde']
  const currentIdx = phaseOrder.indexOf(currentPhase)
  nextPhase = currentIdx < phaseOrder.length - 1 ? phaseOrder[currentIdx + 1] : null

  // Flow direction based on phase
  const flowDirections: Record<ShiftPhase, string> = {
    calme: 'restaurants → bars',
    montee: 'spectacles → centre',
    pic: 'centre → périphérie',
    dispersion: 'clubs → résidentiel',
    nuit_profonde: 'aéroports → gares',
  }

  // Recommendations
  const recommendations: Record<ShiftPhase, string> = {
    calme: 'Positionnement restaurants haut de gamme',
    montee: 'Cibler sorties spectacles + gares',
    pic: 'Rester centre — Bastille/République/Pigalle',
    dispersion: 'Se rapprocher des clubs — préparer sorties',
    nuit_profonde: 'Corridors aéroport actifs',
  }

  return {
    currentPhase,
    nextPhase,
    minutesUntilNext,
    flowDirection: flowDirections[currentPhase],
    recommendation: recommendations[currentPhase],
  }
}
