/**
 * PARIS VENUES
 *
 * Major event venues: theatres, concert halls, arenas, stadiums.
 * Used for event-based signal generation.
 */

import type { VenueNode, VenueType } from '@/core/types'

// ═══════════════════════════════════════════════════════════════════════════
// VENUE CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const PARIS_VENUES: VenueNode[] = [
  // ── Major Arenas ──
  {
    id: 'accor-arena',
    name: 'Accor Arena',
    type: 'arena',
    zone: 'paris_12',
    corridor: 'est',
    lat: 48.8388,
    lng: 2.3786,
    capacity: 20300,
    endTimeRule: {
      typicalEnd: '23:00',
      exitWindowMinutes: 45,
      variationByDay: {
        weekday: '22:30',
        weekend: '23:30',
      },
    },
    entryHint: 'Boulevard de Bercy, sortie VIP côté Seine',
    rideProfile: 'mixed',
    parkingZones: ['bercy', 'gare-de-lyon'],
  },
  {
    id: 'stade-france',
    name: 'Stade de France',
    type: 'stadium',
    zone: 'saint-denis',
    corridor: 'nord',
    lat: 48.9244,
    lng: 2.3602,
    capacity: 80000,
    endTimeRule: {
      typicalEnd: '23:00',
      exitWindowMinutes: 60,
    },
    entryHint: 'Porte H pour VTC, éviter RER D congestionné',
    rideProfile: 'long',
    parkingZones: ['saint-denis', 'la-plaine'],
  },
  {
    id: 'zenith-paris',
    name: 'Zénith Paris',
    type: 'concert',
    zone: 'paris_19',
    corridor: 'nord',
    lat: 48.8935,
    lng: 2.3932,
    capacity: 6300,
    endTimeRule: {
      typicalEnd: '23:00',
      exitWindowMinutes: 40,
    },
    entryHint: 'Avenue Jean-Jaurès, côté Parc de la Villette',
    rideProfile: 'mixed',
    parkingZones: ['villette', 'pantin'],
  },

  // ── Concert Halls ──
  {
    id: 'olympia',
    name: 'L\'Olympia',
    type: 'concert',
    zone: 'paris_9',
    corridor: 'centre',
    lat: 48.8707,
    lng: 2.3276,
    capacity: 2000,
    endTimeRule: {
      typicalEnd: '22:30',
      exitWindowMinutes: 30,
    },
    entryHint: 'Boulevard des Capucines, proche Opéra',
    rideProfile: 'short_fast',
    parkingZones: ['opera', 'madeleine'],
  },
  {
    id: 'bataclan',
    name: 'Bataclan',
    type: 'concert',
    zone: 'paris_11',
    corridor: 'est',
    lat: 48.8634,
    lng: 2.3702,
    capacity: 1500,
    endTimeRule: {
      typicalEnd: '23:00',
      exitWindowMinutes: 30,
    },
    entryHint: 'Boulevard Voltaire, station Oberkampf',
    rideProfile: 'short_fast',
    parkingZones: ['bastille', 'republique'],
  },
  {
    id: 'la-cigale',
    name: 'La Cigale',
    type: 'concert',
    zone: 'paris_18',
    corridor: 'nord',
    lat: 48.8822,
    lng: 2.3407,
    capacity: 1400,
    endTimeRule: {
      typicalEnd: '23:00',
      exitWindowMinutes: 30,
    },
    entryHint: 'Boulevard Rochechouart, station Pigalle',
    rideProfile: 'short_fast',
    parkingZones: ['pigalle', 'montmartre'],
  },

  // ── Theatres ──
  {
    id: 'chatelet-theatre',
    name: 'Théâtre du Châtelet',
    type: 'theatre',
    zone: 'paris_1',
    corridor: 'centre',
    lat: 48.8584,
    lng: 2.3474,
    capacity: 2500,
    endTimeRule: {
      typicalEnd: '22:15',
      exitWindowMinutes: 30,
    },
    entryHint: 'Place du Châtelet, côté Seine',
    rideProfile: 'mixed',
    parkingZones: ['chatelet', 'hotel-de-ville'],
  },
  {
    id: 'palais-garnier',
    name: 'Palais Garnier',
    type: 'opera',
    zone: 'paris_9',
    corridor: 'centre',
    lat: 48.8719,
    lng: 2.3316,
    capacity: 1900,
    endTimeRule: {
      typicalEnd: '22:15',
      exitWindowMinutes: 30,
    },
    entryHint: 'Place de l\'Opéra, entrée principale',
    rideProfile: 'premium_long',
    parkingZones: ['opera', 'madeleine'],
  },
  {
    id: 'moulin-rouge',
    name: 'Moulin Rouge',
    type: 'theatre',
    zone: 'paris_18',
    corridor: 'nord',
    lat: 48.8842,
    lng: 2.3322,
    capacity: 850,
    endTimeRule: {
      typicalEnd: '23:30',
      exitWindowMinutes: 25,
    },
    entryHint: 'Boulevard de Clichy, station Blanche',
    rideProfile: 'premium_long',
    parkingZones: ['pigalle', 'place-clichy'],
  },
  {
    id: 'folies-bergere',
    name: 'Folies Bergère',
    type: 'theatre',
    zone: 'paris_9',
    corridor: 'nord',
    lat: 48.8745,
    lng: 2.3465,
    capacity: 1600,
    endTimeRule: {
      typicalEnd: '22:15',
      exitWindowMinutes: 25,
    },
    entryHint: 'Rue Richer, station Cadet',
    rideProfile: 'mixed',
    parkingZones: ['grands-boulevards', 'pigalle'],
  },
  {
    id: 'opera-bastille',
    name: 'Opéra Bastille',
    type: 'opera',
    zone: 'paris_12',
    corridor: 'est',
    lat: 48.8519,
    lng: 2.3694,
    capacity: 2700,
    endTimeRule: {
      typicalEnd: '22:30',
      exitWindowMinutes: 35,
    },
    entryHint: 'Place de la Bastille, sortie principale',
    rideProfile: 'premium_long',
    parkingZones: ['bastille', 'gare-de-lyon'],
  },

  // ── Exhibition / Conference ──
  {
    id: 'palais-des-congres',
    name: 'Palais des Congrès',
    type: 'conference',
    zone: 'paris_17',
    corridor: 'ouest',
    lat: 48.8787,
    lng: 2.2831,
    capacity: 3700,
    endTimeRule: {
      typicalEnd: '18:00',
      exitWindowMinutes: 45,
    },
    entryHint: 'Porte Maillot, station RER C',
    rideProfile: 'premium_long',
    parkingZones: ['porte-maillot', 'neuilly'],
  },
  {
    id: 'paris-expo',
    name: 'Paris Expo - Porte de Versailles',
    type: 'exhibition',
    zone: 'paris_15',
    corridor: 'sud',
    lat: 48.8321,
    lng: 2.2885,
    capacity: 50000,
    endTimeRule: {
      typicalEnd: '18:30',
      exitWindowMinutes: 60,
    },
    entryHint: 'Porte de Versailles, Hall 1 ou Pavillon 7',
    rideProfile: 'mixed',
    parkingZones: ['porte-versailles', 'balard'],
  },
  {
    id: 'villepinte',
    name: 'Parc des Expositions - Villepinte',
    type: 'exhibition',
    zone: 'villepinte',
    corridor: 'nord',
    lat: 48.9691,
    lng: 2.5153,
    capacity: 70000,
    endTimeRule: {
      typicalEnd: '18:00',
      exitWindowMinutes: 60,
    },
    entryHint: 'Navette RER B, entrée principale Hall 1',
    rideProfile: 'premium_long',
    parkingZones: ['villepinte', 'cdg'],
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function getVenueById(id: string): VenueNode | undefined {
  return PARIS_VENUES.find(v => v.id === id)
}

export function getVenuesByType(type: VenueType): VenueNode[] {
  return PARIS_VENUES.filter(v => v.type === type)
}

export function getVenuesByZone(zone: string): VenueNode[] {
  return PARIS_VENUES.filter(v => v.zone === zone)
}

export function getVenuesByCorridor(corridor: string): VenueNode[] {
  return PARIS_VENUES.filter(v => v.corridor === corridor)
}

export function getLargeVenues(minCapacity: number = 5000): VenueNode[] {
  return PARIS_VENUES.filter(v => (v.capacity || 0) >= minCapacity)
}

/**
 * Calculate expected exit window for a venue
 * @param venue - Venue node
 * @param eventEndTime - Actual event end time (if known)
 * @returns { start: Date, end: Date } exit window
 */
export function calculateExitWindow(
  venue: VenueNode,
  eventEndTime?: Date
): { start: Date; end: Date } | null {
  if (!venue.endTimeRule) return null

  const baseTime = eventEndTime || (() => {
    const now = new Date()
    const [hours, minutes] = venue.endTimeRule!.typicalEnd.split(':').map(Number)
    now.setHours(hours, minutes, 0, 0)
    return now
  })()

  const windowMinutes = venue.endTimeRule.exitWindowMinutes
  const start = new Date(baseTime.getTime() - 5 * 60 * 1000) // 5 min before
  const end = new Date(baseTime.getTime() + windowMinutes * 60 * 1000)

  return { start, end }
}
