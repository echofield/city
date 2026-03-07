/**
 * FLOW Signal Types — Frontend mirror of backend signal.ts
 * Used by LIVE, CARTE, SEMAINE screens
 */

export type SignalKind = 'live' | 'nearby' | 'soon' | 'week' | 'alert' | 'compound'
export type SignalType = 'event_exit' | 'transport_wave' | 'nightlife' | 'hotel_outflow' | 'restaurant' | 'office' | 'weather' | 'friction' | 'transport_disruption' | 'banlieue_pressure' | 'skeleton' | 'compound'
export type SignalIntensity = 1 | 2 | 3 | 4
export type ConfidenceLevel = 'high' | 'medium' | 'low'
export type DriverDensity = 'opportunity' | 'balanced' | 'saturated'
export type Corridor = 'nord' | 'est' | 'sud' | 'ouest' | 'centre'

export interface Signal {
  id: string
  kind: SignalKind
  type: SignalType
  title: string
  zone: string
  arrondissement?: string
  time_window: {
    start: string
    end?: string
    label?: string
  }
  reason: string
  action: string
  priority_score: number
  intensity: SignalIntensity
  confidence: ConfidenceLevel
  proximity_minutes?: number
  distance_km?: number
  direction?: Corridor
  minutes_until_start?: number
  minutes_until_end?: number
  is_active: boolean
  is_expiring: boolean
  is_forming: boolean
  zone_saturation?: number
  driver_density?: DriverDensity
  is_compound: boolean
  overlapping_factors?: string[]
  ramification_score?: number
  source: string
  raw_event_id?: string
  display_label?: string
  display_sublabel?: string
}

export interface SignalFeed {
  signals: Signal[]
  generated_at: string
  driver_position?: { lat: number; lng: number }
  total_count: number
  live_count: number
  nearby_count: number
  alert_count: number
}

export interface WeekSignal extends Signal {
  day_of_week: number
  day_label: string
  is_premium_night: boolean
  earning_potential: 'low' | 'medium' | 'high' | 'very_high'
  strategy?: string
}

export interface WeekCalendar {
  week_of: string
  best_night: {
    day: string
    reason: string
    expected_demand: 'low' | 'medium' | 'high' | 'very_high'
  } | null
  days: {
    day_of_week: number
    day_label: string
    date: string
    signals: WeekSignal[]
    is_premium: boolean
  }[]
  generated_at: string
}

export interface MapSignal extends Signal {
  lat?: number
  lng?: number
  zone_center?: { lat: number; lng: number }
}

export interface MapView {
  signals: MapSignal[]
  hot_zones: string[]
  friction_zones: string[]
  driver_position?: { lat: number; lng: number }
  generated_at: string
}
