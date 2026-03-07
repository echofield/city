/**
 * FLOW Signal Builder
 *
 * Transforms all intelligence sources into unified Signal objects.
 * Sources: peaks, upcoming, ramifications, weather, banlieue hubs, weekly skeleton.
 *
 * Every signal answers: WHAT / WHERE / WHEN / WHY / ACTION
 */

import type {
  Signal,
  SignalKind,
  SignalType,
  SignalIntensity,
  ConfidenceLevel,
  DriverDensity,
  Corridor,
  SignalFeed,
  WeekSignal,
  WeekCalendar,
  MapSignal,
  MapView,
  RankingWeights,
} from '@/types/signal'
import { DEFAULT_RANKING_WEIGHTS } from '@/types/signal'
import type {
  FlowState,
  Ramification,
  WeeklySkeleton,
  SkeletonWindow,
  BanlieueHubState,
  DriverPosition,
} from '@/types/flow-state'
import type { StationSignal } from '@/lib/signal-fetchers/sncf'
import type { ForcedMobilityWave } from '@/lib/flow-engine/forced-mobility'

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function parseTimeToMinutes(timeStr: string): number {
  // Parse "22:40" or "01h30" to minutes since midnight
  const cleaned = timeStr.replace('h', ':')
  const [h, m] = cleaned.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function minutesUntil(timeStr: string, now: Date = new Date()): number {
  const targetMin = parseTimeToMinutes(timeStr)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  let diff = targetMin - nowMin
  // Handle cross-midnight
  if (diff < -60) diff += 24 * 60
  return diff
}

function confidenceToLevel(score: number): ConfidenceLevel {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

function scoreToIntensity(score: number): SignalIntensity {
  if (score >= 80) return 4
  if (score >= 60) return 3
  if (score >= 40) return 2
  return 1
}

function saturationToDensity(saturation: number): DriverDensity {
  if (saturation < 40) return 'opportunity'
  if (saturation < 70) return 'balanced'
  return 'saturated'
}

function inferSignalType(reason: string): SignalType {
  const lower = reason.toLowerCase()
  if (lower.includes('concert') || lower.includes('spectacle') || lower.includes('match')) return 'event_exit'
  if (lower.includes('tgv') || lower.includes('train') || lower.includes('gare')) return 'transport_wave'
  if (lower.includes('bar') || lower.includes('club') || lower.includes('nightlife') || lower.includes('nuit')) return 'nightlife'
  if (lower.includes('hotel') || lower.includes('hôtel')) return 'hotel_outflow'
  if (lower.includes('restaurant') || lower.includes('resto')) return 'restaurant'
  if (lower.includes('bureau') || lower.includes('office')) return 'office'
  if (lower.includes('pluie') || lower.includes('rain') || lower.includes('météo')) return 'weather'
  if (lower.includes('metro') || lower.includes('métro') || lower.includes('transport')) return 'transport_disruption'
  if (lower.includes('orly') || lower.includes('cdg') || lower.includes('aéroport')) return 'banlieue_pressure'
  if (lower.includes('défense')) return 'banlieue_pressure'
  return 'skeleton'
}

function inferCorridor(zone: string): Corridor {
  const lower = zone.toLowerCase()
  if (lower.includes('gare du nord') || lower.includes('montmartre') || lower.includes('pigalle')) return 'nord'
  if (lower.includes('bastille') || lower.includes('marais') || lower.includes('nation') || lower.includes('bercy')) return 'est'
  if (lower.includes('montparnasse') || lower.includes('orly') || lower.includes('denfert')) return 'sud'
  if (lower.includes('défense') || lower.includes('trocadéro') || lower.includes('champs') || lower.includes('george v')) return 'ouest'
  return 'centre'
}

// ═══════════════════════════════════════════════════════════════════
// DEFAULT ZONE COORDINATES (for proximity computation)
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_ZONE_CENTERS: Record<string, { lat: number; lng: number }> = {
  // Arrondissements
  '1': { lat: 48.8603, lng: 2.3472 },
  '2': { lat: 48.8684, lng: 2.3415 },
  '3': { lat: 48.8641, lng: 2.3619 },
  '4': { lat: 48.8546, lng: 2.3577 },
  '5': { lat: 48.8448, lng: 2.3508 },
  '6': { lat: 48.8496, lng: 2.3323 },
  '7': { lat: 48.8566, lng: 2.3150 },
  '8': { lat: 48.8744, lng: 2.3106 },
  '9': { lat: 48.8766, lng: 2.3372 },
  '10': { lat: 48.8760, lng: 2.3597 },
  '11': { lat: 48.8590, lng: 2.3798 },
  '12': { lat: 48.8396, lng: 2.3876 },
  '13': { lat: 48.8322, lng: 2.3561 },
  '14': { lat: 48.8330, lng: 2.3264 },
  '15': { lat: 48.8421, lng: 2.2987 },
  '16': { lat: 48.8637, lng: 2.2769 },
  '17': { lat: 48.8835, lng: 2.3090 },
  '18': { lat: 48.8925, lng: 2.3444 },
  '19': { lat: 48.8817, lng: 2.3822 },
  '20': { lat: 48.8638, lng: 2.3985 },
  // Banlieue hubs
  'cdg': { lat: 49.0097, lng: 2.5479 },
  'orly': { lat: 48.7262, lng: 2.3652 },
  'defense': { lat: 48.8918, lng: 2.2362 },
  'la défense': { lat: 48.8918, lng: 2.2362 },
  // Stations
  'gare du nord': { lat: 48.8809, lng: 2.3553 },
  'gare de lyon': { lat: 48.8448, lng: 2.3735 },
  'gare de l\'est': { lat: 48.8768, lng: 2.3590 },
  'montparnasse': { lat: 48.8408, lng: 2.3212 },
  'saint-lazare': { lat: 48.8766, lng: 2.3250 },
  // Major venues/areas
  'bercy': { lat: 48.8387, lng: 2.3783 },
  'stade de france': { lat: 48.9244, lng: 2.3601 },
  'parc des princes': { lat: 48.8414, lng: 2.2530 },
  'champs-élysées': { lat: 48.8698, lng: 2.3075 },
  'bastille': { lat: 48.8533, lng: 2.3692 },
  'marais': { lat: 48.8566, lng: 2.3619 },
  'montmartre': { lat: 48.8867, lng: 2.3431 },
  'pigalle': { lat: 48.8822, lng: 2.3372 },
  'châtelet': { lat: 48.8584, lng: 2.3474 },
  'opéra': { lat: 48.8719, lng: 2.3316 },
  'république': { lat: 48.8675, lng: 2.3636 },
  'nation': { lat: 48.8483, lng: 2.3956 },
  'trocadéro': { lat: 48.8616, lng: 2.2874 },
}

/**
 * Get zone coordinates, trying multiple lookup strategies
 */
function getZoneCoordinates(
  zone: string,
  customCoords?: Record<string, { lat: number; lng: number }>
): { lat: number; lng: number } | undefined {
  // Try custom coords first
  if (customCoords?.[zone]) return customCoords[zone]

  // Try default lookup (lowercase normalized)
  const normalized = zone.toLowerCase().trim()
  if (DEFAULT_ZONE_CENTERS[normalized]) return DEFAULT_ZONE_CENTERS[normalized]

  // Try to extract arrondissement number
  const arrMatch = zone.match(/\b(\d{1,2})(e|ème|er)?\b/i)
  if (arrMatch && DEFAULT_ZONE_CENTERS[arrMatch[1]]) {
    return DEFAULT_ZONE_CENTERS[arrMatch[1]]
  }

  // Try partial match on default keys
  for (const [key, coords] of Object.entries(DEFAULT_ZONE_CENTERS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return coords
    }
  }

  return undefined
}

function computeDisplayLabel(signal: Signal): string {
  if (signal.kind === 'nearby') return 'PROCHE DE TOI'
  if (signal.kind === 'alert') return 'ALERTE'
  if (signal.is_compound) return 'SIGNAL COMPOSÉ'
  if (signal.intensity >= 3) return 'SIGNAL FORT'
  if (signal.is_forming) return 'BIENTÔT'
  return 'SIGNAL'
}

function computeDisplaySublabel(signal: Signal): string {
  if (signal.proximity_minutes !== undefined) {
    return `${signal.proximity_minutes} min`
  }
  if (signal.is_active && signal.is_expiring) {
    return 'EXIT NOW'
  }
  if (signal.is_active && signal.minutes_until_end !== undefined) {
    return `${signal.minutes_until_end} min restant`
  }
  if (signal.is_forming && signal.minutes_until_start !== undefined) {
    return `dans ${signal.minutes_until_start} min`
  }
  return signal.time_window.label ?? ''
}

// ═══════════════════════════════════════════════════════════════════
// BUILD SIGNALS FROM PEAKS
// ═══════════════════════════════════════════════════════════════════

function buildSignalsFromPeaks(
  peaks: FlowState['peaks'],
  zoneSaturation: Record<string, number>,
  now: Date
): Signal[] {
  if (!peaks) return []

  return peaks.map((peak) => {
    const minUntil = minutesUntil(peak.time, now)
    const isActive = minUntil <= 0 && minUntil > -60
    const isForming = minUntil > 0 && minUntil <= 30
    const isExpiring = isActive && minUntil > -10

    const saturation = zoneSaturation[peak.zone] ?? 0

    const signal: Signal = {
      id: generateId('peak'),
      kind: isActive ? 'live' : isForming ? 'soon' : 'week',
      type: inferSignalType(peak.reason),
      title: peak.reason.split('—')[0]?.trim() ?? peak.zone,
      zone: peak.zone,
      time_window: {
        start: peak.time,
        label: peak.time,
      },
      reason: peak.reason,
      action: `Position: ${peak.zone}`,
      priority_score: peak.score,
      intensity: scoreToIntensity(peak.score),
      confidence: confidenceToLevel(peak.score),
      minutes_until_start: minUntil > 0 ? minUntil : undefined,
      minutes_until_end: isActive ? Math.abs(minUntil) + 30 : undefined,
      is_active: isActive,
      is_expiring: isExpiring,
      is_forming: isForming,
      zone_saturation: saturation,
      driver_density: saturationToDensity(saturation),
      is_compound: false,
      source: 'tonight_pack',
    }

    signal.display_label = computeDisplayLabel(signal)
    signal.display_sublabel = computeDisplaySublabel(signal)

    return signal
  })
}

// ═══════════════════════════════════════════════════════════════════
// BUILD SIGNALS FROM UPCOMING SLOTS
// ═══════════════════════════════════════════════════════════════════

function buildSignalsFromUpcoming(
  upcoming: FlowState['upcoming'],
  zoneSaturation: Record<string, number>,
  now: Date
): Signal[] {
  if (!upcoming) return []

  return upcoming.map((slot) => {
    const minUntil = minutesUntil(slot.time, now)
    const isActive = minUntil <= 0 && minUntil > -60
    const isForming = minUntil > 0 && minUntil <= 30

    const saturation = slot.saturation ?? zoneSaturation[slot.zone] ?? 0
    const score = Math.min(100, 50 + (slot.earnings ?? 0))

    const signal: Signal = {
      id: generateId('upcoming'),
      kind: isActive ? 'live' : isForming ? 'soon' : 'week',
      type: 'skeleton',
      title: slot.zone,
      zone: slot.zone,
      time_window: {
        start: slot.time,
        label: slot.time,
      },
      reason: `Créneau prévu ${slot.time}`,
      action: `Position: ${slot.zone}`,
      priority_score: score,
      intensity: scoreToIntensity(score),
      confidence: 'medium',
      minutes_until_start: minUntil > 0 ? minUntil : undefined,
      is_active: isActive,
      is_expiring: false,
      is_forming: isForming,
      zone_saturation: saturation,
      driver_density: saturationToDensity(saturation),
      is_compound: false,
      source: 'tonight_pack',
    }

    signal.display_label = computeDisplayLabel(signal)
    signal.display_sublabel = computeDisplaySublabel(signal)

    return signal
  })
}

// ═══════════════════════════════════════════════════════════════════
// BUILD SIGNALS FROM WEATHER/TRANSPORT
// ═══════════════════════════════════════════════════════════════════

function buildSignalsFromContextSignals(
  signals: FlowState['signals'],
  now: Date
): Signal[] {
  if (!signals) return []

  return signals.map((sig) => {
    const isWeather = sig.type === 'weather'
    const isTransport = sig.type === 'transport'

    const signal: Signal = {
      id: generateId('context'),
      kind: 'alert',
      type: isWeather ? 'weather' : isTransport ? 'transport_disruption' : 'friction',
      title: sig.text.split('—')[0]?.trim() ?? sig.text,
      zone: 'Paris',
      time_window: {
        start: now.toISOString(),
        label: 'maintenant',
      },
      reason: sig.text,
      action: isWeather ? 'Demande VTC accrue' : 'Adapter itinéraire',
      priority_score: 60,
      intensity: 2,
      confidence: 'medium',
      is_active: true,
      is_expiring: false,
      is_forming: false,
      is_compound: false,
      source: 'weather',
    }

    signal.display_label = 'ALERTE'
    signal.display_sublabel = computeDisplaySublabel(signal)

    return signal
  })
}

// ═══════════════════════════════════════════════════════════════════
// BUILD SIGNALS FROM RAMIFICATIONS (COMPOUND)
// ═══════════════════════════════════════════════════════════════════

function buildSignalsFromRamifications(
  ramifications: Ramification[],
  zoneSaturation: Record<string, number>,
  now: Date
): Signal[] {
  if (!ramifications || ramifications.length === 0) return []

  return ramifications.map((ram) => {
    const zone = ram.effect_zone || ram.zone || 'Paris'
    const saturation = zoneSaturation[zone] ?? 0
    const score = ram.score ?? 70

    // Determine kind based on actual time window, not hardcoded
    let isActive = true
    let isForming = false
    let minUntil: number | undefined

    if (ram.window_start) {
      // Parse window_start if it's a time string like "22:30"
      if (ram.window_start.includes(':') && !ram.window_start.includes('T')) {
        minUntil = minutesUntil(ram.window_start, now)
        isActive = minUntil <= 0 && minUntil > -60
        isForming = minUntil > 0 && minUntil <= 30
      } else {
        // ISO timestamp
        const windowStart = new Date(ram.window_start)
        const diffMs = windowStart.getTime() - now.getTime()
        minUntil = Math.round(diffMs / 60000)
        isActive = diffMs <= 0 && diffMs > -3600000
        isForming = diffMs > 0 && diffMs <= 1800000
      }
    }

    const kind: SignalKind = isActive ? 'live' : isForming ? 'soon' : 'week'

    const signal: Signal = {
      id: ram.id || generateId('ram'),
      kind,
      type: 'compound',
      title: ram.explanation.split('—')[0]?.trim() ?? ram.kind,
      zone,
      time_window: {
        start: ram.window_start ?? now.toISOString(),
        end: ram.window_end,
        label: ram.window ?? 'maintenant',
      },
      reason: ram.explanation,
      action: `Position: ${zone}`,
      priority_score: score,
      intensity: scoreToIntensity(score),
      confidence: ram.confidence,
      minutes_until_start: minUntil !== undefined && minUntil > 0 ? minUntil : undefined,
      is_active: isActive,
      is_expiring: false,
      is_forming: isForming,
      zone_saturation: saturation,
      driver_density: saturationToDensity(saturation),
      is_compound: true,
      overlapping_factors: ram.causes,
      ramification_score: score,
      source: 'ramification',
    }

    signal.display_label = 'SIGNAL COMPOSÉ'
    signal.display_sublabel = computeDisplaySublabel(signal)

    return signal
  })
}

// ═══════════════════════════════════════════════════════════════════
// BUILD SIGNALS FROM BANLIEUE HUBS
// ═══════════════════════════════════════════════════════════════════

function buildSignalsFromBanlieueHubs(
  hubs: Record<string, BanlieueHubState> | undefined,
  now: Date
): Signal[] {
  if (!hubs) return []

  return Object.values(hubs)
    .filter((hub) => hub.status === 'active' || hub.status === 'forming')
    .map((hub) => {
      const isActive = hub.status === 'active'
      const score = Math.round(hub.heat * 100)

      const hubNames: Record<string, string> = {
        'cdg': 'CDG Aéroport',
        'orly': 'Orly Aéroport',
        'la-defense': 'La Défense',
        'saint-denis': 'Saint-Denis',
        'villepinte': 'Villepinte',
        'montreuil': 'Montreuil',
      }

      const signal: Signal = {
        id: generateId('hub'),
        kind: isActive ? 'live' : 'soon',
        type: 'banlieue_pressure',
        title: hubNames[hub.id] ?? hub.id,
        zone: hubNames[hub.id] ?? hub.id,
        time_window: {
          start: hub.nextPic ?? now.toISOString(),
          label: hub.nextPic ?? 'maintenant',
        },
        reason: `Flux ${hub.corridor.toUpperCase()} depuis ${hubNames[hub.id] ?? hub.id}`,
        action: `Position: corridor ${hub.corridor}`,
        priority_score: score,
        intensity: scoreToIntensity(score),
        confidence: isActive ? 'high' : 'medium',
        direction: hub.corridor as Corridor,
        is_active: isActive,
        is_expiring: false,
        is_forming: !isActive,
        is_compound: false,
        source: 'banlieue_hub',
      }

      signal.display_label = computeDisplayLabel(signal)
      signal.display_sublabel = computeDisplaySublabel(signal)

      return signal
    })
}

// ═══════════════════════════════════════════════════════════════════
// BUILD SIGNALS FROM STATION ARRIVALS (SNCF)
// ═══════════════════════════════════════════════════════════════════

function buildSignalsFromStations(
  stationSignals: StationSignal[],
  now: Date
): Signal[] {
  if (!stationSignals || stationSignals.length === 0) return []

  return stationSignals.map((station) => {
    const windowStart = new Date(station.window.start)
    const windowEnd = station.window.end ? new Date(station.window.end) : new Date(windowStart.getTime() + 45 * 60000)

    const minUntilStart = Math.round((windowStart.getTime() - now.getTime()) / 60000)
    const minUntilEnd = Math.round((windowEnd.getTime() - now.getTime()) / 60000)

    const isActive = minUntilStart <= 0 && minUntilEnd > 0
    const isForming = minUntilStart > 0 && minUntilStart <= 30
    const isExpiring = isActive && minUntilEnd <= 10

    // Build reason with concrete details
    const parts: string[] = []
    if (station.arrivalCount > 0) {
      parts.push(`${station.arrivalCount} trains`)
    }
    if (station.estimatedPassengers > 500) {
      parts.push(`~${Math.round(station.estimatedPassengers / 100) * 100} voyageurs`)
    }
    if (station.hasInternational) {
      parts.push('international')
    }
    if (station.hasDelay) {
      parts.push('retards')
    }
    const detailPart = parts.length > 0 ? ` — ${parts.join(', ')}` : ''

    const signal: Signal = {
      id: station.id,
      kind: isActive ? 'live' : isForming ? 'soon' : 'nearby',
      type: 'transport_wave',
      title: station.stationName,
      zone: station.stationName,
      arrondissement: station.zone,
      time_window: {
        start: station.window.start,
        end: station.window.end,
        label: `${windowStart.getHours().toString().padStart(2, '0')}:${windowStart.getMinutes().toString().padStart(2, '0')}`,
      },
      reason: `Arrivées trains${detailPart}`,
      action: station.entryHint,
      priority_score: Math.round(station.intensity * 100),
      intensity: scoreToIntensity(Math.round(station.intensity * 100)),
      confidence: 'high', // SNCF realtime is authoritative
      direction: station.corridor as Corridor,
      minutes_until_start: minUntilStart > 0 ? minUntilStart : undefined,
      minutes_until_end: isActive ? minUntilEnd : undefined,
      is_active: isActive,
      is_expiring: isExpiring,
      is_forming: isForming,
      is_compound: false,
      source: 'sncf_realtime',
      // Include coordinates for navigation
      lat: station.lat,
      lng: station.lng,
    }

    signal.display_label = isActive ? 'GARE ACTIVE' : isForming ? 'VAGUE TRAIN' : 'GARE'
    signal.display_sublabel = station.rideProfile

    return signal
  })
}

// ═══════════════════════════════════════════════════════════════════
// BUILD SIGNALS FROM AIRPORT FORCED MOBILITY WAVES
// ═══════════════════════════════════════════════════════════════════

function buildSignalsFromAirportWaves(
  waves: ForcedMobilityWave[],
  now: Date
): Signal[] {
  if (!waves || waves.length === 0) return []

  return waves.map((wave) => {
    const windowStart = new Date(wave.wave_start)
    const windowEnd = new Date(wave.wave_end)

    const minUntilStart = Math.round((windowStart.getTime() - now.getTime()) / 60000)
    const minUntilEnd = Math.round((windowEnd.getTime() - now.getTime()) / 60000)

    const isActive = minUntilStart <= 0 && minUntilEnd > 0
    const isForming = minUntilStart > 0 && minUntilStart <= 30
    const isExpiring = isActive && minUntilEnd <= 10

    // Build reason from factors
    const factorLabels: Record<string, string> = {
      'arrivées_aéroport': 'arrivées',
      'international': 'vols internationaux',
      'long_courrier': 'long-courrier',
      'transport_faible': 'transport faible',
      'vague_concentrée': 'vague concentrée',
    }
    const reasonParts = wave.factors
      .filter(f => f !== 'arrivées_aéroport') // Already in title
      .map(f => factorLabels[f] || f)
    const detailPart = reasonParts.length > 0 ? ` — ${reasonParts.join(', ')}` : ''

    // Determine corridor from wave
    const corridor: Corridor = wave.corridor === 'nord' || wave.corridor === 'sud'
      ? wave.corridor
      : 'nord' // CDG default

    // Format time window
    const formatTime = (d: Date) =>
      `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`

    const signal: Signal = {
      id: wave.id,
      kind: isActive ? 'live' : isForming ? 'soon' : 'nearby',
      type: 'banlieue_pressure',
      title: wave.venue || wave.zone,
      zone: wave.zone,
      time_window: {
        start: wave.wave_start,
        end: wave.wave_end,
        label: `${formatTime(windowStart)} – ${formatTime(windowEnd)}`,
      },
      reason: `Passagers en sortie${detailPart}`,
      action: wave.positioning_hint,
      priority_score: wave.final_score,
      intensity: scoreToIntensity(wave.final_score),
      confidence: wave.confidence,
      direction: corridor,
      minutes_until_start: minUntilStart > 0 ? minUntilStart : undefined,
      minutes_until_end: isActive ? minUntilEnd : undefined,
      is_active: isActive,
      is_expiring: isExpiring,
      is_forming: isForming,
      is_compound: wave.category === 'compound',
      overlapping_factors: wave.factors,
      source: 'aviationstack',
      lat: wave.lat,
      lng: wave.lng,
    }

    // Display labels
    if (wave.category === 'compound') {
      signal.display_label = 'AÉROPORT + METRO FAIBLE'
    } else if (isActive) {
      signal.display_label = 'AÉROPORT ACTIF'
    } else if (isForming) {
      signal.display_label = 'VAGUE AÉROPORT'
    } else {
      signal.display_label = 'AÉROPORT'
    }

    // Ride profile hint
    switch (wave.likely_ride_profile) {
      case 'premium_long':
        signal.display_sublabel = 'Courses longues garanties'
        break
      case 'long':
        signal.display_sublabel = 'Courses longues probables'
        break
      default:
        signal.display_sublabel = 'Courses moyennes-longues'
    }

    return signal
  })
}

// ═══════════════════════════════════════════════════════════════════
// BUILD WEEK SIGNALS FROM WEEKLY SKELETON
// ═══════════════════════════════════════════════════════════════════

function buildWeekSignalsFromSkeleton(
  skeleton: WeeklySkeleton | null | undefined
): WeekSignal[] {
  if (!skeleton?.skeleton_windows) return []

  const dayLabels = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

  return skeleton.skeleton_windows.map((win) => {
    const intensity = win.expected_intensity ?? 0.5
    const score = Math.round(intensity * 100)

    const signal: WeekSignal = {
      id: win.id || generateId('week'),
      kind: 'week',
      type: inferSignalType(win.signal_type),
      title: win.label,
      zone: win.zones?.[0] ?? 'Paris',
      time_window: {
        start: win.window_start,
        end: win.window_end,
        label: `${win.window_start} – ${win.window_end}`,
      },
      reason: win.why,
      action: win.zones ? `Zones: ${win.zones.join(', ')}` : 'Position à définir',
      priority_score: score,
      intensity: scoreToIntensity(score),
      confidence: win.confidence,
      is_active: false,
      is_expiring: false,
      is_forming: false,
      is_compound: false,
      source: 'weekly_skeleton',
      day_of_week: win.day_of_week,
      day_label: dayLabels[win.day_of_week] ?? '',
      is_premium_night: intensity >= 0.7,
      earning_potential: intensity >= 0.8 ? 'very_high' : intensity >= 0.6 ? 'high' : intensity >= 0.4 ? 'medium' : 'low',
    }

    signal.display_label = computeDisplayLabel(signal)
    signal.display_sublabel = computeDisplaySublabel(signal)

    return signal
  })
}

// ═══════════════════════════════════════════════════════════════════
// ENRICH WITH PROXIMITY
// ═══════════════════════════════════════════════════════════════════

function enrichWithProximity(
  signals: Signal[],
  driverPosition: DriverPosition | undefined,
  zoneCoords?: Record<string, { lat: number; lng: number }>
): Signal[] {
  if (!driverPosition) return signals

  return signals.map((signal) => {
    // Try custom coords first, then fall back to default lookup
    const zoneCenter = zoneCoords?.[signal.zone] ?? getZoneCoordinates(signal.zone)
    if (!zoneCenter) return signal

    // Simple distance calculation (Haversine approximation for Paris)
    const dLat = zoneCenter.lat - driverPosition.lat
    const dLng = zoneCenter.lng - driverPosition.lng
    const distance_km = Math.sqrt(dLat * dLat + dLng * dLng) * 111 // rough km

    // Estimate travel time (avg 15 km/h in Paris traffic)
    const proximity_minutes = Math.max(1, Math.round(distance_km * 4))

    // Determine direction
    let direction: Corridor = 'centre'
    if (dLat > 0.01) direction = 'nord'
    else if (dLat < -0.01) direction = 'sud'
    else if (dLng > 0.01) direction = 'est'
    else if (dLng < -0.01) direction = 'ouest'

    return {
      ...signal,
      proximity_minutes,
      distance_km: Math.round(distance_km * 10) / 10,
      direction,
      kind: proximity_minutes <= 10 ? 'nearby' : signal.kind,
      display_sublabel: proximity_minutes <= 15 ? `${proximity_minutes} min` : signal.display_sublabel,
    }
  })
}

// ═══════════════════════════════════════════════════════════════════
// COMPUTE FINAL PRIORITY SCORE — Using RankingWeights
// ═══════════════════════════════════════════════════════════════════

function computeFinalPriorityScore(
  signal: Signal,
  weights: RankingWeights = DEFAULT_RANKING_WEIGHTS
): number {
  // Immediacy: closer to now = higher (max when is_active, decays with minutes_until_start)
  let immediacyScore = 0
  if (signal.is_active) {
    immediacyScore = 100
  } else if (signal.is_forming) {
    immediacyScore = 80
  } else if (signal.minutes_until_start !== undefined) {
    immediacyScore = Math.max(0, 100 - signal.minutes_until_start)
  }

  // Confidence: high=100, medium=60, low=30
  const confidenceScore = signal.confidence === 'high' ? 100 : signal.confidence === 'medium' ? 60 : 30

  // Overlap strength: compound signals get bonus based on factor count
  let overlapScore = 0
  if (signal.is_compound && signal.overlapping_factors) {
    overlapScore = Math.min(100, signal.overlapping_factors.length * 30)
  }

  // Proximity: closer = higher (only if known)
  let proximityScore = 50 // neutral if unknown
  if (signal.proximity_minutes !== undefined) {
    proximityScore = Math.max(0, 100 - signal.proximity_minutes * 5)
  }

  // Earning potential: use base score as proxy (will be refined with real data)
  const earningScore = signal.priority_score // preserve original source score

  // Inverse saturation: opportunity zones score higher
  let saturationScore = 50 // neutral if unknown
  if (signal.driver_density === 'opportunity') {
    saturationScore = 100
  } else if (signal.driver_density === 'balanced') {
    saturationScore = 50
  } else if (signal.driver_density === 'saturated') {
    saturationScore = 10
  }

  // Weighted sum
  const finalScore =
    immediacyScore * weights.immediacy +
    confidenceScore * weights.confidence +
    overlapScore * weights.overlap_strength +
    proximityScore * weights.proximity +
    earningScore * weights.earning_potential +
    saturationScore * weights.inverse_saturation

  return Math.round(Math.min(100, Math.max(0, finalScore)))
}

// ═══════════════════════════════════════════════════════════════════
// RECOMPUTE INTENSITY FROM FINAL SCORE + OVERLAP
// ═══════════════════════════════════════════════════════════════════

function computeFinalIntensity(signal: Signal): SignalIntensity {
  const base = scoreToIntensity(signal.priority_score)

  // Compound signals with 3+ factors get intensity boost
  if (signal.is_compound && signal.overlapping_factors && signal.overlapping_factors.length >= 3) {
    return Math.min(4, base + 1) as SignalIntensity
  }

  // Expiring signals get intensity boost (urgency)
  if (signal.is_expiring) {
    return Math.min(4, base + 1) as SignalIntensity
  }

  return base
}

// ═══════════════════════════════════════════════════════════════════
// RANK SIGNALS BY DECISION VALUE
// ═══════════════════════════════════════════════════════════════════

function rankSignals(signals: Signal[], weights: RankingWeights = DEFAULT_RANKING_WEIGHTS): Signal[] {
  // Recompute priority_score and intensity using weights
  const enriched = signals.map((sig) => ({
    ...sig,
    priority_score: computeFinalPriorityScore(sig, weights),
    intensity: computeFinalIntensity(sig),
  }))

  return enriched.sort((a, b) => {
    // Primary: priority_score (now weighted)
    if (b.priority_score !== a.priority_score) {
      return b.priority_score - a.priority_score
    }
    // Secondary: compound signals win ties (higher decision value)
    if (a.is_compound !== b.is_compound) {
      return a.is_compound ? -1 : 1
    }
    // Tertiary: proximity (closer first)
    const proxA = a.proximity_minutes ?? 999
    const proxB = b.proximity_minutes ?? 999
    if (proxA !== proxB) {
      return proxA - proxB
    }
    // Quaternary: active before forming
    if (a.is_active !== b.is_active) {
      return a.is_active ? -1 : 1
    }
    return 0
  })
}

// ═══════════════════════════════════════════════════════════════════
// MAIN: BUILD SIGNAL FEED
// ═══════════════════════════════════════════════════════════════════

export interface BuildSignalFeedInput {
  flowState: FlowState
  driverPosition?: DriverPosition
  zoneCoords?: Record<string, { lat: number; lng: number }>
  stationSignals?: StationSignal[]
  airportWaves?: ForcedMobilityWave[]
}

export function buildSignalFeed(input: BuildSignalFeedInput): SignalFeed {
  const { flowState, driverPosition, zoneCoords, stationSignals, airportWaves } = input
  const now = new Date()

  // Build signals from all sources
  let signals: Signal[] = [
    ...buildSignalsFromPeaks(flowState.peaks, flowState.zoneSaturation ?? {}, now),
    ...buildSignalsFromUpcoming(flowState.upcoming, flowState.zoneSaturation ?? {}, now),
    ...buildSignalsFromContextSignals(flowState.signals, now),
    ...buildSignalsFromRamifications(flowState.ramifications ?? [], flowState.zoneSaturation ?? {}, now),
    ...buildSignalsFromBanlieueHubs(flowState.banlieueHubs, now),
    ...buildSignalsFromStations(stationSignals ?? [], now),
    ...buildSignalsFromAirportWaves(airportWaves ?? [], now),
  ]

  // Enrich with proximity if driver position available
  // Uses default zone coordinates when custom coords not provided
  if (driverPosition) {
    signals = enrichWithProximity(signals, driverPosition, zoneCoords)
  }

  // Rank by decision value
  signals = rankSignals(signals)

  // Deduplicate by zone + type + time (keep highest score)
  // Different signal types at same zone/time are DISTINCT (concert + TGV = two signals)
  const seen = new Set<string>()
  signals = signals.filter((sig) => {
    const key = `${sig.zone}-${sig.type}-${sig.time_window.start}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return {
    signals,
    generated_at: now.toISOString(),
    driver_position: driverPosition,
    total_count: signals.length,
    live_count: signals.filter((s) => s.kind === 'live').length,
    nearby_count: signals.filter((s) => s.kind === 'nearby').length,
    alert_count: signals.filter((s) => s.kind === 'alert').length,
  }
}

// ═══════════════════════════════════════════════════════════════════
// BUILD WEEK CALENDAR
// ═══════════════════════════════════════════════════════════════════

export function buildWeekCalendar(
  skeleton: WeeklySkeleton | null | undefined,
  peaks?: FlowState['peaks']
): WeekCalendar {
  const now = new Date()
  const weekSignals = buildWeekSignalsFromSkeleton(skeleton)
  const dayLabels = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

  // Group by day
  const byDay: Record<number, WeekSignal[]> = {}
  for (let d = 0; d < 7; d++) byDay[d] = []
  for (const sig of weekSignals) {
    byDay[sig.day_of_week]?.push(sig)
  }

  // Find best night
  let bestNight: WeekCalendar['best_night'] = null
  let bestScore = 0
  for (const [day, sigs] of Object.entries(byDay)) {
    const dayScore = sigs.reduce((sum, s) => sum + s.priority_score, 0)
    if (dayScore > bestScore) {
      bestScore = dayScore
      const topSig = sigs[0]
      bestNight = {
        day: dayLabels[Number(day)] ?? '',
        reason: topSig?.reason ?? 'Forte demande prévue',
        expected_demand: dayScore >= 150 ? 'very_high' : dayScore >= 100 ? 'high' : 'medium',
      }
    }
  }

  // Build days array
  const days = Object.entries(byDay).map(([dow, sigs]) => {
    const d = Number(dow)
    const date = new Date(now)
    date.setDate(date.getDate() + ((d - now.getDay() + 7) % 7))

    return {
      day_of_week: d,
      day_label: dayLabels[d] ?? '',
      date: date.toISOString().slice(0, 10),
      signals: sigs.sort((a, b) => b.priority_score - a.priority_score),
      is_premium: sigs.some((s) => s.is_premium_night),
    }
  })

  return {
    week_of: skeleton?.week_of ?? `${now.getFullYear()}-W${Math.ceil((now.getDate() + 6) / 7)}`,
    best_night: bestNight,
    days,
    generated_at: now.toISOString(),
  }
}

// ═══════════════════════════════════════════════════════════════════
// BUILD MAP VIEW — For CARTE screen
// ═══════════════════════════════════════════════════════════════════

// Paris zone coordinates (approximate centroids)
const ZONE_COORDS: Record<string, { lat: number; lng: number }> = {
  'Gare du Nord': { lat: 48.8809, lng: 2.3553 },
  'Gare de Lyon': { lat: 48.8448, lng: 2.3735 },
  'Gare Montparnasse': { lat: 48.8408, lng: 2.3212 },
  'Gare Saint-Lazare': { lat: 48.8766, lng: 2.3250 },
  'Châtelet': { lat: 48.8584, lng: 2.3470 },
  'Bastille': { lat: 48.8532, lng: 2.3694 },
  'Opéra': { lat: 48.8720, lng: 2.3316 },
  'République': { lat: 48.8675, lng: 2.3637 },
  'Bercy': { lat: 48.8396, lng: 2.3863 },
  'La Défense': { lat: 48.8920, lng: 2.2367 },
  'Trocadéro': { lat: 48.8628, lng: 2.2875 },
  'Champs-Élysées': { lat: 48.8698, lng: 2.3076 },
  'Montmartre': { lat: 48.8867, lng: 2.3431 },
  'Marais': { lat: 48.8566, lng: 2.3622 },
  'Saint-Germain': { lat: 48.8530, lng: 2.3335 },
  'George V': { lat: 48.8720, lng: 2.3002 },
  'CDG Aéroport': { lat: 49.0097, lng: 2.5479 },
  'Orly Aéroport': { lat: 48.7262, lng: 2.3652 },
  'Pigalle': { lat: 48.8822, lng: 2.3375 },
  'Nation': { lat: 48.8485, lng: 2.3956 },
  'Oberkampf': { lat: 48.8650, lng: 2.3780 },
}

export interface BuildMapViewInput {
  signalFeed: SignalFeed
  flowState: FlowState
  driverPosition?: DriverPosition
}

export function buildMapView(input: BuildMapViewInput): MapView {
  const { signalFeed, flowState, driverPosition } = input
  const now = new Date()

  // Convert top signals to map signals with coordinates
  const mapSignals: MapSignal[] = signalFeed.signals
    .slice(0, 5)
    .map((signal) => {
      const coords = ZONE_COORDS[signal.zone]
      return {
        ...signal,
        lat: coords?.lat,
        lng: coords?.lng,
        zone_center: coords,
      }
    })

  // Identify hot zones (high heat + live signals)
  const hotZones: string[] = []
  const zoneHeat = flowState.zoneHeat ?? {}
  for (const [zone, heat] of Object.entries(zoneHeat)) {
    if (heat >= 0.6) {
      hotZones.push(zone)
    }
  }
  // Also add zones from live signals
  signalFeed.signals
    .filter((s) => s.kind === 'live' && s.intensity >= 3)
    .forEach((s) => {
      if (!hotZones.includes(s.zone)) {
        hotZones.push(s.zone)
      }
    })

  // Identify friction zones (alerts, weather, blocked)
  const frictionZones: string[] = []
  const zoneState = flowState.zoneState ?? {}
  for (const [zone, state] of Object.entries(zoneState)) {
    if (state === 'blocked') {
      frictionZones.push(zone)
    }
  }
  // Also add zones from alert signals
  signalFeed.signals
    .filter((s) => s.kind === 'alert' || s.type === 'friction')
    .forEach((s) => {
      if (!frictionZones.includes(s.zone)) {
        frictionZones.push(s.zone)
      }
    })

  return {
    signals: mapSignals,
    hot_zones: hotZones,
    friction_zones: frictionZones,
    driver_position: driverPosition,
    generated_at: now.toISOString(),
  }
}
