/**
 * Location Resolver
 *
 * Resolves venue locations with GPS fallback chain:
 * 1. Venue has lat/lon → use it
 * 2. GPS map override exists → use it
 * 3. Zone hint centroid exists → use it (approx_location)
 * 4. Arrondissement centroid exists → use it (approx_location)
 * 5. Drop the sensor (too vague)
 */

import * as fs from 'fs'
import * as path from 'path'

// ── Types ──

export interface Coordinates {
  lat: number
  lon: number
}

export interface ResolvedLocation {
  lat: number
  lon: number
  source: 'venue' | 'gps_map' | 'zone_hint' | 'arrondissement'
  isApproximate: boolean
  confidencePenalty: number  // Amount to subtract from base confidence
}

export interface GpsMapItem {
  id: string
  name: string
  lat: number
  lon: number
  confidence: number
  sources: string[]
}

export interface GpsMapData {
  version: string
  city: string
  generated_at: string
  items: GpsMapItem[]
}

export interface CentroidsData {
  version: string
  city: string
  arrondissements: Record<string, { lat: number; lon: number; name: string }>
  zone_hints: Record<string, { lat: number; lon: number }>
}

// ── Data Loading ──

let cachedCentroids: CentroidsData | null = null
let cachedGpsMap: Map<string, GpsMapItem> | null = null

function loadCentroids(): CentroidsData {
  if (cachedCentroids) return cachedCentroids

  const filePath = path.join(process.cwd(), 'data', 'reference', 'paris-centroids.json')

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    cachedCentroids = JSON.parse(raw)
    return cachedCentroids!
  } catch (error) {
    console.warn('[location-resolver] Could not load centroids:', error)
    return {
      version: 'fallback',
      city: 'Paris',
      arrondissements: {},
      zone_hints: {}
    }
  }
}

function loadGpsMap(): Map<string, GpsMapItem> {
  if (cachedGpsMap) return cachedGpsMap

  const filePath = path.join(process.cwd(), 'data', 'sensors', 'gps', 'venue-gps-map.json')

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const data: GpsMapData = JSON.parse(raw)
    cachedGpsMap = new Map(data.items.map(item => [item.id, item]))
    return cachedGpsMap
  } catch (error) {
    console.warn('[location-resolver] Could not load GPS map:', error)
    cachedGpsMap = new Map()
    return cachedGpsMap
  }
}

// ── Core Resolution ──

export interface VenueLocationInput {
  id: string
  name?: string
  lat?: number
  lon?: number
  arrondissement?: string
  zone_hint?: string
}

/**
 * Resolve location for a venue using the fallback chain
 */
export function resolveLocation(venue: VenueLocationInput): ResolvedLocation | null {
  // 1. Venue has direct lat/lon
  if (venue.lat !== undefined && venue.lon !== undefined) {
    return {
      lat: venue.lat,
      lon: venue.lon,
      source: 'venue',
      isApproximate: false,
      confidencePenalty: 0
    }
  }

  // 2. GPS map override
  const gpsMap = loadGpsMap()
  const gpsOverride = gpsMap.get(venue.id)
  if (gpsOverride) {
    return {
      lat: gpsOverride.lat,
      lon: gpsOverride.lon,
      source: 'gps_map',
      isApproximate: false,
      confidencePenalty: 0
    }
  }

  // 3. Zone hint centroid
  const centroids = loadCentroids()
  if (venue.zone_hint && centroids.zone_hints[venue.zone_hint]) {
    const centroid = centroids.zone_hints[venue.zone_hint]
    return {
      lat: centroid.lat,
      lon: centroid.lon,
      source: 'zone_hint',
      isApproximate: true,
      confidencePenalty: 0.10
    }
  }

  // 4. Arrondissement centroid
  if (venue.arrondissement && centroids.arrondissements[venue.arrondissement]) {
    const centroid = centroids.arrondissements[venue.arrondissement]
    return {
      lat: centroid.lat,
      lon: centroid.lon,
      source: 'arrondissement',
      isApproximate: true,
      confidencePenalty: 0.10
    }
  }

  // 5. Could not resolve - drop
  return null
}

/**
 * Get evidence tags for a resolved location
 */
export function getLocationEvidence(resolved: ResolvedLocation): string[] {
  const evidence: string[] = []

  if (resolved.isApproximate) {
    evidence.push('approx_location')
  }

  if (resolved.source === 'zone_hint') {
    evidence.push('zone_centroid')
  } else if (resolved.source === 'arrondissement') {
    evidence.push('arrondissement_centroid')
  }

  return evidence
}

/**
 * Build a cluster key from coordinates (for grouping nearby venues)
 * Uses 3 decimal places (~100m precision)
 */
export function buildClusterKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`
}

/**
 * Check if two locations are within a certain distance (meters)
 */
export function isWithinDistance(
  loc1: Coordinates,
  loc2: Coordinates,
  maxDistanceMeters: number
): boolean {
  const distance = haversineDistance(loc1.lat, loc1.lon, loc2.lat, loc2.lon)
  return distance <= maxDistanceMeters
}

/**
 * Haversine distance between two points in meters
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000 // Earth radius in meters
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

/**
 * Batch resolve locations for multiple venues
 */
export function resolveLocations(
  venues: VenueLocationInput[]
): Map<string, ResolvedLocation> {
  const results = new Map<string, ResolvedLocation>()

  for (const venue of venues) {
    const resolved = resolveLocation(venue)
    if (resolved) {
      results.set(venue.id, resolved)
    }
  }

  return results
}

/**
 * Get all zone hint keys available
 */
export function getAvailableZoneHints(): string[] {
  const centroids = loadCentroids()
  return Object.keys(centroids.zone_hints)
}

/**
 * Get all arrondissement keys available
 */
export function getAvailableArrondissements(): string[] {
  const centroids = loadCentroids()
  return Object.keys(centroids.arrondissements)
}

/**
 * Clear caches (useful for testing or hot reload)
 */
export function clearLocationCaches(): void {
  cachedCentroids = null
  cachedGpsMap = null
}
