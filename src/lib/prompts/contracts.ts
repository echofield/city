/**
 * FLOW Intelligence Engine - Type Contracts
 * These define the JSON structures exchanged between components
 */

// ============================================
// CITY SIGNALS PACK (from OSINT)
// ============================================

export interface CitySignalsPack {
  context: {
    timezone: 'Europe/Paris'
    generated_at: string // ISO
    horizon: '24h' | '7d'
  }
  weather: {
    summary: string
    hourly: Array<{
      hour: string
      temp_c: number
      rain_mm: number
      wind_kmh: number
    }>
    sources: Source[]
  }
  events: Array<{
    category: 'CONCERT' | 'SPORT' | 'FESTIVAL' | 'EXHIBITION' | 'NIGHTLIFE' | 'OTHER'
    name: string
    venue: string
    area: string
    start: string
    end: string
    capacity_band: 'SMALL' | 'MED' | 'LARGE' | 'UNKNOWN'
    confidence: number
    sources: Source[]
  }>
  demonstrations: Array<{
    area_or_route: string
    window: string
    impact: 'LOW' | 'MED' | 'HIGH'
    avoid_axes: string[]
    notes: string[]
    confidence: number
    sources: Source[]
  }>
  roadworks: Array<{
    location: string
    window: string
    impact: 'LOW' | 'MED' | 'HIGH'
    notes: string[]
    sources: Source[]
  }>
  transit: Array<{
    mode: 'METRO' | 'RER' | 'BUS' | 'TRAM' | 'TRAIN'
    line_or_station: string
    window: string
    impact: 'LOW' | 'MED' | 'HIGH'
    notes: string[]
    sources: Source[]
  }>
}

export interface Source {
  url: string
  publisher: string
  ts?: string
}

// ============================================
// DRIVER PROFILE
// ============================================

export interface DriverProfile {
  user_id: string
  profile_variant: ProfileVariant
  weights: ProfileWeights
  constraints: ProfileConstraints
  created_at: string
  updated_at: string
}

export type ProfileVariant =
  | 'NIGHT_CHASER'
  | 'SAFE_STEADY'
  | 'AIRPORT_LONG'
  | 'EAST_NIGHTLIFE'
  | 'WEST_BUSINESS'
  | 'BALANCED'

export interface ProfileWeights {
  nightlife: number // 0-1
  events_big: number
  micro_events: number
  commute: number
  airport: number
  business: number
  rain_uplift: number
  friction_avoidance: number
  dead_km_penalty: number
  saturation_penalty: number
}

export interface ProfileConstraints {
  preferred_areas: string[]
  avoid_areas: string[]
  shift_window: {
    start: string // HH:MM
    end: string
  }
  traffic_tolerance: 'LOW' | 'MED' | 'HIGH'
}

// ============================================
// COMPILED BRIEF (output from FLOW-COMPILER)
// ============================================

export interface CompiledBrief {
  meta: {
    timezone: 'Europe/Paris'
    generated_at: string
    run_mode: 'daily' | 'weekly' | 'intraday_alert'
    profile_variant: ProfileVariant
    confidence_overall: number
  }
  // Time-based blocks for Now/Next/Tonight view
  now_block: NowBlock      // 0-45 min
  next_block: NextBlock    // 45-180 min
  horizon_block: HorizonBlock // 180min - 8h

  // Legacy flat structure (still used for full view)
  summary: string[] // max 6 bullets, each <= 9 words
  timeline: TimelineSlot[]
  hotspots: Hotspot[]
  alerts: Alert[]
  rules: Rule[]
  anti_clustering: {
    principle: string
    dispatch_hint: Array<{
      hotspot: string
      split_into: string[]
      reason: string
    }>
  }
  validation: {
    unknowns: string[]
    do_not_assume: string[]
  }
  feedback?: {
    last_7d_helpfulness: number
    yesterday_accuracy_estimate: number
    missed_opportunities: string[]
    false_positives: string[]
  }
}

// NOW block: 0-45 minutes - immediate actions
export interface NowBlock {
  window: '0-15min' | '15-30min' | '30-45min'
  actions: string[] // max 3, ultra-short
  zones: string[] // max 2 recommended zones
  rule: string // 1 active rule
  micro_alerts: Array<{
    type: 'surge' | 'friction' | 'weather' | 'event'
    message: string
    expires_in_min: number
  }>
  confidence: number
}

// NEXT block: 45-180 minutes - compressed timeline
export interface NextBlock {
  slots: Array<{
    window: string
    zone: string
    reason: string
    saturation: 'LOW' | 'MED' | 'HIGH'
    confidence: number
  }>
  key_transition: string // "Flux shifts from X to Y at HH:MM"
}

// HORIZON block: 180min - 8h - strategic view
export interface HorizonBlock {
  hotspots: Array<{
    zone: string
    window: string
    score: number
    why: string
  }>
  rules: string[]
  expected_peaks: string[]
}

export interface TimelineSlot {
  start: string // HH:MM
  end: string
  primary_zone: string
  reason: string
  confidence: number
  best_arrival: string
  best_exit: string
  saturation_risk: 'LOW' | 'MED' | 'HIGH'
  alternatives: string[]
  avoid_axes: string[]
}

export interface Hotspot {
  zone: string
  score: number // 0-100
  window: string
  why: string[]
  saturation_risk: 'LOW' | 'MED' | 'HIGH'
  alternatives: string[]
  pickup_notes: string[]
  signal_source?: 'Public' | 'Field' | 'Mixed' // confidence provenance
}

export interface Alert {
  type: 'WEATHER' | 'EVENT' | 'DEMONSTRATION' | 'ROADWORKS' | 'TRANSIT' | 'STRIKE' | 'OTHER'
  severity: 'LOW' | 'MED' | 'HIGH'
  window: string
  area: string
  avoid: string[]
  opportunity: string[]
  notes: string[]
}

export interface Rule {
  if: string
  then: string
}

// ============================================
// DRIVER FEEDBACK (V1 simple)
// ============================================

export interface DriverFeedback {
  id: string
  user_id: string
  brief_id: string
  rating: 1 | 0 | -1 // helped / neutral / not useful
  note?: string
  created_at: string
}

// ============================================
// BRIEF RUN METADATA
// ============================================

export interface BriefRun {
  id: string
  run_mode: 'daily' | 'weekly' | 'intraday_alert'
  horizon: '24h' | '7d'
  profiles_processed: number
  briefs_generated: number
  model: string
  tokens_used: number
  confidence_avg: number
  started_at: string
  completed_at: string
  errors: string[]
}
