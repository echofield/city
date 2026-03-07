/**
 * PARIS STATIONS
 *
 * Major train stations in Paris configured for SNCF integration.
 * Stop area IDs are used for real-time train arrival queries.
 */

import type { StationNode } from '@/core/types'

// ═══════════════════════════════════════════════════════════════════════════
// STATION CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const PARIS_STATIONS: StationNode[] = [
  {
    id: 'gare-du-nord',
    name: 'Gare du Nord',
    stopAreaId: 'stop_area:SNCF:87271007',
    corridor: 'nord',
    lat: 48.8809,
    lng: 2.3553,
    hasInternational: true,
    hasLongDistance: true,
    hasSuburban: true,
    entryHint: 'Rue de Dunkerque, sortie internationale',
    rideProfile: 'long',
    peakHours: {
      morning: '07:00-09:30',
      evening: '17:30-20:00',
    },
    metroLines: ['4', '5', 'B', 'D', 'E'],
  },
  {
    id: 'gare-de-lyon',
    name: 'Gare de Lyon',
    stopAreaId: 'stop_area:SNCF:87686006',
    corridor: 'est',
    lat: 48.8443,
    lng: 2.3734,
    hasInternational: false,
    hasLongDistance: true,
    hasSuburban: true,
    entryHint: 'Place Louis-Armand, côté TGV',
    rideProfile: 'long',
    peakHours: {
      morning: '07:00-09:30',
      evening: '17:30-20:00',
      weekend: '15:00-19:00',
    },
    metroLines: ['1', '14', 'A', 'D'],
  },
  {
    id: 'gare-montparnasse',
    name: 'Gare Montparnasse',
    stopAreaId: 'stop_area:SNCF:87391003',
    corridor: 'sud',
    lat: 48.8414,
    lng: 2.3219,
    hasInternational: false,
    hasLongDistance: true,
    hasSuburban: true,
    entryHint: 'Boulevard de Vaugirard, hall 1',
    rideProfile: 'mixed',
    peakHours: {
      morning: '07:00-09:00',
      evening: '17:30-19:30',
    },
    metroLines: ['4', '6', '12', '13'],
  },
  {
    id: 'gare-de-lest',
    name: 'Gare de l\'Est',
    stopAreaId: 'stop_area:SNCF:87113001',
    corridor: 'nord',
    lat: 48.8764,
    lng: 2.3598,
    hasInternational: true,
    hasLongDistance: true,
    hasSuburban: true,
    entryHint: 'Place du 11 Novembre 1918',
    rideProfile: 'long',
    peakHours: {
      morning: '07:00-09:00',
      evening: '17:30-19:30',
    },
    metroLines: ['4', '5', '7'],
  },
  {
    id: 'gare-saint-lazare',
    name: 'Gare Saint-Lazare',
    stopAreaId: 'stop_area:SNCF:87384008',
    corridor: 'ouest',
    lat: 48.8765,
    lng: 2.3247,
    hasInternational: false,
    hasLongDistance: false,
    hasSuburban: true,
    entryHint: 'Rue de Rome, côté banlieue',
    rideProfile: 'short_fast',
    peakHours: {
      morning: '07:30-09:30',
      evening: '17:00-19:30',
    },
    metroLines: ['3', '12', '13', '14'],
  },
  {
    id: 'gare-daustelitrz',
    name: 'Gare d\'Austerlitz',
    stopAreaId: 'stop_area:SNCF:87547000',
    corridor: 'sud',
    lat: 48.8424,
    lng: 2.3654,
    hasInternational: false,
    hasLongDistance: true,
    hasSuburban: true,
    entryHint: 'Quai d\'Austerlitz',
    rideProfile: 'mixed',
    peakHours: {
      morning: '07:00-09:00',
      evening: '17:30-19:30',
    },
    metroLines: ['5', '10', 'C'],
  },
  {
    id: 'gare-de-bercy',
    name: 'Gare de Bercy',
    stopAreaId: 'stop_area:SNCF:87686667',
    corridor: 'est',
    lat: 48.8388,
    lng: 2.3826,
    hasInternational: false,
    hasLongDistance: true,
    hasSuburban: false,
    entryHint: 'Boulevard de Bercy',
    rideProfile: 'long',
    peakHours: {
      morning: '07:00-09:00',
      evening: '17:30-19:30',
    },
    metroLines: ['6', '14'],
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function getStationById(id: string): StationNode | undefined {
  return PARIS_STATIONS.find(s => s.id === id)
}

export function getStationByName(name: string): StationNode | undefined {
  return PARIS_STATIONS.find(s => s.name === name)
}

export function getStationByStopAreaId(stopAreaId: string): StationNode | undefined {
  return PARIS_STATIONS.find(s => s.stopAreaId === stopAreaId)
}

export function getInternationalStations(): StationNode[] {
  return PARIS_STATIONS.filter(s => s.hasInternational)
}

export function getLongDistanceStations(): StationNode[] {
  return PARIS_STATIONS.filter(s => s.hasLongDistance)
}

export function getStationsByCorridor(corridor: string): StationNode[] {
  return PARIS_STATIONS.filter(s => s.corridor === corridor)
}
