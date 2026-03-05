/**
 * FlowViewModel Adapter — v1.7
 *
 * Transforms TonightPack into FlowViewModel using the Corridor Pressure Engine.
 * Every UI element shows CAUSE → CONSEQUENCE → ACTION with sourceRefs.
 *
 * Pipeline:
 * signals → pressure engine → corridor flow → zoneHeat → recommended positioning
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

import {
  computeCorridorPressure,
  buildFullRamifications,
  estimateMagnitude,
  ZONE_ARRONDISSEMENT,
  CORRIDOR_GRAPH,
  type PressureSignal,
  type FullRamification,
  type MagnitudeRange,
} from './corridor-pressure'

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
// SIGNAL CONVERSION — TonightPack signals → PressureSignals
// ════════════════════════════════════════════════════════════════

function convertToPressureSignals(pack: TonightPack): PressureSignal[] {
  const signals: PressureSignal[] = []
  const now = Date.now()

  // Convert events
  const events = pack.signals.filter((s): s is EventSignal => s.type === 'event')
  for (const event of events) {
    const exitStart = new Date(event.exitWindow.start)
    const minutesToExit = (exitStart.getTime() - now) / 60000

    // Only include events within relevant window (-30 to +120 min)
    if (minutesToExit > -30 && minutesToExit < 120) {
      const magnitude = estimateMagnitude(event.title, event.estimatedAttendance)
      signals.push({
        id: event.id,
        type: 'event',
        zone: event.zone,
        corridor: event.corridor,
        magnitude,
        confidence: event.confidence,
        window: event.exitWindow,
        cause: `Sortie ${event.venue} — ${event.title}`,
      })
    }
  }

  // Convert transport disruptions
  const transport = pack.signals.filter((s): s is TransportSignal => s.type === 'transport')
  for (const t of transport) {
    if (t.status === 'disrupted' || t.status === 'closed') {
      signals.push({
        id: `transport-${t.line}`,
        type: 'transport',
        zone: t.affectedZones[0] || 'Châtelet',
        corridor: t.corridor === 'unknown' ? 'centre' : t.corridor,
        magnitude: { low: 500, high: 2000, label: 'demande supplémentaire' },
        confidence: t.confidence,
        window: { start: t.since, end: t.estimatedResolution || new Date(now + 4 * 60 * 60 * 1000).toISOString() },
        cause: `${t.line} ${t.status === 'closed' ? 'fermé' : 'perturbé'} — pression VTC`,
      })
    }
  }

  // Convert weather
  const weather = pack.signals.find((s): s is WeatherSignal => s.type === 'weather')
  if (weather && (weather.impact === 'fragmented' || weather.rainProbability > 0.5)) {
    signals.push({
      id: `weather-${weather.compiledAt}`,
      type: 'weather',
      zone: 'Châtelet', // Weather affects center primarily
      corridor: 'centre',
      magnitude: { low: 0, high: 0, label: `+${Math.round(weather.rainProbability * 30)}% demande` },
      confidence: weather.confidence,
      window: { start: weather.compiledAt, end: new Date(now + 4 * 60 * 60 * 1000).toISOString() },
      cause: weather.condition === 'rain' || weather.condition === 'heavy_rain'
        ? 'Pluie — demande fragmentée'
        : `Météo ${weather.condition}`,
    })
  }

  // Convert skeleton windows (active today)
  const parisTime = getParisTime()
  const dayOfWeek = parisTime.getDay()
  const currentTimeStr = parisTime.toTimeString().slice(0, 5)

  for (const skel of pack.weeklySkeleton) {
    const days = Array.isArray(skel.dayOfWeek) ? skel.dayOfWeek : [skel.dayOfWeek]
    if (!days.includes(dayOfWeek)) continue

    // Include if currently active or starting within 2 hours
    const skelStart = skel.window.start
    const isActive = currentTimeStr >= skel.window.start && currentTimeStr <= skel.window.end
    const minutesToStart = (new Date(`${pack.date}T${skelStart}:00`).getTime() - now) / 60000
    const isUpcoming = minutesToStart > 0 && minutesToStart < 120

    if (isActive || isUpcoming) {
      const intensity = skel.intensity || 3
      signals.push({
        id: skel.id,
        type: 'skeleton',
        zone: skel.zones[0] || 'Châtelet',
        corridor: skel.corridors[0] || 'centre',
        magnitude: {
          low: intensity * 300,
          high: intensity * 800,
          label: 'flux récurrent',
        },
        confidence: skel.confidence,
        window: {
          start: new Date(`${pack.date}T${skel.window.start}:00`).toISOString(),
          end: new Date(`${pack.date}T${skel.window.end}:00`).toISOString(),
        },
        cause: skel.description,
      })
    }
  }

  return signals
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
// ACTION BUILDER — Uses pressure engine
// ════════════════════════════════════════════════════════════════

function buildAction(
  pack: TonightPack,
  fullRamifications: FullRamification[],
  topZone: string,
  topCorridor: CorridorDirection | null,
  dominantFlow: string
): FlowViewAction {
  const now = Date.now()

  // Find the highest-priority ramification (soonest + highest confidence)
  const activeRams = fullRamifications
    .filter(r => r.window.minutesUntil < 60) // Within 1 hour
    .sort((a, b) => {
      // Prioritize: active > soon > later, then by confidence
      if (a.window.minutesUntil <= 0 && b.window.minutesUntil > 0) return -1
      if (b.window.minutesUntil <= 0 && a.window.minutesUntil > 0) return 1
      return b.confidence - a.confidence
    })

  const primaryRam = activeRams[0]

  // Determine action based on ramification
  let mode: ActionMode = 'rest'
  let zone = topZone || 'Châtelet'
  let corridor: CorridorDirection | 'centre' = topCorridor || 'centre'
  let why = 'Pas de pression significative'
  let cause = ''
  let consequence = ''
  const sourceRefs: SourceRef[] = []
  let timerTarget: string | null = null
  let magnitude: MagnitudeRange | null = null

  if (primaryRam) {
    zone = primaryRam.action.target
    corridor = primaryRam.flow.corridor
    cause = primaryRam.source.zone
    consequence = `~${primaryRam.magnitude.low}–${primaryRam.magnitude.high} ${primaryRam.magnitude.label}`
    magnitude = primaryRam.magnitude

    // Build comprehensive "why" with CAUSE → CONSEQUENCE → ACTION
    why = `${primaryRam.action.reason}`

    sourceRefs.push({
      id: primaryRam.source.id,
      type: primaryRam.source.type,
      label: primaryRam.action.reason,
      confidence: primaryRam.confidence,
    })

    if (primaryRam.window.minutesUntil <= 0) {
      mode = 'move'
      timerTarget = primaryRam.window.start
    } else if (primaryRam.window.minutesUntil <= 15) {
      mode = 'prepare'
      timerTarget = primaryRam.window.start
    } else {
      mode = 'hold'
      timerTarget = primaryRam.window.start
    }
  }

  // Build timer
  let timer = null
  if (timerTarget) {
    const secs = secondsUntil(timerTarget)
    const mins = Math.ceil(secs / 60)
    timer = {
      secondsLeft: secs,
      label: mode === 'move' ? 'Pic actif' : `Pic dans ${mins} min`,
      targetIso: timerTarget,
    }
  }

  // Calculate scores
  const opportunityScore = primaryRam ? Math.round(primaryRam.confidence * 100) : 30
  const frictionRisk = pack.signals.some(s => s.type === 'transport' && (s as TransportSignal).status !== 'normal') ? 40 : 15

  return {
    mode,
    zone,
    arrondissement: ZONE_ARRONDISSEMENT[zone] || '',
    corridor,
    confidence: primaryRam?.confidence || 0.3,
    why,
    sourceRefs,
    timer,
    entrySide: corridor !== 'centre' ? `Accès ${corridor}` : null,
    opportunityScore,
    frictionRisk,
    // Extended fields for v1.7
    cause,
    consequence,
    flow: dominantFlow,
    magnitude,
  } as FlowViewAction & { cause: string; consequence: string; flow: string; magnitude: MagnitudeRange | null }
}

// ════════════════════════════════════════════════════════════════
// MAP BUILDER — Uses pressure engine zoneHeat
// ════════════════════════════════════════════════════════════════

function buildMap(
  pack: TonightPack,
  pressureZoneHeat: Record<string, number>,
  fullRamifications: FullRamification[]
): FlowViewMap {
  const zoneHeat: Record<string, number> = {}
  const zoneState: Record<string, ZoneHeatLevel> = {}
  const zoneWhy: Record<string, ZoneWhy> = {}

  // Initialize all zones with pressure engine heat
  for (const id of TERRITORY_IDS) {
    const heat = pressureZoneHeat[id] || 0
    zoneHeat[id] = heat
    zoneState[id] = heat > 0.7 ? 'hot' : heat > 0.3 ? 'warm' : 'cold'
    zoneWhy[id] = {
      heat,
      state: zoneState[id],
      reasons: [],
      sourceRefs: [],
    }
  }

  // Add reasons from ramifications
  for (const ram of fullRamifications) {
    for (const zone of ram.flow.pressureZones) {
      if (zoneWhy[zone]) {
        zoneWhy[zone].reasons.push(ram.action.reason)
        zoneWhy[zone].sourceRefs.push({
          id: ram.source.id,
          type: ram.source.type,
          label: ram.action.reason,
          confidence: ram.confidence,
        })
      }
    }
  }

  // Build banlieue magnets with pressure data
  const parisTime = getParisTime()
  const dayOfWeek = parisTime.getDay()

  const banlieueMagnets: BanlieueMagnet[] = BANLIEUE_MAGNETS_STATIC.map(def => {
    const magnetSourceRefs: SourceRef[] = []
    let heat = 0
    let why: string | null = null
    let nextPic: string | null = null

    // Check ramifications for this corridor
    for (const ram of fullRamifications) {
      if (ram.flow.corridor === def.corridor) {
        heat = Math.max(heat, ram.confidence * 0.6)
        why = ram.action.reason
        magnetSourceRefs.push({
          id: ram.source.id,
          type: ram.source.type,
          label: ram.action.reason,
          confidence: ram.confidence,
        })
        if (!nextPic && ram.window.minutesUntil > 0) {
          nextPic = formatTime(ram.window.start)
        }
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
// NEXT BUILDER — Uses full ramifications
// ════════════════════════════════════════════════════════════════

function buildNext(fullRamifications: FullRamification[]): FlowViewNext {
  const upcoming: UpcomingWindow[] = fullRamifications
    .filter(r => r.window.minutesUntil > 0 && r.window.minutesUntil < 120)
    .sort((a, b) => a.window.minutesUntil - b.window.minutesUntil)
    .slice(0, 4)
    .map(ram => ({
      time: formatTime(ram.window.start),
      timeIso: ram.window.start,
      zone: ram.action.target,
      corridor: ram.flow.corridor,
      label: ram.action.reason,
      intensity: ram.confidence,
      minutesUntil: ram.window.minutesUntil,
      sourceRefs: [{
        id: ram.source.id,
        type: ram.source.type,
        label: ram.action.reason,
        confidence: ram.confidence,
      }],
      // Extended: show magnitude
      magnitude: ram.magnitude,
      flow: ram.flow.direction,
      action: ram.action.type,
    }))

  return { upcoming }
}

// ════════════════════════════════════════════════════════════════
// TONIGHT BUILDER — Peaks with magnitude
// ════════════════════════════════════════════════════════════════

function buildTonight(pack: TonightPack, fullRamifications: FullRamification[]): FlowViewTonight {
  const peaks: TonightPeak[] = []
  const parisTime = getParisTime()
  const currentTimeStr = parisTime.toTimeString().slice(0, 5)
  const activeSkeletonWindows: string[] = []

  // Add ramifications as peaks with full data
  for (const ram of fullRamifications) {
    peaks.push({
      time: formatTime(ram.window.start),
      timeIso: ram.window.start,
      zone: ram.action.target,
      corridor: ram.flow.corridor,
      reason: ram.action.reason,
      venue: ram.source.zone,
      magnitude: ram.confidence,
      confidence: ram.confidence,
      sourceRefs: [{
        id: ram.source.id,
        type: ram.source.type,
        label: ram.action.reason,
        confidence: ram.confidence,
      }],
      // Extended: CAUSE → CONSEQUENCE → ACTION
      cause: ram.source.zone,
      exits: ram.magnitude,
      flow: ram.flow.direction,
      pressureZones: ram.flow.pressureZones,
      action: {
        type: ram.action.type,
        target: ram.action.target,
        arrondissement: ram.action.arrondissement,
      },
    } as TonightPeak & {
      cause: string
      exits: MagnitudeRange
      flow: string
      pressureZones: string[]
      action: { type: string; target: string; arrondissement: string }
    })
  }

  // Track active skeleton windows
  for (const skel of pack.weeklySkeleton) {
    const days = Array.isArray(skel.dayOfWeek) ? skel.dayOfWeek : [skel.dayOfWeek]
    if (!days.includes(parisTime.getDay())) continue

    if (currentTimeStr >= skel.window.start && currentTimeStr <= skel.window.end) {
      activeSkeletonWindows.push(skel.name)
    }
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
      implication: `+${Math.round(weather.rainProbability * 30)}% demande, trajets courts`,
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
        label: `${t.line} ${t.status === 'closed' ? 'fermé' : 'perturbé'}`,
        implication: `Pression VTC sur ${t.affectedZones.join(', ')}`,
        corridor: t.corridor === 'unknown' ? null : t.corridor,
        sourceRefs: [transportToSourceRef(t)],
      })
    }
  }

  return frictions
}

// ════════════════════════════════════════════════════════════════
// ALTERNATIVES BUILDER — Uses corridor pressure
// ════════════════════════════════════════════════════════════════

function buildAlternatives(
  fullRamifications: FullRamification[],
  primaryZone: string,
  zoneHeat: Record<string, number>
): AlternativeZone[] {
  // Find zones with good heat that aren't primary
  const alternatives: AlternativeZone[] = []

  const sortedZones = Object.entries(zoneHeat)
    .filter(([zone]) => zone !== primaryZone)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  for (const [zone, heat] of sortedZones) {
    if (heat < 0.2) continue // Skip cold zones

    // Find which ramification drives this zone
    const ram = fullRamifications.find(r => r.flow.pressureZones.includes(zone))

    alternatives.push({
      zone,
      arrondissement: ZONE_ARRONDISSEMENT[zone] || '',
      corridor: ram?.flow.corridor || 'centre',
      distance_km: 0,
      eta_min: 0,
      condition: `Si ${primaryZone} saturé`,
      why: ram?.action.reason || 'Zone alternative',
      sourceRefs: ram ? [{
        id: ram.source.id,
        type: ram.source.type,
        label: ram.action.reason,
        confidence: ram.confidence,
      }] : [],
    })
  }

  return alternatives
}

// ════════════════════════════════════════════════════════════════
// CORRIDOR STATUS BUILDER
// ════════════════════════════════════════════════════════════════

interface CorridorStatus {
  direction: CorridorDirection
  status: 'fluide' | 'dense' | 'saturé'
  pressure: number
  reason: string | null
}

function buildCorridorStatuses(fullRamifications: FullRamification[]): CorridorStatus[] {
  const corridorPressure: Record<CorridorDirection, { total: number; reasons: string[] }> = {
    nord: { total: 0, reasons: [] },
    est: { total: 0, reasons: [] },
    sud: { total: 0, reasons: [] },
    ouest: { total: 0, reasons: [] },
  }

  for (const ram of fullRamifications) {
    if (ram.flow.corridor !== 'centre') {
      const dir = ram.flow.corridor as CorridorDirection
      corridorPressure[dir].total += ram.confidence
      corridorPressure[dir].reasons.push(ram.action.reason)
    }
  }

  return (Object.entries(corridorPressure) as [CorridorDirection, { total: number; reasons: string[] }][])
    .map(([direction, data]): CorridorStatus => ({
      direction,
      status: data.total > 0.7 ? 'saturé' : data.total > 0.3 ? 'dense' : 'fluide',
      pressure: data.total,
      reason: data.reasons[0] || null,
    }))
    .sort((a, b) => b.pressure - a.pressure)
}

// ════════════════════════════════════════════════════════════════
// MAIN ADAPTER — Full pipeline
// ════════════════════════════════════════════════════════════════

export function tonightPackToFlowViewModel(
  pack: TonightPack,
  source: string,
  driverPosition?: { lat: number; lng: number }
): FlowViewModel & {
  corridorStatuses: CorridorStatus[]
  fullRamifications: FullRamification[]
} {
  // 1. Convert to pressure signals
  const pressureSignals = convertToPressureSignals(pack)

  // 2. Run corridor pressure engine
  const {
    zoneHeat: pressureZoneHeat,
    corridorPressures,
    topZone,
    topCorridor,
    dominantFlow,
  } = computeCorridorPressure(pressureSignals)

  // 3. Build full ramifications
  const fullRamifications = buildFullRamifications(pressureSignals, corridorPressures)

  // 4. Build all view components
  const meta = buildMeta(pack, source)
  const action = buildAction(pack, fullRamifications, topZone, topCorridor, dominantFlow)
  const map = buildMap(pack, pressureZoneHeat, fullRamifications)
  const next = buildNext(fullRamifications)
  const tonight = buildTonight(pack, fullRamifications)
  const activeFrictions = buildFrictions(pack)
  const alternatives = buildAlternatives(fullRamifications, action.zone, pressureZoneHeat)
  const corridorStatuses = buildCorridorStatuses(fullRamifications)

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
    // v1.7 extensions
    corridorStatuses,
    fullRamifications,
  }
}
