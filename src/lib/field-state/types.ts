// ============================================
// FIELD STATE CONTRACT
// ============================================
// The map renders this object. Nothing else.
// Every visual element maps to a field property.
// No decorative animation — motion encodes information.
//
// ARCHÉ → FLOW reinterpretation:
// - Territory presence → Opportunity density
// - Aura → Pickup probability tension
// - Echo → Residual demand memory
// - Breathing → Market rhythm (volatility)
// ============================================

// ── Zone Phase ──
// Describes where a zone is in the opportunity lifecycle
export type ZonePhase =
  | 'dormant'    // No signal, minimal visibility
  | 'forming'    // Signal emerging, probability rising
  | 'active'     // Window open, high probability
  | 'peak'       // Maximum intensity
  | 'fading'     // Window closing, probability falling
  | 'echo'       // Residual memory, low probability

// ── Zone State ──
// The state of a single zone in the field
export interface ZoneState {
  id: string

  // Opportunity density (0-1)
  // Maps to: glow intensity
  intensity: number

  // How fast this zone is changing (0-1)
  // 0 = stable, 1 = volatile
  // Maps to: breath speed of this zone
  volatility: number

  // Current phase in opportunity lifecycle
  // Maps to: color tint, animation style
  phase: ZonePhase

  // Residual memory from recent activity (0-1)
  // Maps to: ghost glow, faded presence
  echo: number

  // How confident we are in this reading (0-1)
  // Low confidence = visual noise/flicker
  // Maps to: edge sharpness, stability
  confidence: number

  // Time until phase transition (minutes, null if unknown)
  // Maps to: urgency indicator
  phaseTransitionIn: number | null
}

// ── Corridor State ──
// Directional flow between zones
export interface CorridorState {
  from: string
  to: string

  // Flow strength (0-1)
  // Maps to: line opacity, thickness
  strength: number

  // Direction bias (-1 to 1)
  // -1 = flow toward 'from', +1 = flow toward 'to', 0 = bidirectional
  // Maps to: animated dash direction
  direction: number

  // Is this corridor currently recommended?
  // Maps to: signal color vs ghost color
  recommended: boolean
}

// ── Field Rhythm ──
// Global temporal state of the field
export interface FieldRhythm {
  // Global breath speed (seconds per cycle)
  // Low = volatile market, High = calm market
  // Range: 0.5 (frantic) to 4 (calm)
  breathCycle: number

  // Current phase in the breath (0-1)
  // Syncs all zones to same rhythm
  breathPhase: number

  // Overall market energy
  // Maps to: background subtle pulse
  energy: 'dormant' | 'waking' | 'active' | 'peak' | 'dispersing'
}

// ── Field Readability ──
// How "clear" the field is to the driver
// Used for progressive reveal in onboarding
export interface FieldReadability {
  // Overall readability (0-1)
  // 0 = city dark, 1 = full clarity
  // Maps to: global opacity multiplier
  level: number

  // Which layers are visible
  zones: boolean
  corridors: boolean
  rhythm: boolean
  labels: boolean

  // Which zone categories are illuminated
  illuminated: {
    nightlife: boolean
    business: boolean
    transit: boolean
    event: boolean
  }
}

// ── Complete Field State ──
// The single source of truth for the map
export interface FieldState {
  // Individual zone states
  zones: Map<string, ZoneState>

  // Flow corridors between zones
  corridors: CorridorState[]

  // Global rhythm
  rhythm: FieldRhythm

  // Readability state (for progressive reveal)
  readability: FieldReadability

  // Timestamp of this state
  timestamp: number

  // Driver context (affects how field is interpreted)
  driverContext: {
    currentZone: string | null
    selectedZones: string[]  // Familiar zones
    movementStyle: 'patient' | 'active' | 'balanced' | null
    shiftPreference: 'day' | 'evening' | 'night' | null
  }
}

// ============================================
// FACTORY FUNCTIONS
// ============================================

export function createEmptyZoneState(id: string): ZoneState {
  return {
    id,
    intensity: 0,
    volatility: 0,
    phase: 'dormant',
    echo: 0,
    confidence: 0,
    phaseTransitionIn: null,
  }
}

export function createInitialFieldState(): FieldState {
  return {
    zones: new Map(),
    corridors: [],
    rhythm: {
      breathCycle: 3, // Calm default
      breathPhase: 0,
      energy: 'dormant',
    },
    readability: {
      level: 0, // Start dark
      zones: false,
      corridors: false,
      rhythm: false,
      labels: false,
      illuminated: {
        nightlife: false,
        business: false,
        transit: false,
        event: false,
      },
    },
    timestamp: Date.now(),
    driverContext: {
      currentZone: null,
      selectedZones: [],
      movementStyle: null,
      shiftPreference: null,
    },
  }
}

// ============================================
// VISUAL MAPPING RULES
// ============================================
// These rules define how FieldState maps to visuals.
// The map component ONLY reads these mappings.
//
// Zone intensity → Glow brightness (0-1 linear)
// Zone volatility → Zone-specific breath speed override
// Zone phase → Color palette selection:
//   - dormant: ghost gray
//   - forming: intent amber
//   - active: signal green
//   - peak: bright signal
//   - fading: muted signal
//   - echo: faded ghost
// Zone confidence → Edge blur (low = fuzzy, high = sharp)
// Zone echo → Secondary ghost layer opacity
//
// Corridor strength → Line opacity + thickness
// Corridor direction → Dash animation direction
// Corridor recommended → Signal vs ghost color
//
// Rhythm breathCycle → Global animation timing
// Rhythm energy → Background pulse intensity
//
// Readability level → Global opacity multiplier
// Readability.zones → Zone visibility
// Readability.corridors → Corridor visibility
// ============================================
