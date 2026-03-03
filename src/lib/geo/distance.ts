/**
 * Geo utilities for city-flow.
 * Pure math, no symbolic layer.
 */

const EARTH_RADIUS_M = 6371000

/**
 * Distance between two GPS points in meters (Haversine formula).
 */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const lat1 = (aLat * Math.PI) / 180
  const lat2 = (bLat * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_M * c
}

/**
 * Bearing from point A to point B in degrees.
 * 0 = North, 90 = East, 180 = South, 270 = West.
 */
export function bearingDegrees(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const lat1 = (aLat * Math.PI) / 180
  const lat2 = (bLat * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const x = Math.sin(dLng) * Math.cos(lat2)
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  const bearing = (Math.atan2(x, y) * 180) / Math.PI
  return normalizeDegrees(bearing)
}

/**
 * Normalize angle to 0-360 range.
 */
export function normalizeDegrees(d: number): number {
  let n = d % 360
  if (n < 0) n += 360
  return n
}

/**
 * Convert bearing to corridor direction.
 */
export function bearingToDirection(bearing: number): 'nord' | 'est' | 'sud' | 'ouest' {
  if (bearing >= 315 || bearing < 45) return 'nord'
  if (bearing >= 45 && bearing < 135) return 'est'
  if (bearing >= 135 && bearing < 225) return 'sud'
  return 'ouest'
}

/**
 * Estimate drive time in minutes (rough approximation).
 * Assumes 25 km/h average in Paris urban area.
 */
export function estimateDriveMinutes(distanceMeters: number): number {
  const AVG_SPEED_KMH = 25
  const hours = distanceMeters / 1000 / AVG_SPEED_KMH
  return Math.round(hours * 60)
}
