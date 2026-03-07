/**
 * FLOW — Driver Position Hook
 *
 * Adapted from arche-paris useStabilizedPosition for in-car usage.
 * Key differences from pedestrian GPS:
 * - Higher accuracy threshold (150m OK for driver decisions)
 * - Larger teleport window (drivers move faster)
 * - Throttled updates when locked (every 15s, not continuous)
 * - maximumAge allowed (driver trajectory is predictable)
 */

import { useEffect, useRef, useState, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface DriverPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
  heading: number | null;
  speed: number | null; // m/s
}

export type PositionStatus = "idle" | "warming" | "locked" | "weak" | "error";

// ═══════════════════════════════════════════════════════════════════
// DRIVER-ADAPTED CONSTANTS
// ═══════════════════════════════════════════════════════════════════

// More relaxed than pedestrian - driver decisions are zone-level, not meter-level
const DRIVER_MAX_ACCURACY_M = 150;

// Faster warmup - driver wants to see data quickly
const DRIVER_WARMUP_STREAK = 2;

// Higher teleport threshold - drivers move faster
// 300m in 3s = 360 km/h, handles highway + GPS jumps
const DRIVER_TELEPORT_M = 300;
const DRIVER_TELEPORT_WINDOW_MS = 3000;

// Throttle updates when locked - no need for continuous updates in car
const DRIVER_UPDATE_THROTTLE_MS = 15000; // 15 seconds

// Allow slightly stale position - driver trajectory is predictable
const DRIVER_MAXIMUM_AGE_MS = 10000; // 10 seconds

// ═══════════════════════════════════════════════════════════════════
// HAVERSINE (from arche-paris geo.ts)
// ═══════════════════════════════════════════════════════════════════

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═══════════════════════════════════════════════════════════════════
// PROXIMITY ESTIMATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Estimate travel time in minutes.
 * Simple model: ~15 km/h average in Paris traffic = 4 min/km
 * Can be refined later with time-of-day factors.
 */
export function estimateTravelMinutes(distanceMeters: number): number {
  const minutes = (distanceMeters / 1000) * 4;
  return Math.max(1, Math.round(minutes));
}

// ═══════════════════════════════════════════════════════════════════
// ZONE CENTERS (for proximity computation)
// ═══════════════════════════════════════════════════════════════════

export const PARIS_ZONE_CENTERS: Record<string, { lat: number; lng: number }> = {
  // Arrondissements
  "1": { lat: 48.8603, lng: 2.3472 },
  "2": { lat: 48.8684, lng: 2.3415 },
  "3": { lat: 48.8641, lng: 2.3619 },
  "4": { lat: 48.8546, lng: 2.3577 },
  "5": { lat: 48.8448, lng: 2.3508 },
  "6": { lat: 48.8496, lng: 2.3323 },
  "7": { lat: 48.8566, lng: 2.3150 },
  "8": { lat: 48.8744, lng: 2.3106 },
  "9": { lat: 48.8766, lng: 2.3372 },
  "10": { lat: 48.8760, lng: 2.3597 },
  "11": { lat: 48.8590, lng: 2.3798 },
  "12": { lat: 48.8396, lng: 2.3876 },
  "13": { lat: 48.8322, lng: 2.3561 },
  "14": { lat: 48.8330, lng: 2.3264 },
  "15": { lat: 48.8421, lng: 2.2987 },
  "16": { lat: 48.8637, lng: 2.2769 },
  "17": { lat: 48.8835, lng: 2.3090 },
  "18": { lat: 48.8925, lng: 2.3444 },
  "19": { lat: 48.8817, lng: 2.3822 },
  "20": { lat: 48.8638, lng: 2.3985 },
  // Banlieue hubs
  "cdg": { lat: 49.0097, lng: 2.5479 },
  "orly": { lat: 48.7262, lng: 2.3652 },
  "defense": { lat: 48.8918, lng: 2.2362 },
  // Stations
  "gare-nord": { lat: 48.8809, lng: 2.3553 },
  "gare-lyon": { lat: 48.8448, lng: 2.3735 },
  "gare-est": { lat: 48.8768, lng: 2.3590 },
  "montparnasse": { lat: 48.8408, lng: 2.3212 },
  "st-lazare": { lat: 48.8766, lng: 2.3250 },
  // Venues
  "bercy": { lat: 48.8387, lng: 2.3783 },
  "stade-france": { lat: 48.9244, lng: 2.3601 },
};

/**
 * Extract arrondissement number from zone string.
 * "Bastille" → null, "11" → "11", "11e" → "11", "Arr. 11" → "11"
 */
function extractArrondissement(zone: string): string | null {
  const match = zone.match(/\b(\d{1,2})(e|ème|er)?\b/i);
  return match ? match[1] : null;
}

/**
 * Compute proximity in minutes from driver to a zone.
 * Returns null if zone location cannot be determined.
 */
export function computeProximityMinutes(
  driverLat: number,
  driverLng: number,
  zone: string,
  arrondissement?: string
): number | null {
  // Try direct zone lookup
  const zoneLower = zone.toLowerCase().replace(/\s+/g, "-");
  if (PARIS_ZONE_CENTERS[zoneLower]) {
    const center = PARIS_ZONE_CENTERS[zoneLower];
    const distance = haversineMeters(driverLat, driverLng, center.lat, center.lng);
    return estimateTravelMinutes(distance);
  }

  // Try arrondissement
  const arr = arrondissement || extractArrondissement(zone);
  if (arr && PARIS_ZONE_CENTERS[arr]) {
    const center = PARIS_ZONE_CENTERS[arr];
    const distance = haversineMeters(driverLat, driverLng, center.lat, center.lng);
    return estimateTravelMinutes(distance);
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════

interface UseDriverPositionResult {
  position: DriverPosition | null;
  status: PositionStatus;
  error: string | null;
}

export function useDriverPosition(enabled: boolean = true): UseDriverPositionResult {
  const [position, setPosition] = useState<DriverPosition | null>(null);
  const [status, setStatus] = useState<PositionStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const goodStreakRef = useRef(0);
  const lastAcceptedRef = useRef<DriverPosition | null>(null);
  const lastUpdateTimeRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setStatus("idle");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      setError("Géolocalisation non supportée");
      return;
    }

    setStatus("warming");
    goodStreakRef.current = 0;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (p) => {
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        const accuracy = p.coords.accuracy ?? 99999;
        const timestamp = p.timestamp || Date.now();
        const heading =
          typeof p.coords.heading === "number" && Number.isFinite(p.coords.heading)
            ? p.coords.heading
            : null;
        const speed =
          typeof p.coords.speed === "number" && Number.isFinite(p.coords.speed)
            ? p.coords.speed
            : null;

        // Accuracy gate
        if (accuracy > DRIVER_MAX_ACCURACY_M) {
          goodStreakRef.current = 0;
          setStatus((s) => (s === "locked" ? "weak" : s));
          return;
        }

        const candidate: DriverPosition = { lat, lng, accuracy, timestamp, heading, speed };

        // Teleport detection
        const last = lastAcceptedRef.current;
        if (last) {
          const dt = Math.max(1, timestamp - last.timestamp);
          const dist = haversineMeters(last.lat, last.lng, lat, lng);
          if (dist > DRIVER_TELEPORT_M && dt < DRIVER_TELEPORT_WINDOW_MS) {
            // Reject teleport but don't reset streak
            return;
          }
        }

        goodStreakRef.current += 1;

        // Warmup phase
        if (goodStreakRef.current < DRIVER_WARMUP_STREAK) {
          setStatus("warming");
          return;
        }

        // Throttle updates when locked
        const now = Date.now();
        if (
          status === "locked" &&
          lastAcceptedRef.current &&
          now - lastUpdateTimeRef.current < DRIVER_UPDATE_THROTTLE_MS
        ) {
          // Still update internal ref for teleport detection, but don't trigger re-render
          lastAcceptedRef.current = candidate;
          return;
        }

        lastAcceptedRef.current = candidate;
        lastUpdateTimeRef.current = now;
        setPosition(candidate);
        setStatus("locked");
        setError(null);
      },
      (err) => {
        let msg: string;
        switch (err.code) {
          case err.PERMISSION_DENIED:
            msg = "Permission GPS refusée";
            break;
          case err.POSITION_UNAVAILABLE:
            msg = "Signal GPS indisponible";
            break;
          case err.TIMEOUT:
            msg = "GPS timeout";
            break;
          default:
            msg = "Erreur GPS";
        }
        setStatus("error");
        setError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000, // Longer timeout for in-car
        maximumAge: DRIVER_MAXIMUM_AGE_MS,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, status]);

  return { position, status, error };
}
