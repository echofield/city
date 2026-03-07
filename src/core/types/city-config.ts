/**
 * FLOW Universal City Configuration
 *
 * This is the master configuration type for any city in the Flow system.
 * Each city (Paris, London, NYC, etc.) implements this interface with
 * their specific zones, venues, transport rules, and strategy weights.
 *
 * The UI consumes CityConfig to render any city without hardcoded data.
 */

import type {
  Zone,
  Corridor,
  AirportNode,
  StationNode,
  VenueNode,
  ClusterNode,
} from './nodes'

// ═══════════════════════════════════════════════════════════════════════════
// CITY CONFIG — Universal city definition
// ═══════════════════════════════════════════════════════════════════════════

export interface CityConfig {
  // ── Identity ──
  /** Unique city identifier: "paris", "london", "nyc" */
  cityId: string
  /** Display name: "Paris" */
  name: string
  /** ISO country code: "FR", "GB", "US" */
  country: string
  /** IANA timezone: "Europe/Paris" */
  timezone: string
  /** Locale for formatting: "fr-FR" */
  locale: string
  /** Currency code: "EUR", "GBP", "USD" */
  currency: string

  // ── Map Bounds ──
  center: { lat: number; lng: number }
  defaultZoom: number
  bounds: {
    north: number
    south: number
    east: number
    west: number
  }

  // ── Geographic Structure ──
  /** Zones: arrondissements, boroughs, districts */
  zones: Zone[]
  /** Corridors: directional transport axes */
  corridors: Corridor[]

  // ── Nodes (demand generators) ──
  airports: AirportNode[]
  stations: StationNode[]
  venues: VenueNode[]
  nightlifeClusters: ClusterNode[]

  // ── Transport Rules ──
  transportRules: TransportRules

  // ── Strategy Profile ──
  /** Tune signal weights per city */
  strategyProfile: StrategyProfile

  // ── Labels (i18n) ──
  labels: CityLabels
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSPORT RULES — City-specific transport timing
// ═══════════════════════════════════════════════════════════════════════════

export interface TransportRules {
  /** Metro/subway start time: "05:30" */
  metroStart: string
  /** Metro/subway end time weekdays: "00:30" */
  metroEnd: string
  /** Metro/subway end time weekends: "02:00" */
  weekendMetroEnd: string
  /** When weakness > 50 (hour 0-23) */
  weaknessThresholds: {
    /** Hour when transport becomes weak */
    strong: number
    /** Hour when transport is very weak */
    extreme: number
  }
  /** Night bus availability */
  hasNightBus: boolean
  /** Night bus routes if available */
  nightBusRoutes?: string[]
}

// ═══════════════════════════════════════════════════════════════════════════
// STRATEGY PROFILE — Signal weighting per city
// ═══════════════════════════════════════════════════════════════════════════

export interface StrategyProfile {
  /** Weight for airport signals: 0-1 */
  airportWeight: number
  /** Weight for station signals: 0-1 */
  stationWeight: number
  /** Weight for nightlife signals: 0-1 */
  nightlifeWeight: number
  /** Weight for event signals: 0-1 */
  eventWeight: number
  /** Weight for office district signals: 0-1 */
  officeWeight: number
  /** Weight for hotel district signals: 0-1 */
  hotelWeight: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CITY LABELS — i18n strings for UI
// ═══════════════════════════════════════════════════════════════════════════

export interface CityLabels {
  /** Corridor display names */
  corridors: Record<string, string>
  /** Zone type labels */
  zoneTypes: Record<string, string>
  /** Signal type labels */
  signalTypes: Record<string, string>
  /** Action labels */
  actions: Record<string, string>
  /** Ride profile labels */
  rideProfiles: Record<string, string>
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export type { Zone, Corridor, AirportNode, StationNode, VenueNode, ClusterNode }
