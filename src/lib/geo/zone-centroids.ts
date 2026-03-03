/**
 * Zone centroids (GPS coordinates) for city-flow.
 * Used for distance calculations and proximity sorting.
 */

export interface ZoneCentroid {
  lat: number
  lng: number
}

/**
 * Paris arrondissements (1-20).
 */
export const ARRONDISSEMENT_CENTERS: Record<number, ZoneCentroid> = {
  1: { lat: 48.8610, lng: 2.3362 },
  2: { lat: 48.8687, lng: 2.3441 },
  3: { lat: 48.8637, lng: 2.3612 },
  4: { lat: 48.8544, lng: 2.3574 },
  5: { lat: 48.8462, lng: 2.3508 },
  6: { lat: 48.8498, lng: 2.3322 },
  7: { lat: 48.8575, lng: 2.3127 },
  8: { lat: 48.8744, lng: 2.3106 },
  9: { lat: 48.8768, lng: 2.3382 },
  10: { lat: 48.8762, lng: 2.3614 },
  11: { lat: 48.8596, lng: 2.3810 },
  12: { lat: 48.8396, lng: 2.4160 },
  13: { lat: 48.8322, lng: 2.3561 },
  14: { lat: 48.8331, lng: 2.3264 },
  15: { lat: 48.8421, lng: 2.2990 },
  16: { lat: 48.8590, lng: 2.2686 },
  17: { lat: 48.8880, lng: 2.3140 },
  18: { lat: 48.8925, lng: 2.3444 },
  19: { lat: 48.8860, lng: 2.3822 },
  20: { lat: 48.8638, lng: 2.3985 },
}

/**
 * Named zones (gares, venues, banlieue).
 * Maps zone IDs from paris-zones.ts to GPS coordinates.
 */
export const ZONE_CENTERS: Record<string, ZoneCentroid> = {
  // ════════════════════════════════════════
  // GARES PARIS
  // ════════════════════════════════════════
  'gare-nord': { lat: 48.8809, lng: 2.3553 },
  'gare-est': { lat: 48.8763, lng: 2.3594 },
  'gare-lyon': { lat: 48.8443, lng: 2.3735 },
  'saint-lazare': { lat: 48.8756, lng: 2.3247 },
  'montparnasse': { lat: 48.8414, lng: 2.3210 },

  // ════════════════════════════════════════
  // ZONES PARIS
  // ════════════════════════════════════════
  'bastille': { lat: 48.8533, lng: 2.3694 },
  'oberkampf': { lat: 48.8647, lng: 2.3783 },
  'pigalle': { lat: 48.8821, lng: 2.3374 },
  'marais': { lat: 48.8566, lng: 2.3622 },
  'montmartre': { lat: 48.8867, lng: 2.3431 },
  'opera': { lat: 48.8719, lng: 2.3316 },
  'champs': { lat: 48.8698, lng: 2.3078 },
  'bercy': { lat: 48.8396, lng: 2.3822 },
  'stade-france': { lat: 48.9244, lng: 2.3601 },
  'chatelet': { lat: 48.8584, lng: 2.3474 },
  'republique': { lat: 48.8675, lng: 2.3638 },
  'belleville': { lat: 48.8717, lng: 2.3847 },
  'nation': { lat: 48.8483, lng: 2.3959 },
  'latin': { lat: 48.8494, lng: 2.3445 },
  'invalides': { lat: 48.8566, lng: 2.3125 },
  'trocadero': { lat: 48.8616, lng: 2.2875 },

  // ════════════════════════════════════════
  // BANLIEUE 92 — Hauts-de-Seine
  // ════════════════════════════════════════
  'defense': { lat: 48.8918, lng: 2.2362 },
  'nanterre': { lat: 48.8924, lng: 2.2066 },
  'boulogne': { lat: 48.8397, lng: 2.2399 },
  'issy': { lat: 48.8244, lng: 2.2700 },

  // ════════════════════════════════════════
  // BANLIEUE 93 — Seine-Saint-Denis
  // ════════════════════════════════════════
  'saint-denis': { lat: 48.9362, lng: 2.3574 },
  'aubervilliers': { lat: 48.9147, lng: 2.3831 },
  'pantin': { lat: 48.8936, lng: 2.4025 },
  'bobigny': { lat: 48.9096, lng: 2.4400 },
  'villepinte': { lat: 48.9617, lng: 2.5447 },
  'le-bourget': { lat: 48.9319, lng: 2.4253 },

  // ════════════════════════════════════════
  // BANLIEUE 94 — Val-de-Marne
  // ════════════════════════════════════════
  'vincennes': { lat: 48.8472, lng: 2.4386 },
  'creteil': { lat: 48.7904, lng: 2.4556 },
  'ivry': { lat: 48.8155, lng: 2.3847 },
  'orly': { lat: 48.7262, lng: 2.3652 },

  // ════════════════════════════════════════
  // AEROPORTS
  // ════════════════════════════════════════
  'cdg': { lat: 49.0097, lng: 2.5479 },
}

/**
 * Get centroid for any zone (by ID or arrondissement number).
 */
export function getZoneCentroid(zoneIdOrArr: string | number): ZoneCentroid | null {
  if (typeof zoneIdOrArr === 'number') {
    return ARRONDISSEMENT_CENTERS[zoneIdOrArr] ?? null
  }
  return ZONE_CENTERS[zoneIdOrArr] ?? null
}

/**
 * Get all zone IDs.
 */
export function getAllZoneIds(): string[] {
  return Object.keys(ZONE_CENTERS)
}
