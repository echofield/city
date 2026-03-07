/**
 * WEEKLY PULSE MODEL
 *
 * Paris has 7 predictable demand waves that pulse through the city every day.
 * Their strength varies by day of week — this is the rhythm model.
 *
 * The 7 Waves:
 * 1. Morning Station + Airport (05:30-09:00)
 * 2. Morning Office Absorption (07:30-10:00)
 * 3. Midday Redistribution (11:30-14:30)
 * 4. Evening Office Release (17:30-20:30)
 * 5. Event Exit Release (20:30-23:45)
 * 6. Late Station/Airport Forced Mobility (21:30-01:30)
 * 7. Nightlife Closure Cascade (00:30-05:30)
 *
 * Weekly Rhythm:
 * - Monday: Office strong, nightlife dead
 * - Tuesday-Thursday: Office strong, events moderate
 * - Friday: Office + events + nightlife start building
 * - Saturday: Events peak, nightlife peak, office dead
 * - Sunday: Airport returns, nightlife tail, office dead
 */

import { RideProfile } from './forced-mobility'

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type PredictableWaveCategory =
  | 'morning_station_airport'
  | 'morning_office'
  | 'midday_redistribution'
  | 'evening_office_release'
  | 'event_exit'
  | 'late_station_airport'
  | 'nightlife_closure'

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export interface PredictableDemandWave {
  id: string
  name: string
  category: PredictableWaveCategory
  typical_start: string  // "HH:MM" format
  typical_end: string    // "HH:MM" format
  core_zones: string[]
  base_strength: number  // 0-100, baseline strength
  ride_profile: RideProfile
  modifiers: string[]    // Factors that amplify/diminish
  notes: string
}

export interface DayModifier {
  day: DayOfWeek
  multiplier: number     // 0.0 = dead, 1.0 = baseline, 2.0 = doubled
  notes?: string
}

export interface WaveWithDayContext extends PredictableDemandWave {
  day: DayOfWeek
  adjusted_strength: number
  is_active: boolean
  minutes_until_start: number
  minutes_until_end: number
}

// ═══════════════════════════════════════════════════════════════════
// THE 7 PREDICTABLE DEMAND WAVES
// ═══════════════════════════════════════════════════════════════════

export const PREDICTABLE_WAVES: PredictableDemandWave[] = [
  // ─────────────────────────────────────────────────────────────────
  // 1. MORNING STATION + AIRPORT (05:30-09:00)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'morning_station_airport',
    name: 'Vague Gares + Aéroports Matinale',
    category: 'morning_station_airport',
    typical_start: '05:30',
    typical_end: '09:00',
    core_zones: [
      'Gare du Nord', 'Gare de Lyon', 'Gare Montparnasse',
      'Gare Saint-Lazare', 'CDG', 'Orly'
    ],
    base_strength: 75,
    ride_profile: 'premium_long',
    modifiers: [
      'International arrivals boost +20',
      'Monday = business travelers peak',
      'Holiday returns = surge',
      'Metro not yet full capacity = +15',
    ],
    notes: 'First wave of the day. Travelers with luggage, tight schedules. Metro starts at 05:30 but sparse. Premium rides to hotels, business districts, or onward connections.',
  },

  // ─────────────────────────────────────────────────────────────────
  // 2. MORNING OFFICE ABSORPTION (07:30-10:00)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'morning_office',
    name: 'Absorption Bureaux',
    category: 'morning_office',
    typical_start: '07:30',
    typical_end: '10:00',
    core_zones: [
      'La Défense', 'Opéra', 'Châtelet', 'Saint-Lazare',
      'Nation', 'République', 'Bastille'
    ],
    base_strength: 60,
    ride_profile: 'mixed',
    modifiers: [
      'Rain = +25 (no one wants to wait)',
      'Strike = +40',
      'Monday = peak',
      'Friday = -15',
      'Weekend = dead',
    ],
    notes: 'Commuters who missed metro, running late, or expense account. Competition with metro is high but rain/disruption converts to VTC.',
  },

  // ─────────────────────────────────────────────────────────────────
  // 3. MIDDAY REDISTRIBUTION (11:30-14:30)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'midday_redistribution',
    name: 'Redistribution Midi',
    category: 'midday_redistribution',
    typical_start: '11:30',
    typical_end: '14:30',
    core_zones: [
      'Saint-Germain', 'Marais', 'Opéra', 'Champs-Élysées',
      'Trocadéro', 'Grands Boulevards'
    ],
    base_strength: 40,
    ride_profile: 'short_fast',
    modifiers: [
      'Business lunches = short rides',
      'Tourist activity = random',
      'Weather dependent',
      'Steady but low-value',
    ],
    notes: 'Lunch redistribution. Business meetings, tourist movement. Lower intensity, steady flow. Not worth chasing unless nearby.',
  },

  // ─────────────────────────────────────────────────────────────────
  // 4. EVENING OFFICE RELEASE (17:30-20:30)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'evening_office_release',
    name: 'Sortie Bureaux Soir',
    category: 'evening_office_release',
    typical_start: '17:30',
    typical_end: '20:30',
    core_zones: [
      'La Défense', 'Opéra', 'Saint-Lazare', 'Châtelet',
      'Nation', 'Bastille', 'République'
    ],
    base_strength: 70,
    ride_profile: 'mixed',
    modifiers: [
      'Rain = +30',
      'Strike = +50 (most valuable)',
      'Thursday/Friday = after-work drinks',
      'Weekend = dead',
      'Metro saturation = conversion',
    ],
    notes: 'Major daily wave. Office workers heading home or to dinner/drinks. Rain and disruption are massive multipliers. Friday extends into nightlife transition.',
  },

  // ─────────────────────────────────────────────────────────────────
  // 5. EVENT EXIT RELEASE (20:30-23:45)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'event_exit',
    name: 'Sorties Événements',
    category: 'event_exit',
    typical_start: '20:30',
    typical_end: '23:45',
    core_zones: [
      'Bercy', 'La Défense Arena', 'Stade de France',
      'Accor Arena', 'Olympia', 'Bataclan', 'Zénith'
    ],
    base_strength: 80,
    ride_profile: 'long',
    modifiers: [
      'Large venue (>10k) = +25',
      'Late end (>23:00) = +30 (metro weak)',
      'Rain = +20',
      'Weekend = more events',
      'Depends entirely on event calendar',
    ],
    notes: 'High-value wave but requires event intelligence. Crowds release suddenly. Late events force VTC when metro weakens. Position 15 min before end.',
  },

  // ─────────────────────────────────────────────────────────────────
  // 6. LATE STATION/AIRPORT FORCED MOBILITY (21:30-01:30)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'late_station_airport',
    name: 'Mobilité Forcée Gares/Aéroports',
    category: 'late_station_airport',
    typical_start: '21:30',
    typical_end: '01:30',
    core_zones: [
      'Gare du Nord', 'Gare de Lyon', 'Gare Montparnasse',
      'CDG', 'Orly'
    ],
    base_strength: 85,
    ride_profile: 'premium_long',
    modifiers: [
      'After 23:00 = metro closing = +30',
      'International arrivals = guaranteed VTC',
      'Delayed trains = burst release',
      'Weekend nights = higher volume',
    ],
    notes: 'THE forced mobility window. Late trains + no metro = guaranteed rides. International travelers have no alternative. This is the most predictable high-value window.',
  },

  // ─────────────────────────────────────────────────────────────────
  // 7. NIGHTLIFE CLOSURE CASCADE (00:30-05:30)
  // ─────────────────────────────────────────────────────────────────
  {
    id: 'nightlife_closure',
    name: 'Cascade Fermeture Nuit',
    category: 'nightlife_closure',
    typical_start: '00:30',
    typical_end: '05:30',
    core_zones: [
      'Pigalle', 'Oberkampf', 'Bastille', 'Marais',
      'Châtelet', 'Saint-Germain', 'Champs-Élysées'
    ],
    base_strength: 65,
    ride_profile: 'short_fast',
    modifiers: [
      'Friday/Saturday = +50',
      'Thursday = +20',
      'Sunday-Wednesday = minimal',
      '02:00 bar closure = first wave',
      '05:00 club closure = second wave',
    ],
    notes: 'Cascading closures. Bars close 02:00, clubs 05:00. No metro until 05:30. Volume high on weekends but rides are shorter (intra-Paris). Competition from other drivers.',
  },
]

// ═══════════════════════════════════════════════════════════════════
// WEEKLY RHYTHM MODIFIERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Each wave has different strength depending on day of week.
 * These multipliers adjust the base_strength.
 */
export const WEEKLY_RHYTHM: Record<PredictableWaveCategory, DayModifier[]> = {
  // ─────────────────────────────────────────────────────────────────
  // Morning Station + Airport
  // ─────────────────────────────────────────────────────────────────
  morning_station_airport: [
    { day: 'monday', multiplier: 1.3, notes: 'Business travelers return' },
    { day: 'tuesday', multiplier: 1.0 },
    { day: 'wednesday', multiplier: 1.0 },
    { day: 'thursday', multiplier: 1.0 },
    { day: 'friday', multiplier: 1.1, notes: 'Early weekend arrivals' },
    { day: 'saturday', multiplier: 0.8, notes: 'Leisure travelers, fewer flights' },
    { day: 'sunday', multiplier: 1.2, notes: 'Weekend returns starting' },
  ],

  // ─────────────────────────────────────────────────────────────────
  // Morning Office
  // ─────────────────────────────────────────────────────────────────
  morning_office: [
    { day: 'monday', multiplier: 1.2, notes: 'Week starts, meetings' },
    { day: 'tuesday', multiplier: 1.1 },
    { day: 'wednesday', multiplier: 1.0 },
    { day: 'thursday', multiplier: 1.0 },
    { day: 'friday', multiplier: 0.8, notes: 'Remote work, lighter' },
    { day: 'saturday', multiplier: 0.1, notes: 'Minimal' },
    { day: 'sunday', multiplier: 0.05, notes: 'Dead' },
  ],

  // ─────────────────────────────────────────────────────────────────
  // Midday Redistribution
  // ─────────────────────────────────────────────────────────────────
  midday_redistribution: [
    { day: 'monday', multiplier: 1.0 },
    { day: 'tuesday', multiplier: 1.0 },
    { day: 'wednesday', multiplier: 1.0 },
    { day: 'thursday', multiplier: 1.0 },
    { day: 'friday', multiplier: 1.1, notes: 'Longer lunches' },
    { day: 'saturday', multiplier: 0.9, notes: 'Tourist lunch' },
    { day: 'sunday', multiplier: 0.7, notes: 'Quiet' },
  ],

  // ─────────────────────────────────────────────────────────────────
  // Evening Office Release
  // ─────────────────────────────────────────────────────────────────
  evening_office_release: [
    { day: 'monday', multiplier: 1.0 },
    { day: 'tuesday', multiplier: 1.0 },
    { day: 'wednesday', multiplier: 1.0 },
    { day: 'thursday', multiplier: 1.15, notes: 'After-work drinks' },
    { day: 'friday', multiplier: 1.3, notes: 'Weekend starts, after-work' },
    { day: 'saturday', multiplier: 0.1, notes: 'Minimal' },
    { day: 'sunday', multiplier: 0.05, notes: 'Dead' },
  ],

  // ─────────────────────────────────────────────────────────────────
  // Event Exit
  // ─────────────────────────────────────────────────────────────────
  event_exit: [
    { day: 'monday', multiplier: 0.5, notes: 'Few events' },
    { day: 'tuesday', multiplier: 0.6 },
    { day: 'wednesday', multiplier: 0.7 },
    { day: 'thursday', multiplier: 0.9, notes: 'Midweek concerts' },
    { day: 'friday', multiplier: 1.2, notes: 'Weekend starts' },
    { day: 'saturday', multiplier: 1.5, notes: 'Peak event day' },
    { day: 'sunday', multiplier: 0.8, notes: 'Afternoon events, early end' },
  ],

  // ─────────────────────────────────────────────────────────────────
  // Late Station/Airport
  // ─────────────────────────────────────────────────────────────────
  late_station_airport: [
    { day: 'monday', multiplier: 0.8 },
    { day: 'tuesday', multiplier: 0.8 },
    { day: 'wednesday', multiplier: 0.9 },
    { day: 'thursday', multiplier: 1.0 },
    { day: 'friday', multiplier: 1.3, notes: 'Weekend arrivals' },
    { day: 'saturday', multiplier: 1.1 },
    { day: 'sunday', multiplier: 1.4, notes: 'Weekend returns peak' },
  ],

  // ─────────────────────────────────────────────────────────────────
  // Nightlife Closure
  // ─────────────────────────────────────────────────────────────────
  nightlife_closure: [
    { day: 'monday', multiplier: 0.2, notes: 'Dead' },
    { day: 'tuesday', multiplier: 0.3 },
    { day: 'wednesday', multiplier: 0.4 },
    { day: 'thursday', multiplier: 0.7, notes: 'Student night' },
    { day: 'friday', multiplier: 1.4, notes: 'Weekend night' },
    { day: 'saturday', multiplier: 1.6, notes: 'Peak nightlife' },
    { day: 'sunday', multiplier: 0.5, notes: 'Sunday morning tail' },
  ],
}

// ═══════════════════════════════════════════════════════════════════
// TIME UTILITIES
// ═══════════════════════════════════════════════════════════════════

function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

function getCurrentParisTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
}

function getDayOfWeek(date: Date): DayOfWeek {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[date.getDay()]
}

function getCurrentMinutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

// ═══════════════════════════════════════════════════════════════════
// WAVE STATUS COMPUTATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if a wave is currently active
 */
export function isWaveActive(wave: PredictableDemandWave, currentMinutes: number): boolean {
  const startMinutes = parseTimeToMinutes(wave.typical_start)
  const endMinutes = parseTimeToMinutes(wave.typical_end)

  // Handle cross-midnight waves (e.g., nightlife: 00:30-05:30)
  if (endMinutes < startMinutes) {
    // Wave crosses midnight
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes
}

/**
 * Compute minutes until wave starts
 */
export function minutesUntilWaveStart(wave: PredictableDemandWave, currentMinutes: number): number {
  const startMinutes = parseTimeToMinutes(wave.typical_start)

  if (currentMinutes < startMinutes) {
    return startMinutes - currentMinutes
  } else {
    // Wave already started or passed — next occurrence is tomorrow
    return (24 * 60 - currentMinutes) + startMinutes
  }
}

/**
 * Compute minutes until wave ends
 */
export function minutesUntilWaveEnd(wave: PredictableDemandWave, currentMinutes: number): number {
  const startMinutes = parseTimeToMinutes(wave.typical_start)
  const endMinutes = parseTimeToMinutes(wave.typical_end)

  // Handle cross-midnight waves
  if (endMinutes < startMinutes) {
    if (currentMinutes >= startMinutes) {
      // Before midnight, wave active
      return (24 * 60 - currentMinutes) + endMinutes
    } else if (currentMinutes < endMinutes) {
      // After midnight, wave active
      return endMinutes - currentMinutes
    } else {
      // Wave not active
      return -1
    }
  }

  if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
    return endMinutes - currentMinutes
  }

  return -1 // Not active
}

/**
 * Get adjusted strength based on day of week
 */
export function getAdjustedStrength(wave: PredictableDemandWave, day: DayOfWeek): number {
  const modifiers = WEEKLY_RHYTHM[wave.category]
  const modifier = modifiers.find(m => m.day === day)
  const multiplier = modifier?.multiplier ?? 1.0

  return Math.round(wave.base_strength * multiplier)
}

// ═══════════════════════════════════════════════════════════════════
// MAIN FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get all waves with current day context
 */
export function getWavesWithContext(date?: Date): WaveWithDayContext[] {
  const now = date ?? getCurrentParisTime()
  const day = getDayOfWeek(now)
  const currentMinutes = getCurrentMinutesSinceMidnight(now)

  return PREDICTABLE_WAVES.map(wave => {
    const isActive = isWaveActive(wave, currentMinutes)
    const adjustedStrength = getAdjustedStrength(wave, day)
    const minsUntilStart = minutesUntilWaveStart(wave, currentMinutes)
    const minsUntilEnd = isActive ? minutesUntilWaveEnd(wave, currentMinutes) : -1

    return {
      ...wave,
      day,
      adjusted_strength: adjustedStrength,
      is_active: isActive,
      minutes_until_start: minsUntilStart,
      minutes_until_end: minsUntilEnd,
    }
  })
}

/**
 * Get currently active waves, sorted by strength
 */
export function getActiveWaves(date?: Date): WaveWithDayContext[] {
  return getWavesWithContext(date)
    .filter(w => w.is_active)
    .sort((a, b) => b.adjusted_strength - a.adjusted_strength)
}

/**
 * Get upcoming waves (not yet started), sorted by time to start
 */
export function getUpcomingWaves(date?: Date, maxMinutes: number = 180): WaveWithDayContext[] {
  return getWavesWithContext(date)
    .filter(w => !w.is_active && w.minutes_until_start <= maxMinutes)
    .sort((a, b) => a.minutes_until_start - b.minutes_until_start)
}

/**
 * Get the strongest wave right now
 */
export function getStrongestActiveWave(date?: Date): WaveWithDayContext | null {
  const active = getActiveWaves(date)
  return active[0] ?? null
}

/**
 * Get next significant wave (strength > 50)
 */
export function getNextSignificantWave(date?: Date): WaveWithDayContext | null {
  const upcoming = getUpcomingWaves(date, 360) // Look 6 hours ahead
    .filter(w => w.adjusted_strength >= 50)

  return upcoming[0] ?? null
}

// ═══════════════════════════════════════════════════════════════════
// DAILY SUMMARY
// ═══════════════════════════════════════════════════════════════════

export interface DailySummary {
  day: DayOfWeek
  date: string
  best_window: string
  best_wave: PredictableWaveCategory
  expected_peak_strength: number
  waves_by_hour: {
    hour: number
    active_waves: PredictableWaveCategory[]
    combined_strength: number
  }[]
  strategic_notes: string[]
}

/**
 * Generate a full day summary showing wave rhythm
 */
export function generateDailySummary(date?: Date): DailySummary {
  const now = date ?? getCurrentParisTime()
  const day = getDayOfWeek(now)
  const dateStr = now.toISOString().slice(0, 10)

  // Calculate wave activity for each hour
  const wavesByHour: DailySummary['waves_by_hour'] = []
  let bestHour = 0
  let bestStrength = 0

  for (let hour = 0; hour < 24; hour++) {
    const hourMinutes = hour * 60 + 30 // Check at :30 of each hour
    const activeWaves: PredictableWaveCategory[] = []
    let combinedStrength = 0

    for (const wave of PREDICTABLE_WAVES) {
      if (isWaveActive(wave, hourMinutes)) {
        activeWaves.push(wave.category)
        combinedStrength += getAdjustedStrength(wave, day)
      }
    }

    // Cap combined strength at 100
    combinedStrength = Math.min(100, combinedStrength)

    wavesByHour.push({
      hour,
      active_waves: activeWaves,
      combined_strength: combinedStrength,
    })

    if (combinedStrength > bestStrength) {
      bestStrength = combinedStrength
      bestHour = hour
    }
  }

  // Find best wave in best hour
  const bestHourData = wavesByHour[bestHour]
  const bestWave = bestHourData.active_waves[0] ?? 'morning_station_airport'

  // Generate strategic notes based on day
  const strategicNotes: string[] = []

  switch (day) {
    case 'monday':
      strategicNotes.push('Business travelers return — gares et aéroports forts le matin')
      strategicNotes.push('Bureaux actifs — pluie = conversion VTC')
      strategicNotes.push('Nuit calme — ne pas chasser la nightlife')
      break
    case 'tuesday':
    case 'wednesday':
      strategicNotes.push('Journée standard — focus bureaux matin/soir')
      strategicNotes.push('Events possibles — checker le calendrier')
      break
    case 'thursday':
      strategicNotes.push('Soirée after-work commence — Châtelet/Bastille')
      strategicNotes.push('Début de semaine nightlife — étudiants')
      break
    case 'friday':
      strategicNotes.push('JOUR CLÉ — sortie bureaux + début weekend')
      strategicNotes.push('Enchaîner: bureaux (17h30) → events (20h30) → nuit')
      strategicNotes.push('Arrivées weekend aux gares/aéroports soir')
      break
    case 'saturday':
      strategicNotes.push('PIC NIGHTLIFE — préparer 00h30-05h30')
      strategicNotes.push('Events majeurs — concerts, matchs, spectacles')
      strategicNotes.push('Pas de bureaux — ne pas les attendre')
      break
    case 'sunday':
      strategicNotes.push('Retours weekend — aéroports/gares soir')
      strategicNotes.push('Nightlife tail jusqu\'à 06h — puis creux')
      strategicNotes.push('Journée calme — économiser énergie')
      break
  }

  // Format best window
  const endHour = bestHour + 2 > 23 ? (bestHour + 2) % 24 : bestHour + 2
  const bestWindow = `${String(bestHour).padStart(2, '0')}:00 – ${String(endHour).padStart(2, '0')}:00`

  return {
    day,
    date: dateStr,
    best_window: bestWindow,
    best_wave: bestWave,
    expected_peak_strength: bestStrength,
    waves_by_hour: wavesByHour,
    strategic_notes: strategicNotes,
  }
}

// ═══════════════════════════════════════════════════════════════════
// WEEKLY OVERVIEW
// ═══════════════════════════════════════════════════════════════════

export interface WeeklyOverview {
  week_of: string
  best_night: {
    day: DayOfWeek
    reason: string
    expected_strength: number
  }
  best_day_shift: {
    day: DayOfWeek
    reason: string
    expected_strength: number
  }
  day_summaries: Pick<DailySummary, 'day' | 'best_window' | 'expected_peak_strength' | 'strategic_notes'>[]
}

/**
 * Generate a week-level overview for planning
 */
export function generateWeeklyOverview(startDate?: Date): WeeklyOverview {
  const start = startDate ?? getCurrentParisTime()
  const weekOf = start.toISOString().slice(0, 10)

  const dayOrder: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

  // Calculate peak strength for each day for nightlife and day shift
  const nightStrengths: Record<DayOfWeek, number> = {} as Record<DayOfWeek, number>
  const dayStrengths: Record<DayOfWeek, number> = {} as Record<DayOfWeek, number>

  for (const day of dayOrder) {
    // Nightlife strength (average of late_station_airport + nightlife_closure)
    const lateStationMod = WEEKLY_RHYTHM.late_station_airport.find(m => m.day === day)?.multiplier ?? 1
    const nightlifeMod = WEEKLY_RHYTHM.nightlife_closure.find(m => m.day === day)?.multiplier ?? 1
    nightStrengths[day] = Math.round((85 * lateStationMod + 65 * nightlifeMod) / 2)

    // Day strength (average of office waves)
    const morningOfficeMod = WEEKLY_RHYTHM.morning_office.find(m => m.day === day)?.multiplier ?? 1
    const eveningOfficeMod = WEEKLY_RHYTHM.evening_office_release.find(m => m.day === day)?.multiplier ?? 1
    dayStrengths[day] = Math.round((60 * morningOfficeMod + 70 * eveningOfficeMod) / 2)
  }

  // Find best night
  let bestNight: DayOfWeek = 'saturday'
  let bestNightStrength = 0
  for (const [day, strength] of Object.entries(nightStrengths)) {
    if (strength > bestNightStrength) {
      bestNightStrength = strength
      bestNight = day as DayOfWeek
    }
  }

  // Find best day shift
  let bestDayShift: DayOfWeek = 'friday'
  let bestDayStrength = 0
  for (const [day, strength] of Object.entries(dayStrengths)) {
    if (strength > bestDayStrength) {
      bestDayStrength = strength
      bestDayShift = day as DayOfWeek
    }
  }

  // Generate summaries for each day
  const daySummaries = dayOrder.map(day => {
    // Create a date for this day
    const dayDate = new Date(start)
    const currentDayIndex = start.getDay()
    const targetDayIndex = dayOrder.indexOf(day) + 1 // Monday = 1
    const diff = (targetDayIndex - currentDayIndex + 7) % 7
    dayDate.setDate(dayDate.getDate() + diff)

    const summary = generateDailySummary(dayDate)
    return {
      day: summary.day,
      best_window: summary.best_window,
      expected_peak_strength: summary.expected_peak_strength,
      strategic_notes: summary.strategic_notes,
    }
  })

  return {
    week_of: weekOf,
    best_night: {
      day: bestNight,
      reason: bestNight === 'saturday' ? 'Pic nightlife + events' :
              bestNight === 'friday' ? 'Début weekend + bureaux' :
              'Volume élevé',
      expected_strength: bestNightStrength,
    },
    best_day_shift: {
      day: bestDayShift,
      reason: bestDayShift === 'friday' ? 'Sortie bureaux + après-work' :
              bestDayShift === 'monday' ? 'Business travelers' :
              'Bureaux standard',
      expected_strength: bestDayStrength,
    },
    day_summaries: daySummaries,
  }
}

// ═══════════════════════════════════════════════════════════════════
// DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════════

export function getWaveLabel(category: PredictableWaveCategory): string {
  switch (category) {
    case 'morning_station_airport': return 'Gares/Aéroports Matin'
    case 'morning_office': return 'Bureaux Matin'
    case 'midday_redistribution': return 'Midi'
    case 'evening_office_release': return 'Sortie Bureaux'
    case 'event_exit': return 'Sorties Events'
    case 'late_station_airport': return 'Gares/Aéros Tard'
    case 'nightlife_closure': return 'Fin Nuit'
  }
}

export function getWaveEmoji(category: PredictableWaveCategory): string {
  switch (category) {
    case 'morning_station_airport': return '🚄'
    case 'morning_office': return '🏢'
    case 'midday_redistribution': return '🍽️'
    case 'evening_office_release': return '💼'
    case 'event_exit': return '🎭'
    case 'late_station_airport': return '✈️'
    case 'nightlife_closure': return '🌙'
  }
}

export function formatStrength(strength: number): string {
  if (strength >= 80) return 'FORT'
  if (strength >= 60) return 'BON'
  if (strength >= 40) return 'MOYEN'
  if (strength >= 20) return 'FAIBLE'
  return 'CALME'
}

export function getDayLabelFr(day: DayOfWeek): string {
  const labels: Record<DayOfWeek, string> = {
    monday: 'Lundi',
    tuesday: 'Mardi',
    wednesday: 'Mercredi',
    thursday: 'Jeudi',
    friday: 'Vendredi',
    saturday: 'Samedi',
    sunday: 'Dimanche',
  }
  return labels[day]
}
