/**
 * PARIS NIGHTLIFE CLUSTERS
 *
 * Major nightlife areas: bars, clubs, restaurant districts.
 * Used for late-night signal generation and forced mobility computation.
 */

import type { ClusterNode } from '@/core/types'

// ═══════════════════════════════════════════════════════════════════════════
// NIGHTLIFE CLUSTER CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const PARIS_NIGHTLIFE: ClusterNode[] = [
  // ── Major Bar Districts ──
  {
    id: 'bastille-bars',
    name: 'Bastille',
    zone: 'paris_11',
    corridor: 'est',
    lat: 48.8533,
    lng: 2.3692,
    barCloseHour: 2,
    clubCloseHour: 6,
    density: 0.9,
    positioningHint: 'Rue de Lappe et rue de la Roquette',
    peakNights: ['thursday', 'friday', 'saturday'],
    clubs: ['Le Baron', 'Badaboum', 'Glazart'],
  },
  {
    id: 'oberkampf-bars',
    name: 'Oberkampf',
    zone: 'paris_11',
    corridor: 'est',
    lat: 48.8650,
    lng: 2.3773,
    barCloseHour: 2,
    clubCloseHour: 5,
    density: 0.75,
    positioningHint: 'Rue Oberkampf, station Parmentier',
    peakNights: ['friday', 'saturday'],
    clubs: ['Nouveau Casino', 'Point Ephemere'],
  },
  {
    id: 'pigalle-bars',
    name: 'Pigalle',
    zone: 'paris_18',
    corridor: 'nord',
    lat: 48.8822,
    lng: 2.3370,
    barCloseHour: 4,
    clubCloseHour: 6,
    density: 0.85,
    positioningHint: 'Place Pigalle, Boulevard de Clichy',
    peakNights: ['friday', 'saturday'],
    clubs: ['Bus Palladium', 'La Machine du Moulin Rouge', 'Le Carmen'],
  },
  {
    id: 'marais-bars',
    name: 'Marais',
    zone: 'paris_4',
    corridor: 'centre',
    lat: 48.8594,
    lng: 2.3615,
    barCloseHour: 2,
    clubCloseHour: 4,
    density: 0.8,
    positioningHint: 'Rue Vieille du Temple, rue des Archives',
    peakNights: ['friday', 'saturday', 'sunday'],
    clubs: ['Open Cafe', 'Cox'],
  },
  {
    id: 'grands-boulevards-bars',
    name: 'Grands Boulevards',
    zone: 'paris_9',
    corridor: 'centre',
    lat: 48.8706,
    lng: 2.3487,
    barCloseHour: 2,
    clubCloseHour: 6,
    density: 0.7,
    positioningHint: 'Boulevard Montmartre, station Grands Boulevards',
    peakNights: ['friday', 'saturday'],
    clubs: ['Rex Club', 'Social Club'],
  },
  {
    id: 'champs-elysees-bars',
    name: 'Champs-Élysées',
    zone: 'paris_8',
    corridor: 'ouest',
    lat: 48.8698,
    lng: 2.3075,
    barCloseHour: 4,
    clubCloseHour: 6,
    density: 0.6,
    positioningHint: 'Avenue des Champs-Élysées, rue de Ponthieu',
    peakNights: ['friday', 'saturday'],
    clubs: ['Queen', 'L\'Arc', 'Raspoutine'],
  },
  {
    id: 'saint-germain-bars',
    name: 'Saint-Germain',
    zone: 'paris_6',
    corridor: 'sud',
    lat: 48.8530,
    lng: 2.3327,
    barCloseHour: 2,
    clubCloseHour: 4,
    density: 0.5,
    positioningHint: 'Rue de Buci, rue Saint-André des Arts',
    peakNights: ['friday', 'saturday'],
    clubs: ['Castel', 'Chez Georges'],
  },
  {
    id: 'canal-saint-martin-bars',
    name: 'Canal Saint-Martin',
    zone: 'paris_10',
    corridor: 'nord',
    lat: 48.8714,
    lng: 2.3654,
    barCloseHour: 2,
    clubCloseHour: 4,
    density: 0.65,
    positioningHint: 'Quai de Valmy, rue de Lancry',
    peakNights: ['thursday', 'friday', 'saturday'],
    clubs: ['Le Comptoir General'],
  },
  {
    id: 'belleville-bars',
    name: 'Belleville',
    zone: 'paris_20',
    corridor: 'est',
    lat: 48.8700,
    lng: 2.3850,
    barCloseHour: 2,
    clubCloseHour: 5,
    density: 0.6,
    positioningHint: 'Rue de Belleville, station Jourdain',
    peakNights: ['friday', 'saturday'],
    clubs: ['La Bellevilloise'],
  },

  // ── Restaurant Districts (post-dinner surge) ──
  {
    id: 'chatelet-restaurants',
    name: 'Châtelet',
    zone: 'paris_1',
    corridor: 'centre',
    lat: 48.8584,
    lng: 2.3474,
    barCloseHour: 1,
    clubCloseHour: 2,
    density: 0.7,
    positioningHint: 'Place du Châtelet, rue de Rivoli',
    peakNights: ['friday', 'saturday'],
    clubs: [],
  },
  {
    id: 'opera-restaurants',
    name: 'Opéra',
    zone: 'paris_9',
    corridor: 'centre',
    lat: 48.8707,
    lng: 2.3276,
    barCloseHour: 1,
    clubCloseHour: 2,
    density: 0.65,
    positioningHint: 'Boulevard des Capucines, Place de l\'Opéra',
    peakNights: ['friday', 'saturday'],
    clubs: [],
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function getClusterById(id: string): ClusterNode | undefined {
  return PARIS_NIGHTLIFE.find(c => c.id === id)
}

export function getClustersByZone(zone: string): ClusterNode[] {
  return PARIS_NIGHTLIFE.filter(c => c.zone === zone)
}

export function getClustersByCorridor(corridor: string): ClusterNode[] {
  return PARIS_NIGHTLIFE.filter(c => c.corridor === corridor)
}

export function getActiveClustersAt(hour: number): ClusterNode[] {
  // Active if hour is after 21:00 (9 PM) and before close hour
  return PARIS_NIGHTLIFE.filter(c => {
    if (hour >= 21) return true // Pre-midnight activity
    if (hour <= c.barCloseHour) return true // Still open
    return false
  })
}

export function getClustersClosingAt(hour: number): ClusterNode[] {
  return PARIS_NIGHTLIFE.filter(c =>
    c.barCloseHour === hour || c.clubCloseHour === hour
  )
}

export function getPeakNightClusters(dayName: string): ClusterNode[] {
  const day = dayName.toLowerCase()
  return PARIS_NIGHTLIFE.filter(c =>
    c.peakNights?.includes(day)
  )
}

/**
 * Get expected closure waves for tonight
 * @param isWeekend - Is it a weekend night (Fri/Sat)
 * @returns Array of { hour, clusters } representing closure waves
 */
export function getClosureWaves(isWeekend: boolean): Array<{
  hour: number
  clusters: ClusterNode[]
  totalDensity: number
}> {
  const waves: Map<number, ClusterNode[]> = new Map()

  for (const cluster of PARIS_NIGHTLIFE) {
    // On weekends, clubs stay open longer
    const barHour = cluster.barCloseHour
    const clubHour = isWeekend ? cluster.clubCloseHour : cluster.clubCloseHour - 1

    // Add bar closure wave
    if (!waves.has(barHour)) waves.set(barHour, [])
    waves.get(barHour)!.push(cluster)

    // Add club closure wave if different
    if (clubHour !== barHour && cluster.clubs && cluster.clubs.length > 0) {
      if (!waves.has(clubHour)) waves.set(clubHour, [])
      // Don't add again, clubs are part of same cluster
    }
  }

  return Array.from(waves.entries())
    .map(([hour, clusters]) => ({
      hour,
      clusters,
      totalDensity: clusters.reduce((sum, c) => sum + c.density, 0),
    }))
    .sort((a, b) => {
      // Sort by time, with hours after midnight coming after 23
      const aHour = a.hour < 6 ? a.hour + 24 : a.hour
      const bHour = b.hour < 6 ? b.hour + 24 : b.hour
      return aHour - bHour
    })
}
