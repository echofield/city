/**
 * FIELD MODEL V0.5 - State Memory + Drift Correction
 *
 * The thin layer between FLOW-COMPILER (strategic) and SHIFT-CONDUCTOR (tactical).
 *
 * Why this exists:
 * Cities drift constantly. Concert ends early. Rain arrives late. Police reroute exits.
 * Without Field Model, Shift-Conductor becomes brittle.
 * With it, Flow feels alive.
 *
 * Field Model ≠ brief
 * Field Model = evolving interpretation
 */

import type { FieldState, EnergyPhase, NextMove } from './contracts'
import type { CompiledBrief } from '@/lib/prompts/contracts'

// ============================================
// FIELD MODEL STATE
// ============================================

export interface FieldModelState {
  // Core state
  field_state: FieldState
  energy: EnergyPhase
  confidence: number           // 0-1, decays over time

  // Active window (if any)
  active_window: {
    zone: string
    opened_at: string          // ISO
    expected_close: string     // ISO
    saturation_score: number   // 0-100
  } | null

  // Temporal tracking
  last_update_ts: string       // ISO
  brief_id: string | null      // Source brief
  brief_generated_at: string | null

  // Drift detection
  drift_flags: DriftFlag[]
  signal_deltas: SignalDelta[] // Last 3 signal changes

  // Driver context
  driver_zone: string | null
  driver_moving_toward_target: boolean
}

export interface DriftFlag {
  type: 'SIGNAL_CHANGED' | 'WINDOW_EXPIRED' | 'SATURATION_HIGH' | 'DRIVER_FAR' | 'TIME_DECAY'
  detected_at: string
  details?: string
}

export interface SignalDelta {
  timestamp: string
  signal: string
  change: 'APPEARED' | 'DISAPPEARED' | 'INTENSIFIED' | 'WEAKENED'
}

// ============================================
// LIVE SIGNALS (real-time inputs)
// ============================================

export interface LiveSignals {
  // Zone saturation (drivers per zone)
  zone_saturation?: Record<string, number>

  // Active surge zones
  surge_zones?: string[]

  // Events status updates
  event_updates?: Array<{
    event_id: string
    status: 'ON_TIME' | 'DELAYED' | 'ENDED_EARLY' | 'ENDED'
    actual_end?: string
  }>

  // Weather updates
  weather?: {
    rain_started?: boolean
    rain_stopped?: boolean
    rain_expected_in?: number  // minutes
  }

  // Transit updates
  transit?: Array<{
    line: string
    status: 'NORMAL' | 'DISRUPTED' | 'RESTORED'
  }>

  // Timestamp
  fetched_at: string
}

// ============================================
// DRIVER CONTEXT
// ============================================

export interface DriverContext {
  id: string
  current_zone: string
  last_position_update: string
  heading_toward?: string      // Target zone if moving
  idle_since?: string          // If stationary
  last_pickup_at?: string
}

// ============================================
// CONFIDENCE DECAY
// ============================================

const CONFIDENCE_DECAY_RATE = 0.05  // Per 10 minutes
const CONFIDENCE_FLOOR = 0.3        // Minimum confidence

function calculateDecayedConfidence(
  baseConfidence: number,
  generatedAt: string,
  now: Date
): number {
  const elapsedMinutes = (now.getTime() - new Date(generatedAt).getTime()) / (1000 * 60)
  const decayPeriods = Math.floor(elapsedMinutes / 10)
  const decayed = baseConfidence - (decayPeriods * CONFIDENCE_DECAY_RATE)
  return Math.max(CONFIDENCE_FLOOR, decayed)
}

// ============================================
// DRIFT DETECTION
// ============================================

function detectDrift(
  currentState: FieldModelState,
  liveSignals: LiveSignals,
  driverContext: DriverContext,
  now: Date
): DriftFlag[] {
  const flags: DriftFlag[] = []
  const nowIso = now.toISOString()

  // Check window expiration
  if (currentState.active_window) {
    const closeTime = new Date(currentState.active_window.expected_close)
    if (now > closeTime) {
      flags.push({
        type: 'WINDOW_EXPIRED',
        detected_at: nowIso,
        details: `Window ${currentState.active_window.zone} closed`
      })
    }
  }

  // Check saturation
  if (currentState.active_window && liveSignals.zone_saturation) {
    const saturation = liveSignals.zone_saturation[currentState.active_window.zone]
    if (saturation && saturation > 70) {
      flags.push({
        type: 'SATURATION_HIGH',
        detected_at: nowIso,
        details: `${currentState.active_window.zone} saturation ${saturation}%`
      })
    }
  }

  // Check if driver is far from target
  if (currentState.active_window && driverContext.current_zone) {
    if (driverContext.current_zone !== currentState.active_window.zone) {
      // In production: use distance calculation
      // For now: just flag if zones don't match and driver is idle
      if (driverContext.idle_since) {
        const idleMinutes = (now.getTime() - new Date(driverContext.idle_since).getTime()) / (1000 * 60)
        if (idleMinutes > 5) {
          flags.push({
            type: 'DRIVER_FAR',
            detected_at: nowIso,
            details: `Driver idle ${Math.round(idleMinutes)}min away from ${currentState.active_window.zone}`
          })
        }
      }
    }
  }

  // Check time decay
  if (currentState.brief_generated_at) {
    const elapsedMinutes = (now.getTime() - new Date(currentState.brief_generated_at).getTime()) / (1000 * 60)
    if (elapsedMinutes > 60) {
      flags.push({
        type: 'TIME_DECAY',
        detected_at: nowIso,
        details: `Brief is ${Math.round(elapsedMinutes)}min old`
      })
    }
  }

  // Check for signal changes
  if (liveSignals.event_updates) {
    for (const update of liveSignals.event_updates) {
      if (update.status === 'ENDED_EARLY' || update.status === 'DELAYED') {
        flags.push({
          type: 'SIGNAL_CHANGED',
          detected_at: nowIso,
          details: `Event ${update.event_id} ${update.status.toLowerCase()}`
        })
      }
    }
  }

  if (liveSignals.weather?.rain_started) {
    flags.push({
      type: 'SIGNAL_CHANGED',
      detected_at: nowIso,
      details: 'Rain started'
    })
  }

  return flags
}

// ============================================
// STATE TRANSITIONS
// ============================================

function determineFieldState(
  currentState: FieldModelState,
  liveSignals: LiveSignals,
  driftFlags: DriftFlag[],
  now: Date
): { state: FieldState; energy: EnergyPhase } {
  // If too many drift flags, go to RESET
  if (driftFlags.length >= 3) {
    return { state: 'RESET', energy: 'CALM' }
  }

  // If window expired, transition to FLOW_SHIFT or RESET
  const windowExpired = driftFlags.some(f => f.type === 'WINDOW_EXPIRED')
  if (windowExpired) {
    return { state: 'FLOW_SHIFT', energy: 'DISPERSION' }
  }

  // If saturation high, suggest FLOW_SHIFT
  const saturationHigh = driftFlags.some(f => f.type === 'SATURATION_HIGH')
  if (saturationHigh && currentState.field_state === 'WINDOW_ACTIVE') {
    return { state: 'WINDOW_CLOSING', energy: currentState.energy }
  }

  // If rain started, boost demand
  if (liveSignals.weather?.rain_started) {
    if (currentState.field_state === 'RESET' || currentState.field_state === 'HOLD_POSITION') {
      return { state: 'WINDOW_OPENING', energy: 'BUILDING' }
    }
  }

  // Default: maintain current state
  return {
    state: currentState.field_state,
    energy: currentState.energy
  }
}

// ============================================
// MAIN UPDATE FUNCTION
// ============================================

export function updateFieldModel(
  currentState: FieldModelState | null,
  compiledBrief: CompiledBrief | null,
  liveSignals: LiveSignals,
  driverContext: DriverContext
): FieldModelState {
  const now = new Date()
  const nowIso = now.toISOString()

  // Initialize from brief if no current state
  if (!currentState && compiledBrief) {
    return initializeFromBrief(compiledBrief, driverContext, now)
  }

  // If no state and no brief, return default
  if (!currentState) {
    return createDefaultState(driverContext, now)
  }

  // Detect drift
  const driftFlags = detectDrift(currentState, liveSignals, driverContext, now)

  // Determine new state
  const { state, energy } = determineFieldState(currentState, liveSignals, driftFlags, now)

  // Calculate decayed confidence
  const confidence = currentState.brief_generated_at
    ? calculateDecayedConfidence(
        currentState.confidence,
        currentState.brief_generated_at,
        now
      )
    : CONFIDENCE_FLOOR

  // Track signal deltas (keep last 3)
  const newDeltas = extractSignalDeltas(liveSignals, nowIso)
  const signalDeltas = [...newDeltas, ...currentState.signal_deltas].slice(0, 3)

  // Update active window saturation if available
  let activeWindow = currentState.active_window
  if (activeWindow && liveSignals.zone_saturation) {
    const saturation = liveSignals.zone_saturation[activeWindow.zone]
    if (saturation !== undefined) {
      activeWindow = { ...activeWindow, saturation_score: saturation }
    }
  }

  // Check if driver is moving toward target
  const movingTowardTarget = activeWindow
    ? driverContext.heading_toward === activeWindow.zone
    : false

  return {
    field_state: state,
    energy,
    confidence,
    active_window: activeWindow,
    last_update_ts: nowIso,
    brief_id: currentState.brief_id,
    brief_generated_at: currentState.brief_generated_at,
    drift_flags: driftFlags,
    signal_deltas: signalDeltas,
    driver_zone: driverContext.current_zone,
    driver_moving_toward_target: movingTowardTarget
  }
}

function initializeFromBrief(
  brief: CompiledBrief,
  driverContext: DriverContext,
  now: Date
): FieldModelState {
  const nowIso = now.toISOString()

  // Get primary zone from now_block
  const primaryZone = brief.now_block?.zones?.[0] || brief.hotspots?.[0]?.zone || null

  return {
    field_state: brief.now_block?.confidence > 0.7 ? 'WINDOW_ACTIVE' : 'WINDOW_OPENING',
    energy: 'BUILDING',
    confidence: brief.meta.confidence_overall,
    active_window: primaryZone ? {
      zone: primaryZone,
      opened_at: nowIso,
      expected_close: new Date(now.getTime() + 45 * 60 * 1000).toISOString(),
      saturation_score: 30
    } : null,
    last_update_ts: nowIso,
    brief_id: `brief-${Date.now()}`,
    brief_generated_at: brief.meta.generated_at,
    drift_flags: [],
    signal_deltas: [],
    driver_zone: driverContext.current_zone,
    driver_moving_toward_target: false
  }
}

function createDefaultState(
  driverContext: DriverContext,
  now: Date
): FieldModelState {
  return {
    field_state: 'RESET',
    energy: 'CALM',
    confidence: CONFIDENCE_FLOOR,
    active_window: null,
    last_update_ts: now.toISOString(),
    brief_id: null,
    brief_generated_at: null,
    drift_flags: [],
    signal_deltas: [],
    driver_zone: driverContext.current_zone,
    driver_moving_toward_target: false
  }
}

function extractSignalDeltas(signals: LiveSignals, timestamp: string): SignalDelta[] {
  const deltas: SignalDelta[] = []

  if (signals.weather?.rain_started) {
    deltas.push({
      timestamp,
      signal: 'rain',
      change: 'APPEARED'
    })
  }

  if (signals.weather?.rain_stopped) {
    deltas.push({
      timestamp,
      signal: 'rain',
      change: 'DISAPPEARED'
    })
  }

  if (signals.event_updates) {
    for (const update of signals.event_updates) {
      if (update.status === 'ENDED' || update.status === 'ENDED_EARLY') {
        deltas.push({
          timestamp,
          signal: `event:${update.event_id}`,
          change: 'DISAPPEARED'
        })
      }
    }
  }

  return deltas
}

// ============================================
// DECISION SUPPORT (for Shift Conductor)
// ============================================

export interface FieldModelDecision {
  should_recompute: boolean
  reason?: string
  suggested_action?: 'HOLD' | 'SHIFT' | 'WAIT'
  confidence_level: 'HIGH' | 'MODERATE' | 'LOW'
}

export function evaluateFieldModel(state: FieldModelState): FieldModelDecision {
  // High drift = recompute needed
  if (state.drift_flags.length >= 2) {
    return {
      should_recompute: true,
      reason: state.drift_flags.map(f => f.details).join(', '),
      suggested_action: 'WAIT',
      confidence_level: 'LOW'
    }
  }

  // Low confidence = uncertain
  if (state.confidence < 0.5) {
    return {
      should_recompute: true,
      reason: 'Confidence decayed',
      suggested_action: 'WAIT',
      confidence_level: 'LOW'
    }
  }

  // Active window + driver far = suggest shift
  if (state.active_window && !state.driver_moving_toward_target) {
    if (state.drift_flags.some(f => f.type === 'DRIVER_FAR')) {
      return {
        should_recompute: false,
        suggested_action: 'SHIFT',
        confidence_level: 'MODERATE'
      }
    }
  }

  // Active window + driver close = hold
  if (state.active_window && state.driver_zone === state.active_window.zone) {
    return {
      should_recompute: false,
      suggested_action: 'HOLD',
      confidence_level: state.confidence > 0.7 ? 'HIGH' : 'MODERATE'
    }
  }

  // Default
  return {
    should_recompute: false,
    confidence_level: state.confidence > 0.7 ? 'HIGH' : 'MODERATE'
  }
}

// ============================================
// MOCK FOR TESTING
// ============================================

export function createMockFieldModel(): FieldModelState {
  const now = new Date()
  return {
    field_state: 'WINDOW_ACTIVE',
    energy: 'RISING',
    confidence: 0.78,
    active_window: {
      zone: 'Gare du Nord',
      opened_at: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      expected_close: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      saturation_score: 45
    },
    last_update_ts: now.toISOString(),
    brief_id: 'brief-mock-001',
    brief_generated_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    drift_flags: [],
    signal_deltas: [
      {
        timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
        signal: 'RER B delay',
        change: 'APPEARED'
      }
    ],
    driver_zone: 'Gare de l\'Est',
    driver_moving_toward_target: true
  }
}
