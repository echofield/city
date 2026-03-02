// ============================================
// PARIS ZONES — Driver-Relevant POIs
// ============================================
// Not arrondissements. These are the places
// where drivers actually need to be positioned.
//
// Coordinate system: 1000x700 viewBox (like ARCHÉ)
// Center of Paris ≈ (500, 380)
// ============================================

export interface ZoneDefinition {
  id: string
  label: string
  shortLabel: string  // For tight spaces
  center: [number, number]  // SVG coordinates

  // Base intensity profile (0-1)
  // These are the "natural" intensities before real-time modulation
  intensity: {
    nightlife: number   // Bars, clubs, restaurants
    business: number    // Corporate, meetings, airport runs
    transit: number     // Train stations, metro hubs
    event: number       // Concerts, sports, conferences
  }

  // Adjacent zones for corridor rendering
  neighbors: string[]

  // Visual sizing (affects node radius)
  weight: 'major' | 'standard' | 'minor'
}

export const PARIS_ZONES: ZoneDefinition[] = [
  // ════════════════════════════════════════
  // GARES — High transit, predictable windows
  // ════════════════════════════════════════
  {
    id: 'gare-nord',
    label: 'Gare du Nord',
    shortLabel: 'Nord',
    center: [540, 195],
    intensity: { nightlife: 0.3, business: 0.7, transit: 1.0, event: 0.3 },
    neighbors: ['gare-est', 'opera', 'pigalle', 'republique'],
    weight: 'major',
  },
  {
    id: 'gare-est',
    label: 'Gare de l\'Est',
    shortLabel: 'Est',
    center: [575, 210],
    intensity: { nightlife: 0.2, business: 0.6, transit: 0.9, event: 0.2 },
    neighbors: ['gare-nord', 'republique', 'belleville'],
    weight: 'major',
  },
  {
    id: 'gare-lyon',
    label: 'Gare de Lyon',
    shortLabel: 'Lyon',
    center: [610, 420],
    intensity: { nightlife: 0.25, business: 0.8, transit: 1.0, event: 0.4 },
    neighbors: ['bastille', 'bercy', 'nation'],
    weight: 'major',
  },
  {
    id: 'saint-lazare',
    label: 'Saint-Lazare',
    shortLabel: 'Lazare',
    center: [420, 240],
    intensity: { nightlife: 0.2, business: 0.85, transit: 0.9, event: 0.3 },
    neighbors: ['opera', 'pigalle', 'defense'],
    weight: 'major',
  },
  {
    id: 'montparnasse',
    label: 'Montparnasse',
    shortLabel: 'Montp.',
    center: [430, 480],
    intensity: { nightlife: 0.4, business: 0.7, transit: 0.85, event: 0.3 },
    neighbors: ['invalides', 'latin', 'nation'],
    weight: 'major',
  },

  // ════════════════════════════════════════
  // NIGHTLIFE — High volatility, late peaks
  // ════════════════════════════════════════
  {
    id: 'bastille',
    label: 'Bastille',
    shortLabel: 'Bastille',
    center: [590, 370],
    intensity: { nightlife: 0.9, business: 0.3, transit: 0.5, event: 0.6 },
    neighbors: ['marais', 'oberkampf', 'gare-lyon', 'nation'],
    weight: 'major',
  },
  {
    id: 'oberkampf',
    label: 'Oberkampf',
    shortLabel: 'Ober.',
    center: [600, 310],
    intensity: { nightlife: 0.95, business: 0.2, transit: 0.3, event: 0.4 },
    neighbors: ['bastille', 'republique', 'belleville', 'marais'],
    weight: 'standard',
  },
  {
    id: 'pigalle',
    label: 'Pigalle',
    shortLabel: 'Pigalle',
    center: [480, 180],
    intensity: { nightlife: 0.85, business: 0.15, transit: 0.4, event: 0.5 },
    neighbors: ['montmartre', 'opera', 'saint-lazare', 'gare-nord'],
    weight: 'standard',
  },
  {
    id: 'marais',
    label: 'Marais',
    shortLabel: 'Marais',
    center: [560, 340],
    intensity: { nightlife: 0.8, business: 0.5, transit: 0.4, event: 0.5 },
    neighbors: ['bastille', 'chatelet', 'republique', 'oberkampf'],
    weight: 'standard',
  },
  {
    id: 'montmartre',
    label: 'Montmartre',
    shortLabel: 'Monm.',
    center: [490, 145],
    intensity: { nightlife: 0.7, business: 0.2, transit: 0.3, event: 0.4 },
    neighbors: ['pigalle', 'gare-nord'],
    weight: 'standard',
  },

  // ════════════════════════════════════════
  // BUSINESS — Day peaks, corporate rhythm
  // ════════════════════════════════════════
  {
    id: 'defense',
    label: 'La Défense',
    shortLabel: 'Défense',
    center: [250, 260],
    intensity: { nightlife: 0.1, business: 1.0, transit: 0.7, event: 0.4 },
    neighbors: ['saint-lazare', 'champs'],
    weight: 'major',
  },
  {
    id: 'opera',
    label: 'Opéra',
    shortLabel: 'Opéra',
    center: [470, 280],
    intensity: { nightlife: 0.5, business: 0.9, transit: 0.6, event: 0.6 },
    neighbors: ['saint-lazare', 'pigalle', 'gare-nord', 'chatelet', 'champs'],
    weight: 'major',
  },
  {
    id: 'champs',
    label: 'Champs-Élysées',
    shortLabel: 'Champs',
    center: [380, 300],
    intensity: { nightlife: 0.6, business: 0.8, transit: 0.4, event: 0.7 },
    neighbors: ['opera', 'defense', 'invalides', 'trocadero'],
    weight: 'major',
  },

  // ════════════════════════════════════════
  // EVENTS — High event intensity, variable
  // ════════════════════════════════════════
  {
    id: 'bercy',
    label: 'Bercy',
    shortLabel: 'Bercy',
    center: [680, 440],
    intensity: { nightlife: 0.5, business: 0.3, transit: 0.4, event: 1.0 },
    neighbors: ['gare-lyon', 'nation'],
    weight: 'major',
  },
  {
    id: 'stade-france',
    label: 'Stade de France',
    shortLabel: 'Stade',
    center: [540, 100],
    intensity: { nightlife: 0.2, business: 0.2, transit: 0.5, event: 0.95 },
    neighbors: ['gare-nord'],
    weight: 'standard',
  },

  // ════════════════════════════════════════
  // MIXED — Versatile zones
  // ════════════════════════════════════════
  {
    id: 'chatelet',
    label: 'Châtelet',
    shortLabel: 'Châtelet',
    center: [500, 360],
    intensity: { nightlife: 0.6, business: 0.6, transit: 0.7, event: 0.5 },
    neighbors: ['marais', 'opera', 'latin', 'invalides'],
    weight: 'standard',
  },
  {
    id: 'republique',
    label: 'République',
    shortLabel: 'Rép.',
    center: [560, 275],
    intensity: { nightlife: 0.65, business: 0.5, transit: 0.6, event: 0.4 },
    neighbors: ['gare-nord', 'gare-est', 'oberkampf', 'marais', 'belleville'],
    weight: 'standard',
  },
  {
    id: 'belleville',
    label: 'Belleville',
    shortLabel: 'Belle.',
    center: [620, 250],
    intensity: { nightlife: 0.7, business: 0.2, transit: 0.3, event: 0.3 },
    neighbors: ['gare-est', 'oberkampf', 'republique'],
    weight: 'minor',
  },
  {
    id: 'nation',
    label: 'Nation',
    shortLabel: 'Nation',
    center: [700, 390],
    intensity: { nightlife: 0.4, business: 0.5, transit: 0.6, event: 0.4 },
    neighbors: ['bastille', 'gare-lyon', 'bercy'],
    weight: 'standard',
  },
  {
    id: 'latin',
    label: 'Quartier Latin',
    shortLabel: 'Latin',
    center: [500, 430],
    intensity: { nightlife: 0.6, business: 0.4, transit: 0.4, event: 0.4 },
    neighbors: ['chatelet', 'montparnasse'],
    weight: 'minor',
  },
  {
    id: 'invalides',
    label: 'Invalides',
    shortLabel: 'Inval.',
    center: [390, 390],
    intensity: { nightlife: 0.3, business: 0.7, transit: 0.5, event: 0.5 },
    neighbors: ['champs', 'chatelet', 'montparnasse', 'trocadero'],
    weight: 'standard',
  },
  {
    id: 'trocadero',
    label: 'Trocadéro',
    shortLabel: 'Troca.',
    center: [320, 360],
    intensity: { nightlife: 0.3, business: 0.6, transit: 0.4, event: 0.6 },
    neighbors: ['champs', 'invalides', 'defense'],
    weight: 'standard',
  },
]

// ════════════════════════════════════════
// SEINE PATH — For visual authenticity
// ════════════════════════════════════════
// Simplified path from ARCHÉ, adapted to our viewBox
export const SEINE_PATH = {
  north: [
    [755, 445], [700, 420], [645, 398], [590, 378],
    [545, 362], [505, 350], [470, 342], [435, 338],
    [400, 338], [365, 342], [325, 355], [280, 378], [240, 405],
  ] as [number, number][],
  south: [
    [755, 468], [700, 445], [645, 423], [590, 404],
    [545, 390], [505, 380], [470, 374], [435, 370],
    [400, 370], [365, 374], [325, 387], [280, 408], [240, 432],
  ] as [number, number][],
}

// ════════════════════════════════════════
// PÉRIPHÉRIQUE — City boundary anchor
// ════════════════════════════════════════
export const PERIPHERIQUE = {
  cx: 500,
  cy: 340,
  rx: 300,
  ry: 270,
}

// ════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════

export function getZoneById(id: string): ZoneDefinition | undefined {
  return PARIS_ZONES.find(z => z.id === id)
}

export function getZonesByIntensity(
  category: keyof ZoneDefinition['intensity'],
  threshold: number = 0.5
): ZoneDefinition[] {
  return PARIS_ZONES.filter(z => z.intensity[category] >= threshold)
}

export function getNeighbors(zoneId: string): ZoneDefinition[] {
  const zone = getZoneById(zoneId)
  if (!zone) return []
  return zone.neighbors
    .map(id => getZoneById(id))
    .filter((z): z is ZoneDefinition => z !== undefined)
}

// Build all unique corridors from neighbor relationships
export function buildCorridors(): { from: string; to: string }[] {
  const seen = new Set<string>()
  const corridors: { from: string; to: string }[] = []

  for (const zone of PARIS_ZONES) {
    for (const neighborId of zone.neighbors) {
      const key = [zone.id, neighborId].sort().join('-')
      if (!seen.has(key)) {
        seen.add(key)
        corridors.push({ from: zone.id, to: neighborId })
      }
    }
  }

  return corridors
}
