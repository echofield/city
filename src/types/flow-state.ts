/**
 * FLOW API CONTRACT — FlowState
 *
 * This type is the exact shape returned by GET /api/flow/state.
 * Frontend must consume it as-is. Do not change without frontend coordination.
 */

/** Driver GPS position for proximity calculations */
export interface DriverPosition {
  lat: number
  lng: number
}

export type ShiftPhase =
  | "calme"
  | "montee"
  | "pic"
  | "dispersion";

export type WindowState =
  | "forming"
  | "active"
  | "closing"
  | "stable";

export type ActionType =
  | "hold"
  | "prepare"
  | "move"
  | "rest";

export type ZoneStateApi = "cold" | "warm" | "hot" | "blocked";

export interface FlowState {
  windowState: WindowState;
  windowLabel: string;

  /** Seconds until window closes; frontend formats as MM:SS */
  windowCountdownSec: number;
  /** Formatted countdown string MM:SS */
  windowCountdown: string;
  windowMinutes: number;

  shiftPhase: ShiftPhase;
  shiftProgress: number;

  action: ActionType;
  actionLabel: string;

  confidence: number;

  fieldMessage: string;
  temporalMessage: string;

  targetZone: string;
  targetZoneArr: string;

  favoredCorridor: string;
  favoredZoneIds: string[];
  alternatives: string[];

  zoneHeat: Record<string, number>;
  zoneSaturation: Record<string, number>;
  /** Zone states keyed by territory id */
  zoneState: Record<string, ZoneStateApi>;
  /** Alias for zoneState (frontend compatibility) */
  zoneStates: Record<string, ZoneStateApi>;

  earningsEstimate: [number, number];
  sessionEarnings: number;

  signals: {
    text: string;
    type: "event" | "weather" | "transport" | "surge";
  }[];

  upcoming: {
    time: string;
    zone: string;
    saturation: number;
    earnings: number;
    /** Distance from driver in km (if position provided) */
    distance_km?: number;
    /** ETA in minutes (if position provided) */
    eta_min?: number;
  }[];

  peaks: {
    time: string;
    zone: string;
    reason: string;
    score: number;
    /** Distance from driver in km (if position provided) */
    distance_km?: number;
    /** ETA in minutes (if position provided) */
    eta_min?: number;
  }[];

  /** Driver position used for distance calculations (echo back) */
  driverPosition?: DriverPosition;

  /** API contract version; future-proof and debug */
  version?: number;
  /** ISO timestamp when this state was generated */
  generatedAt?: string;

  /** Day templates derived from daily pack (Matin/Midi/Soir/Nuit) */
  templates?: DayTemplate[];

  /** Ramifications: effects propagating from current signals */
  ramifications?: Ramification[];

  /** Weekly skeleton: predicted windows for the current week */
  weeklySkeleton?: WeeklySkeleton | null;

  /** Primary action recommendation (structured for "instrument décisionnel") */
  primaryAction?: PrimaryAction;

  /** Active frictions affecting operations */
  activeFrictions?: ActiveFriction[];

  /** Alternative zones if primary is saturated */
  alternativeActions?: Alternative[];

  /** Driver context based on current position */
  driverContext?: DriverContext;
}

/** Confidence level as enum string (not numeric) */
export type ConfidenceLevel = "high" | "medium" | "low";

/** Ramification kind including banlieue variants */
export type RamificationKind =
  | "banlieue_pressure"
  | "banlieue_x_friction"
  | "surge_momentum"
  | "fleet_saturation"
  | "event_dispersion"
  | "transport_disruption"
  | "weather_shift";

export interface Ramification {
  id: string;
  kind: RamificationKind;
  effect_zone: string;
  explanation: string;
  confidence: ConfidenceLevel;
  /** Optional fields for detailed ramifications */
  zone?: string;
  score?: number;
  window?: string;
  causes?: string[];
  pressure_zone?: string;
  resistance_zone?: string;
  corridor?: string;
  window_start?: string;
  window_end?: string;
  regime?: string;
  status?: string;
  tone?: string;
}

export interface SkeletonWindow {
  id: string;
  label: string;
  day_of_week: number;
  window_start: string;
  window_end: string;
  signal_type: string;
  why: string;
  confidence: ConfidenceLevel;
  zones?: string[];
  expected_intensity?: number;
}

export interface WeeklySkeleton {
  territory: string;
  week_of: string;
  generated_at: string;
  skeleton_windows: SkeletonWindow[];
}

export type DayTemplateWindow = "morning" | "midday" | "evening" | "night";

export interface DayTemplate {
  id: string;
  title: string;
  window: DayTemplateWindow;
  description: string;
  fuelBand: string;
  movement: number;
  stress: number;
  potential: number;
  suggestedZones: string[];
  reasons: string[];
}

// ════════════════════════════════════════════════════════════════
// PRIMARY ACTION — Structured recommendation for "instrument décisionnel"
// ════════════════════════════════════════════════════════════════

export interface PrimaryAction {
  zone: string;
  arrondissement: string;
  distance_km: number;
  eta_min: number;
  /** Entry side recommendation */
  entry_side: string;
  /** Optimal window for arrival */
  optimal_window: string;
  /** Opportunity score 0-100 */
  opportunity_score: number;
  /** Friction risk 0-100 */
  friction_risk: number;
  /** Why this zone is recommended */
  reason: string;
  /** Cost to reposition (time + friction) 0-100, lower is better */
  reposition_cost: number;
  /** Delta between opportunity and saturation risk */
  saturation_risk_delta: number;
}

/** Driver's current corridor based on position relative to Paris center */
export type DriverCorridor = "nord" | "est" | "sud" | "ouest" | "centre";

export interface DriverContext {
  /** Which corridor the driver is currently in */
  corridor: DriverCorridor;
  /** Is the recommended zone in the same corridor? */
  same_corridor: boolean;
  /** Natural opportunity message if same corridor */
  corridor_hint?: string;
}

export interface ActiveFriction {
  type: "transit" | "weather" | "saturation" | "event";
  label: string;
  implication: string;
  corridor?: string;
}

export interface Alternative {
  zone: string;
  distance_km: number;
  eta_min: number;
  condition: string;
}

// ════════════════════════════════════════════════════════════════
// DISPATCH VIEW — Strategic context (complementary to GUIDÉ)
// ════════════════════════════════════════════════════════════════

export type CorridorStatus = "fluide" | "dense" | "sature";

export interface CorridorState {
  direction: "nord" | "est" | "sud" | "ouest";
  status: CorridorStatus;
  reason?: string;
}

export interface SessionMetrics {
  /** Session duration in minutes */
  duration_min: number;
  /** Number of completed courses */
  courses_count: number;
  /** Current earnings */
  earnings: number;
  /** Target earnings for shift */
  target_earnings: number;
  /** Efficiency percentage (time in course vs total) */
  efficiency: number;
}

export interface TimelineEvent {
  time: string;
  label: string;
  zone: string;
  type: "pic" | "dispersion" | "transition" | "nuit";
}

export interface DispatchView {
  session: SessionMetrics;
  corridors: CorridorState[];
  timeline_extended: TimelineEvent[];
  /** Current phase for context */
  phase: ShiftPhase;
  /** Generated timestamp */
  generatedAt: string;
}

// ════════════════════════════════════════════════════════════════
// BANLIEUE HUBS — External pressure points (CDG, Orly, La Defense, etc.)
// ════════════════════════════════════════════════════════════════

export type BanlieueHubStatus = "dormant" | "forming" | "active";

export interface BanlieueHubState {
  id: string;
  /** Heat level 0-1 */
  heat: number;
  /** Current status */
  status: BanlieueHubStatus;
  /** Next peak time if known */
  nextPic?: string;
  /** Corridor this hub belongs to */
  corridor: "nord" | "est" | "sud" | "ouest";
}

export interface BanlieueHubsResponse {
  hubs: Record<string, BanlieueHubState>;
  generatedAt: string;
}
