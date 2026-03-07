/**
 * PARIS CITY PACK — Entry point
 *
 * Re-exports all Paris-specific configuration and data.
 */

// Config
export { PARIS_CONFIG, PARIS_CORRIDORS, PARIS_BANLIEUE_HUBS } from './config'

// Zones
export {
  PARIS_ZONES,
  getZoneById,
  getZoneByName,
  getZonesByCharacteristic,
  getZonesByCorridor,
} from './zones'
export type { BanlieueHub } from './zones'

// Airports
export {
  PARIS_AIRPORTS,
  getAirportByIata,
  getAirportById,
  getTerminalHint,
  estimatePassengerReleaseTime,
} from './airports'

// Stations
export {
  PARIS_STATIONS,
  getStationById,
  getStationByName,
  getStationByStopAreaId,
  getInternationalStations,
  getLongDistanceStations,
  getStationsByCorridor,
} from './stations'

// Venues
export {
  PARIS_VENUES,
  getVenueById,
  getVenuesByType,
  getVenuesByZone,
  getVenuesByCorridor,
  getLargeVenues,
  calculateExitWindow,
} from './venues'

// Nightlife
export {
  PARIS_NIGHTLIFE,
  getClusterById,
  getClustersByZone,
  getClustersByCorridor,
  getActiveClustersAt,
  getClustersClosingAt,
  getPeakNightClusters,
  getClosureWaves,
} from './nightlife'

// Adapter
export { ParisAdapter, parisAdapter } from './adapter'
