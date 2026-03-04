/**
 * Adapter: CompiledBrief + NextMove → FlowState
 *
 * Single place that maps backend engine output to the stable API contract.
 * All territory ids must be emitted; missing zones default to cold/0.
 */

import type { CompiledBrief } from '@/lib/prompts/contracts'
import type { NextMove } from '@/lib/shift-conductor/contracts'
import type { FlowState, ZoneStateApi, Ramification, WeeklySkeleton, DriverPosition } from '@/types/flow-state'
import { haversineMeters, estimateDriveMinutes, getZoneCentroid } from '@/lib/geo'

/** Corridor directions (lowercase for frontend glossary compatibility) */
const CORRIDOR_KEYS = ['est', 'nord', 'ouest', 'sud', 'centre'] as const

/** Map zone names to corridor directions */
const ZONE_TO_CORRIDOR: Record<string, typeof CORRIDOR_KEYS[number]> = {
  'Bercy': 'est',
  'Nation': 'est',
  'Bastille': 'est',
  'République': 'est',
  'Gare de Lyon': 'est',
  'Vincennes': 'est',
  'Gare du Nord': 'nord',
  'Gare de l\'Est': 'nord',
  'Pigalle': 'nord',
  'Montmartre': 'nord',
  'La Chapelle': 'nord',
  'Saint-Lazare': 'ouest',
  'Porte de Saint-Cloud': 'ouest',
  'Auteuil': 'ouest',
  'Boulogne': 'ouest',
  'La Défense': 'ouest',
  'Trocadero': 'ouest',
  'Montparnasse': 'sud',
  'Denfert': 'sud',
  'Porte d\'Orléans': 'sud',
  'Châtelet': 'centre',
  'Opéra': 'centre',
  'Marais': 'centre',
  'Louvre': 'centre',
  'Halles': 'centre',
}

/** All Paris territory ids used by the frontend map (must match parisData) */
export const TERRITORY_IDS = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  'cite', 'stlouis',
] as const

/** Map brief zone names (areas) to territory ids for heat/favored */
const ZONE_NAME_TO_TERRITORY_ID: Record<string, string> = {
  'Gare du Nord': '10', 'Gare de l\'Est': '10', 'Gare de Lyon': '12',
  'Bercy': '12', 'Nation': '12', 'Bastille': '11', 'République': '11',
  'Opéra': '9', 'Saint-Lazare': '9', 'Châtelet': '1', 'Marais': '3',
  'Grands Boulevards': '9', 'Porte de Saint-Cloud': '16',
  'Pigalle': '18', 'Oberkampf': '11', 'Quartier Latin': '5',
  'Montmartre': '18', 'Trocadero': '16', 'La Défense': '17',
  'Halles': '1', 'Louvre': '1',
}

const SHIFT_DURATION_SEC = 25 * 60 // 25 min arc for progress

/** Format seconds as MM:SS string */
function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function energyToShiftPhase(energy: NextMove['energy']): FlowState['shiftPhase'] {
  switch (energy) {
    case 'CALM': return 'calme'
    case 'BUILDING':
    case 'RISING': return 'montee'
    case 'PEAK': return 'pic'
    case 'DISPERSION':
    case 'NIGHT_DRIFT': return 'dispersion'
    default: return 'calme'
  }
}

function fieldStateToWindowState(state: NextMove['state']): FlowState['windowState'] {
  switch (state) {
    case 'WINDOW_OPENING': return 'forming'
    case 'WINDOW_ACTIVE': return 'active'
    case 'WINDOW_CLOSING': return 'closing'
    case 'FLOW_SHIFT':
    case 'HOLD_POSITION':
    case 'RESET':
    default: return 'stable'
  }
}

function fieldStateToAction(state: NextMove['state']): FlowState['action'] {
  switch (state) {
    case 'HOLD_POSITION': return 'hold'
    case 'WINDOW_OPENING': return 'prepare'
    case 'FLOW_SHIFT': return 'move'
    case 'RESET': return 'rest'
    case 'WINDOW_ACTIVE': return 'move'
    case 'WINDOW_CLOSING': return 'hold'
    default: return 'hold'
  }
}

function actionToLabel(action: FlowState['action']): string {
  switch (action) {
    case 'move': return 'BOUGER'
    case 'prepare': return 'PREPARER'
    case 'hold': return 'MAINTENIR'
    case 'rest': return 'REPOS'
    default: return 'MAINTENIR'
  }
}

function windowStateToLabel(ws: FlowState['windowState']): string {
  switch (ws) {
    case 'forming': return 'FENETRE EN FORMATION'
    case 'active': return 'FENETRE ACTIVE'
    case 'closing': return 'FENETRE FERME'
    case 'stable': return 'CHAMP STABLE'
    default: return 'CHAMP STABLE'
  }
}

/** Resolve a brief zone name to a territory id (for map keys) */
function zoneNameToId(name: string): string | null {
  const id = ZONE_NAME_TO_TERRITORY_ID[name]
  if (id && TERRITORY_IDS.includes(id as typeof TERRITORY_IDS[number])) return id
  return null
}

/** Build zoneHeat, zoneSaturation, zoneState for ALL territory ids */
function buildZoneMaps(
  brief: CompiledBrief,
  move: NextMove
): {
  zoneHeat: Record<string, number>
  zoneSaturation: Record<string, number>
  zoneState: Record<string, ZoneStateApi>
  favoredZoneIds: string[]
} {
  const zoneHeat: Record<string, number> = {}
  const zoneSaturation: Record<string, number> = {}
  const zoneState: Record<string, ZoneStateApi> = {}
  const favoredSet = new Set<string>()

  const nowZones = brief.now_block.zones || []
  const nextZones = brief.next_block.slots?.map((s) => s.zone) || []
  const hotspotZones = brief.horizon_block?.hotspots?.map((h) => h.zone) || []
  const targetZoneId = move.target?.zone ? zoneNameToId(move.target.zone) : null

  const favoredNames = new Set([
    ...nowZones,
    ...nextZones.slice(0, 3),
    ...hotspotZones.slice(0, 3),
    ...(move.target?.zone ? [move.target.zone] : []),
  ])

  for (const name of favoredNames) {
    const id = zoneNameToId(name)
    if (id) favoredSet.add(id)
  }

  const saturationMap: Record<string, number> = {}
  for (const s of brief.next_block.slots || []) {
    const id = zoneNameToId(s.zone)
    if (id) {
      const sat = s.saturation === 'HIGH' ? 75 : s.saturation === 'MED' ? 50 : 25
      saturationMap[id] = Math.max(saturationMap[id] ?? 0, sat)
    }
  }

  for (const id of TERRITORY_IDS) {
    const isFavored = favoredSet.has(id)
    const isTarget = id === targetZoneId
    let heat = 0
    let state: ZoneStateApi = 'cold'
    let saturation = 0

    if (isTarget) {
      heat = 0.85
      state = 'hot'
      saturation = saturationMap[id] ?? 60
    } else if (isFavored) {
      // Derive heat from brief confidence - no random noise
      const baseConfidence = brief.meta.confidence_overall ?? 0.5
      heat = 0.4 + (baseConfidence * 0.35) // 0.4-0.75 based on confidence
      state = heat > 0.65 ? 'hot' : 'warm'
      saturation = saturationMap[id] ?? 30
    }
    zoneHeat[id] = Math.min(1, heat)
    zoneSaturation[id] = Math.min(100, saturation)
    zoneState[id] = state
  }

  return {
    zoneHeat,
    zoneSaturation,
    zoneState,
    favoredZoneIds: Array.from(favoredSet),
  }
}

/** Parse expected_peaks strings like "22:45 Bercy" or "23:15 PSG" */
function parsePeaks(brief: CompiledBrief): FlowState['peaks'] {
  const peaks: FlowState['peaks'] = []
  const seen = new Set<string>()

  for (const raw of brief.horizon_block?.expected_peaks ?? []) {
    const match = raw.match(/^(\d{1,2}:?\d{0,2})\s+(.+)$/) ?? [null, raw, '']
    const time = match[1] ?? raw
    const zone = match[2] ?? ''
    const key = `${time}-${zone}`
    if (seen.has(key)) continue
    seen.add(key)
    peaks.push({
      time: time.length <= 2 ? `${time}h` : time.replace(':', 'h'),
      zone,
      reason: '',
      score: 75,
    })
  }

  for (const h of brief.horizon_block?.hotspots ?? []) {
    const key = `${h.window}-${h.zone}`
    if (seen.has(key)) continue
    seen.add(key)
    const [start] = h.window.split('-')
    peaks.push({
      time: start?.trim() ?? h.window,
      zone: h.zone,
      reason: h.why ?? '',
      score: h.score ?? 70,
    })
  }

  return peaks.slice(0, 12)
}

/** Merge micro_alerts + alerts into signals */
function buildSignals(brief: CompiledBrief): FlowState['signals'] {
  const signals: FlowState['signals'] = []

  for (const m of brief.now_block.micro_alerts ?? []) {
    signals.push({
      text: m.message,
      type: m.type as 'event' | 'weather' | 'transport' | 'surge',
    })
  }

  for (const a of brief.alerts ?? []) {
    const type =
      a.type === 'WEATHER' ? 'weather'
      : a.type === 'EVENT' ? 'event'
      : a.type === 'TRANSIT' || a.type === 'STRIKE' ? 'transport'
      : 'surge'
    signals.push({
      text: `${a.type} — ${a.area}: ${a.notes?.join('. ') ?? ''}`,
      type,
    })
  }

  return signals.slice(0, 8)
}

/** Build upcoming from timeline or next_block.slots */
function buildUpcoming(brief: CompiledBrief): FlowState['upcoming'] {
  // Base rate: 25-35 EUR/h Paris night, derive from confidence
  const baseRate = 28
  const confidenceMultiplier = brief.meta.confidence_overall ?? 0.7

  if (brief.timeline?.length) {
    return brief.timeline.slice(0, 6).map((t) => {
      // Earnings derived from saturation risk (higher saturation = more competition = lower earnings)
      const satRisk = t.saturation_risk === 'HIGH' ? 0.8 : t.saturation_risk === 'MED' ? 1.0 : 1.15
      const earnings = Math.round(baseRate * satRisk * confidenceMultiplier)
      return {
        time: t.start ?? '',
        zone: t.primary_zone ?? '',
        saturation: t.saturation_risk === 'HIGH' ? 80 : t.saturation_risk === 'MED' ? 50 : 25,
        earnings,
      }
    })
  }
  return (brief.next_block.slots ?? []).slice(0, 6).map((s) => {
    const satRisk = s.saturation === 'HIGH' ? 0.8 : s.saturation === 'MED' ? 1.0 : 1.15
    const earnings = Math.round(baseRate * satRisk * confidenceMultiplier)
    return {
      time: s.window?.split('-')[0] ?? '',
      zone: s.zone,
      saturation: s.saturation === 'HIGH' ? 80 : s.saturation === 'MED' ? 50 : 25,
      earnings,
    }
  })
}

/** Zone name aliases to centroid IDs */
const ZONE_NAME_ALIASES: Record<string, string> = {
  // Gares
  'gare du nord': 'gare-nord',
  'gare de l\'est': 'gare-est',
  'gare de lyon': 'gare-lyon',
  'saint-lazare': 'saint-lazare',
  'montparnasse': 'montparnasse',
  // Portes → Banlieue
  'porte de saint-cloud': 'boulogne',
  'porte d\'auteuil': 'boulogne',
  'porte de la chapelle': 'saint-denis',
  'porte de bagnolet': 'pantin',
  'porte de vincennes': 'vincennes',
  'porte d\'orléans': 'ivry',
  'porte de bercy': 'bercy',
  'porte de montreuil': 'vincennes',
  'porte d\'italie': 'ivry',
  'porte maillot': 'defense',
  // Venues
  'accor arena': 'bercy',
  'parc des princes': 'boulogne',
  'stade de france': 'stade-france',
  'la défense': 'defense',
  'la defense': 'defense',
  // Paris zones
  'quartier latin': 'latin',
  'grands boulevards': 'opera',
  'les halles': 'chatelet',
  'châtelet': 'chatelet',
  'chatelet': 'chatelet',
  'opéra': 'opera',
  'opera': 'opera',
  'trocadéro': 'trocadero',
  'trocadero': 'trocadero',
  'république': 'republique',
  'republique': 'republique',
  // Airports
  'cdg': 'cdg',
  'charles de gaulle': 'cdg',
  'roissy': 'cdg',
  'orly': 'orly',
}

/** Calculate distance and ETA from driver to a zone */
function calculateDistanceToZone(
  driverPos: DriverPosition,
  zoneName: string
): { distance_km: number; eta_min: number } | null {
  const lowerName = zoneName.toLowerCase()

  // Try alias first
  const aliasId = ZONE_NAME_ALIASES[lowerName]
  if (aliasId) {
    const centroid = getZoneCentroid(aliasId)
    if (centroid) {
      const meters = haversineMeters(driverPos.lat, driverPos.lng, centroid.lat, centroid.lng)
      return {
        distance_km: Math.round(meters / 100) / 10,
        eta_min: estimateDriveMinutes(meters),
      }
    }
  }

  // Try to find zone centroid by name (lowercase, hyphenated)
  const zoneId = lowerName.replace(/['\s]/g, '-').replace(/--+/g, '-')
  const centroid = getZoneCentroid(zoneId)

  if (!centroid) {
    // Try arrondissement number
    const arrMatch = zoneName.match(/(\d+)(e|ème)?/i)
    if (arrMatch) {
      const arrNum = parseInt(arrMatch[1], 10)
      const arrCentroid = getZoneCentroid(arrNum)
      if (arrCentroid) {
        const meters = haversineMeters(driverPos.lat, driverPos.lng, arrCentroid.lat, arrCentroid.lng)
        return {
          distance_km: Math.round(meters / 100) / 10, // 1 decimal
          eta_min: estimateDriveMinutes(meters),
        }
      }
    }
    return null
  }

  const meters = haversineMeters(driverPos.lat, driverPos.lng, centroid.lat, centroid.lng)
  return {
    distance_km: Math.round(meters / 100) / 10,
    eta_min: estimateDriveMinutes(meters),
  }
}

/** Arrondissement label from zone name (simplified) */
function zoneToArr(zone: string): string {
  const id = zoneNameToId(zone)
  if (!id) return ''
  if (id === 'cite') return 'Île'
  if (id === 'stlouis') return 'Île'
  const n = parseInt(id, 10)
  if (Number.isNaN(n)) return id
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX']
  return roman[n - 1] ?? id
}

/** Normalize corridor string to lowercase key */
function normalizeCorridor(raw: string | undefined, targetZone?: string): string {
  // First try: if targetZone is provided, use zone-to-corridor mapping
  if (targetZone && ZONE_TO_CORRIDOR[targetZone]) {
    return ZONE_TO_CORRIDOR[targetZone]
  }

  if (!raw) return 'est'
  const lower = raw.toLowerCase().trim()

  // Second try: check if raw contains a direction keyword
  for (const dir of CORRIDOR_KEYS) {
    if (lower.includes(dir)) return dir
  }

  // Third try: check if raw contains a zone name we can map
  for (const [zone, corridor] of Object.entries(ZONE_TO_CORRIDOR)) {
    if (raw.includes(zone)) return corridor
  }

  // Fallback
  return 'est'
}

export function compiledBriefAndMoveToFlowState(
  brief: CompiledBrief,
  move: NextMove,
  sessionStart?: number,
  ramifications?: Ramification[],
  weeklySkeleton?: WeeklySkeleton | null,
  driverPosition?: DriverPosition
): FlowState {
  const now = Date.now()
  const sessionStartMs = sessionStart ?? now - 10 * 60 * 1000
  const sessionSeconds = (now - sessionStartMs) / 1000
  const shiftProgress = Math.min(1, Math.max(0, sessionSeconds / SHIFT_DURATION_SEC))

  const shiftPhase = energyToShiftPhase(move.energy)
  const windowState = fieldStateToWindowState(move.state)
  const action = fieldStateToAction(move.state)
  const windowCountdownSec = Math.max(0, move.timing.expiry_seconds ?? 0)
  const windowMinutes = Math.max(1, Math.ceil(windowCountdownSec / 60))

  const confidence = Math.round(
    (brief.meta.confidence_overall ?? move.confidence ?? 0.5) * 100
  )

  const { zoneHeat, zoneSaturation, zoneState, favoredZoneIds } = buildZoneMaps(brief, move)

  const targetZone = move.target?.zone ?? brief.now_block.zones?.[0] ?? ''
  const targetZoneArr = zoneToArr(targetZone)

  const alternatives = (move.alternatives ?? [])
    .concat(brief.now_block.zones?.filter((z) => z !== targetZone) ?? [])
    .slice(0, 5)

  const topHotspots = brief.hotspots?.slice(0, 3) ?? []
  const avgScore = topHotspots.length
    ? topHotspots.reduce((s, h) => s + h.score, 0) / topHotspots.length
    : 50
  const mult = (avgScore / 100) * (brief.meta.confidence_overall ?? 0.8)
  const earningsEstimate: [number, number] = [
    Math.round(25 * mult * 0.8),
    Math.round(25 * mult * 1.4),
  ]
  const sessionEarnings = Math.round(earningsEstimate[0] * (sessionSeconds / 3600) * 10) / 10

  // Build upcoming and peaks with optional distance enrichment
  let upcoming = buildUpcoming(brief)
  let peaks = parsePeaks(brief)

  if (driverPosition) {
    // Enrich upcoming with distances and sort by proximity
    upcoming = upcoming.map((u) => {
      const dist = calculateDistanceToZone(driverPosition, u.zone)
      return dist ? { ...u, ...dist } : u
    }).sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999))

    // Enrich peaks with distances
    peaks = peaks.map((p) => {
      const dist = calculateDistanceToZone(driverPosition, p.zone)
      return dist ? { ...p, ...dist } : p
    })
  }

  return {
    windowState,
    windowLabel: windowStateToLabel(windowState),
    windowCountdownSec,
    windowCountdown: formatCountdown(windowCountdownSec),
    windowMinutes,
    shiftPhase,
    shiftProgress,
    action,
    actionLabel: actionToLabel(action),
    confidence,
    fieldMessage: move.hold_message ?? (windowState === 'active' ? `${targetZone} actif.` : 'Champ en lecture.'),
    temporalMessage: windowState === 'active'
      ? `Fenêtre ouverte — ${windowMinutes} min restantes.`
      : `Transition dans ~${windowMinutes} min.`,
    targetZone,
    targetZoneArr,
    favoredCorridor: normalizeCorridor(brief.next_block?.key_transition, targetZone),
    favoredZoneIds,
    alternatives,
    zoneHeat,
    zoneSaturation,
    zoneState,
    zoneStates: zoneState, // alias for frontend compatibility
    earningsEstimate,
    sessionEarnings,
    signals: buildSignals(brief),
    upcoming,
    peaks,
    version: 1,
    generatedAt: new Date().toISOString(),
    ramifications: ramifications ?? [],
    weeklySkeleton: weeklySkeleton ?? null,
    driverPosition,
  }
}
