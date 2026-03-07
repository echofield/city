/**
 * FLOW — Around You Layer
 *
 * Local tactical radar that shows nearby opportunities.
 * Different from LIVE: proximity-weighted, local-first, refresh-oriented.
 */

import type { Signal } from "../types/signal";
import { haversineMeters, PARIS_ZONE_CENTERS, estimateTravelMinutes } from "../hooks/useDriverPosition";

// ── Types ──

export interface AroundYouSignal extends Signal {
  distance_meters: number;
  travel_minutes: number;
  local_score: number;
  local_label: string;
}

export interface AroundYouResult {
  signals: AroundYouSignal[];
  driver_arrondissement: string | null;
  scan_radius_km: number;
  scanned_at: string;
}

// ── Constants ──

// Max radius for Around You (2.5km ~ 10 min in Paris traffic)
const MAX_RADIUS_M = 2500;

// Scoring weights (proximity matters most)
const WEIGHT_PROXIMITY = 0.45;
const WEIGHT_URGENCY = 0.30;
const WEIGHT_CAPACITY = 0.15;
const WEIGHT_RAMIFICATION = 0.10;

// ── Helpers ──

/**
 * Get zone center coordinates for distance calculation.
 */
function getZoneCenter(zone: string, arrondissement?: string): { lat: number; lng: number } | null {
  // Try direct zone lookup
  const zoneLower = zone.toLowerCase().replace(/\s+/g, "-");
  if (PARIS_ZONE_CENTERS[zoneLower]) {
    return PARIS_ZONE_CENTERS[zoneLower];
  }

  // Try arrondissement
  if (arrondissement) {
    const arrNum = arrondissement.replace(/\D/g, "");
    if (PARIS_ZONE_CENTERS[arrNum]) {
      return PARIS_ZONE_CENTERS[arrNum];
    }
  }

  // Extract arrondissement from zone name
  const match = zone.match(/\b(\d{1,2})(e|ème|er)?\b/i);
  if (match && PARIS_ZONE_CENTERS[match[1]]) {
    return PARIS_ZONE_CENTERS[match[1]];
  }

  return null;
}

/**
 * Determine driver's current arrondissement from GPS.
 */
export function getDriverArrondissement(driverLat: number, driverLng: number): string | null {
  let closestArr: string | null = null;
  let minDistance = Infinity;

  // Check all arrondissements (1-20)
  for (let i = 1; i <= 20; i++) {
    const center = PARIS_ZONE_CENTERS[String(i)];
    if (!center) continue;

    const dist = haversineMeters(driverLat, driverLng, center.lat, center.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestArr = String(i);
    }
  }

  // Only return if reasonably close (within 2km of any center)
  return minDistance < 2000 ? closestArr : null;
}

/**
 * Calculate exit urgency score (0-1).
 * Higher for signals ending soon.
 */
function calculateUrgencyScore(signal: Signal): number {
  // Already active and expiring = highest urgency
  if (signal.is_active && signal.is_expiring) return 1.0;

  // Active but not expiring
  if (signal.is_active) return 0.8;

  // Forming soon
  if (signal.is_forming && signal.minutes_until_start !== undefined) {
    if (signal.minutes_until_start <= 15) return 0.9;
    if (signal.minutes_until_start <= 30) return 0.7;
    if (signal.minutes_until_start <= 60) return 0.5;
    return 0.3;
  }

  // Has end time coming up
  if (signal.minutes_until_end !== undefined) {
    if (signal.minutes_until_end <= 15) return 0.95;
    if (signal.minutes_until_end <= 30) return 0.8;
    if (signal.minutes_until_end <= 60) return 0.6;
  }

  return 0.4;
}

/**
 * Calculate capacity/importance score (0-1).
 * Based on intensity and signal type.
 */
function calculateCapacityScore(signal: Signal): number {
  // Intensity directly maps to importance
  const intensityScore = signal.intensity / 4;

  // Boost for high-value types
  const typeBoost =
    signal.type === "event_exit" ? 0.15 :
    signal.type === "nightlife" ? 0.1 :
    signal.type === "transport_wave" ? 0.1 :
    signal.type === "compound" ? 0.2 :
    0;

  return Math.min(1, intensityScore + typeBoost);
}

/**
 * Generate local-specific label for Around You display.
 */
function generateLocalLabel(signal: Signal, travelMinutes: number): string {
  const timePrefix = travelMinutes <= 5 ? "tout proche" :
                     travelMinutes <= 10 ? `${travelMinutes} min` :
                     `~${travelMinutes} min`;

  // Type-specific labels
  switch (signal.type) {
    case "event_exit":
      return signal.is_active ? `sortie en cours` :
             signal.minutes_until_end ? `fin ~${signal.minutes_until_end} min` :
             `sortie prevue`;

    case "nightlife":
      return signal.is_active ? "zone active" : "demarre bientot";

    case "transport_wave":
      return signal.is_active ? "flux actif" : "flux prevu";

    case "weather":
      return "demande probable";

    case "compound":
      return `${signal.overlapping_factors?.length || 2} facteurs`;

    default:
      return signal.is_active ? "actif" : "a venir";
  }
}

// ── Core Computation ──

/**
 * Compute Around You signals for a driver position.
 * Returns nearby opportunities ranked by local relevance.
 */
export function computeAroundYouSignals(
  driverLat: number,
  driverLng: number,
  allSignals: Signal[],
  limit: number = 5
): AroundYouResult {
  const nearbySignals: AroundYouSignal[] = [];

  for (const signal of allSignals) {
    // Skip alerts (friction, disruption) - not opportunities
    if (signal.kind === "alert") continue;

    // Skip week-level signals
    if (signal.kind === "week") continue;

    // Get zone coordinates
    const zoneCenter = getZoneCenter(signal.zone, signal.arrondissement);
    if (!zoneCenter) continue;

    // Calculate distance
    const distanceMeters = haversineMeters(
      driverLat,
      driverLng,
      zoneCenter.lat,
      zoneCenter.lng
    );

    // Filter by radius
    if (distanceMeters > MAX_RADIUS_M) continue;

    // Calculate travel time
    const travelMinutes = estimateTravelMinutes(distanceMeters);

    // Calculate local score components
    const proximityScore = 1 - (distanceMeters / MAX_RADIUS_M); // 0-1, closer = higher
    const urgencyScore = calculateUrgencyScore(signal);
    const capacityScore = calculateCapacityScore(signal);
    const ramificationScore = signal.ramification_score ?? 0;

    // Weighted local score
    const localScore =
      proximityScore * WEIGHT_PROXIMITY +
      urgencyScore * WEIGHT_URGENCY +
      capacityScore * WEIGHT_CAPACITY +
      ramificationScore * WEIGHT_RAMIFICATION;

    // Generate local-specific label
    const localLabel = generateLocalLabel(signal, travelMinutes);

    nearbySignals.push({
      ...signal,
      distance_meters: Math.round(distanceMeters),
      travel_minutes: travelMinutes,
      local_score: localScore,
      local_label: localLabel,
    });
  }

  // Sort by local_score (not priority_score)
  nearbySignals.sort((a, b) => b.local_score - a.local_score);

  // Take top N
  const topSignals = nearbySignals.slice(0, limit);

  return {
    signals: topSignals,
    driver_arrondissement: getDriverArrondissement(driverLat, driverLng),
    scan_radius_km: MAX_RADIUS_M / 1000,
    scanned_at: new Date().toISOString(),
  };
}

/**
 * Check if driver entered a new arrondissement.
 */
export function detectArrondissementChange(
  prevArr: string | null,
  currentLat: number,
  currentLng: number
): { changed: boolean; newArr: string | null } {
  const currentArr = getDriverArrondissement(currentLat, currentLng);

  if (currentArr && currentArr !== prevArr) {
    return { changed: true, newArr: currentArr };
  }

  return { changed: false, newArr: currentArr };
}
