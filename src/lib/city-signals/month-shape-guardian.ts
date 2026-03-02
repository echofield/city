/**
 * MonthShape Guardian — read-only filter so the pack stays aligned with known city shape.
 * LLM = sensor, not journalist. Log filtered items; never silently drop.
 */

import type { CitySignalsPackV1 } from '@/types/city-signals-pack'

export interface MonthShapePack {
  /** Venues we always trust (e.g. Accor Arena, Parc des Princes). */
  knownVenues: string[]
  /** Zone names that count as structural attractors (event kept if zoneImpact hits one). */
  structuralAttractors: string[]
  /** Venues allowed for unknown events when type is sport/concert. */
  highConfidenceVenues: string[]
}

const normalize = (s: string) => s.trim().toLowerCase()

function matchesKnownVenue(venue: string, known: string[]): boolean {
  const v = normalize(venue)
  return known.some((k) => normalize(k) === v || v.includes(normalize(k)))
}

function zoneImpactMatchesAttractors(zoneImpact: string[], attractors: string[]): boolean {
  const zones = new Set(zoneImpact.map(normalize))
  return attractors.some((a) => zones.has(normalize(a)))
}

/**
 * Filter pack against month shape. Transport and weather pass through.
 * Events: keep if known venue or structural attractor; else keep only if type is sport/concert AND high-confidence venue.
 * Filtered events are logged, not silently dropped.
 */
export function filterPackAgainstMonthShape(
  pack: CitySignalsPackV1,
  monthShape: MonthShapePack
): CitySignalsPackV1 {
  const { knownVenues, structuralAttractors, highConfidenceVenues } = monthShape
  const kept: CitySignalsPackV1['events'] = []
  const filtered: Array<{ event: CitySignalsPackV1['events'][number]; reason: string }> = []

  for (const event of pack.events) {
    const known = matchesKnownVenue(event.venue, knownVenues)
    const structural = zoneImpactMatchesAttractors(event.zoneImpact, structuralAttractors)
    const highConfidence =
      (event.type === 'sport' || event.type === 'concert') &&
      matchesKnownVenue(event.venue, highConfidenceVenues)

    if (known || structural || highConfidence) {
      kept.push(event)
    } else {
      filtered.push({
        event,
        reason: 'venue not in known/structural/high-confidence; dropped',
      })
    }
  }

  if (filtered.length > 0) {
    for (const { event, reason } of filtered) {
      console.warn('[MonthShape Guardian] filtered event:', event.name, event.venue, reason)
    }
  }

  return {
    ...pack,
    events: kept,
    transport: pack.transport,
    weather: pack.weather,
  }
}

/** Default Paris month shape: major venues + structural zones. */
export function getDefaultMonthShape(): MonthShapePack {
  return {
    knownVenues: [
      'Accor Arena',
      'Bercy',
      'Parc des Princes',
      'Stade de France',
      'Zénith',
      'Zenith',
      'Olympia',
      'Porte de Versailles',
      'Palais des Congrès',
      'Grand Rex',
      'Rex Club',
      'Bataclan',
    ],
    structuralAttractors: [
      'Gare du Nord',
      'Gare de Lyon',
      'Gare de l\'Est',
      'Bercy',
      'Nation',
      'Porte de Saint-Cloud',
      'Châtelet',
      'Opéra',
      'Saint-Lazare',
      'La Défense',
    ],
    highConfidenceVenues: [
      'Accor Arena',
      'Parc des Princes',
      'Stade de France',
      'Zénith',
      'Zenith',
      'Olympia',
      'Porte de Versailles',
    ],
  }
}
