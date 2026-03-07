/**
 * FLOW Universal Node Types
 *
 * These types define demand-generating nodes that exist in every city:
 * - Zones: Geographic areas (arrondissements, boroughs, districts)
 * - Corridors: Directional transport axes
 * - Airports: International/domestic airports
 * - Stations: Train/bus stations
 * - Venues: Event venues, theatres, stadiums
 * - Clusters: Nightlife/entertainment areas
 *
 * Each city implements these with local data.
 */

// ═══════════════════════════════════════════════════════════════════════════
// ZONE — Geographic area (arrondissement, borough, district)
// ═══════════════════════════════════════════════════════════════════════════

export interface Zone {
  /** Unique identifier: "paris_1", "westminster" */
  id: string
  /** Internal name: "1er", "Westminster" */
  name: string
  /** Display name with formatting: "1ᵉʳ arr.", "Westminster" */
  displayName: string
  /** Zone type for grouping */
  type: ZoneType
  /** Center coordinates */
  center: { lat: number; lng: number }
  /** Which corridor this zone belongs to */
  corridor: string
  /** Adjacent zone IDs */
  neighbors: string[]
  /** Driver competition density: 0-1 */
  density: number
  /** Zone characteristics */
  characteristics: ZoneCharacteristics
}

export type ZoneType =
  | 'arrondissement'  // Paris
  | 'borough'         // London
  | 'district'        // Generic
  | 'island'          // Special zones (Ile de la Cité)

export interface ZoneCharacteristics {
  /** Primary zone function */
  primary: ZoneFunction
  /** Secondary functions */
  secondary: ZoneFunction[]
  /** Is this a business district? */
  isBusinessDistrict: boolean
  /** Is this a nightlife hub? */
  isNightlifeHub: boolean
  /** Is this a tourist area? */
  isTouristArea: boolean
  /** Is this a residential area? */
  isResidential: boolean
}

export type ZoneFunction =
  | 'business'
  | 'residential'
  | 'nightlife'
  | 'tourist'
  | 'transport'
  | 'mixed'

// ═══════════════════════════════════════════════════════════════════════════
// CORRIDOR — Directional transport axis
// ═══════════════════════════════════════════════════════════════════════════

export interface Corridor {
  /** Unique identifier: "nord", "north" */
  id: string
  /** Display label: "NORD", "NORTH" */
  label: string
  /** Color for map rendering */
  color: string
  /** Description for driver context */
  description?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// AIRPORT NODE — International/domestic airport
// ═══════════════════════════════════════════════════════════════════════════

export interface AirportNode {
  /** Unique identifier: "cdg", "lhr" */
  id: string
  /** IATA code: "CDG", "LHR" */
  iata: string
  /** Full name: "Charles de Gaulle", "Heathrow" */
  name: string
  /** Which corridor this airport serves */
  corridor: string
  /** Coordinates */
  lat: number
  lng: number
  /** Terminal identifiers */
  terminals: string[]
  /** Average passengers per flight */
  avgPassengersPerFlight: number
  /** Customs processing delay in minutes */
  customsDelay: number
  /** Baggage claim delay in minutes */
  baggageDelay: number
  /** Driver positioning hint */
  positioningHint: string
  /** Expected ride profile */
  rideProfile: RideProfile
  /** Terminal-specific hints */
  terminalHints?: Record<string, string>
}

// ═══════════════════════════════════════════════════════════════════════════
// STATION NODE — Train/bus station
// ═══════════════════════════════════════════════════════════════════════════

export interface StationNode {
  /** Unique identifier: "gare_du_nord", "kings_cross" */
  id: string
  /** Display name: "Gare du Nord", "King's Cross" */
  name: string
  /** API identifier for real-time data */
  stopAreaId: string
  /** Which corridor this station serves */
  corridor: string
  /** Coordinates */
  lat: number
  lng: number
  /** Has international services (Eurostar, etc.) */
  hasInternational: boolean
  /** Has long-distance services */
  hasLongDistance: boolean
  /** Has suburban/commuter services */
  hasSuburban: boolean
  /** Driver entry/positioning hint */
  entryHint: string
  /** Expected ride profile */
  rideProfile: RideProfile
  /** Peak hours for this station */
  peakHours?: PeakHours
  /** Connected metro/subway lines */
  metroLines?: string[]
}

export interface PeakHours {
  /** Morning peak: "07:00-09:00" */
  morning: string
  /** Evening peak: "17:30-19:30" */
  evening: string
  /** Weekend peak if different */
  weekend?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// VENUE NODE — Event venues, theatres, stadiums
// ═══════════════════════════════════════════════════════════════════════════

export interface VenueNode {
  /** Unique identifier: "accor_arena", "o2_arena" */
  id: string
  /** Display name: "Accor Arena", "The O2" */
  name: string
  /** Venue type */
  type: VenueType
  /** Which zone this venue is in */
  zone: string
  /** Which corridor this venue serves */
  corridor: string
  /** Coordinates */
  lat: number
  lng: number
  /** Capacity (for demand estimation) */
  capacity?: number
  /** Typical end time rule */
  endTimeRule?: EndTimeRule
  /** Driver entry/positioning hint */
  entryHint: string
  /** Expected ride profile */
  rideProfile: RideProfile
  /** Nearby parking zones */
  parkingZones?: string[]
}

export type VenueType =
  | 'theatre'
  | 'concert'
  | 'stadium'
  | 'arena'
  | 'opera'
  | 'cinema'
  | 'conference'
  | 'exhibition'

export interface EndTimeRule {
  /** Typical show end time: "22:30" */
  typicalEnd: string
  /** Exit window in minutes */
  exitWindowMinutes: number
  /** Variation by day */
  variationByDay?: Record<string, string>
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUSTER NODE — Nightlife/entertainment areas
// ═══════════════════════════════════════════════════════════════════════════

export interface ClusterNode {
  /** Unique identifier: "pigalle", "soho" */
  id: string
  /** Display name: "Pigalle", "Soho" */
  name: string
  /** Which zone this cluster is in */
  zone: string
  /** Which corridor this cluster serves */
  corridor: string
  /** Coordinates */
  lat: number
  lng: number
  /** Bar closing hour (24h format): 2 = 02:00 */
  barCloseHour: number
  /** Club closing hour (24h format): 6 = 06:00 */
  clubCloseHour: number
  /** Venue density in this cluster: 0-1 */
  density: number
  /** Driver positioning hint */
  positioningHint: string
  /** Peak nights */
  peakNights?: string[]
  /** Club names for reference */
  clubs?: string[]
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type RideProfile =
  | 'short_fast'    // <15 min, quick turnaround
  | 'mixed'         // Variable distance
  | 'long'          // >30 min, good revenue
  | 'premium_long'  // >45 min, high-value passengers

// ═══════════════════════════════════════════════════════════════════════════
// HELPER TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** GeoJSON-style coordinate */
export interface Coordinate {
  lat: number
  lng: number
}

/** Bounding box for map rendering */
export interface BoundingBox {
  north: number
  south: number
  east: number
  west: number
}
