/**
 * Geo module for city-flow.
 * P1 extraction from ARCHÉ + Movement Corridor Model.
 */

export {
  haversineMeters,
  bearingDegrees,
  normalizeDegrees,
  bearingToDirection,
  estimateDriveMinutes,
} from './distance'

export {
  ARRONDISSEMENT_CENTERS,
  ZONE_CENTERS,
  getZoneCentroid,
  getAllZoneIds,
  type ZoneCentroid,
} from './zone-centroids'

export {
  MOVEMENT_CORRIDORS,
  CORRIDOR_ENTRY_HINTS,
  getCorridorsByDirection,
  getCorridorsServingZone,
  getCorridorEntryHint,
  type MovementCorridor,
  type CorridorDirection,
  type CorridorType,
  type FrictionLevel,
} from './corridors'
