/**
 * FLOW Vocabulary System — v1.0
 *
 * ~25 words max. The whole product speaks the same language of the city.
 * Sound like an experienced Paris driver whispering useful hints.
 *
 * Principles:
 * - Short
 * - Concrete
 * - Observable
 * - Human
 * - No analytics language
 *
 * AVOID: signal, dispersion, ramification, saturation, friction,
 *        champ, optimisation, prediction
 */

// ════════════════════════════════════════════════════════════════
// 1. CORE ACTION VERBS (the big command)
// ════════════════════════════════════════════════════════════════

export type ActionVerb =
  | 'maintenir'   // Stay in area
  | 'rejoindre'   // Move to area
  | 'anticiper'   // Go early
  | 'contourner'  // Avoid congestion
  | 'tenter'      // Opportunistic try

export const ACTION_VERBS: Record<ActionVerb, {
  label: string
  meaning: string
}> = {
  maintenir: { label: 'MAINTENIR', meaning: 'Rester dans la zone' },
  rejoindre: { label: 'REJOINDRE', meaning: 'Se diriger vers' },
  anticiper: { label: 'ANTICIPER', meaning: 'Partir en avance' },
  contourner: { label: 'CONTOURNER', meaning: 'Éviter la congestion' },
  tenter: { label: 'TENTER', meaning: 'Coup de poker' },
}

// ════════════════════════════════════════════════════════════════
// 2. CITY MOVEMENT VERBS (what the city is doing)
// ════════════════════════════════════════════════════════════════

export type CityVerb =
  | 'ca_arrive'   // influx forming
  | 'ca_monte'    // demand building
  | 'plein'       // peak density
  | 'ca_sort'     // people leaving venues
  | 'ca_bouge'    // active area
  | 'ca_retombe'  // decline

export const CITY_VERBS: Record<CityVerb, string> = {
  ca_arrive: 'Ça arrive',
  ca_monte: 'Ça monte',
  plein: 'Plein',
  ca_sort: 'Ça sort',
  ca_bouge: 'Ça bouge',
  ca_retombe: 'Ça retombe',
}

// ════════════════════════════════════════════════════════════════
// 3. AREA RHYTHM PHASES (the phase bar)
// ════════════════════════════════════════════════════════════════

export type AreaPhase = 'calme' | 'ca_monte' | 'plein' | 'ca_sort'

export const PHASE_LABELS: Record<AreaPhase, string> = {
  calme: 'Calme',
  ca_monte: 'Ça monte',
  plein: 'Plein',
  ca_sort: 'Ça sort',
}

export const PHASE_ORDER: AreaPhase[] = ['calme', 'ca_monte', 'plein', 'ca_sort']

// ════════════════════════════════════════════════════════════════
// 4. EVENT TRIGGERS (high-trust signals)
// ════════════════════════════════════════════════════════════════

export type EventTrigger =
  | 'sortie'       // people leaving
  | 'arrivee'      // people arriving
  | 'match'        // sports event
  | 'concert'      // music event
  | 'bars_pleins'  // nightlife peak
  | 'pluie'        // weather
  | 'nuit'         // late night

export const EVENT_LABELS: Record<EventTrigger, string> = {
  sortie: 'Sortie',
  arrivee: 'Arrivée',
  match: 'Match',
  concert: 'Concert',
  bars_pleins: 'Bars pleins',
  pluie: 'Pluie',
  nuit: 'Nuit',
}

// ════════════════════════════════════════════════════════════════
// 5. TIME HINTS (approximate, human)
// ════════════════════════════════════════════════════════════════

export function formatTimeHint(minutes: number | null): string {
  if (minutes === null) return ''
  if (minutes <= 0) return 'Maintenant'
  if (minutes <= 2) return 'Dans ~2 min'
  if (minutes <= 5) return 'Dans ~5 min'
  if (minutes <= 10) return 'Dans ~10 min'
  if (minutes <= 15) return 'Dans ~15 min'
  if (minutes <= 30) return 'Dans ~30 min'
  return `Dans ~${Math.round(minutes / 5) * 5} min`
}

export function formatWindowRemaining(minutes: number | null): string {
  if (minutes === null) return ''
  if (minutes <= 0) return 'Fini'
  if (minutes <= 2) return 'Encore ~2 min'
  if (minutes <= 5) return 'Encore ~5 min'
  if (minutes <= 10) return 'Encore ~10 min'
  return `Encore ~${Math.round(minutes / 5) * 5} min`
}

// ════════════════════════════════════════════════════════════════
// 6. TRAFFIC LANGUAGE (not friction)
// ════════════════════════════════════════════════════════════════

export type TrafficState = 'fluide' | 'dense' | 'bloque'

export const TRAFFIC_LABELS: Record<TrafficState, string> = {
  fluide: 'Trafic fluide',
  dense: 'Trafic dense',
  bloque: 'Zone bloquée',
}

// Weather impact
export function formatWeatherImpact(type: string, impact: string): string {
  if (type === 'rain') return `Pluie ${impact}`
  if (type === 'cold') return `Froid ${impact}`
  return impact
}

// ════════════════════════════════════════════════════════════════
// 7. OPPORTUNITY HINTS (subtle, not gamified)
// ════════════════════════════════════════════════════════════════

export const OPPORTUNITY_HINTS = {
  active: 'Ça bouge',
  good_window: 'Bonne fenêtre',
  interesting: 'Moment intéressant',
  forming: 'Ça arrive',
  peak: 'Plein',
} as const

// ════════════════════════════════════════════════════════════════
// 8. CORRIDOR LABELS (readable)
// ════════════════════════════════════════════════════════════════

export const CORRIDOR_LABELS = {
  nord: 'Nord',
  sud: 'Sud',
  est: 'Est',
  ouest: 'Ouest',
  centre: 'Centre',
} as const

// ════════════════════════════════════════════════════════════════
// 9. COMPLETE PHRASE BUILDERS
// ════════════════════════════════════════════════════════════════

/**
 * Build an event phrase: "Sortie concert La Cigale"
 */
export function buildEventPhrase(
  trigger: EventTrigger,
  venue?: string,
  type?: string
): string {
  const base = EVENT_LABELS[trigger]
  if (venue && type) return `${base} ${type} ${venue}`
  if (venue) return `${base} ${venue}`
  if (type) return `${base} ${type}`
  return base
}

/**
 * Build a zone state phrase: "Bastille — Ça monte"
 */
export function buildZoneState(zone: string, verb: CityVerb): string {
  return `${zone} — ${CITY_VERBS[verb]}`
}

/**
 * Build a traffic phrase: "Trafic dense périph"
 */
export function buildTrafficPhrase(state: TrafficState, detail?: string): string {
  const base = TRAFFIC_LABELS[state]
  return detail ? `${base} ${detail}` : base
}

// ════════════════════════════════════════════════════════════════
// 10. VOCABULARY SUMMARY (for reference)
// ════════════════════════════════════════════════════════════════

/**
 * The ~25 word vocabulary:
 *
 * ACTIONS (5):
 * - Maintenir, Rejoindre, Anticiper, Contourner, Tenter
 *
 * CITY VERBS (6):
 * - Ça arrive, Ça monte, Plein, Ça sort, Ça bouge, Ça retombe
 *
 * EVENTS (7):
 * - Sortie, Arrivée, Match, Concert, Bars pleins, Pluie, Nuit
 *
 * PHASES (4):
 * - Calme, Ça monte, Plein, Ça sort
 *
 * TIME (4):
 * - Dans ~X min, Maintenant, Encore ~X min, Fini
 *
 * TRAFFIC (3):
 * - Fluide, Dense, Bloqué
 */
