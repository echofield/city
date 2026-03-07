/**
 * PARIS AIRPORTS
 *
 * CDG (Charles de Gaulle) and ORY (Orly) configuration.
 * Used for Aviationstack integration and Forced Mobility computation.
 */

import type { AirportNode } from '@/core/types'

// ═══════════════════════════════════════════════════════════════════════════
// AIRPORT CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const PARIS_AIRPORTS: AirportNode[] = [
  {
    id: 'cdg',
    iata: 'CDG',
    name: 'Charles de Gaulle',
    corridor: 'nord',
    lat: 49.0097,
    lng: 2.5479,
    terminals: ['1', '2A', '2B', '2C', '2D', '2E', '2F', '2G', '3'],
    avgPassengersPerFlight: 180,
    customsDelay: 20,
    baggageDelay: 15,
    positioningHint: 'Terminal 2E/2F pour international long-courrier',
    rideProfile: 'premium_long',
    terminalHints: {
      '1': 'Vols internationaux, Star Alliance',
      '2A': 'Vols Schengen Air France',
      '2B': 'Compagnies Schengen',
      '2C': 'Vols Schengen',
      '2D': 'Vols Schengen Air France',
      '2E': 'Long-courrier Air France, SkyTeam',
      '2F': 'Long-courrier Air France, SkyTeam',
      '2G': 'Vols régionaux',
      '3': 'Low-cost, charter',
    },
  },
  {
    id: 'ory',
    iata: 'ORY',
    name: 'Orly',
    corridor: 'sud',
    lat: 48.7262,
    lng: 2.3652,
    terminals: ['1', '2', '3', '4'],
    avgPassengersPerFlight: 150,
    customsDelay: 15,
    baggageDelay: 12,
    positioningHint: 'Terminal Sud pour vols domestiques',
    rideProfile: 'long',
    terminalHints: {
      '1': 'Vols domestiques, Transavia',
      '2': 'Vols internationaux',
      '3': 'Vols internationaux',
      '4': 'Vols domestiques Air France',
    },
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function getAirportByIata(iata: string): AirportNode | undefined {
  return PARIS_AIRPORTS.find(a => a.iata === iata)
}

export function getAirportById(id: string): AirportNode | undefined {
  return PARIS_AIRPORTS.find(a => a.id === id)
}

/**
 * Get positioning hint for a specific terminal
 */
export function getTerminalHint(airportIata: string, terminal: string): string {
  const airport = getAirportByIata(airportIata)
  if (!airport || !airport.terminalHints) {
    return airport?.positioningHint || ''
  }
  return airport.terminalHints[terminal] || airport.positioningHint
}

/**
 * Calculate estimated passenger release time after arrival
 * @param arrivalTime - Flight arrival time
 * @param airport - Airport node
 * @param isInternational - Whether flight is international
 * @returns Date of estimated passenger release
 */
export function estimatePassengerReleaseTime(
  arrivalTime: Date,
  airport: AirportNode,
  isInternational: boolean
): Date {
  const delayMinutes =
    airport.baggageDelay + (isInternational ? airport.customsDelay : 0)
  return new Date(arrivalTime.getTime() + delayMinutes * 60 * 1000)
}
