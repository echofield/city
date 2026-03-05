/**
 * FLOW VIEW MODEL — v1.6
 *
 * Clean contract for the dashboard. Every UI element has sourceRefs
 * for full traceability back to real signals and ramifications.
 *
 * The 6 "information links" that make the system feel real:
 * 1. action.why → sourceRefs → signal/ramification IDs
 * 2. map.zoneWhy[zone] → which signals affect this zone
 * 3. next.upcoming[].sourceRefs → ramification IDs
 * 4. tonight.peaks[].sourceRefs → signal/skeleton IDs
 * 5. activeFrictions[].sourceRefs → transport/weather signal IDs
 * 6. banlieueMagnets[].sourceRefs → return magnet signal IDs
 */

import type { CorridorDirection } from '@/lib/signal-fetchers/types'

// ════════════════════════════════════════════════════════════════
// SOURCE REFERENCE — Traceability link to real data
// ════════════════════════════════════════════════════════════════

export type SourceRefType =
  | 'event'
  | 'weather'
  | 'transport'
  | 'ramification'
  | 'skeleton'
  | 'exit_wave'
  | 'return_magnet'

export interface SourceRef {
  /** Unique ID of the source signal/ramification */
  id: string
  /** Type of source */
  type: SourceRefType
  /** Human-readable label for debug panel */
  label: string
  /** Confidence from source (0-1) */
  confidence: number
}

// ════════════════════════════════════════════════════════════════
// META — Pack metadata
// ════════════════════════════════════════════════════════════════

export interface FlowViewMeta {
  compiledAt: string // ISO
  overallConfidence: number // 0-1
  stale: boolean
  timezone: string
  /** Source of this pack (storage-tonight, live-compiled, etc.) */
  source: string
  /** Signal counts by type */
  signalCounts: {
    events: number
    weather: number
    transport: number
    ramifications: number
    skeleton: number
  }
}

// ════════════════════════════════════════════════════════════════
// ACTION — Primary recommendation with timer
// ════════════════════════════════════════════════════════════════

export type ActionMode = 'hold' | 'prepare' | 'move' | 'rest'

export interface ActionTimer {
  secondsLeft: number
  label: string // "Pic dans 12 min"
  targetIso: string // ISO timestamp of target window
}

export interface FlowViewAction {
  mode: ActionMode
  zone: string
  arrondissement: string
  corridor: CorridorDirection | 'centre'
  confidence: number
  /** Human explanation: "Sortie Zénith dans 15 min" */
  why: string
  /** All sources that contributed to this action */
  sourceRefs: SourceRef[]
  /** Timer until next significant moment */
  timer: ActionTimer | null
  /** Entry recommendation */
  entrySide: string | null
  /** Opportunity score 0-100 */
  opportunityScore: number
  /** Friction risk 0-100 */
  frictionRisk: number
}

// ════════════════════════════════════════════════════════════════
// MAP — Zone heat and banlieue magnets
// ════════════════════════════════════════════════════════════════

export type ZoneHeatLevel = 'cold' | 'warm' | 'hot' | 'blocked'

export interface ZoneWhy {
  heat: number // 0-1
  state: ZoneHeatLevel
  /** Why this zone has this heat level */
  reasons: string[]
  /** Sources affecting this zone */
  sourceRefs: SourceRef[]
}

/**
 * Banlieue Magnets — Static list of external hubs
 * These are always shown, heat updates based on signals
 */
export interface BanlieueMagnet {
  id: string
  name: string
  corridor: CorridorDirection
  /** Heat level 0-1 */
  heat: number
  /** Status indicator */
  status: 'dormant' | 'forming' | 'active'
  /** Next expected peak if known */
  nextPic: string | null
  /** Why this hub is active */
  why: string | null
  /** Source signals for this magnet */
  sourceRefs: SourceRef[]
}

/** Static banlieue magnet definitions */
export const BANLIEUE_MAGNETS_STATIC: Omit<BanlieueMagnet, 'heat' | 'status' | 'nextPic' | 'why' | 'sourceRefs'>[] = [
  { id: 'montreuil', name: 'Montreuil', corridor: 'est' },
  { id: 'saint-denis', name: 'Saint-Denis', corridor: 'nord' },
  { id: 'creteil', name: 'Créteil', corridor: 'sud' },
  { id: 'nanterre', name: 'Nanterre', corridor: 'ouest' },
  { id: 'cdg', name: 'CDG', corridor: 'nord' },
  { id: 'orly', name: 'Orly', corridor: 'sud' },
  { id: 'la-defense', name: 'La Défense', corridor: 'ouest' },
  { id: 'stade-de-france', name: 'Stade de France', corridor: 'nord' },
]

export interface FlowViewMap {
  /** Zone heat levels by zone ID */
  zoneHeat: Record<string, number>
  /** Zone states by zone ID */
  zoneState: Record<string, ZoneHeatLevel>
  /** Why each zone has its current state, with sourceRefs */
  zoneWhy: Record<string, ZoneWhy>
  /** Banlieue magnets with current state */
  banlieueMagnets: BanlieueMagnet[]
}

// ════════════════════════════════════════════════════════════════
// NEXT — Upcoming windows (from ramifications)
// ════════════════════════════════════════════════════════════════

export interface UpcomingWindow {
  time: string // "22:30"
  timeIso: string // ISO timestamp
  zone: string
  corridor: CorridorDirection | 'centre'
  /** What's happening */
  label: string
  /** Estimated intensity 0-1 */
  intensity: number
  /** Minutes until this window */
  minutesUntil: number
  /** Sources for this window */
  sourceRefs: SourceRef[]
  /** Distance if driver position known */
  distance_km?: number
  eta_min?: number
}

export interface FlowViewNext {
  /** Next 4 upcoming windows */
  upcoming: UpcomingWindow[]
}

// ════════════════════════════════════════════════════════════════
// TONIGHT — Tonight's peaks (high-confidence ramifications + skeleton)
// ════════════════════════════════════════════════════════════════

export interface TonightPeak {
  time: string // "23:00"
  timeIso: string
  zone: string
  corridor: CorridorDirection | 'centre'
  /** Why this is a peak */
  reason: string
  /** Venue name if known */
  venue: string | null
  /** Magnitude 0-1 */
  magnitude: number
  /** Confidence 0-1 */
  confidence: number
  /** Sources for this peak */
  sourceRefs: SourceRef[]
}

export interface FlowViewTonight {
  /** Tonight's expected peaks, sorted by time */
  peaks: TonightPeak[]
  /** Current skeleton windows active */
  activeSkeletonWindows: string[]
}

// ════════════════════════════════════════════════════════════════
// FRICTIONS — Active disruptions
// ════════════════════════════════════════════════════════════════

export interface ActiveFriction {
  type: 'transit' | 'weather' | 'saturation' | 'event'
  label: string
  implication: string
  corridor: CorridorDirection | null
  /** Sources for this friction */
  sourceRefs: SourceRef[]
}

// ════════════════════════════════════════════════════════════════
// ALTERNATIVES — Fallback zones
// ════════════════════════════════════════════════════════════════

export interface AlternativeZone {
  zone: string
  arrondissement: string
  corridor: CorridorDirection | 'centre'
  distance_km: number
  eta_min: number
  /** When this becomes preferred */
  condition: string
  /** Why this is a good alternative */
  why: string
  /** Sources for this alternative */
  sourceRefs: SourceRef[]
}

// ════════════════════════════════════════════════════════════════
// FLOW VIEW MODEL — Complete dashboard contract
// ════════════════════════════════════════════════════════════════

export interface FlowViewModel {
  /** API version for compatibility */
  version: 2
  /** Pack metadata */
  meta: FlowViewMeta
  /** Primary action recommendation */
  action: FlowViewAction
  /** Map state with zone heat and magnets */
  map: FlowViewMap
  /** Next upcoming windows */
  next: FlowViewNext
  /** Tonight's peaks */
  tonight: FlowViewTonight
  /** Active frictions/disruptions */
  activeFrictions: ActiveFriction[]
  /** Alternative zones */
  alternatives: AlternativeZone[]
  /** Driver position if provided */
  driverPosition?: { lat: number; lng: number }
  /** Generated timestamp */
  generatedAt: string
}

// ════════════════════════════════════════════════════════════════
// DEBUG TRACE — For "Pourquoi?" panel
// ════════════════════════════════════════════════════════════════

export interface DebugTrace {
  /** All source signals used */
  signals: Array<{
    id: string
    type: SourceRefType
    label: string
    confidence: number
    raw: unknown
  }>
  /** All ramifications computed */
  ramifications: Array<{
    id: string
    regime: string
    explanation: string
    confidence: number
    zones: string[]
  }>
  /** Skeleton windows active */
  skeletonWindows: Array<{
    id: string
    name: string
    window: string
    zones: string[]
  }>
  /** Compilation timestamp */
  compiledAt: string
}
