/**
 * SHIFT ORCHESTRATOR
 *
 * Generates executable moves every 60-120 seconds
 * This is the conductor - it removes micro-decision fatigue
 *
 * Driver → starts shift
 * System → conducts
 * Driver → executes physically
 */

import type {
  NextMove,
  PastMove,
  ShiftSession,
  FieldState,
  EnergyPhase,
  OrchestratorInput,
  OrchestratorOutput,
} from './contracts'
import type { FieldModelState, DriverContext } from './field-model'
import { evaluateFieldModel } from './field-model'

// ============================================
// MOCK ORCHESTRATOR (for development)
// ============================================

const PARIS_ZONES = [
  'Gare du Nord',
  'Gare de Lyon',
  'Bercy',
  'Nation',
  'Bastille',
  'République',
  'Opéra',
  'Saint-Lazare',
  'Châtelet',
  'Marais',
]

// Signals - physical, not analytical
const FIELD_SIGNALS = [
  'Sortie concert',
  'Perturbation RER',
  'Pluie détectée',
  'Fin match',
  'Fermeture restaurants',
  'Flux métro',
  'Zone saturée',
  'Surge actif',
  'Report transports',
]

// Hold messages - temporal confidence
const HOLD_MESSAGES = [
  'Partir maintenant réinitialise l\'avantage',
  'Queue position se construit',
  'Fenêtre se stabilise',
  'Rester augmente la probabilité',
  'Demande en formation',
]

function generateMoveId(): string {
  return `move-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
}

function pickRandom<T>(arr: T[], count: number = 1): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

// Determine energy phase based on time
function getCurrentEnergyPhase(): EnergyPhase {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 9) return 'BUILDING'
  if (hour >= 9 && hour < 12) return 'RISING'
  if (hour >= 12 && hour < 14) return 'PEAK'
  if (hour >= 14 && hour < 17) return 'CALM'
  if (hour >= 17 && hour < 20) return 'RISING'
  if (hour >= 20 && hour < 23) return 'PEAK'
  if (hour >= 23 || hour < 2) return 'DISPERSION'
  return 'NIGHT_DRIFT'
}

export function generateNextMove(currentZone?: string): NextMove {
  const availableZones = currentZone
    ? PARIS_ZONES.filter((z) => z !== currentZone)
    : PARIS_ZONES

  const targetZone = pickRandom(availableZones, 1)[0]
  const signals = pickRandom(FIELD_SIGNALS, 3)
  const energy = getCurrentEnergyPhase()

  // Determine field state based on energy and randomness
  const states: FieldState[] = [
    'WINDOW_OPENING',
    'WINDOW_ACTIVE',
    'HOLD_POSITION',
    'FLOW_SHIFT',
    'WINDOW_CLOSING',
  ]
  const stateWeights = energy === 'PEAK' || energy === 'RISING'
    ? [0.3, 0.35, 0.15, 0.15, 0.05]
    : [0.15, 0.2, 0.3, 0.2, 0.15]

  const rand = Math.random()
  let cumulative = 0
  let state: FieldState = 'WINDOW_ACTIVE'
  for (let i = 0; i < states.length; i++) {
    cumulative += stateWeights[i]
    if (rand < cumulative) {
      state = states[i]
      break
    }
  }

  // For HOLD state, target is current zone
  const zone = state === 'HOLD_POSITION' ? (currentZone || targetZone) : targetZone

  const now = new Date()
  const windowOpens = new Date(now.getTime() + 2 * 60000) // +2min
  const windowCloses = new Date(now.getTime() + 20 * 60000) // +20min
  const arrivalTarget = new Date(now.getTime() + 8 * 60000) // +8min

  const confidence = 0.72 + Math.random() * 0.2
  const confidenceLabel = confidence > 0.85 ? 'HIGH' : confidence > 0.7 ? 'MODERATE' : 'FORMING'

  return {
    id: generateMoveId(),
    state,
    energy,
    target: {
      zone,
      specifics: state === 'FLOW_SHIFT' ? 'Sortie Est' : undefined,
    },
    window: {
      opens: windowOpens.toISOString(),
      closes: windowCloses.toISOString(),
      arrival_target: arrivalTarget.toISOString(),
    },
    signals,
    timing: {
      issued_at: now.toISOString(),
      expiry_seconds: state === 'WINDOW_CLOSING' ? 180 : 420,
      pickup_window: {
        min_minutes: 4 + Math.floor(Math.random() * 3),
        max_minutes: 8 + Math.floor(Math.random() * 4),
      },
    },
    confidence,
    confidence_label: confidenceLabel,
    hold_message: state === 'HOLD_POSITION' || state === 'WINDOW_ACTIVE'
      ? pickRandom(HOLD_MESSAGES, 1)[0]
      : undefined,
    alternatives: pickRandom(availableZones.filter((z) => z !== zone), 2),
  }
}

// ============================================
// MOCK SHIFT SESSION
// ============================================

export function createMockSession(driverId: string): ShiftSession {
  const now = new Date()

  // Generate past moves (continuity ribbon) - shows alignment history
  const history: PastMove[] = [
    {
      id: 'past-1',
      timestamp: new Date(now.getTime() - 45 * 60000).toISOString(),
      state: 'WINDOW_ACTIVE',
      target: 'Gare du Nord',
      outcome: 'followed',
      result: {
        followed: true,
        pickup_achieved: true,
        time_to_pickup_minutes: 6,
        earnings_delta: 12,
      },
    },
    {
      id: 'past-2',
      timestamp: new Date(now.getTime() - 30 * 60000).toISOString(),
      state: 'HOLD_POSITION',
      target: 'Opéra',
      outcome: 'ignored',
      result: {
        followed: false,
        pickup_achieved: false,
        time_to_pickup_minutes: 18,
        earnings_delta: -8,
      },
    },
    {
      id: 'past-3',
      timestamp: new Date(now.getTime() - 12 * 60000).toISOString(),
      state: 'FLOW_SHIFT',
      target: 'Châtelet',
      outcome: 'followed',
      result: {
        followed: true,
        pickup_achieved: true,
        time_to_pickup_minutes: 4,
        earnings_delta: 15,
      },
    },
  ]

  return {
    session_id: `session-${Date.now()}`,
    started_at: new Date(now.getTime() - 2 * 60 * 60000).toISOString(),
    driver_id: driverId,
    current_move: generateNextMove('Châtelet'),
    position: {
      zone: 'Châtelet',
      updated_at: now.toISOString(),
    },
    history,
    stats: {
      moves_followed: 2,
      moves_ignored: 1,
      total_earnings: 89,
      flow_score: 72,
    },
  }
}

// ============================================
// ORCHESTRATOR (production version stub)
// ============================================

export function orchestrate(input: OrchestratorInput): OrchestratorOutput {
  // In production, this would:
  // 1. Score all zones based on brief + real-time signals
  // 2. Factor in driver's current position and history
  // 3. Consider fleet density to avoid saturation
  // 4. Apply driver profile weights
  // 5. Return highest-scored move

  const move = generateNextMove(input.driver.current_zone)

  return {
    move,
    _debug: {
      inputs_considered: [
        'brief_now_block',
        'driver_position',
        'fleet_density',
        'surge_zones',
      ],
      score_breakdown: {
        demand_signal: 0.35,
        saturation_penalty: -0.12,
        distance_cost: -0.08,
        profile_match: 0.15,
      },
      alternatives_scored: [
        { zone: 'Nation', score: 72 },
        { zone: 'Bastille', score: 68 },
        { zone: 'République', score: 65 },
      ],
    },
  }
}

// ============================================
// FIELD MODEL AWARE ORCHESTRATION
// ============================================

export interface FieldModelOrchestratorOutput extends OrchestratorOutput {
  field_model_decision: {
    should_recompute: boolean
    confidence_level: 'HIGH' | 'MODERATE' | 'LOW'
    drift_detected: boolean
    suggested_action?: 'HOLD' | 'SHIFT' | 'WAIT'
  }
}

/**
 * Orchestrate using Field Model state instead of raw brief
 *
 * This is the production version that:
 * 1. Reads from FieldModel (not directly from brief)
 * 2. Considers drift and confidence decay
 * 3. Adjusts moves based on real-time field state
 */
export function orchestrateWithFieldModel(
  fieldModel: FieldModelState,
  driverContext: DriverContext
): FieldModelOrchestratorOutput {
  // Evaluate field model for decision support
  const decision = evaluateFieldModel(fieldModel)

  // If drift detected or low confidence, adjust behavior
  if (decision.should_recompute || decision.confidence_level === 'LOW') {
    // Generate a more conservative move
    const move = generateNextMove(driverContext.current_zone)

    // Override to HOLD or RESET if high uncertainty
    if (decision.suggested_action === 'WAIT') {
      move.state = 'RESET'
      move.confidence = fieldModel.confidence
      move.confidence_label = 'FORMING'
      move.hold_message = 'Champ en recalibration'
    }

    return {
      move,
      field_model_decision: {
        should_recompute: decision.should_recompute,
        confidence_level: decision.confidence_level,
        drift_detected: fieldModel.drift_flags.length > 0,
        suggested_action: decision.suggested_action
      }
    }
  }

  // Use field model state to inform move generation
  const move = generateNextMove(driverContext.current_zone)

  // Apply field model state
  move.state = fieldModel.field_state
  move.energy = fieldModel.energy
  move.confidence = fieldModel.confidence

  // If active window exists, target that zone
  if (fieldModel.active_window) {
    move.target.zone = fieldModel.active_window.zone

    // Adjust confidence label based on saturation
    if (fieldModel.active_window.saturation_score > 60) {
      move.confidence_label = 'MODERATE'
      move.hold_message = 'Zone se remplit'
    }
  }

  // Apply suggested action
  if (decision.suggested_action === 'HOLD') {
    move.state = 'HOLD_POSITION'
    move.hold_message = move.hold_message || 'Position favorable'
  } else if (decision.suggested_action === 'SHIFT') {
    move.state = 'FLOW_SHIFT'
  }

  return {
    move,
    field_model_decision: {
      should_recompute: false,
      confidence_level: decision.confidence_level,
      drift_detected: fieldModel.drift_flags.length > 0,
      suggested_action: decision.suggested_action
    }
  }
}
