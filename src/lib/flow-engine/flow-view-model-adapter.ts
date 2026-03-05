/**
 * FlowViewModel Adapter — v1.6
 *
 * Transforms TonightPack into FlowViewModel with full sourceRefs traceability.
 * Every UI element links back to the real signals that generated it.
 */

import type {
  TonightPack,
  EventSignal,
  WeatherSignal,
  TransportSignal,
  Ramification,
  WeeklyWindow,
  CorridorDirection,
} from '@/lib/signal-fetchers/types'

import type {
  FlowViewModel,
  FlowViewMeta,
  FlowViewAction,
  FlowViewMap,
  FlowViewNext,
  FlowViewTonight,
  SourceRef,
  ZoneWhy,
  ZoneHeatLevel,
  BanlieueMagnet,
  UpcomingWindow,
  TonightPeak,
  ActiveFriction,
  AlternativeZone,
  ActionMode,
} from '@/types/flow-view-model'

import { BANLIEUE_MAGNETS_STATIC } from '@/types/flow-view-model'
import { TERRITORY_IDS } from './flow-state-adapter'

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

function getParisTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
}

function minutesUntil(iso: string): number {
  const target = new Date(iso).getTime()
  const now = Date.now()
  return Math.max(0, Math.round((target - now) / 60000))
}

function secondsUntil(iso: string): number {
  const target = new Date(iso).getTime()
  const now = Date.now()
  return Math.max(0, Math.round((target - now) / 1000))
}

function confidenceToLevel(c: number): 'high' | 'medium' | 'low' {
  if (c >= 0.7) return 'high'
  if (c >= 0.4) return 'medium'
  return 'low'
}

/** Create a sourceRef from an event signal */
function eventToSourceRef(e: EventSignal): SourceRef {
  return {
    id: e.id,
    type: 'event',
    label: `${e.title} @ ${e.venue}`,
    confidence: e.confidence,
  }
}

/** Create a sourceRef from a weather signal */
function weatherToSourceRef(w: WeatherSignal): SourceRef {
  return {
    id: `weather-${w.compiledAt}`,
    type: 'weather',
    label: `${w.condition} (${w.temperature}°C)`,
    confidence: w.confidence,
  }
}

/** Create a sourceRef from a transport signal */
function transportToSourceRef(t: TransportSignal): SourceRef {
  return {
    id: `transport-${t.line}`,
    type: 'transport',
    label: `${t.line}: ${t.status}`,
    confidence: t.confidence,
  }
}

/** Create a sourceRef from a ramification */
function ramificationToSourceRef(r: Ramification): SourceRef {
  return {
    id: r.id,
    type: 'ramification',
    label: r.explanation.slice(0, 50),
    confidence: r.confidence,
  }
}

/** Create a sourceRef from a skeleton window */
function skeletonToSourceRef(s: WeeklyWindow): SourceRef {
  return {
    id: s.id,
    type: 'skeleton',
    label: s.name,
    confidence: s.confidence,
  }
}

// ════════════════════════════════════════════════════════════════
// META BUILDER
// ════════════════════════════════════════════════════════════════

function buildMeta(pack: TonightPack, source: string): FlowViewMeta {
  const events = pack.signals.filter((s): s is EventSignal => s.type === 'event')
  const weather = pack.signals.filter((s): s is WeatherSignal => s.type === 'weather')
  const transport = pack.signals.filter((s): s is TransportSignal => s.type === 'transport')

  return {
    compiledAt: pack.compiledAt,
    overallConfidence: pack.meta.overallConfidence,
    stale: pack.meta.stale,
    timezone: 'Europe/Paris',
    source,
    signalCounts: {
      events: events.length,
      weather: weather.length,
      transport: transport.length,
      ramifications: pack.ramifications.length,
      skeleton: pack.weeklySkeleton.length,
    },
  }
}

// ════════════════════════════════════════════════════════════════
// ACTION BUILDER
// ════════════════════════════════════════════════════════════════

function buildAction(pack: TonightPack, driverPosition?: { lat: number; lng: number }): FlowViewAction {
  const now = getParisTime()
  const currentHour = now.getHours()

  // Find the most imminent high-confidence ramification
  const activeRamifications = pack.ramifications
    .filter(r => {
      const start = new Date(r.window.start)
      const end = new Date(r.window.end)
      const nowTs = Date.now()
      // Active or starting within 30 minutes
      return (nowTs >= start.getTime() && nowTs <= end.getTime()) ||
             (start.getTime() - nowTs <= 30 * 60 * 1000 && start.getTime() > nowTs)
    })
    .sort((a, b) => b.confidence - a.confidence)

  // Find active skeleton windows
  const dayOfWeek = now.getDay()
  const currentTimeStr = now.toTimeString().slice(0, 5) // HH:MM
  const activeSkeletons = pack.weeklySkeleton.filter(s => {
    const days = Array.isArray(s.dayOfWeek) ? s.dayOfWeek : [s.dayOfWeek]
    if (!days.includes(dayOfWeek)) return false
    return currentTimeStr >= s.window.start && currentTimeStr <= s.window.end
  })

  // Find relevant events (ending soon)
  const events = pack.signals.filter((s): s is EventSignal => s.type === 'event')
  const upcomingEvents = events.filter(e => {
    const exitStart = new Date(e.exitWindow.start)
    const minutesToExit = (exitStart.getTime() - Date.now()) / 60000
    return minutesToExit > -15 && minutesToExit < 45 // Within -15 to +45 min
  }).sort((a, b) => new Date(a.exitWindow.start).getTime() - new Date(b.exitWindow.start).getTime())

  // Determine primary zone and action
  let mode: ActionMode = 'rest'
  let zone = 'Châtelet'
  let corridor: CorridorDirection | 'centre' = 'centre'
  let why = 'Pas de signal fort'
  const sourceRefs: SourceRef[] = []
  let timerTarget: string | null = null

  // Priority 1: Upcoming event exit
  if (upcomingEvents.length > 0) {
    const event = upcomingEvents[0]
    const minutesToExit = minutesUntil(event.exitWindow.start)

    zone = event.zone
    corridor = event.corridor
    sourceRefs.push(eventToSourceRef(event))

    if (minutesToExit <= 0) {
      mode = 'move'
      why = `Sortie ${event.venue} en cours`
    } else if (minutesToExit <= 15) {
      mode = 'prepare'
      why = `Sortie ${event.venue} dans ${minutesToExit} min`
      timerTarget = event.exitWindow.start
    } else {
      mode = 'hold'
      why = `${event.title} — sortie à ${formatTime(event.exitWindow.start)}`
      timerTarget = event.exitWindow.start
    }
  }
  // Priority 2: Active ramification
  else if (activeRamifications.length > 0) {
    const ram = activeRamifications[0]
    zone = ram.pressureZones[0] || ram.effectZones[0] || 'Centre'
    corridor = ram.corridor || 'centre'
    why = ram.explanation
    sourceRefs.push(ramificationToSourceRef(ram))

    const windowStart = new Date(ram.window.start)
    if (windowStart.getTime() > Date.now()) {
      mode = 'prepare'
      timerTarget = ram.window.start
    } else {
      mode = 'move'
    }
  }
  // Priority 3: Active skeleton window
  else if (activeSkeletons.length > 0) {
    const skel = activeSkeletons[0]
    zone = skel.zones[0] || 'Centre'
    corridor = skel.corridors[0] || 'centre'
    why = skel.description
    mode = 'hold'
    sourceRefs.push(skeletonToSourceRef(skel))
  }

  // Build timer
  let timer = null
  if (timerTarget) {
    const secs = secondsUntil(timerTarget)
    const mins = Math.ceil(secs / 60)
    timer = {
      secondsLeft: secs,
      label: `${mode === 'prepare' ? 'Pic dans' : 'Depuis'} ${mins} min`,
      targetIso: timerTarget,
    }
  }

  // Estimate arrondissement from zone
  const arrondissementMap: Record<string, string> = {
    'Châtelet': '1er',
    'Marais': '4ème',
    'Bastille': '11ème',
    'République': '10ème',
    'Opéra': '9ème',
    'Saint-Lazare': '8ème',
    'Gare du Nord': '10ème',
    "Gare de l'Est": '10ème',
    'Gare de Lyon': '12ème',
    'Montparnasse': '14ème',
    'Pigalle': '18ème',
    'Nation': '12ème',
    'Bercy': '12ème',
  }

  return {
    mode,
    zone,
    arrondissement: arrondissementMap[zone] || '',
    corridor,
    confidence: sourceRefs.length > 0 ? Math.max(...sourceRefs.map(s => s.confidence)) : 0.3,
    why,
    sourceRefs,
    timer,
    entrySide: corridor !== 'centre' ? `Accès ${corridor}` : null,
    opportunityScore: sourceRefs.length > 0 ? Math.round(sourceRefs[0].confidence * 100) : 30,
    frictionRisk: 20, // Default low risk
  }
}

// ════════════════════════════════════════════════════════════════
// MAP BUILDER
// ════════════════════════════════════════════════════════════════

function buildMap(pack: TonightPack): FlowViewMap {
  const zoneHeat: Record<string, number> = {}
  const zoneState: Record<string, ZoneHeatLevel> = {}
  const zoneWhy: Record<string, ZoneWhy> = {}

  // Initialize all zones as cold
  for (const id of TERRITORY_IDS) {
    zoneHeat[id] = 0
    zoneState[id] = 'cold'
    zoneWhy[id] = { heat: 0, state: 'cold', reasons: [], sourceRefs: [] }
  }

  // Apply event signals
  const events = pack.signals.filter((s): s is EventSignal => s.type === 'event')
  for (const event of events) {
    const exitStart = new Date(event.exitWindow.start)
    const minutesToExit = (exitStart.getTime() - Date.now()) / 60000

    // Only count events within active window
    if (minutesToExit > -30 && minutesToExit < 60) {
      const zone = event.zone
      if (zoneWhy[zone]) {
        const heat = Math.min(1, (zoneWhy[zone].heat || 0) + event.confidence * 0.5)
        zoneHeat[zone] = heat
        zoneWhy[zone].heat = heat
        zoneWhy[zone].reasons.push(`${event.title} @ ${event.venue}`)
        zoneWhy[zone].sourceRefs.push(eventToSourceRef(event))
        zoneWhy[zone].state = heat > 0.7 ? 'hot' : heat > 0.3 ? 'warm' : 'cold'
        zoneState[zone] = zoneWhy[zone].state
      }
    }
  }

  // Apply ramifications
  for (const ram of pack.ramifications) {
    const start = new Date(ram.window.start)
    const end = new Date(ram.window.end)
    const now = Date.now()

    // Active or upcoming ramifications
    if (now >= start.getTime() - 30 * 60 * 1000 && now <= end.getTime()) {
      for (const zone of [...ram.pressureZones, ...ram.effectZones]) {
        if (zoneWhy[zone]) {
          const heat = Math.min(1, (zoneWhy[zone].heat || 0) + ram.confidence * 0.3)
          zoneHeat[zone] = heat
          zoneWhy[zone].heat = heat
          zoneWhy[zone].reasons.push(ram.explanation)
          zoneWhy[zone].sourceRefs.push(ramificationToSourceRef(ram))
          zoneWhy[zone].state = heat > 0.7 ? 'hot' : heat > 0.3 ? 'warm' : 'cold'
          zoneState[zone] = zoneWhy[zone].state
        }
      }
    }
  }

  // Apply skeleton windows
  const now = getParisTime()
  const dayOfWeek = now.getDay()
  const currentTimeStr = now.toTimeString().slice(0, 5)

  for (const skel of pack.weeklySkeleton) {
    const days = Array.isArray(skel.dayOfWeek) ? skel.dayOfWeek : [skel.dayOfWeek]
    if (!days.includes(dayOfWeek)) continue
    if (currentTimeStr < skel.window.start || currentTimeStr > skel.window.end) continue

    for (const zone of skel.zones) {
      if (zoneWhy[zone]) {
        const intensity = skel.intensity / 5 // Normalize 0-5 to 0-1
        const heat = Math.min(1, (zoneWhy[zone].heat || 0) + intensity * skel.confidence)
        zoneHeat[zone] = heat
        zoneWhy[zone].heat = heat
        zoneWhy[zone].reasons.push(skel.description)
        zoneWhy[zone].sourceRefs.push(skeletonToSourceRef(skel))
        zoneWhy[zone].state = heat > 0.7 ? 'hot' : heat > 0.3 ? 'warm' : 'cold'
        zoneState[zone] = zoneWhy[zone].state
      }
    }
  }

  // Build banlieue magnets
  const banlieueMagnets: BanlieueMagnet[] = BANLIEUE_MAGNETS_STATIC.map(def => {
    // Find signals affecting this magnet
    const magnetSourceRefs: SourceRef[] = []
    let heat = 0
    let why: string | null = null
    let nextPic: string | null = null

    // Check ramifications for this corridor
    for (const ram of pack.ramifications) {
      if (ram.corridor === def.corridor) {
        heat = Math.max(heat, ram.confidence * 0.5)
        why = ram.explanation
        magnetSourceRefs.push(ramificationToSourceRef(ram))
        if (!nextPic) nextPic = formatTime(ram.window.start)
      }
    }

    // Check skeleton for this corridor
    for (const skel of pack.weeklySkeleton) {
      if (skel.corridors.includes(def.corridor)) {
        const days = Array.isArray(skel.dayOfWeek) ? skel.dayOfWeek : [skel.dayOfWeek]
        if (days.includes(dayOfWeek)) {
          heat = Math.max(heat, (skel.intensity / 5) * skel.confidence)
          if (!why) why = skel.description
          magnetSourceRefs.push(skeletonToSourceRef(skel))
          if (!nextPic) nextPic = skel.window.start
        }
      }
    }

    return {
      ...def,
      heat,
      status: heat > 0.5 ? 'active' : heat > 0.2 ? 'forming' : 'dormant',
      nextPic,
      why,
      sourceRefs: magnetSourceRefs,
    }
  })

  return {
    zoneHeat,
    zoneState,
    zoneWhy,
    banlieueMagnets,
  }
}

// ════════════════════════════════════════════════════════════════
// NEXT BUILDER (upcoming windows)
// ════════════════════════════════════════════════════════════════

function buildNext(pack: TonightPack): FlowViewNext {
  const upcoming: UpcomingWindow[] = []
  const now = Date.now()

  // Add upcoming ramifications
  for (const ram of pack.ramifications) {
    const start = new Date(ram.window.start)
    const minutesToStart = (start.getTime() - now) / 60000

    // Only future ramifications, within 2 hours
    if (minutesToStart > 0 && minutesToStart < 120) {
      upcoming.push({
        time: formatTime(ram.window.start),
        timeIso: ram.window.start,
        zone: ram.pressureZones[0] || ram.effectZones[0] || 'Centre',
        corridor: ram.corridor || 'centre',
        label: ram.explanation,
        intensity: ram.confidence,
        minutesUntil: Math.round(minutesToStart),
        sourceRefs: [ramificationToSourceRef(ram)],
      })
    }
  }

  // Add upcoming events
  const events = pack.signals.filter((s): s is EventSignal => s.type === 'event')
  for (const event of events) {
    const exitStart = new Date(event.exitWindow.start)
    const minutesToExit = (exitStart.getTime() - now) / 60000

    if (minutesToExit > 0 && minutesToExit < 120) {
      upcoming.push({
        time: formatTime(event.exitWindow.start),
        timeIso: event.exitWindow.start,
        zone: event.zone,
        corridor: event.corridor,
        label: `Sortie ${event.venue}`,
        intensity: event.confidence,
        minutesUntil: Math.round(minutesToExit),
        sourceRefs: [eventToSourceRef(event)],
      })
    }
  }

  // Sort by time and take first 4
  upcoming.sort((a, b) => a.minutesUntil - b.minutesUntil)

  return {
    upcoming: upcoming.slice(0, 4),
  }
}

// ════════════════════════════════════════════════════════════════
// TONIGHT BUILDER (peaks)
// ════════════════════════════════════════════════════════════════

function buildTonight(pack: TonightPack): FlowViewTonight {
  const peaks: TonightPeak[] = []
  const now = getParisTime()
  const dayOfWeek = now.getDay()
  const currentTimeStr = now.toTimeString().slice(0, 5)
  const activeSkeletonWindows: string[] = []

  // Add high-confidence ramifications as peaks
  for (const ram of pack.ramifications) {
    if (ram.confidence >= 0.5) {
      peaks.push({
        time: formatTime(ram.window.start),
        timeIso: ram.window.start,
        zone: ram.pressureZones[0] || ram.effectZones[0] || 'Centre',
        corridor: ram.corridor || 'centre',
        reason: ram.explanation,
        venue: null,
        magnitude: ram.confidence,
        confidence: ram.confidence,
        sourceRefs: [ramificationToSourceRef(ram)],
      })
    }
  }

  // Add events as peaks
  const events = pack.signals.filter((s): s is EventSignal => s.type === 'event')
  for (const event of events) {
    peaks.push({
      time: formatTime(event.exitWindow.start),
      timeIso: event.exitWindow.start,
      zone: event.zone,
      corridor: event.corridor,
      reason: `Sortie ${event.title}`,
      venue: event.venue,
      magnitude: event.confidence,
      confidence: event.confidence,
      sourceRefs: [eventToSourceRef(event)],
    })
  }

  // Add skeleton windows as peaks
  for (const skel of pack.weeklySkeleton) {
    const days = Array.isArray(skel.dayOfWeek) ? skel.dayOfWeek : [skel.dayOfWeek]
    if (!days.includes(dayOfWeek)) continue

    const isActive = currentTimeStr >= skel.window.start && currentTimeStr <= skel.window.end
    if (isActive) {
      activeSkeletonWindows.push(skel.name)
    }

    // Add as peak if today
    peaks.push({
      time: skel.window.start,
      timeIso: new Date(`${pack.date}T${skel.window.start}:00`).toISOString(),
      zone: skel.zones[0] || 'Centre',
      corridor: skel.corridors[0] || 'centre',
      reason: skel.description,
      venue: null,
      magnitude: skel.intensity / 5,
      confidence: skel.confidence,
      sourceRefs: [skeletonToSourceRef(skel)],
    })
  }

  // Sort by time
  peaks.sort((a, b) => a.time.localeCompare(b.time))

  return {
    peaks,
    activeSkeletonWindows,
  }
}

// ════════════════════════════════════════════════════════════════
// FRICTIONS BUILDER
// ════════════════════════════════════════════════════════════════

function buildFrictions(pack: TonightPack): ActiveFriction[] {
  const frictions: ActiveFriction[] = []

  // Weather friction
  const weather = pack.signals.find((s): s is WeatherSignal => s.type === 'weather')
  if (weather && (weather.impact === 'fragmented' || weather.rainProbability > 0.5)) {
    frictions.push({
      type: 'weather',
      label: weather.condition === 'rain' || weather.condition === 'heavy_rain'
        ? 'Pluie'
        : weather.condition,
      implication: weather.impact === 'fragmented'
        ? 'Demande fragmentée — courses courtes'
        : 'Conditions météo dégradées',
      corridor: null,
      sourceRefs: [weatherToSourceRef(weather)],
    })
  }

  // Transport frictions
  const transport = pack.signals.filter((s): s is TransportSignal => s.type === 'transport')
  for (const t of transport) {
    if (t.status === 'disrupted' || t.status === 'closed') {
      frictions.push({
        type: 'transit',
        label: `${t.line} perturbé`,
        implication: `Pression sur ${t.affectedZones.join(', ')}`,
        corridor: t.corridor === 'unknown' ? null : t.corridor,
        sourceRefs: [transportToSourceRef(t)],
      })
    }
  }

  return frictions
}

// ════════════════════════════════════════════════════════════════
// ALTERNATIVES BUILDER
// ════════════════════════════════════════════════════════════════

function buildAlternatives(pack: TonightPack, primaryZone: string): AlternativeZone[] {
  const alternatives: AlternativeZone[] = []
  const now = getParisTime()
  const dayOfWeek = now.getDay()
  const currentTimeStr = now.toTimeString().slice(0, 5)

  // Find active skeleton zones that aren't the primary
  for (const skel of pack.weeklySkeleton) {
    const days = Array.isArray(skel.dayOfWeek) ? skel.dayOfWeek : [skel.dayOfWeek]
    if (!days.includes(dayOfWeek)) continue
    if (currentTimeStr < skel.window.start || currentTimeStr > skel.window.end) continue

    for (const zone of skel.zones) {
      if (zone === primaryZone) continue
      if (alternatives.find(a => a.zone === zone)) continue

      alternatives.push({
        zone,
        arrondissement: '',
        corridor: skel.corridors[0] || 'centre',
        distance_km: 0, // Would need driver position
        eta_min: 0,
        condition: `Si ${primaryZone} saturé`,
        why: skel.description,
        sourceRefs: [skeletonToSourceRef(skel)],
      })
    }
  }

  return alternatives.slice(0, 3)
}

// ════════════════════════════════════════════════════════════════
// MAIN ADAPTER
// ════════════════════════════════════════════════════════════════

export function tonightPackToFlowViewModel(
  pack: TonightPack,
  source: string,
  driverPosition?: { lat: number; lng: number }
): FlowViewModel {
  const meta = buildMeta(pack, source)
  const action = buildAction(pack, driverPosition)
  const map = buildMap(pack)
  const next = buildNext(pack)
  const tonight = buildTonight(pack)
  const activeFrictions = buildFrictions(pack)
  const alternatives = buildAlternatives(pack, action.zone)

  return {
    version: 2,
    meta,
    action,
    map,
    next,
    tonight,
    activeFrictions,
    alternatives,
    driverPosition,
    generatedAt: new Date().toISOString(),
  }
}
