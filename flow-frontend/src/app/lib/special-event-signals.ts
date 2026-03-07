/**
 * FLOW — Special Event Signal Generator
 * Mega-events, expos, banlieue festivals, chateau galas
 * Structural demand anomalies that create massive synchronized exits
 *
 * These are date-specific events (not daily patterns) that:
 * - Create 10,000+ person exits
 * - Often occur where public transport fails (banlieue, late night)
 * - Represent the highest-value positioning opportunities
 */

import type { Signal, SignalIntensity, ConfidenceLevel, Corridor } from '../types/signal'

// ── Types ──

interface SpecialEvent {
  id: string
  name: string
  type: 'expo_center' | 'stadium' | 'banlieue_event_space'
  lat: number
  lng: number
  zone: string
  arrondissement: string
  corridor: Corridor
  close_time: string
  active_dates: string[]  // ISO date strings YYYY-MM-DD
  exit_window: { start: string; end: string }
  weight: number
  crowd: 'premium' | 'mixed' | 'young_metro' | 'tourist'
  vtc_probability: number
  reason: string
  positioning: string
  notes?: string
}

interface SpecialEventsData {
  version: string
  month: string
  events: SpecialEvent[]
}

// ── Helpers ──

/**
 * Parse HH:MM time string to minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Format minutes since midnight to HH:MM
 */
function formatMinutesToTime(mins: number): string {
  const normalizedMins = ((mins % 1440) + 1440) % 1440
  const h = Math.floor(normalizedMins / 60)
  const m = normalizedMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Check if a date string matches today
 */
function isToday(dateStr: string, now: Date): boolean {
  const today = now.toISOString().slice(0, 10) // YYYY-MM-DD
  return dateStr === today
}

/**
 * Check if current time is within an exit window
 */
function isWithinExitWindow(
  now: Date,
  exitWindow: { start: string; end: string }
): { active: boolean; forming: boolean; expiring: boolean; minutesUntil: number } {
  const currentMins = now.getHours() * 60 + now.getMinutes()
  const startMins = parseTimeToMinutes(exitWindow.start)
  let endMins = parseTimeToMinutes(exitWindow.end)

  // Handle overnight windows (e.g., 22:45-00:00 or 05:00-06:30)
  if (endMins < startMins) endMins += 1440

  let normalizedCurrent = currentMins
  // Handle past midnight for overnight events
  if (currentMins < 6 * 60 && startMins > 18 * 60) {
    normalizedCurrent = currentMins + 1440
  }

  // Forming: 60 minutes before start (special events need more prep time)
  const forming = normalizedCurrent >= startMins - 60 && normalizedCurrent < startMins
  const active = normalizedCurrent >= startMins && normalizedCurrent <= endMins
  const expiring = active && (endMins - normalizedCurrent) <= 20

  const minutesUntil = forming ? (startMins - normalizedCurrent) :
                       active ? 0 :
                       (startMins - normalizedCurrent)

  return { active, forming, expiring, minutesUntil }
}

/**
 * Compute priority score for special events
 * These are high-value by definition, so scores start high
 */
function computePriorityScore(
  event: SpecialEvent,
  timing: { active: boolean; forming: boolean; expiring: boolean }
): number {
  const baseWeight = event.weight * 10  // 70-100 base
  const vtcBonus = event.vtc_probability * 20  // Up to 20

  let score = baseWeight + vtcBonus

  // Timing modifiers
  if (timing.active) score *= 1.15
  if (timing.forming) score *= 1.0
  if (timing.expiring) score *= 0.85

  // Type modifiers - banlieue events are gold
  if (event.type === 'banlieue_event_space') score *= 1.2
  if (event.arrondissement === '93' || event.arrondissement === '77' || event.arrondissement === '78') {
    score *= 1.1  // Remote = less competition
  }

  // Late night bonus (no public transport)
  const closeHour = parseInt(event.close_time.split(':')[0])
  if (closeHour >= 1 && closeHour <= 6) {
    score *= 1.25  // No RER/Metro = guaranteed demand
  }

  return Math.min(100, Math.round(score))
}

/**
 * Generate intensity based on weight and crowd size
 */
function computeIntensity(weight: number, type: string): SignalIntensity {
  if (weight >= 10) return 4
  if (weight >= 9 || type === 'stadium') return 4
  if (weight >= 8) return 3
  if (weight >= 6) return 2
  return 1
}

/**
 * Get confidence level based on VTC probability
 */
function computeConfidence(vtcProb: number): ConfidenceLevel {
  if (vtcProb >= 0.85) return 'high'
  if (vtcProb >= 0.65) return 'medium'
  return 'low'
}

/**
 * Generate crowd label in French
 */
function getCrowdLabel(crowd: string): string {
  switch (crowd) {
    case 'premium': return 'clientele premium'
    case 'young_metro': return 'public jeune'
    case 'tourist': return 'touristes'
    default: return 'public mixte'
  }
}

/**
 * Generate event type label
 */
function getEventTypeLabel(type: string): string {
  switch (type) {
    case 'expo_center': return 'EXPO'
    case 'stadium': return 'CONCERT'
    case 'banlieue_event_space': return 'BANLIEUE'
    default: return 'EVENT'
  }
}

// ── Static Data ──

/**
 * March 2026 special events data
 * In production, this would be fetched from API or loaded from JSON
 */
export function getSpecialEventsStatic(): SpecialEvent[] {
  return [
    // ═══════════════════════════════════════════════════════════════
    // TONIGHT: Curated high-value signals for field test (2026-03-07)
    // ═══════════════════════════════════════════════════════════════
    {
      id: 'tonight_indochine_bercy',
      name: 'Accor Arena - Indochine',
      type: 'stadium',
      lat: 48.8386,
      lng: 2.3785,
      zone: 'Bercy',
      arrondissement: '12',
      corridor: 'est',
      close_time: '23:00',
      active_dates: ['2026-03-07'],
      exit_window: { start: '22:30', end: '23:45' },
      weight: 10,
      crowd: 'mixed',
      vtc_probability: 0.8,
      reason: 'concert Indochine - 20000 spectateurs - sortie synchronisee',
      positioning: 'Quai de Bercy'
    },
    {
      id: 'tonight_chronologic_pigalle',
      name: 'La Machine - Chronologic',
      type: 'banlieue_event_space',
      lat: 48.8840,
      lng: 2.3323,
      zone: 'Pigalle',
      arrondissement: '18',
      corridor: 'nord',
      close_time: '06:00',
      active_dates: ['2026-03-07'],
      exit_window: { start: '04:30', end: '06:30' },
      weight: 9,
      crowd: 'young_metro',
      vtc_probability: 0.85,
      reason: 'Chronologic sold-out - techno exit wave - metro arrete',
      positioning: 'Boulevard de Clichy'
    },
    {
      id: 'tonight_pfw_yoyo_early',
      name: 'Palais de Tokyo / YOYO - Fashion Week',
      type: 'banlieue_event_space',
      lat: 48.8636,
      lng: 2.2957,
      zone: 'Trocadero',
      arrondissement: '16',
      corridor: 'ouest',
      close_time: '01:30',
      active_dates: ['2026-03-07'],
      exit_window: { start: '23:30', end: '01:30' },
      weight: 9,
      crowd: 'premium',
      vtc_probability: 0.9,
      reason: 'Fashion Week cluster - clientele premium - arrivees soiree',
      positioning: 'Place du Trocadero'
    },
    {
      id: 'tonight_pfw_yoyo_late',
      name: 'YOYO / Palais de Tokyo - sortie club',
      type: 'banlieue_event_space',
      lat: 48.8636,
      lng: 2.2957,
      zone: 'Trocadero',
      arrondissement: '16',
      corridor: 'ouest',
      close_time: '05:30',
      active_dates: ['2026-03-07'],
      exit_window: { start: '03:30', end: '05:30' },
      weight: 9,
      crowd: 'premium',
      vtc_probability: 0.9,
      reason: 'Fashion Week after-party exit - clientele mode premium',
      positioning: 'Avenue du President Wilson'
    },
    {
      id: 'tonight_cdg_early_flights',
      name: 'CDG - vague departs matinaux',
      type: 'banlieue_event_space',
      lat: 49.0097,
      lng: 2.5479,
      zone: 'CDG',
      arrondissement: '95',
      corridor: 'nord',
      close_time: '06:30',
      active_dates: ['2026-03-07'],
      exit_window: { start: '03:30', end: '05:30' },
      weight: 8,
      crowd: 'mixed',
      vtc_probability: 0.7,
      reason: 'vols 06h-08h - passagers vers CDG - courses longues',
      positioning: 'Corridor A1 Nord'
    },
    // ═══════════════════════════════════════════════════════════════
    // MARCH 2026: Structural events (expos, arenas, chateaux)
    // ═══════════════════════════════════════════════════════════════
    {
      id: 'expo_versailles_seniors',
      name: 'Paris Expo - Salon des Seniors',
      type: 'expo_center',
      lat: 48.8327,
      lng: 2.2875,
      zone: 'Porte de Versailles',
      arrondissement: '15',
      corridor: 'sud',
      close_time: '18:00',
      active_dates: ['2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14'],
      exit_window: { start: '17:30', end: '18:30' },
      weight: 8,
      crowd: 'mixed',
      vtc_probability: 0.6,
      reason: 'sortie salon B2B - flux synchronise 18h',
      positioning: 'Porte de Versailles metro'
    },
    {
      id: 'expo_versailles_tourisme',
      name: 'Paris Expo - Mondial du Tourisme',
      type: 'expo_center',
      lat: 48.8327,
      lng: 2.2875,
      zone: 'Porte de Versailles',
      arrondissement: '15',
      corridor: 'sud',
      close_time: '18:00',
      active_dates: ['2026-03-12', '2026-03-13', '2026-03-14', '2026-03-15'],
      exit_window: { start: '17:30', end: '18:30' },
      weight: 9,
      crowd: 'mixed',
      vtc_probability: 0.65,
      reason: 'fermeture Mondial du Tourisme - 10000+ visiteurs',
      positioning: 'Boulevard Victor'
    },
    {
      id: 'expo_versailles_franchise',
      name: 'Paris Expo - Franchise Expo Paris',
      type: 'expo_center',
      lat: 48.8327,
      lng: 2.2875,
      zone: 'Porte de Versailles',
      arrondissement: '15',
      corridor: 'sud',
      close_time: '19:00',
      active_dates: ['2026-03-14', '2026-03-15', '2026-03-16'],
      exit_window: { start: '18:30', end: '19:30' },
      weight: 10,
      crowd: 'premium',
      vtc_probability: 0.75,
      reason: 'Franchise Expo - clientele affaires premium',
      positioning: 'Porte de Versailles'
    },
    {
      id: 'arena_accor_lara_fabian',
      name: 'Accor Arena - Lara Fabian',
      type: 'stadium',
      lat: 48.8386,
      lng: 2.3785,
      zone: 'Bercy',
      arrondissement: '12',
      corridor: 'est',
      close_time: '22:30',
      active_dates: ['2026-03-10'],
      exit_window: { start: '22:15', end: '23:15' },
      weight: 9,
      crowd: 'premium',
      vtc_probability: 0.8,
      reason: 'concert Lara Fabian - 17000 spectateurs',
      positioning: 'Quai de Bercy'
    },
    {
      id: 'arena_accor_wutang',
      name: 'Accor Arena - Wu-Tang Clan',
      type: 'stadium',
      lat: 48.8386,
      lng: 2.3785,
      zone: 'Bercy',
      arrondissement: '12',
      corridor: 'est',
      close_time: '23:00',
      active_dates: ['2026-03-11'],
      exit_window: { start: '22:45', end: '23:45' },
      weight: 10,
      crowd: 'mixed',
      vtc_probability: 0.75,
      reason: 'concert Wu-Tang Clan - sold out 20000',
      positioning: 'Boulevard de Bercy'
    },
    {
      id: 'arena_accor_kendji',
      name: 'Accor Arena - Kendji Girac',
      type: 'stadium',
      lat: 48.8386,
      lng: 2.3785,
      zone: 'Bercy',
      arrondissement: '12',
      corridor: 'est',
      close_time: '22:30',
      active_dates: ['2026-03-14'],
      exit_window: { start: '22:15', end: '23:15' },
      weight: 8,
      crowd: 'mixed',
      vtc_probability: 0.7,
      reason: 'concert Kendji Girac - public familial',
      positioning: 'Gare de Lyon'
    },
    {
      id: 'banlieue_arena_defense_rugby',
      name: 'Paris La Defense Arena - Racing 92 vs Castres',
      type: 'stadium',
      lat: 48.8958,
      lng: 2.2286,
      zone: 'La Defense',
      arrondissement: '92',
      corridor: 'ouest',
      close_time: '18:30',
      active_dates: ['2026-03-21'],
      exit_window: { start: '18:15', end: '19:15' },
      weight: 9,
      crowd: 'premium',
      vtc_probability: 0.7,
      reason: 'match Top 14 - 30000 supporters',
      positioning: 'Esplanade de La Defense'
    },
    {
      id: 'banlieue_arena_defense_artus',
      name: 'Paris La Defense Arena - Artus Show',
      type: 'stadium',
      lat: 48.8958,
      lng: 2.2286,
      zone: 'La Defense',
      arrondissement: '92',
      corridor: 'ouest',
      close_time: '23:00',
      active_dates: ['2026-03-27', '2026-03-28'],
      exit_window: { start: '22:45', end: '00:00' },
      weight: 9,
      crowd: 'mixed',
      vtc_probability: 0.75,
      reason: 'spectacle Artus - 40000 personnes - La Defense paralysee',
      positioning: 'Pont de Neuilly'
    },
    {
      id: 'banlieue_villepinte_madame_loyal',
      name: 'Paris Nord Villepinte - Madame Loyal Festival',
      type: 'banlieue_event_space',
      lat: 48.9719,
      lng: 2.5161,
      zone: 'Villepinte',
      arrondissement: '93',
      corridor: 'nord',
      close_time: '06:00',
      active_dates: ['2026-03-13', '2026-03-14'],
      exit_window: { start: '05:00', end: '06:30' },
      weight: 10,
      crowd: 'young_metro',
      vtc_probability: 0.95,
      reason: 'festival 24000 pers - RER arrete - goldmine VTC',
      positioning: 'Parking P1 Villepinte'
    },
    {
      id: 'banlieue_chateau_meridon',
      name: 'Chateau de Meridon - Galas/Mariages',
      type: 'banlieue_event_space',
      lat: 48.6833,
      lng: 2.0333,
      zone: 'Chevreuse',
      arrondissement: '78',
      corridor: 'ouest',
      close_time: '03:00',
      active_dates: ['2026-03-07', '2026-03-14', '2026-03-21', '2026-03-28'],
      exit_window: { start: '02:00', end: '04:00' },
      weight: 7,
      crowd: 'premium',
      vtc_probability: 0.9,
      reason: 'mariages/galas chateau - courses longues 78->Paris',
      positioning: 'Chateau de Meridon'
    },
    {
      id: 'banlieue_chateau_vaux',
      name: 'Chateau de Vaux-le-Vicomte - Corporate Event',
      type: 'banlieue_event_space',
      lat: 48.5661,
      lng: 2.7145,
      zone: 'Maincy',
      arrondissement: '77',
      corridor: 'est',
      close_time: '02:00',
      active_dates: ['2026-03-20', '2026-03-27'],
      exit_window: { start: '01:00', end: '02:30' },
      weight: 8,
      crowd: 'premium',
      vtc_probability: 0.95,
      reason: 'soiree corporate chateau - VIP retours Paris',
      positioning: 'Chateau Vaux-le-Vicomte'
    }
  ]
}

// ── Main Generator ──

/**
 * Generate special event signals for today
 * Only returns signals for events happening TODAY
 */
export function generateSpecialEventSignals(
  events: SpecialEvent[] = getSpecialEventsStatic(),
  now: Date = new Date()
): Signal[] {
  const signals: Signal[] = []
  const todayStr = now.toISOString().slice(0, 10)

  for (const event of events) {
    // Skip if not active today
    if (!event.active_dates.includes(todayStr)) continue

    // Check timing
    const timing = isWithinExitWindow(now, event.exit_window)

    // Skip if not forming or active
    if (!timing.active && !timing.forming) continue

    // Compute signal properties
    const priorityScore = computePriorityScore(event, timing)
    const intensity = computeIntensity(event.weight, event.type)
    const confidence = computeConfidence(event.vtc_probability)
    const crowdLabel = getCrowdLabel(event.crowd)
    const typeLabel = getEventTypeLabel(event.type)

    // Generate title
    const title = timing.forming
      ? `${event.name} - sortie imminente`
      : `${event.name} - vague de sortie`

    // Generate action
    const action = `Position ${event.positioning} avant ${event.exit_window.start}`

    // Window label
    const windowLabel = `${event.exit_window.start}–${event.exit_window.end}`

    // Create signal
    const signal: Signal = {
      id: `special-${event.id}-${todayStr}`,
      kind: timing.active ? 'live' : 'soon',
      type: event.type === 'expo_center' ? 'event_exit' :
            event.type === 'banlieue_event_space' ? 'banlieue_pressure' : 'event_exit',
      title,
      zone: event.zone,
      arrondissement: event.arrondissement,
      time_window: {
        start: event.exit_window.start,
        end: event.exit_window.end,
        label: windowLabel
      },
      reason: event.reason,
      action,
      priority_score: priorityScore,
      intensity,
      confidence,
      direction: event.corridor,
      minutes_until_start: timing.minutesUntil,
      is_active: timing.active,
      is_expiring: timing.expiring,
      is_forming: timing.forming,
      is_compound: false,
      source: 'special-events',
      raw_event_id: event.id,
      display_label: typeLabel,
      display_sublabel: `${windowLabel} · ${crowdLabel}`
    }

    signals.push(signal)
  }

  // Sort by priority score descending
  signals.sort((a, b) => b.priority_score - a.priority_score)

  return signals
}

/**
 * Get all events for a specific date (for SEMAINE view)
 */
export function getEventsForDate(
  dateStr: string,
  events: SpecialEvent[] = getSpecialEventsStatic()
): SpecialEvent[] {
  return events.filter(e => e.active_dates.includes(dateStr))
}

/**
 * Get upcoming events within the next N days (for SEMAINE view)
 */
export function getUpcomingEvents(
  days: number = 7,
  events: SpecialEvent[] = getSpecialEventsStatic(),
  now: Date = new Date()
): { date: string; events: SpecialEvent[] }[] {
  const result: { date: string; events: SpecialEvent[] }[] = []

  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const dayEvents = getEventsForDate(dateStr, events)
    if (dayEvents.length > 0) {
      result.push({ date: dateStr, events: dayEvents })
    }
  }

  return result
}
