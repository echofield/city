/**
 * Venue Sensors — Exit Wave Detection
 *
 * Loads enriched venue data and provides venue sensor capabilities
 * for exit wave detection.
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// ── Types ──

export type CrowdLabel = 'young_metro' | 'premium' | 'mixed' | 'tourist' | 'unknown'
export type Corridor = 'nord' | 'est' | 'sud' | 'ouest' | 'centre'

export interface VenueSchedule {
  days: number[]  // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  open?: string   // "HH:MM"
  close: string   // "HH:MM"
}

export interface VtcProfile {
  probability: number        // 0-1
  crowd: CrowdLabel
  exit_duration_min: number  // Minutes for crowd to fully exit
}

export interface EnrichedVenue {
  id: string
  name: string
  zone: string
  corridor: Corridor
  lat: number
  lon: number
  capacity: number | null
  type: string
  schedule?: VenueSchedule
  vtc_profile?: VtcProfile
  confidence: number
  notes?: string
}

export interface NightlifeDistrict {
  id: string
  name: string
  centroid_lat: number
  centroid_lon: number
  arrondissements: string[]
  corridor: Corridor
  exit_waves_thu_fri_sat: string[]
  exit_waves_weekdays: string[]
  crowd_label: string
  vtc_likelihood: number
}

interface EnrichedVenuesData {
  version: string
  venues: EnrichedVenue[]
}

interface NightlifeDistrictsData {
  version: string
  districts: NightlifeDistrict[]
}

// ── Loaders ──

const DATA_DIR = join(process.cwd(), 'data')

/**
 * Load enriched venues from JSON
 */
export function loadEnrichedVenues(): EnrichedVenue[] {
  const path = join(DATA_DIR, 'venues', 'paris-venues-enriched.json')

  if (!existsSync(path)) {
    console.warn('[venue-sensors] Enriched venues file not found:', path)
    return []
  }

  try {
    const data = JSON.parse(readFileSync(path, 'utf-8')) as EnrichedVenuesData
    return data.venues || []
  } catch (err) {
    console.error('[venue-sensors] Error loading enriched venues:', err)
    return []
  }
}

/**
 * Load nightlife districts from generated JSON
 */
export function loadNightlifeDistricts(): NightlifeDistrict[] {
  const path = join(DATA_DIR, 'sensors', 'generated', 'nightlife-districts.json')

  if (!existsSync(path)) {
    console.warn('[venue-sensors] Nightlife districts file not found:', path)
    return []
  }

  try {
    const data = JSON.parse(readFileSync(path, 'utf-8')) as NightlifeDistrictsData
    return data.districts || []
  } catch (err) {
    console.error('[venue-sensors] Error loading nightlife districts:', err)
    return []
  }
}

/**
 * Filter venues that have schedule and vtc_profile data
 * These are the venues capable of generating exit wave signals
 */
export function getSensorCapableVenues(venues: EnrichedVenue[]): EnrichedVenue[] {
  return venues.filter(v => v.schedule && v.vtc_profile)
}

/**
 * Check if a venue is open on a given day
 */
export function isVenueOpenOnDay(venue: EnrichedVenue, dayOfWeek: number): boolean {
  if (!venue.schedule) return false
  return venue.schedule.days.includes(dayOfWeek)
}

/**
 * Parse time string "HH:MM" to minutes since midnight
 */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Get venue closing time as Date for a given date
 * Handles cross-midnight closing times
 */
export function getVenueCloseTime(venue: EnrichedVenue, date: Date): Date | null {
  if (!venue.schedule?.close) return null

  const closeMinutes = parseTimeToMinutes(venue.schedule.close)
  const result = new Date(date)

  // If close time is before 12:00, it's the next day (cross-midnight)
  if (closeMinutes < 12 * 60) {
    result.setDate(result.getDate() + 1)
  }

  result.setHours(Math.floor(closeMinutes / 60), closeMinutes % 60, 0, 0)
  return result
}

/**
 * Calculate haversine distance between two points in meters
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Map zone to arrondissement number (for corridor mapping)
 */
export function zoneToArrondissement(zone: string): string | null {
  // Roman numerals
  const romanToNum: Record<string, string> = {
    I: '1', II: '2', III: '3', IV: '4', V: '5',
    VI: '6', VII: '7', VIII: '8', IX: '9', X: '10',
    XI: '11', XII: '12', XIII: '13', XIV: '14', XV: '15',
    XVI: '16', XVII: '17', XVIII: '18', XIX: '19', XX: '20'
  }

  // Direct number match
  if (/^\d+$/.test(zone)) return zone

  // Roman numeral
  if (romanToNum[zone]) return romanToNum[zone]

  // Banlieue zones
  return null
}
