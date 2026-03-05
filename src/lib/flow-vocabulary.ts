/**
 * FLOW Lexicon — v3.0
 *
 * The 10-word micro-language + ~35 word corpus.
 * "Un chauffeur parisien expérimenté qui te glisse l'info."
 *
 * THE 10-WORD CORE (for instant reading):
 * ┌─────────────────────────────────────────────────┐
 * │ Maintenir · Rejoindre · Anticiper · Contourner │
 * │ Tenter · Calme · Monte · Plein · Sortie · Trafic │
 * └─────────────────────────────────────────────────┘
 *
 * NEW IN v3.0 — UNCERTAINTY LAYER:
 * ┌─────────────────────────────────────────────────┐
 * │ Confirmé (certain) vs Piste (positioning bet)  │
 * │ "Navigation system for uncertainty"            │
 * └─────────────────────────────────────────────────┘
 *
 * Principles:
 * - Very small vocabulary
 * - Consistent structure
 * - Observable reality words
 * - Verbs over nouns
 * - Honest about uncertainty (piste vs confirmé)
 *
 * BANNED: signal, ramification, saturation, dispersion, optimisation,
 *         algorithme, champ, friction, analyse, prediction
 */

// ════════════════════════════════════════════════════════════════
// THE 10-WORD MICRO-LANGUAGE
// ════════════════════════════════════════════════════════════════

export const FLOW_CORE = [
  'Maintenir',   // stay
  'Rejoindre',   // go there
  'Anticiper',   // move early
  'Contourner',  // avoid
  'Tenter',      // opportunistic try
  'Calme',       // low activity
  'Monte',       // building demand
  'Plein',       // peak
  'Sortie',      // people exiting
  'Trafic',      // traffic condition
] as const

// ════════════════════════════════════════════════════════════════
// 1. ACTIONS (driver commands)
// ════════════════════════════════════════════════════════════════

export const FLOW_ACTIONS = [
  'Maintenir',
  'Rejoindre',
  'Anticiper',
  'Contourner',
  'Tenter',
] as const

export type ActionVerb = 'maintenir' | 'rejoindre' | 'anticiper' | 'contourner' | 'tenter'

export const ACTION_LABELS: Record<ActionVerb, string> = {
  maintenir: 'MAINTENIR',
  rejoindre: 'REJOINDRE',
  anticiper: 'ANTICIPER',
  contourner: 'CONTOURNER',
  tenter: 'TENTER',
}

// ════════════════════════════════════════════════════════════════
// 2. PHASES (the bar: Calme — Monte — Plein — Sortie)
// ════════════════════════════════════════════════════════════════

export const FLOW_PHASES = [
  'Calme',
  'Monte',
  'Plein',
  'Sortie',
] as const

export type AreaPhase = 'calme' | 'monte' | 'plein' | 'sortie'

export const PHASE_LABELS: Record<AreaPhase, string> = {
  calme: 'Calme',
  monte: 'Monte',
  plein: 'Plein',
  sortie: 'Sortie',
}

export const PHASE_ORDER: AreaPhase[] = ['calme', 'monte', 'plein', 'sortie']

// ════════════════════════════════════════════════════════════════
// 3. CITY MOVEMENT (how the area behaves)
// ════════════════════════════════════════════════════════════════

export const FLOW_CITY = [
  'Calme',
  'Monte',
  'Plein',
  'Sortie',
  'Retombe',
] as const

export type CityState = 'calme' | 'monte' | 'plein' | 'sortie' | 'retombe'

export const CITY_LABELS: Record<CityState, string> = {
  calme: 'Calme',
  monte: 'Monte',
  plein: 'Plein',
  sortie: 'Sortie',
  retombe: 'Retombe',
}

// ════════════════════════════════════════════════════════════════
// 4. EVENT TRIGGERS (creates trust — real events)
// ════════════════════════════════════════════════════════════════

export const FLOW_EVENTS = [
  'Concert',
  'Théâtre',
  'Match',
  'Bars',
  'Arrivée',
  'Vols',
  'Marché',
  'Festival',
] as const

export type EventTrigger =
  | 'concert'
  | 'theatre'
  | 'match'
  | 'bars'
  | 'arrivee'
  | 'vols'
  | 'marche'
  | 'festival'

export const EVENT_LABELS: Record<EventTrigger, string> = {
  concert: 'Concert',
  theatre: 'Théâtre',
  match: 'Match',
  bars: 'Bars',
  arrivee: 'Arrivée',
  vols: 'Vols',
  marche: 'Marché',
  festival: 'Festival',
}

// ════════════════════════════════════════════════════════════════
// 5. TIME INDICATORS (approximate, human)
// ════════════════════════════════════════════════════════════════

export const FLOW_TIME = [
  'Maintenant',
  'Dans ~5 min',
  'Encore ~10 min',
  'Bientôt',
  'Fini',
] as const

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
// 6. TRAFFIC (not "friction")
// ════════════════════════════════════════════════════════════════

export const FLOW_TRAFFIC = [
  'Trafic fluide',
  'Trafic dense',
  'Bloqué',
  'Pluie',
  'Travaux',
] as const

export type TrafficState = 'fluide' | 'dense' | 'bloque' | 'pluie' | 'travaux'

export const TRAFFIC_LABELS: Record<TrafficState, string> = {
  fluide: 'Trafic fluide',
  dense: 'Trafic dense',
  bloque: 'Bloqué',
  pluie: 'Pluie',
  travaux: 'Travaux',
}

// ════════════════════════════════════════════════════════════════
// 7. CORRIDORS
// ════════════════════════════════════════════════════════════════

export const CORRIDOR_LABELS = {
  nord: 'Nord',
  sud: 'Sud',
  est: 'Est',
  ouest: 'Ouest',
  centre: 'Centre',
} as const

// ════════════════════════════════════════════════════════════════
// 8. SIGNAL CERTAINTY (confirmed vs speculative)
// ════════════════════════════════════════════════════════════════

/**
 * Two types of signals:
 *
 * CONFIRMÉ — Predictable movement
 *   "Sortie théâtre Châtelet" — we know people will exit
 *
 * PISTE — Positioning bet
 *   "Piste nuit · Club Pantin ferme ~04:00"
 *   Something is likely to happen, but outcome uncertain
 *
 * Drivers are gamblers. They like honest uncertainty.
 * This builds trust.
 */

export type SignalCertainty = 'confirme' | 'piste'

export const CERTAINTY_LABELS: Record<SignalCertainty, string> = {
  confirme: 'Confirmé',
  piste: 'Piste',
}

/**
 * Piste categories — context for the lead
 */
export type PisteCategory = 'nuit' | 'jour' | 'soiree'

export const PISTE_LABELS: Record<PisteCategory, string> = {
  nuit: 'Piste nuit',
  jour: 'Piste',
  soiree: 'Piste soirée',
}

/**
 * Quest chain — the night as a sequence of opportunities
 *
 * Example driver night:
 * 02:30 — Bars Bastille pleins
 * 03:15 — Sortie concert
 * 04:00 — Piste club Pantin
 * 04:40 — Arrivées Orly
 *
 * The driver is surfing the city rhythm.
 */
export interface Piste {
  zone: string
  cause: string
  time: string // "~04:00"
  category: PisteCategory
  certainty: SignalCertainty
}

// ════════════════════════════════════════════════════════════════
// 9. PHRASE BUILDERS
// ════════════════════════════════════════════════════════════════

/**
 * "Sortie concert La Cigale"
 */
export function buildEventPhrase(type: string, venue?: string): string {
  return venue ? `Sortie ${type} ${venue}` : `Sortie ${type}`
}

/**
 * "Arrivée TGV Gare du Nord"
 */
export function buildArrivalPhrase(type: string, location?: string): string {
  return location ? `Arrivée ${type} ${location}` : `Arrivée ${type}`
}

/**
 * "Trafic dense périph"
 */
export function buildTrafficPhrase(state: TrafficState, detail?: string): string {
  const base = TRAFFIC_LABELS[state]
  return detail ? `${base} ${detail}` : base
}

/**
 * "Piste nuit · Club Pantin ferme ~04:00"
 */
export function buildPistePhrase(piste: Piste): string {
  const label = PISTE_LABELS[piste.category]
  return `${label} · ${piste.cause} ${piste.time}`
}

/**
 * "Prochaine piste · Club Pantin ~04:00"
 */
export function buildNextPistePhrase(zone: string, time: string): string {
  return `Prochaine piste · ${zone} ${time}`
}

// ════════════════════════════════════════════════════════════════
// THE COMPLETE FLOW CORPUS (~35 words)
// ════════════════════════════════════════════════════════════════

export const FLOW_CORPUS = {
  actions: FLOW_ACTIONS,
  phases: FLOW_PHASES,
  city: FLOW_CITY,
  events: FLOW_EVENTS,
  time: FLOW_TIME,
  traffic: FLOW_TRAFFIC,
  certainty: ['Confirmé', 'Piste'] as const,
  pistes: ['Piste', 'Piste nuit', 'Piste soirée', 'Prochaine piste'] as const,
} as const

/**
 * VOCABULARY SUMMARY:
 *
 * ACTIONS (5):     Maintenir · Rejoindre · Anticiper · Contourner · Tenter
 * PHASES (4):      Calme · Monte · Plein · Sortie
 * CITY (5):        Calme · Monte · Plein · Sortie · Retombe
 * EVENTS (8):      Concert · Théâtre · Match · Bars · Arrivée · Vols · Marché · Festival
 * TIME (5):        Maintenant · Dans ~X min · Encore ~X min · Bientôt · Fini
 * TRAFFIC (5):     Trafic fluide · Trafic dense · Bloqué · Pluie · Travaux
 * CERTAINTY (2):   Confirmé · Piste
 * PISTES (4):      Piste · Piste nuit · Piste soirée · Prochaine piste
 *
 * TOTAL: ~35 words
 *
 * Example confirmed screen:
 * ┌────────────────────────────┐
 * │ REJOINDRE                  │
 * │ Montmartre                 │
 * │                            │
 * │ Sortie concert La Cigale   │
 * │ Dans ~6 min                │
 * │                            │
 * │ Trafic fluide              │
 * └────────────────────────────┘
 *
 * Example speculative screen:
 * ┌────────────────────────────┐
 * │ TENTER                     │
 * │ Pantin                     │
 * │                            │
 * │ Piste nuit                 │
 * │ Club ferme ~04:00          │
 * └────────────────────────────┘
 *
 * Phase bar:
 * Calme — Monte — Plein — Sortie
 */
