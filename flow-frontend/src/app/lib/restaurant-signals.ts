/**
 * FLOW — Restaurant Signal Generator
 * Daily demand signals from premium and festive restaurant exits
 *
 * Two distinct restaurant types:
 * - restaurant_palace: Michelin/palace dining, earlier cleaner exits
 * - restaurant_festive: Trendy/DJ spots, later denser exits
 */

import type { Signal, SignalIntensity, ConfidenceLevel } from '../types/signal'

// ── Types ──

interface RestaurantVenue {
  id: string
  name: string
  zone: string
  corridor: 'nord' | 'est' | 'sud' | 'ouest' | 'centre'
  lat: number
  lon: number
  capacity?: number
  type: 'restaurant_palace' | 'restaurant_festive' | 'restaurant_gastro'
  schedule?: { days?: number[]; close?: string }
  vtc_profile?: { probability?: number; crowd?: string; exit_duration_min?: number }
  weight?: number
}

interface RestaurantExitWindow {
  start: string    // HH:MM
  end: string      // HH:MM
  label: string
}

// ── Constants ──

// Zone positioning recommendations
const ZONE_POSITIONS: Record<string, string> = {
  'Trocadero': 'Place du Trocadero',
  'Champs-Elysees': 'Rond-Point des Champs-Elysees',
  'Vendome': 'Place Vendome',
  'Tuileries': 'Rue de Rivoli',
  'Opera': 'Place de l\'Opera',
  'Pont Neuf': 'Quai du Louvre',
  'Saint-Germain': 'Boulevard Saint-Germain',
  'Faubourg Saint-Honore': 'Rue du Faubourg Saint-Honore',
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
  // Handle overflow past midnight
  const normalizedMins = ((mins % 1440) + 1440) % 1440
  const h = Math.floor(normalizedMins / 60)
  const m = normalizedMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Compute exit window based on restaurant type
 * - Palace: close_time - 45min to close_time
 * - Festive: close_time - 60min to close_time + 30min
 */
function computeExitWindow(
  closeTime: string,
  type: 'restaurant_palace' | 'restaurant_festive' | 'restaurant_gastro'
): RestaurantExitWindow {
  const closeMins = parseTimeToMinutes(closeTime)

  if (type === 'restaurant_festive') {
    // Festive: guests linger, exit wave spans wider
    const startMins = closeMins - 60
    const endMins = closeMins + 30
    return {
      start: formatMinutesToTime(startMins),
      end: formatMinutesToTime(endMins),
      label: `${formatMinutesToTime(startMins)}–${formatMinutesToTime(endMins)}`
    }
  } else {
    // Palace/Gastro: cleaner, earlier exit
    const startMins = closeMins - 45
    const endMins = closeMins
    return {
      start: formatMinutesToTime(startMins),
      end: formatMinutesToTime(endMins),
      label: `${formatMinutesToTime(startMins)}–${formatMinutesToTime(endMins)}`
    }
  }
}

/**
 * Check if current time is within an exit window
 */
function isWithinExitWindow(
  now: Date,
  window: RestaurantExitWindow
): { active: boolean; forming: boolean; expiring: boolean; minutesUntil: number } {
  const currentMins = now.getHours() * 60 + now.getMinutes()
  const startMins = parseTimeToMinutes(window.start)
  let endMins = parseTimeToMinutes(window.end)

  // Handle overnight windows (e.g., 01:00-02:30)
  if (endMins < startMins) endMins += 1440

  let normalizedCurrent = currentMins
  if (currentMins < startMins - 120) {
    // We're past midnight, window was evening
    normalizedCurrent = currentMins + 1440
  }

  const forming = normalizedCurrent >= startMins - 30 && normalizedCurrent < startMins
  const active = normalizedCurrent >= startMins && normalizedCurrent <= endMins
  const expiring = active && (endMins - normalizedCurrent) <= 15

  const minutesUntil = forming ? (startMins - normalizedCurrent) :
                       active ? 0 :
                       (startMins - normalizedCurrent)

  return { active, forming, expiring, minutesUntil }
}

/**
 * Check if today is an active day for the restaurant
 */
function isActiveDay(schedule: { days?: number[] } | undefined, now: Date): boolean {
  if (!schedule?.days) return true // Default: open every day
  const dayOfWeek = now.getDay() // 0=Sunday, 1=Monday...
  return schedule.days.includes(dayOfWeek)
}

/**
 * Compute priority score based on weight, crowd, and timing
 */
function computePriorityScore(
  venue: RestaurantVenue,
  timing: { active: boolean; forming: boolean; expiring: boolean }
): number {
  const baseWeight = venue.weight ?? 7
  const vtcProb = venue.vtc_profile?.probability ?? 0.7

  let score = baseWeight * 10 * vtcProb

  // Timing modifiers
  if (timing.active) score *= 1.2
  if (timing.forming) score *= 0.9
  if (timing.expiring) score *= 0.7

  // Type modifiers
  if (venue.type === 'restaurant_palace') score *= 1.1  // Premium crowd
  if (venue.type === 'restaurant_festive') score *= 1.05

  return Math.min(100, Math.round(score))
}

/**
 * Generate intensity based on weight
 */
function computeIntensity(weight: number): SignalIntensity {
  if (weight >= 9) return 4
  if (weight >= 8) return 3
  if (weight >= 6) return 2
  return 1
}

/**
 * Generate crowd label in French
 */
function getCrowdLabel(type: string, crowd?: string): string {
  if (type === 'restaurant_palace') return 'clientele premium'
  if (type === 'restaurant_festive') return 'clientele festive'
  if (crowd === 'premium') return 'clientele premium'
  if (crowd === 'tourist') return 'clientele touriste'
  return 'clientele mixte'
}

// ── Main Generator ──

/**
 * Generate restaurant exit signals for the current time
 */
export function generateRestaurantSignals(
  venues: RestaurantVenue[],
  now: Date = new Date()
): Signal[] {
  const signals: Signal[] = []

  // Filter to restaurant types only
  const restaurants = venues.filter(v =>
    v.type === 'restaurant_palace' ||
    v.type === 'restaurant_festive' ||
    v.type === 'restaurant_gastro'
  )

  for (const venue of restaurants) {
    // Skip if not open today
    if (!isActiveDay(venue.schedule, now)) continue

    // Get close time
    const closeTime = venue.schedule?.close
    if (!closeTime) continue

    // Compute exit window
    const exitWindow = computeExitWindow(closeTime, venue.type as 'restaurant_palace' | 'restaurant_festive' | 'restaurant_gastro')

    // Check if window is active/forming
    const timing = isWithinExitWindow(now, exitWindow)

    // Skip if not relevant
    if (!timing.active && !timing.forming) continue

    // Compute signal properties
    const priorityScore = computePriorityScore(venue, timing)
    const intensity = computeIntensity(venue.weight ?? 7)
    const crowdLabel = getCrowdLabel(venue.type, venue.vtc_profile?.crowd)
    const position = ZONE_POSITIONS[venue.zone] ?? venue.zone

    // Generate title based on type
    const title = venue.type === 'restaurant_festive'
      ? `${venue.name} vague de sortie`
      : `${venue.name} fenetre de sortie`

    // Generate action recommendation
    const actionTime = timing.forming
      ? formatMinutesToTime(parseTimeToMinutes(exitWindow.start) - 15)
      : formatMinutesToTime(parseTimeToMinutes(exitWindow.start) + 10)

    const action = `Position ${position} avant ${actionTime}`

    // Create signal
    const signal: Signal = {
      id: `rest-exit-${venue.id}-${now.toISOString().slice(0, 10)}`,
      kind: timing.active ? 'live' : 'soon',
      type: 'restaurant',
      title,
      zone: venue.zone,
      arrondissement: venue.zone,
      time_window: {
        start: exitWindow.start,
        end: exitWindow.end,
        label: exitWindow.label
      },
      reason: crowdLabel,
      action,
      priority_score: priorityScore,
      intensity,
      confidence: (venue.vtc_profile?.probability ?? 0.7) >= 0.85 ? 'high' : 'medium',
      direction: venue.corridor,
      minutes_until_start: timing.minutesUntil,
      is_active: timing.active,
      is_expiring: timing.expiring,
      is_forming: timing.forming,
      is_compound: false,
      source: 'restaurant-daily',
      raw_event_id: venue.id,
      display_label: venue.name,
      display_sublabel: `${exitWindow.label} · ${crowdLabel}`
    }

    signals.push(signal)
  }

  // Sort by priority score descending
  signals.sort((a, b) => b.priority_score - a.priority_score)

  return signals
}

/**
 * Load restaurant venues from static data
 * In production, this would fetch from API or bundled JSON
 */
export function getRestaurantVenuesStatic(): RestaurantVenue[] {
  // These match the venues added to paris-venues-enriched.json
  return [
    {
      id: 'rest-girafe',
      name: 'Girafe',
      zone: 'Trocadero',
      corridor: 'ouest',
      lat: 48.8623,
      lon: 2.2881,
      capacity: 150,
      type: 'restaurant_festive',
      schedule: { days: [0, 1, 2, 3, 4, 5, 6], close: '02:00' },
      vtc_profile: { probability: 0.9, crowd: 'premium', exit_duration_min: 30 },
      weight: 9
    },
    {
      id: 'rest-lavenue',
      name: "L'Avenue",
      zone: 'Champs-Elysees',
      corridor: 'ouest',
      lat: 48.8659,
      lon: 2.3046,
      capacity: 200,
      type: 'restaurant_festive',
      schedule: { days: [0, 1, 2, 3, 4, 5, 6], close: '02:00' },
      vtc_profile: { probability: 0.85, crowd: 'premium', exit_duration_min: 30 },
      weight: 8
    },
    {
      id: 'rest-costes',
      name: 'Hotel Costes',
      zone: 'Vendome',
      corridor: 'centre',
      lat: 48.8669,
      lon: 2.3262,
      capacity: 120,
      type: 'restaurant_festive',
      schedule: { days: [0, 1, 2, 3, 4, 5, 6], close: '01:00' },
      vtc_profile: { probability: 0.95, crowd: 'premium', exit_duration_min: 25 },
      weight: 10
    },
    {
      id: 'rest-verde',
      name: 'Verde Paris',
      zone: 'Champs-Elysees',
      corridor: 'ouest',
      lat: 48.8688,
      lon: 2.3001,
      capacity: 180,
      type: 'restaurant_festive',
      schedule: { days: [0, 1, 2, 3, 4, 5, 6], close: '02:00' },
      vtc_profile: { probability: 0.9, crowd: 'premium', exit_duration_min: 30 },
      weight: 9
    },
    {
      id: 'rest-noto',
      name: 'Noto Paris',
      zone: 'Champs-Elysees',
      corridor: 'ouest',
      lat: 48.8768,
      lon: 2.3013,
      capacity: 160,
      type: 'restaurant_festive',
      schedule: { days: [0, 1, 2, 3, 4, 5, 6], close: '02:00' },
      vtc_profile: { probability: 0.85, crowd: 'premium', exit_duration_min: 30 },
      weight: 8
    },
    {
      id: 'rest-lepiaf',
      name: 'Le Piaf',
      zone: 'Champs-Elysees',
      corridor: 'ouest',
      lat: 48.8725,
      lon: 2.3105,
      capacity: 140,
      type: 'restaurant_festive',
      schedule: { days: [0, 1, 2, 3, 4, 5, 6], close: '02:00' },
      vtc_profile: { probability: 0.85, crowd: 'premium', exit_duration_min: 30 },
      weight: 8
    },
    {
      id: 'rest-lecinq',
      name: 'Le Cinq (George V)',
      zone: 'Champs-Elysees',
      corridor: 'ouest',
      lat: 48.8686,
      lon: 2.3005,
      capacity: 70,
      type: 'restaurant_palace',
      schedule: { days: [1, 2, 3, 4, 5, 6], close: '23:30' },
      vtc_profile: { probability: 0.95, crowd: 'premium', exit_duration_min: 15 },
      weight: 10
    },
    {
      id: 'rest-plenitude',
      name: 'Plenitude (Cheval Blanc)',
      zone: 'Pont Neuf',
      corridor: 'centre',
      lat: 48.8587,
      lon: 2.3424,
      capacity: 50,
      type: 'restaurant_palace',
      schedule: { days: [2, 3, 4, 5, 6], close: '23:30' },
      vtc_profile: { probability: 0.95, crowd: 'premium', exit_duration_min: 15 },
      weight: 10
    },
    {
      id: 'rest-lemeurice',
      name: 'Le Meurice Alain Ducasse',
      zone: 'Tuileries',
      corridor: 'centre',
      lat: 48.8652,
      lon: 2.3283,
      capacity: 60,
      type: 'restaurant_palace',
      schedule: { days: [2, 3, 4, 5], close: '23:30' },
      vtc_profile: { probability: 0.95, crowd: 'premium', exit_duration_min: 15 },
      weight: 9
    },
    // Include existing gastro restaurants
    {
      id: 'restaurant-epicure',
      name: 'Epicure (Bristol)',
      zone: 'Faubourg Saint-Honore',
      corridor: 'ouest',
      lat: 48.8710,
      lon: 2.3160,
      capacity: 60,
      type: 'restaurant_palace',  // Treat as palace
      schedule: { days: [1, 2, 3, 4, 5, 6], close: '22:30' },
      vtc_profile: { probability: 0.9, crowd: 'premium', exit_duration_min: 15 },
      weight: 9
    }
  ]
}
