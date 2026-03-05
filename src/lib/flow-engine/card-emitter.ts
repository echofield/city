/**
 * FLOW Card Emitter v1.6
 *
 * Builds a FlowCard from engine output.
 * Filters expired opportunities. Computes states. Detects revisions.
 * Writes to journal (Supabase) when hash changes.
 *
 * This is the single point where "engine state" becomes "driver-facing card."
 * Everything downstream (UI, WhatsApp, journal) consumes this output.
 */

import type {
  FlowCard,
  Opportunity,
  OpportunityState,
  OpportunityKind,
  CauseType,
  Corridor,
  CardRevisionReason,
  DriverProfileTonight,
  Momentum,
  WindowPressure,
} from '@/types/flow-card'
import {
  computeOpportunityState,
  computeWindowPressure,
  computeMinutesRemaining,
  computeWindowProgress,
  inferMomentum,
  filterExpiredOpportunities,
  computeCardHash,
  detectRevisionReason,
} from '@/types/flow-card'
import type { CompiledBrief } from '@/lib/prompts/contracts'

// ── Generic Ramification interface ──
// Accepts both signal-fetchers/types.Ramification and flow-state.Ramification
export interface RamificationInput {
  id: string
  explanation: string
  confidence: number | 'high' | 'medium' | 'low'
  // Window can be object or string ("21:00-23:00") or separate fields
  window?: { start: string; end: string } | string
  window_start?: string
  window_end?: string
  pressureZones?: string[]
  pressure_zone?: string
  effect_zone?: string
  corridor?: string | null
  regime?: string
  sourceSignals?: Array<{ source: string }>
}

// ── Banned vocabulary (never shown to driver) ──
// Vocabulary firewall: these terms are internal/technical, not driver-language

const BANNED_WORDS = [
  // Internal terms
  'signal', 'signaux', 'ramification', 'structure', 'données',
  'compilation', 'pack', 'engine', 'computed', 'confidence',
  'skeleton', 'source', 'pipeline', 'fetch', 'compile',
  // UI/WhatsApp banned per requirements
  'saturation', 'champ', 'friction', 'dispersion', 'optimisation',
  'analyse', 'prediction', 'prédiction', 'algorithme', 'modèle',
  'probabilité', 'scoring', 'score', 'metric', 'métriques',
]

// Generic skeleton labels to filter out (silence > vague)
const GENERIC_SKELETON_PATTERNS = [
  /structure\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i,
  /pattern\s+hebdo/i,
  /récurrence\s+\w+/i,
  /habitude\s+générale/i,
  /flux\s+habituel/i,
  /tendance\s+\w+/i,
]

/**
 * Check if a skeleton explanation is too generic.
 * Generic skeletons are filtered out — silence > vague.
 * Allowed: "bars ferment", "arrivées gares", "hôtels actifs"
 * Rejected: "structure mercredi", "tendance nuit"
 */
function isGenericSkeleton(explanation: string, cause: CauseType): boolean {
  if (cause !== 'skeleton') return false

  // Check against generic patterns
  for (const pattern of GENERIC_SKELETON_PATTERNS) {
    if (pattern.test(explanation)) return true
  }

  // Must mention something concrete (bars, gare, hôtel, resto, etc.)
  const lower = explanation.toLowerCase()
  const concreteTerms = [
    'bar', 'bars', 'club', 'clubs', 'ferme', 'ferment',
    'gare', 'tgv', 'train', 'arrivée', 'arrivées',
    'hôtel', 'hotels', 'hotel',
    'resto', 'restaurant', 'restos',
    'métro', 'rer', 'transport',
    'bureau', 'bureaux', 'office',
    'concert', 'spectacle', 'show',
    'match', 'stade',
  ]

  const hasConcreteTerms = concreteTerms.some(term => lower.includes(term))
  if (!hasConcreteTerms) return true // too generic

  return false
}

function sanitizeDriverText(text: string): string {
  let clean = text
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    clean = clean.replace(regex, '').replace(/\s{2,}/g, ' ').trim()
  }
  // Remove dangling separators
  clean = clean.replace(/^[\s·—–-]+|[\s·—–-]+$/g, '').trim()
  return clean || text // fallback to original if fully stripped
}

// ── Cause type inference ──

function inferCauseType(explanation: string, regime?: string): CauseType {
  const lower = explanation.toLowerCase()
  if (lower.includes('bar') || lower.includes('club') || lower.includes('nuit')) return 'bars'
  if (lower.includes('concert') || lower.includes('spectacle') || lower.includes('cigale')) return 'concert'
  if (lower.includes('tgv') || lower.includes('thalys') || lower.includes('gare')) return 'gare'
  if (lower.includes('orly') || lower.includes('cdg') || lower.includes('vol') || lower.includes('aéroport')) return 'aeroport'
  if (lower.includes('resto') || lower.includes('restaurant')) return 'restos'
  if (lower.includes('pluie') || lower.includes('météo') || lower.includes('froid')) return 'meteo'
  if (lower.includes('métro') || lower.includes('rer') || lower.includes('transport') || lower.includes('fermé')) return 'transport'
  if (lower.includes('hôtel') || lower.includes('hotel')) return 'hotels'
  if (lower.includes('bureau') || lower.includes('office')) return 'bureau'
  if (lower.includes('stade') || lower.includes('psg') || lower.includes('match')) return 'sport'
  return 'skeleton'
}

// ── Corridor inference ──

function inferCorridor(explanation: string, zones: string[]): Corridor | null {
  const lower = (explanation + ' ' + zones.join(' ')).toLowerCase()
  if (lower.includes('nord') || lower.includes('gare du nord') || lower.includes('pigalle') || lower.includes('montmartre')) return 'nord'
  if (lower.includes('est') || lower.includes('bastille') || lower.includes('nation') || lower.includes('bercy') || lower.includes('oberkampf')) return 'est'
  if (lower.includes('sud') || lower.includes('montparnasse') || lower.includes('orly') || lower.includes('denfert')) return 'sud'
  if (lower.includes('ouest') || lower.includes('défense') || lower.includes('defense') || lower.includes('lazare')) return 'ouest'
  if (lower.includes('châtelet') || lower.includes('chatelet') || lower.includes('marais') || lower.includes('opéra')) return 'centre'
  return null
}

// ── Action inference ──

function inferAction(topOpportunity: Opportunity | null, brief: CompiledBrief): FlowCard['action'] {
  if (!topOpportunity) return 'repos'
  if (topOpportunity.state === 'active') {
    if (topOpportunity.confidence >= 0.6) return 'rejoindre'
    return 'maintenir'
  }
  if (topOpportunity.state === 'forming') return 'anticiper'
  return 'maintenir'
}

// ── TTL defaults by cause type ──

const TTL_BY_CAUSE: Record<CauseType, number> = {
  bars: 30,       // 30 min after window closes
  concert: 45,    // 45 min (crowd dispersal takes time)
  gare: 20,       // 20 min (arrivals are fast)
  aeroport: 60,   // 1h (airport queues are slow)
  restos: 20,     // 20 min
  meteo: 120,     // 2h (weather persists)
  transport: 180,  // 3h (disruptions last)
  hotels: 30,
  bureau: 20,
  sport: 60,      // 1h (stadium dispersal)
  skeleton: 15,   // 15 min (low confidence pattern)
}

// ── Kind inference (confirme vs piste) ──

/**
 * Determine if an opportunity is confirmed or speculative.
 * - confirme: deterministic events (concerts, train arrivals, venue closings)
 * - piste: pattern-based bets (skeleton-only, low confidence)
 */
function inferKind(cause: CauseType, confidence: number, evidenceSources?: string[]): OpportunityKind {
  // Deterministic cause types are always confirme
  const deterministicCauses: CauseType[] = ['concert', 'gare', 'aeroport', 'sport', 'transport']
  if (deterministicCauses.includes(cause)) return 'confirme'

  // If evidence comes from live sources (not skeleton-only), it's confirme
  if (evidenceSources && evidenceSources.length > 0) {
    const hasLiveSource = evidenceSources.some(src =>
      src !== 'skeleton' && src !== 'pattern' && src !== 'habitude'
    )
    if (hasLiveSource) return 'confirme'
  }

  // High confidence pattern (>= 0.7) can be confirme
  if (confidence >= 0.7 && cause !== 'skeleton') return 'confirme'

  // Skeleton-only or low confidence = piste
  return 'piste'
}

// ── Normalize confidence to number ──

function normalizeConfidence(conf: number | 'high' | 'medium' | 'low'): number {
  if (typeof conf === 'number') return conf
  if (conf === 'high') return 0.85
  if (conf === 'medium') return 0.65
  return 0.4
}

// ── Build opportunities from ramifications ──

function ramificationsToOpportunities(
  ramifications: RamificationInput[],
  now: Date
): Opportunity[] {
  return ramifications
    .map((ram): Opportunity | null => {
      const cause = inferCauseType(ram.explanation, ram.regime)

      // Filter out generic skeletons (silence > vague)
      if (isGenericSkeleton(ram.explanation, cause)) {
        return null
      }

      // Extract window (handle object, string, or separate fields)
      let windowStart: string
      let windowEnd: string

      if (ram.window && typeof ram.window === 'object') {
        // Object format: { start, end }
        windowStart = ram.window.start
        windowEnd = ram.window.end
      } else if (ram.window && typeof ram.window === 'string') {
        // String format: "21:00-23:00" — convert to ISO
        const today = now.toISOString().split('T')[0]
        const parts = ram.window.split('-')
        if (parts.length === 2) {
          windowStart = `${today}T${parts[0].trim()}:00+01:00`
          windowEnd = `${today}T${parts[1].trim()}:00+01:00`
        } else {
          windowStart = now.toISOString()
          windowEnd = new Date(now.getTime() + 60 * 60000).toISOString()
        }
      } else if (ram.window_start && ram.window_end) {
        // Separate fields
        windowStart = ram.window_start
        windowEnd = ram.window_end
      } else {
        // Default: 1 hour window from now
        windowStart = now.toISOString()
        windowEnd = new Date(now.getTime() + 60 * 60000).toISOString()
      }

      const window = { start: windowStart, end: windowEnd }

      const ttlMinutes = TTL_BY_CAUSE[cause]
      const expiresAt = new Date(new Date(windowEnd).getTime() + ttlMinutes * 60000)

      // Extract zone (handle both formats)
      const zones = ram.pressureZones ?? (ram.pressure_zone ? [ram.pressure_zone] : (ram.effect_zone ? [ram.effect_zone] : ['Paris']))
      const primaryZone = zones[0] || 'Paris'

      // Normalize confidence
      const confidence = normalizeConfidence(ram.confidence)

      // Determine kind based on cause, confidence, and evidence
      const evidenceSources = ram.sourceSignals?.map(s => s.source) ?? []
      const kind = inferKind(cause, confidence, evidenceSources)

      // Compute all state-related fields
      const state = computeOpportunityState({ quand: window }, now)
      const windowProgress = computeWindowProgress({ quand: window }, now)
      const minutesRemaining = computeMinutesRemaining({ quand: window }, now)
      const windowPressure = computeWindowPressure({ quand: window }, now)
      const momentum = inferMomentum(state, confidence, windowProgress)

      return {
        id: ram.id,
        ou: primaryZone,
        quand: window,
        quoi: sanitizeDriverText(ram.explanation),
        cause,
        kind,
        corridor: ram.corridor as Corridor | null ?? inferCorridor(ram.explanation, zones),
        state,
        momentum,
        windowPressure,
        minutesRemaining,
        windowProgress,
        confidence,
        ttlMinutes,
        expiresAt: expiresAt.toISOString(),
      }
    })
    .filter((o): o is Opportunity => o !== null) // Remove filtered generic skeletons
}

// ── Rank opportunities (driver profile aware) ──

function rankOpportunities(
  opportunities: Opportunity[],
  profile: DriverProfileTonight | null
): Opportunity[] {
  const stateOrder: Record<OpportunityState, number> = {
    active: 0,
    closing: 1,   // Closing is urgent but fading — still actionable
    forming: 2,
    horizon: 3,
  }

  return [...opportunities].sort((a, b) => {
    // State first: active > forming > horizon
    const stateDiff = stateOrder[a.state] - stateOrder[b.state]
    if (stateDiff !== 0) return stateDiff

    // If driver has anchor, prefer opportunities near anchor
    if (profile?.anchor) {
      const aMatch = a.ou.toLowerCase().includes(profile.anchor.toLowerCase()) ? -1 : 0
      const bMatch = b.ou.toLowerCase().includes(profile.anchor.toLowerCase()) ? -1 : 0
      if (aMatch !== bMatch) return aMatch - bMatch
    }

    // If driver prefers long rides, prefer gare/aeroport
    if (profile?.ridePreference === 'longues') {
      const longCauses: CauseType[] = ['gare', 'aeroport']
      const aLong = longCauses.includes(a.cause) ? -1 : 0
      const bLong = longCauses.includes(b.cause) ? -1 : 0
      if (aLong !== bLong) return aLong - bLong
    }

    // Confidence
    return b.confidence - a.confidence
  })
}

// ── Context line builders ──

function buildWeatherContext(brief: CompiledBrief): string | null {
  const weatherAlert = brief.alerts?.find(a => a.type === 'WEATHER')
  if (!weatherAlert) return null
  const note = weatherAlert.notes?.[0]
  if (!note) return null
  return sanitizeDriverText(note.toLowerCase())
}

function buildTransportContext(brief: CompiledBrief): string | null {
  const transportAlert = brief.alerts?.find(a => a.type === 'TRANSIT' || a.type === 'STRIKE')
  if (!transportAlert) return null
  const note = transportAlert.notes?.[0]
  if (!note) return null
  return sanitizeDriverText(note.toLowerCase())
}

function buildEarningsContext(brief: CompiledBrief): string | null {
  const conf = brief.meta.confidence_overall ?? 0.5
  if (conf < 0.3) return null
  const base = 28
  const low = Math.round(base * conf * 0.85)
  const high = Math.round(base * conf * 1.25)
  return `≈${low}–${high} €/h`
}

// ── Format window remaining ──

function formatWindowRemaining(endTime: string, now: Date): string {
  const end = new Date(endTime)
  const remaining = Math.max(0, Math.round((end.getTime() - now.getTime()) / 60000))
  if (remaining <= 0) return 'fenêtre fermée'
  if (remaining < 60) return `fenêtre ~${remaining} min`
  const h = Math.floor(remaining / 60)
  const m = remaining % 60
  return `fenêtre ~${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
}

// ── Main: Build FlowCard ──

export function buildFlowCard(
  brief: CompiledBrief,
  ramifications: RamificationInput[],
  profile: DriverProfileTonight | null,
  previousCard: FlowCard | null,
  shiftRevisionCount: number
): FlowCard {
  const now = new Date()

  // 1. Build opportunities from ramifications
  let opportunities = ramificationsToOpportunities(ramifications, now)

  // 2. Filter expired (silence > stale)
  opportunities = filterExpiredOpportunities(opportunities, now)

  // 3. Rank (driver profile aware)
  opportunities = rankOpportunities(opportunities, profile)

  // 4. Cap at 5 entries
  opportunities = opportunities.slice(0, 5)

  // 5. Determine top opportunity and action
  const top = opportunities[0] || null
  const action = inferAction(top, brief)

  // 6. Build card
  const card: FlowCard = {
    id: crypto.randomUUID?.() ?? `card-${Date.now()}`,
    version: (previousCard?.version ?? 0) + 1,
    emittedAt: now.toISOString(),
    hash: '', // computed below

    action,
    actionZone: top?.ou ?? '',
    actionReason: top?.quoi ?? 'champ calme',
    actionWindow: top ? formatWindowRemaining(top.quand.end, now) : '',

    opportunities,

    context: {
      weather: buildWeatherContext(brief),
      transport: buildTransportContext(brief),
      earnings: buildEarningsContext(brief),
    },

    revision: {
      number: shiftRevisionCount + 1,
      reason: 'initial', // computed below
      previousHash: previousCard?.hash ?? null,
    },

    driverProfile: profile,

    meta: {
      packDate: brief.meta.generated_at?.split('T')[0] ?? new Date().toISOString().split('T')[0],
      packCompiledAt: brief.meta.generated_at ?? now.toISOString(),
      sourceCount: (brief.hotspots?.length ?? 0) + (brief.timeline?.length ?? 0),
      overallConfidence: brief.meta.confidence_overall ?? 0,
      stale: false,
    },
  }

  // 7. Compute hash and revision reason
  card.hash = computeCardHash(card)
  card.revision.reason = detectRevisionReason(previousCard, card)

  return card
}

// ── Journal write rules ──

export interface JournalWriteDecision {
  shouldWrite: boolean
  reason: string
}

/**
 * Decide whether to write this card revision to the journal.
 * Rules:
 *   - Always write if hash changed
 *   - Always write 'initial'
 *   - Write every 15 min even if unchanged (heartbeat)
 *   - Never write if hash is same and <15 min since last write
 */
export function shouldWriteToJournal(
  card: FlowCard,
  previousCard: FlowCard | null,
  lastWriteAt: Date | null,
  now: Date = new Date()
): JournalWriteDecision {
  // First card ever
  if (!previousCard || card.revision.reason === 'initial') {
    return { shouldWrite: true, reason: 'initial_card' }
  }

  // Hash changed → something meaningful changed
  if (card.hash !== previousCard.hash) {
    return { shouldWrite: true, reason: `hash_changed:${card.revision.reason}` }
  }

  // Heartbeat: 15 min since last write
  if (lastWriteAt) {
    const msSinceWrite = now.getTime() - lastWriteAt.getTime()
    if (msSinceWrite >= 15 * 60 * 1000) {
      return { shouldWrite: true, reason: 'heartbeat_15min' }
    }
  }

  return { shouldWrite: false, reason: 'no_change' }
}
