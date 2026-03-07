/**
 * PARIS CITY CONFIG
 *
 * Master configuration for Paris, France.
 * Implements the universal CityConfig interface.
 */

import type { CityConfig, Corridor } from '@/core/types'
import { PARIS_ZONES, PARIS_BANLIEUE_HUBS } from './zones'
import { PARIS_AIRPORTS } from './airports'
import { PARIS_STATIONS } from './stations'
import { PARIS_VENUES } from './venues'
import { PARIS_NIGHTLIFE } from './nightlife'

// ═══════════════════════════════════════════════════════════════════════════
// CORRIDORS
// ═══════════════════════════════════════════════════════════════════════════

export const PARIS_CORRIDORS: Corridor[] = [
  {
    id: 'nord',
    label: 'NORD',
    color: '#10B981', // Emerald
    description: 'Gare du Nord, Saint-Denis, CDG',
  },
  {
    id: 'est',
    label: 'EST',
    color: '#F59E0B', // Amber
    description: 'Bastille, Nation, Montreuil',
  },
  {
    id: 'sud',
    label: 'SUD',
    color: '#EF4444', // Red
    description: 'Montparnasse, Orly, Porte d\'Orléans',
  },
  {
    id: 'ouest',
    label: 'OUEST',
    color: '#3B82F6', // Blue
    description: 'Champs-Élysées, La Défense, Neuilly',
  },
  {
    id: 'centre',
    label: 'CENTRE',
    color: '#8B5CF6', // Purple
    description: 'Châtelet, Opéra, Marais',
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// PARIS CONFIG
// ═══════════════════════════════════════════════════════════════════════════

export const PARIS_CONFIG: CityConfig = {
  // ── Identity ──
  cityId: 'paris',
  name: 'Paris',
  country: 'FR',
  timezone: 'Europe/Paris',
  locale: 'fr-FR',
  currency: 'EUR',

  // ── Map ──
  center: { lat: 48.8566, lng: 2.3522 },
  defaultZoom: 12,
  bounds: {
    north: 48.95,
    south: 48.80,
    east: 2.50,
    west: 2.20,
  },

  // ── Geographic Structure ──
  zones: PARIS_ZONES,
  corridors: PARIS_CORRIDORS,

  // ── Nodes ──
  airports: PARIS_AIRPORTS,
  stations: PARIS_STATIONS,
  venues: PARIS_VENUES,
  nightlifeClusters: PARIS_NIGHTLIFE,

  // ── Transport Rules ──
  transportRules: {
    metroStart: '05:30',
    metroEnd: '00:30',
    weekendMetroEnd: '02:00',
    weaknessThresholds: {
      strong: 23,   // After 23:00, transport weakness > 50
      extreme: 1,   // After 01:00, transport weakness > 80
    },
    hasNightBus: true,
    nightBusRoutes: ['N01', 'N02', 'N11', 'N12', 'N13', 'N14', 'N15', 'N16', 'N21', 'N22', 'N23', 'N24', 'N31', 'N32', 'N33', 'N34', 'N35', 'N41', 'N42', 'N43', 'N44', 'N45', 'N51', 'N52', 'N53', 'N61', 'N62', 'N63', 'N66', 'N71', 'N122', 'N130', 'N131', 'N132', 'N133', 'N134', 'N135', 'N140', 'N141', 'N142', 'N143', 'N144', 'N145', 'N150', 'N151', 'N152', 'N153', 'N154'],
  },

  // ── Strategy Profile ──
  strategyProfile: {
    airportWeight: 0.9,    // Airports are high priority
    stationWeight: 0.85,   // Stations very important
    nightlifeWeight: 0.7,  // Nightlife moderate
    eventWeight: 0.8,      // Events high priority
    officeWeight: 0.5,     // Office districts less predictable
    hotelWeight: 0.6,      // Hotels moderate
  },

  // ── Labels (French) ──
  labels: {
    corridors: {
      nord: 'Nord',
      est: 'Est',
      sud: 'Sud',
      ouest: 'Ouest',
      centre: 'Centre',
    },
    zoneTypes: {
      arrondissement: 'Arrondissement',
      island: 'Île',
    },
    signalTypes: {
      event_exit: 'Sortie événement',
      transport_wave: 'Vague transport',
      nightlife_closure: 'Fermeture nuit',
      airport_release: 'Arrivées aéroport',
      station_release: 'Arrivées gare',
      weather: 'Météo',
      friction: 'Friction',
      skeleton: 'Récurrent',
      compound: 'Combiné',
    },
    actions: {
      hold: 'Maintenir',
      prepare: 'Préparer',
      move: 'Rejoindre',
      rest: 'Pause',
    },
    rideProfiles: {
      short_fast: 'Courses courtes',
      mixed: 'Mixte',
      long: 'Courses longues',
      premium_long: 'Courses premium',
    },
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { PARIS_BANLIEUE_HUBS }
