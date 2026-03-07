/**
 * PARIS ZONES
 *
 * 20 arrondissements + 2 islands (Cité, Saint-Louis)
 * Extracted from parisData.ts and normalized to universal Zone type.
 */

import type { Zone, ZoneType, ZoneCharacteristics } from '@/core/types'

// ═══════════════════════════════════════════════════════════════════════════
// ARRONDISSEMENT DATA
// ═══════════════════════════════════════════════════════════════════════════

interface RawArrondissement {
  id: string
  name: string
  displayName: string
  subtitle: string
  center: [number, number]
  neighbors: string[]
  density: number
  corridor: string
  characteristics: ZoneCharacteristics
}

const RAW_ARRONDISSEMENTS: RawArrondissement[] = [
  {
    id: 'paris_1',
    name: '1er',
    displayName: 'Iᵉʳ arr.',
    subtitle: 'Louvre · Châtelet',
    center: [48.8606, 2.3376],
    neighbors: ['paris_2', 'paris_4', 'paris_8', 'paris_9', 'cite'],
    density: 0.8,
    corridor: 'centre',
    characteristics: {
      primary: 'tourist',
      secondary: ['business', 'nightlife'],
      isBusinessDistrict: true,
      isNightlifeHub: true,
      isTouristArea: true,
      isResidential: false,
    },
  },
  {
    id: 'paris_2',
    name: '2e',
    displayName: 'IIᵉ arr.',
    subtitle: 'Bourse · Sentier',
    center: [48.8687, 2.3407],
    neighbors: ['paris_1', 'paris_3', 'paris_9', 'paris_10'],
    density: 0.7,
    corridor: 'centre',
    characteristics: {
      primary: 'business',
      secondary: ['mixed'],
      isBusinessDistrict: true,
      isNightlifeHub: false,
      isTouristArea: false,
      isResidential: false,
    },
  },
  {
    id: 'paris_3',
    name: '3e',
    displayName: 'IIIᵉ arr.',
    subtitle: 'Temple · Haut Marais',
    center: [48.8635, 2.3615],
    neighbors: ['paris_2', 'paris_4', 'paris_10', 'paris_11'],
    density: 0.75,
    corridor: 'centre',
    characteristics: {
      primary: 'mixed',
      secondary: ['tourist', 'nightlife'],
      isBusinessDistrict: false,
      isNightlifeHub: true,
      isTouristArea: true,
      isResidential: true,
    },
  },
  {
    id: 'paris_4',
    name: '4e',
    displayName: 'IVᵉ arr.',
    subtitle: 'Marais · Hôtel de Ville',
    center: [48.8544, 2.3573],
    neighbors: ['paris_1', 'paris_3', 'paris_11', 'paris_12', 'cite', 'stlouis'],
    density: 0.85,
    corridor: 'centre',
    characteristics: {
      primary: 'tourist',
      secondary: ['nightlife', 'residential'],
      isBusinessDistrict: false,
      isNightlifeHub: true,
      isTouristArea: true,
      isResidential: true,
    },
  },
  {
    id: 'paris_5',
    name: '5e',
    displayName: 'Vᵉ arr.',
    subtitle: 'Panthéon · Quartier Latin',
    center: [48.8462, 2.3484],
    neighbors: ['paris_6', 'paris_13', 'paris_14', 'cite', 'stlouis'],
    density: 0.7,
    corridor: 'sud',
    characteristics: {
      primary: 'tourist',
      secondary: ['residential'],
      isBusinessDistrict: false,
      isNightlifeHub: false,
      isTouristArea: true,
      isResidential: true,
    },
  },
  {
    id: 'paris_6',
    name: '6e',
    displayName: 'VIᵉ arr.',
    subtitle: 'Luxembourg · Saint-Germain',
    center: [48.8499, 2.3319],
    neighbors: ['paris_5', 'paris_7', 'paris_14', 'paris_15'],
    density: 0.65,
    corridor: 'sud',
    characteristics: {
      primary: 'tourist',
      secondary: ['residential', 'business'],
      isBusinessDistrict: false,
      isNightlifeHub: false,
      isTouristArea: true,
      isResidential: true,
    },
  },
  {
    id: 'paris_7',
    name: '7e',
    displayName: 'VIIᵉ arr.',
    subtitle: 'Tour Eiffel · Invalides',
    center: [48.8566, 2.3150],
    neighbors: ['paris_6', 'paris_8', 'paris_15', 'paris_16'],
    density: 0.5,
    corridor: 'ouest',
    characteristics: {
      primary: 'tourist',
      secondary: ['business', 'residential'],
      isBusinessDistrict: true,
      isNightlifeHub: false,
      isTouristArea: true,
      isResidential: true,
    },
  },
  {
    id: 'paris_8',
    name: '8e',
    displayName: 'VIIIᵉ arr.',
    subtitle: 'Champs-Élysées · Madeleine',
    center: [48.8755, 2.3113],
    neighbors: ['paris_1', 'paris_7', 'paris_9', 'paris_16', 'paris_17'],
    density: 0.4,
    corridor: 'ouest',
    characteristics: {
      primary: 'business',
      secondary: ['tourist', 'nightlife'],
      isBusinessDistrict: true,
      isNightlifeHub: true,
      isTouristArea: true,
      isResidential: false,
    },
  },
  {
    id: 'paris_9',
    name: '9e',
    displayName: 'IXᵉ arr.',
    subtitle: 'Opéra · Grands Boulevards',
    center: [48.8767, 2.3373],
    neighbors: ['paris_1', 'paris_2', 'paris_8', 'paris_10', 'paris_17', 'paris_18'],
    density: 0.6,
    corridor: 'nord',
    characteristics: {
      primary: 'business',
      secondary: ['nightlife', 'tourist'],
      isBusinessDistrict: true,
      isNightlifeHub: true,
      isTouristArea: true,
      isResidential: false,
    },
  },
  {
    id: 'paris_10',
    name: '10e',
    displayName: 'Xᵉ arr.',
    subtitle: 'Canal Saint-Martin · Gare du Nord',
    center: [48.8761, 2.3590],
    neighbors: ['paris_2', 'paris_3', 'paris_9', 'paris_11', 'paris_18', 'paris_19'],
    density: 0.55,
    corridor: 'nord',
    characteristics: {
      primary: 'transport',
      secondary: ['nightlife', 'residential'],
      isBusinessDistrict: false,
      isNightlifeHub: true,
      isTouristArea: false,
      isResidential: true,
    },
  },
  {
    id: 'paris_11',
    name: '11e',
    displayName: 'XIᵉ arr.',
    subtitle: 'Bastille · Oberkampf',
    center: [48.8594, 2.3796],
    neighbors: ['paris_3', 'paris_4', 'paris_10', 'paris_12', 'paris_19', 'paris_20'],
    density: 0.6,
    corridor: 'est',
    characteristics: {
      primary: 'nightlife',
      secondary: ['residential', 'mixed'],
      isBusinessDistrict: false,
      isNightlifeHub: true,
      isTouristArea: false,
      isResidential: true,
    },
  },
  {
    id: 'paris_12',
    name: '12e',
    displayName: 'XIIᵉ arr.',
    subtitle: 'Bercy · Nation',
    center: [48.8412, 2.3876],
    neighbors: ['paris_4', 'paris_11', 'paris_13', 'paris_20'],
    density: 0.3,
    corridor: 'est',
    characteristics: {
      primary: 'transport',
      secondary: ['residential', 'mixed'],
      isBusinessDistrict: false,
      isNightlifeHub: false,
      isTouristArea: false,
      isResidential: true,
    },
  },
  {
    id: 'paris_13',
    name: '13e',
    displayName: 'XIIIᵉ arr.',
    subtitle: 'Gobelins · Bibliothèque',
    center: [48.8322, 2.3561],
    neighbors: ['paris_5', 'paris_12', 'paris_14'],
    density: 0.35,
    corridor: 'sud',
    characteristics: {
      primary: 'residential',
      secondary: ['mixed'],
      isBusinessDistrict: false,
      isNightlifeHub: false,
      isTouristArea: false,
      isResidential: true,
    },
  },
  {
    id: 'paris_14',
    name: '14e',
    displayName: 'XIVᵉ arr.',
    subtitle: 'Montparnasse · Denfert',
    center: [48.8331, 2.3264],
    neighbors: ['paris_5', 'paris_6', 'paris_13', 'paris_15'],
    density: 0.4,
    corridor: 'sud',
    characteristics: {
      primary: 'residential',
      secondary: ['transport', 'mixed'],
      isBusinessDistrict: false,
      isNightlifeHub: false,
      isTouristArea: false,
      isResidential: true,
    },
  },
  {
    id: 'paris_15',
    name: '15e',
    displayName: 'XVᵉ arr.',
    subtitle: 'Vaugirard · Grenelle',
    center: [48.8421, 2.2983],
    neighbors: ['paris_6', 'paris_7', 'paris_14', 'paris_16'],
    density: 0.35,
    corridor: 'sud',
    characteristics: {
      primary: 'residential',
      secondary: ['business'],
      isBusinessDistrict: false,
      isNightlifeHub: false,
      isTouristArea: false,
      isResidential: true,
    },
  },
  {
    id: 'paris_16',
    name: '16e',
    displayName: 'XVIᵉ arr.',
    subtitle: 'Trocadéro · Passy',
    center: [48.8637, 2.2769],
    neighbors: ['paris_7', 'paris_8', 'paris_15', 'paris_17'],
    density: 0.25,
    corridor: 'ouest',
    characteristics: {
      primary: 'residential',
      secondary: ['tourist'],
      isBusinessDistrict: false,
      isNightlifeHub: false,
      isTouristArea: true,
      isResidential: true,
    },
  },
  {
    id: 'paris_17',
    name: '17e',
    displayName: 'XVIIᵉ arr.',
    subtitle: 'Batignolles · Ternes',
    center: [48.8836, 2.3092],
    neighbors: ['paris_8', 'paris_9', 'paris_16', 'paris_18'],
    density: 0.35,
    corridor: 'ouest',
    characteristics: {
      primary: 'residential',
      secondary: ['business'],
      isBusinessDistrict: false,
      isNightlifeHub: false,
      isTouristArea: false,
      isResidential: true,
    },
  },
  {
    id: 'paris_18',
    name: '18e',
    displayName: 'XVIIIᵉ arr.',
    subtitle: 'Montmartre · Sacré-Cœur',
    center: [48.8917, 2.3442],
    neighbors: ['paris_9', 'paris_10', 'paris_17', 'paris_19'],
    density: 0.6,
    corridor: 'nord',
    characteristics: {
      primary: 'tourist',
      secondary: ['nightlife', 'residential'],
      isBusinessDistrict: false,
      isNightlifeHub: true,
      isTouristArea: true,
      isResidential: true,
    },
  },
  {
    id: 'paris_19',
    name: '19e',
    displayName: 'XIXᵉ arr.',
    subtitle: 'Buttes-Chaumont · Villette',
    center: [48.8815, 2.3827],
    neighbors: ['paris_10', 'paris_11', 'paris_18', 'paris_20'],
    density: 0.35,
    corridor: 'nord',
    characteristics: {
      primary: 'residential',
      secondary: ['mixed'],
      isBusinessDistrict: false,
      isNightlifeHub: false,
      isTouristArea: false,
      isResidential: true,
    },
  },
  {
    id: 'paris_20',
    name: '20e',
    displayName: 'XXᵉ arr.',
    subtitle: 'Père-Lachaise · Belleville',
    center: [48.8649, 2.3987],
    neighbors: ['paris_11', 'paris_12', 'paris_19'],
    density: 0.4,
    corridor: 'est',
    characteristics: {
      primary: 'residential',
      secondary: ['nightlife'],
      isBusinessDistrict: false,
      isNightlifeHub: true,
      isTouristArea: false,
      isResidential: true,
    },
  },
  // Islands
  {
    id: 'cite',
    name: 'Cité',
    displayName: 'Île de la Cité',
    subtitle: 'Notre-Dame · Sainte-Chapelle',
    center: [48.8554, 2.3471],
    neighbors: ['paris_1', 'paris_4', 'paris_5', 'stlouis'],
    density: 0.95,
    corridor: 'centre',
    characteristics: {
      primary: 'tourist',
      secondary: [],
      isBusinessDistrict: false,
      isNightlifeHub: false,
      isTouristArea: true,
      isResidential: false,
    },
  },
  {
    id: 'stlouis',
    name: 'St-Louis',
    displayName: 'Île Saint-Louis',
    subtitle: 'Île Saint-Louis',
    center: [48.8514, 2.3567],
    neighbors: ['paris_4', 'paris_5', 'cite'],
    density: 0.9,
    corridor: 'centre',
    characteristics: {
      primary: 'residential',
      secondary: ['tourist'],
      isBusinessDistrict: false,
      isNightlifeHub: false,
      isTouristArea: true,
      isResidential: true,
    },
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTED ZONES
// ═══════════════════════════════════════════════════════════════════════════

function toZone(raw: RawArrondissement): Zone {
  const zoneType: ZoneType =
    raw.id === 'cite' || raw.id === 'stlouis' ? 'island' : 'arrondissement'

  return {
    id: raw.id,
    name: raw.name,
    displayName: raw.displayName,
    type: zoneType,
    center: { lat: raw.center[0], lng: raw.center[1] },
    corridor: raw.corridor,
    neighbors: raw.neighbors,
    density: raw.density,
    characteristics: raw.characteristics,
  }
}

export const PARIS_ZONES: Zone[] = RAW_ARRONDISSEMENTS.map(toZone)

// ═══════════════════════════════════════════════════════════════════════════
// ZONE LOOKUP HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function getZoneById(id: string): Zone | undefined {
  return PARIS_ZONES.find(z => z.id === id)
}

export function getZoneByName(name: string): Zone | undefined {
  return PARIS_ZONES.find(z => z.name === name || z.displayName === name)
}

export function getZonesByCharacteristic(
  characteristic: keyof ZoneCharacteristics
): Zone[] {
  return PARIS_ZONES.filter(z => z.characteristics[characteristic] === true)
}

export function getZonesByCorridor(corridor: string): Zone[] {
  return PARIS_ZONES.filter(z => z.corridor === corridor)
}

// ═══════════════════════════════════════════════════════════════════════════
// BANLIEUE HUBS (external pressure points)
// ═══════════════════════════════════════════════════════════════════════════

export interface BanlieueHub {
  id: string
  name: string
  corridor: 'nord' | 'est' | 'sud' | 'ouest'
  subtitle: string
  coords: { lat: number; lng: number }
}

export const PARIS_BANLIEUE_HUBS: BanlieueHub[] = [
  {
    id: 'saint-denis',
    name: 'Saint-Denis',
    corridor: 'nord',
    subtitle: 'Stade de France',
    coords: { lat: 48.9362, lng: 2.3574 },
  },
  {
    id: 'villepinte',
    name: 'Villepinte',
    corridor: 'nord',
    subtitle: 'Parc des Expositions',
    coords: { lat: 48.9691, lng: 2.5153 },
  },
  {
    id: 'la-defense',
    name: 'La Défense',
    corridor: 'ouest',
    subtitle: 'Affaires · CNIT',
    coords: { lat: 48.8918, lng: 2.2362 },
  },
  {
    id: 'montreuil',
    name: 'Montreuil',
    corridor: 'est',
    subtitle: 'Pantin · Vincennes',
    coords: { lat: 48.8638, lng: 2.4433 },
  },
]
