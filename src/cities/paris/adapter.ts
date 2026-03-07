/**
 * PARIS ADAPTER
 *
 * Converts Paris-specific data into universal engine-ready formats.
 * Handles transport weakness computation, zone lookups, and data normalization.
 */

import type { CityConfig } from '@/core/types'
import { PARIS_CONFIG } from './config'
import { PARIS_ZONES, getZoneById, getZoneByName } from './zones'
import { PARIS_AIRPORTS, getAirportByIata } from './airports'
import { PARIS_STATIONS, getStationById } from './stations'
import { PARIS_VENUES, getVenueById } from './venues'
import { PARIS_NIGHTLIFE, getClusterById } from './nightlife'

// ═══════════════════════════════════════════════════════════════════════════
// PARIS ADAPTER CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class ParisAdapter {
  private config: CityConfig

  constructor() {
    this.config = PARIS_CONFIG
  }

  // ── Config Access ──

  getConfig(): CityConfig {
    return this.config
  }

  getCityId(): string {
    return this.config.cityId
  }

  getTimezone(): string {
    return this.config.timezone
  }

  // ── Zone Operations ──

  /**
   * Convert zone name to zone ID
   */
  zoneNameToId(name: string): string {
    // Try direct lookup by name or displayName
    const zone = getZoneByName(name)
    if (zone) return zone.id

    // Try numeric conversion (e.g., "1er" -> "paris_1")
    const numMatch = name.match(/^(\d+)/)
    if (numMatch) {
      const num = parseInt(numMatch[1], 10)
      const found = getZoneById(`paris_${num}`)
      if (found) return found.id
    }

    // Fallback to original name
    return name
  }

  /**
   * Get corridor for a zone
   */
  getZoneCorridor(zoneId: string): string {
    const zone = getZoneById(zoneId)
    return zone?.corridor ?? 'centre'
  }

  /**
   * Get all zone IDs for a corridor
   */
  getZoneIdsForCorridor(corridor: string): string[] {
    return PARIS_ZONES
      .filter(z => z.corridor === corridor)
      .map(z => z.id)
  }

  // ── Transport Weakness ──

  /**
   * Compute transport weakness for Paris at a given time.
   * Returns 0-100 where higher = weaker public transport = better for VTC.
   *
   * Paris Metro hours:
   * - Weekdays: 05:30 - 00:30 (last trains ~01:15)
   * - Weekends: 05:30 - 02:00 (last trains ~02:15)
   */
  computeTransportWeakness(hour: number, minute: number, isWeekend = false): number {
    const time = hour + minute / 60

    // Metro end time
    const metroEnd = isWeekend ? 2.0 : 0.5 // 02:00 or 00:30

    // No metro: 01:00 - 05:30
    if (time >= 1 && time < 5.5) {
      return 100 // No metro at all
    }

    // Metro just closed (00:30 - 01:00 weekday, 02:00 - 02:30 weekend)
    if (!isWeekend && time >= 0.5 && time < 1) {
      return 90 // Just closed
    }
    if (isWeekend && time >= 2 && time < 2.5) {
      return 85 // Just closed
    }

    // Last metros running (weekday 00:00 - 00:30)
    if (!isWeekend && time >= 0 && time < 0.5) {
      return 75 // Very few metros
    }
    // Weekend 01:30 - 02:00
    if (isWeekend && time >= 1.5 && time < 2) {
      return 70 // Winding down
    }

    // Late night service (23:00 - 00:00)
    if (time >= 23) {
      return 60 // Reduced frequency
    }

    // Evening reduction (22:00 - 23:00)
    if (time >= 22) {
      return 35 // Some reduction
    }

    // Early morning (05:30 - 06:30)
    if (time >= 5.5 && time < 6.5) {
      return 40 // Starting up, reduced service
    }

    // Normal operating hours
    return 10 // Full service
  }

  /**
   * Check if metro is currently running
   */
  isMetroRunning(hour: number, minute: number, isWeekend = false): boolean {
    const time = hour + minute / 60
    const metroStart = 5.5 // 05:30
    const metroEnd = isWeekend ? 2.25 : 0.75 // ~02:15 or ~00:45

    if (time >= metroStart) return true
    if (isWeekend && time < metroEnd) return true
    if (!isWeekend && time < metroEnd) return true

    return false
  }

  // ── Node Lookups ──

  getAirport(iata: string) {
    return getAirportByIata(iata)
  }

  getStation(id: string) {
    return getStationById(id)
  }

  getVenue(id: string) {
    return getVenueById(id)
  }

  getNightlifeCluster(id: string) {
    return getClusterById(id)
  }

  // ── Strategy Weights ──

  /**
   * Get signal type weight from strategy profile
   */
  getSignalWeight(
    signalType: 'airport' | 'station' | 'nightlife' | 'event' | 'office' | 'hotel'
  ): number {
    const weights = this.config.strategyProfile
    switch (signalType) {
      case 'airport':
        return weights.airportWeight
      case 'station':
        return weights.stationWeight
      case 'nightlife':
        return weights.nightlifeWeight
      case 'event':
        return weights.eventWeight
      case 'office':
        return weights.officeWeight
      case 'hotel':
        return weights.hotelWeight
      default:
        return 0.5
    }
  }

  // ── Corridor Helpers ──

  /**
   * Get corridor for a lat/lng position relative to Paris center
   */
  getCorridorForPosition(lat: number, lng: number): string {
    const { center } = this.config
    const dLat = lat - center.lat
    const dLng = lng - center.lng

    // Simple quadrant-based corridor detection
    const threshold = 0.02 // ~2km

    if (Math.abs(dLat) < threshold && Math.abs(dLng) < threshold) {
      return 'centre'
    }

    if (dLat > 0 && Math.abs(dLat) >= Math.abs(dLng)) {
      return 'nord'
    }
    if (dLat < 0 && Math.abs(dLat) >= Math.abs(dLng)) {
      return 'sud'
    }
    if (dLng > 0 && Math.abs(dLng) > Math.abs(dLat)) {
      return 'est'
    }
    if (dLng < 0 && Math.abs(dLng) > Math.abs(dLat)) {
      return 'ouest'
    }

    return 'centre'
  }

  /**
   * Calculate distance between two points in km
   */
  calculateDistanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371 // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1)
    const dLng = this.toRad(lng2 - lng1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180)
  }

  /**
   * Estimate travel time in Paris (accounting for traffic)
   */
  estimateTravelMinutes(distanceKm: number, hour: number): number {
    // Base speed: 25 km/h in Paris traffic
    let speedKmh = 25

    // Rush hour slowdown
    if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20)) {
      speedKmh = 15
    }
    // Night speed up
    else if (hour >= 22 || hour < 6) {
      speedKmh = 40
    }

    return Math.round((distanceKm / speedKmh) * 60)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

export const parisAdapter = new ParisAdapter()

// ═══════════════════════════════════════════════════════════════════════════
// DIRECT EXPORTS FOR CONVENIENCE
// ═══════════════════════════════════════════════════════════════════════════

export { PARIS_ZONES, PARIS_AIRPORTS, PARIS_STATIONS, PARIS_VENUES, PARIS_NIGHTLIFE }
