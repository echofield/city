/**
 * SHIFT CONDUCTOR - Engine 2
 *
 * Not "what's happening in the city" (that's Flow Compiler)
 * But "what should THIS driver do in the next 3 minutes"
 *
 * Output: Executable intent, not suggestion
 */

// ============================================
// SHIFT STATE (the current move)
// ============================================

// Field states - how the driver experiences reality
export type FieldState =
  | 'WINDOW_OPENING'   // Demand window forming
  | 'WINDOW_ACTIVE'    // High-probability pickup zone
  | 'WINDOW_CLOSING'   // Opportunity fading
  | 'FLOW_SHIFT'       // Movement to better position
  | 'HOLD_POSITION'    // Staying builds advantage
  | 'RESET'            // Calm period, reposition freely

// Energy phases - the wave the driver rides
export type EnergyPhase =
  | 'CALM'        // ⚫ Low activity
  | 'BUILDING'    // 🟢 Demand forming
  | 'RISING'      // 🟡 Tension increasing
  | 'PEAK'        // 🔴 Maximum opportunity
  | 'DISPERSION'  // 🔵 Post-peak scatter
  | 'NIGHT_DRIFT' // ⚫ Late night flow

// Legacy alias
export type ShiftState = FieldState

export interface NextMove {
  id: string
  state: FieldState
  energy: EnergyPhase

  target: {
    zone: string
    specifics?: string  // "East Exit", "Côté rue de Dunkerque"
    coordinates?: { lat: number; lng: number }
  }

  // Window timing - when reality bends
  window: {
    opens: string        // ISO - when window starts
    closes: string       // ISO - when window ends
    arrival_target: string  // ISO - optimal arrival time
  }

  // Signals that formed this decision (max 3)
  signals: string[]

  timing: {
    issued_at: string
    expiry_seconds: number
    pickup_window: {
      min_minutes: number
      max_minutes: number
    }
  }

  confidence: number       // 0-1
  confidence_label: 'HIGH' | 'MODERATE' | 'FORMING'

  // Temporal confidence message
  hold_message?: string   // "Leaving now resets queue advantage"

  alternatives?: string[]
}

// ============================================
// SHIFT HISTORY (continuity ribbon)
// ============================================

export type MoveOutcome = 'followed' | 'ignored' | 'partial'

export interface PastMove {
  id: string
  timestamp: string
  state: ShiftState
  target: string
  outcome: MoveOutcome
  result: {
    followed: boolean
    pickup_achieved: boolean
    time_to_pickup_minutes?: number
    earnings_delta?: number  // +12€ or -8€ vs expected
  }
}

export interface ShiftSession {
  session_id: string
  started_at: string
  driver_id: string

  // Live state
  current_move: NextMove | null
  position: {
    zone: string
    updated_at: string
  }

  // Continuity ribbon
  history: PastMove[]

  // Session stats
  stats: {
    moves_followed: number
    moves_ignored: number
    total_earnings: number
    flow_score: number  // 0-100, how well driver follows the rhythm
  }
}

// ============================================
// ORCHESTRATOR INPUT (what it needs)
// ============================================

export interface OrchestratorInput {
  // From Engine 1 (Flow Compiler)
  brief_id: string
  now_block: {
    zones: string[]
    rule: string
    confidence: number
  }

  // Driver state
  driver: {
    id: string
    profile_variant: string
    current_zone: string
    last_pickup_at?: string
    shift_started_at: string
  }

  // Real-time signals
  signals: {
    fleet_density: Record<string, number>  // zone -> driver count
    surge_active: string[]                  // zones with surge
    events_ending_soon: Array<{
      zone: string
      ends_in_minutes: number
      capacity: 'SMALL' | 'MED' | 'LARGE'
    }>
  }
}

// ============================================
// ORCHESTRATOR OUTPUT
// ============================================

export interface OrchestratorOutput {
  move: NextMove

  // Debug (hidden from driver, visible in operator view)
  _debug?: {
    inputs_considered: string[]
    score_breakdown: Record<string, number>
    alternatives_scored: Array<{ zone: string; score: number }>
  }
}
