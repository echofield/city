/**
 * Movement Corridor Model (minimal).
 * Phase 1: Simple direction-based corridors.
 * Phase 2: Will add movement_axis (a1, a3, etc.)
 */

export type CorridorDirection = 'nord' | 'est' | 'sud' | 'ouest'

export type CorridorType = 'autoroute' | 'rer' | 'periph'

export type FrictionLevel = 'fluide' | 'dense' | 'sature' | 'bloque'

/**
 * Minimal corridor definition (Phase 1).
 */
export interface MovementCorridor {
  id: string
  name: string
  direction: CorridorDirection
  type: CorridorType
  // Main gate into Paris
  primary_gate: string
  // Banlieue zones served
  serves: string[]
}

/**
 * Core movement corridors (infrastructure-based, not symbolic).
 */
export const MOVEMENT_CORRIDORS: MovementCorridor[] = [
  // ════════════════════════════════════════
  // NORD
  // ════════════════════════════════════════
  {
    id: 'a1',
    name: 'A1 Nord',
    direction: 'nord',
    type: 'autoroute',
    primary_gate: 'Porte de la Chapelle',
    serves: ['saint-denis', 'villepinte', 'cdg', 'le-bourget'],
  },
  {
    id: 'rer-b-nord',
    name: 'RER B Nord',
    direction: 'nord',
    type: 'rer',
    primary_gate: 'Gare du Nord',
    serves: ['saint-denis', 'aubervilliers', 'cdg'],
  },

  // ════════════════════════════════════════
  // EST
  // ════════════════════════════════════════
  {
    id: 'a3',
    name: 'A3 Est',
    direction: 'est',
    type: 'autoroute',
    primary_gate: 'Porte de Bagnolet',
    serves: ['pantin', 'bobigny', 'villepinte'],
  },
  {
    id: 'a4',
    name: 'A4 Est',
    direction: 'est',
    type: 'autoroute',
    primary_gate: 'Porte de Bercy',
    serves: ['vincennes', 'creteil'],
  },
  {
    id: 'rer-a-est',
    name: 'RER A Est',
    direction: 'est',
    type: 'rer',
    primary_gate: 'Nation',
    serves: ['vincennes', 'nation'],
  },

  // ════════════════════════════════════════
  // SUD
  // ════════════════════════════════════════
  {
    id: 'a6',
    name: 'A6 Sud',
    direction: 'sud',
    type: 'autoroute',
    primary_gate: "Porte d'Orléans",
    serves: ['orly', 'ivry'],
  },
  {
    id: 'rer-b-sud',
    name: 'RER B Sud',
    direction: 'sud',
    type: 'rer',
    primary_gate: 'Denfert-Rochereau',
    serves: ['orly'],
  },

  // ════════════════════════════════════════
  // OUEST
  // ════════════════════════════════════════
  {
    id: 'a13',
    name: 'A13 Ouest',
    direction: 'ouest',
    type: 'autoroute',
    primary_gate: "Porte d'Auteuil",
    serves: ['defense', 'nanterre', 'boulogne'],
  },
  {
    id: 'rer-a-ouest',
    name: 'RER A Ouest',
    direction: 'ouest',
    type: 'rer',
    primary_gate: 'Etoile',
    serves: ['defense', 'nanterre'],
  },
]

/**
 * Get corridors by direction.
 */
export function getCorridorsByDirection(direction: CorridorDirection): MovementCorridor[] {
  return MOVEMENT_CORRIDORS.filter(c => c.direction === direction)
}

/**
 * Get corridors serving a banlieue zone.
 */
export function getCorridorsServingZone(zoneId: string): MovementCorridor[] {
  return MOVEMENT_CORRIDORS.filter(c => c.serves.includes(zoneId))
}

/**
 * Entry hint for UI display.
 */
export const CORRIDOR_ENTRY_HINTS: Record<CorridorDirection, string> = {
  nord: 'Porte de la Chapelle / Gare du Nord',
  est: 'Porte de Bagnolet / Nation',
  sud: "Porte d'Orléans / Denfert",
  ouest: "Porte d'Auteuil / Etoile",
}

/**
 * Get entry hint for display.
 */
export function getCorridorEntryHint(direction: CorridorDirection): string {
  return CORRIDOR_ENTRY_HINTS[direction]
}
