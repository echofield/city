/**
 * FLOW Card v1.6 — Canonical Schema
 *
 * The card is the product. Everything else exists to produce the next revision.
 * UI is a renderer. WhatsApp is a transport. Journal is the append-only trace.
 *
 * OÙ / QUAND / QUOI — the irreducible unit per opportunity.
 * ● maintenant  ○ ça monte  · plus tard  ⊘ expiré (dropped silently)
 */

// ── Opportunity (one line on the card) ──

export type OpportunityState = 'active' | 'forming' | 'horizon' | 'closing'
// active  = ● maintenant (now within window, >10 min remaining)
// closing = ⚠ dernières minutes (within window, <10 min remaining)
// forming = ○ ça monte   (window starts within 30 min)
// horizon = · plus tard   (>30 min away)
// expired entries are never shown — they are dropped before card emission

/**
 * Momentum: is the wave building, stable, or fading?
 * ▲ building — confidence or activity increasing
 * → stable — steady state
 * ▼ fading — confidence or activity decreasing
 */
export type Momentum = 'building' | 'stable' | 'fading'

/**
 * Window pressure: urgency indicator for driver action
 */
export type WindowPressure = 'opening' | 'active' | 'closing'

export type CauseType =
  | 'bars'        // bars/clubs closing → sortie
  | 'concert'     // concert/spectacle ending
  | 'gare'        // train arrival burst
  | 'aeroport'    // airport corridor (CDG/Orly)
  | 'restos'      // restaurant district closing
  | 'meteo'       // weather shift (rain, cold)
  | 'transport'   // transport disruption / closure
  | 'hotels'      // hotel district activity
  | 'bureau'      // office district evening exit
  | 'sport'       // stadium exit
  | 'skeleton'    // recurring structural pattern (only if named concretely)

export type Corridor = 'nord' | 'est' | 'sud' | 'ouest' | 'centre'

/**
 * kind: distinguishes confirmed from speculative
 * - confirme: deterministic event (concert ending, train arriving, etc.)
 * - piste: positioning bet based on patterns ("à tenter")
 */
export type OpportunityKind = 'confirme' | 'piste'

export interface Opportunity {
  id: string                  // stable ID for dedup (e.g. "ram-2026-03-05-3")
  ou: string                  // pressure zone name — "Bastille", "Gare du Nord"
  quand: {
    start: string             // ISO timestamp
    end: string               // ISO timestamp
  }
  quoi: string                // driver-language explanation — "bars pleins · sortie EST"
  cause: CauseType            // machine-readable cause type
  kind: OpportunityKind       // confirme = deterministic, piste = pattern bet
  corridor: Corridor | null   // flow direction
  state: OpportunityState     // computed at card emission time
  momentum: Momentum          // ▲ building / → stable / ▼ fading
  windowPressure: WindowPressure // opening / active / closing
  minutesRemaining: number    // computed: minutes until window ends (or starts if forming)
  windowProgress: number      // 0-1: how far through the window (for progress bar)
  confidence: number          // 0-1
  ttlMinutes: number          // after window.end, how long before silent drop
  expiresAt: string           // ISO — computed: window.end + ttlMinutes
}

// ── Card (the product) ──

export interface FlowCard {
  id: string                  // unique card revision ID (uuid)
  version: number             // increments with each revision
  emittedAt: string           // ISO timestamp
  hash: string                // SHA-256 of canonical content (for dedup in journal)

  // The action line (top of card)
  action: 'rejoindre' | 'maintenir' | 'anticiper' | 'repos'
  actionZone: string          // "BASTILLE", "GARE DU NORD"
  actionReason: string        // "bars pleins · sortie EST"
  actionWindow: string        // "fenêtre ~18 min"

  // The opportunity table (3-5 lines max)
  opportunities: Opportunity[]

  // Context line (bottom of card)
  context: {
    weather: string | null    // "pluie ~05h" or null
    transport: string | null  // "métro off" or null
    earnings: string | null   // "≈25-34 €/h" or null
  }

  // Revision metadata
  revision: {
    number: number            // 1, 2, 3... within this shift
    reason: CardRevisionReason
    previousHash: string | null
  }

  // Driver profile (if set tonight)
  driverProfile: DriverProfileTonight | null

  // Source metadata (for journal / debugging, never shown to driver)
  meta: {
    packDate: string
    packCompiledAt: string
    sourceCount: number
    overallConfidence: number
    stale: boolean
  }
}

// ── Revision reasons (why the card changed) ──

export type CardRevisionReason =
  | 'initial'                 // first card of the shift
  | 'new_top'                 // top opportunity changed
  | 'opportunity_expired'     // a line was dropped (TTL)
  | 'opportunity_added'       // new opportunity appeared
  | 'weather_shift'           // weather changed
  | 'transport_disruption'    // new transport event
  | 'confidence_change'       // material confidence shift (>15%)
  | 'pack_refresh'            // cron produced a new tonight pack
  | 'driver_profile_change'   // driver updated preferences
  | 'scheduled'               // periodic refresh (every 10-15 min)

// ── Driver profile tonight (from 2-3 questions) ──

export interface DriverProfileTonight {
  anchor: string              // starting zone
  ridePreference: 'courtes' | 'longues' | 'peu_importe'
  endTime: string             // "02h" | "04h" | "matin"
  riskTolerance: 'faible' | 'moyen' | 'fort'
}

// ── Journal entry (append-only, one per revision) ──

export interface CardJournalEntry {
  id: string                  // uuid
  driverId: string            // user_id or anonymous device key
  shiftId: string             // groups entries within one night
  createdAt: string           // ISO
  cardHash: string            // dedup — only write when hash changes
  cardPayload: FlowCard       // full snapshot
  topOpportunityId: string
  confidence: number
  stale: boolean
  revisionReason: CardRevisionReason
}

// ── Nightly feedback (one question) ──

export interface NightlyFeedback {
  id: string
  driverId: string
  shiftId: string
  date: string                // YYYY-MM-DD
  served: boolean             // "ça a servi ?" ✅/❌
  longRide: boolean | null    // "course longue ?" ✅/❌ (optional)
  createdAt: string
}

// ── WhatsApp message (derived from card) ──

export function cardToWhatsApp(card: FlowCard): string {
  const action = card.action.toUpperCase()
  const zone = card.actionZone
  const reason = card.actionReason
  const window = card.actionWindow

  const contextParts: string[] = []
  if (card.context.weather) contextParts.push(card.context.weather)
  if (card.context.transport) contextParts.push(card.context.transport)

  const contextStr = contextParts.length ? ` · ${contextParts.join(' · ')}` : ''

  return `FLOW · ${action} ${zone} · ${reason} · ${window}${contextStr}`
}

// ── Ultra-compressed (HUD / watch) ──

export function cardToHUD(card: FlowCard): string {
  const stateChar: Record<OpportunityState, string> = { active: '●', closing: '⚠', forming: '○', horizon: '·' }
  return card.opportunities
    .slice(0, 4)
    .map(o => {
      const zone = o.ou.slice(0, 3).toUpperCase()
      const hour = new Date(o.quand.start).getHours().toString().padStart(2, '0')
      return `${zone} ${hour} ${stateChar[o.state]}`
    })
    .join('   ')
}

// ── Card hash (for journal dedup) ──

export function computeCardHash(card: FlowCard): string {
  // Hash the content that matters — not timestamps or metadata
  const content = {
    action: card.action,
    actionZone: card.actionZone,
    opportunities: card.opportunities.map(o => ({
      id: o.id,
      ou: o.ou,
      state: o.state,
    })),
    weather: card.context.weather,
    transport: card.context.transport,
  }
  // Simple string hash — replace with crypto.subtle.digest in production
  const str = JSON.stringify(content)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

// ── Opportunity TTL filter ──

export function filterExpiredOpportunities(
  opportunities: Opportunity[],
  now: Date = new Date()
): Opportunity[] {
  return opportunities.filter(o => {
    const expiresAt = new Date(o.expiresAt)
    return now < expiresAt
  })
}

// ── Opportunity state computation ──

export function computeOpportunityState(
  o: Pick<Opportunity, 'quand'>,
  now: Date = new Date()
): OpportunityState {
  const start = new Date(o.quand.start)
  const end = new Date(o.quand.end)
  const msToStart = start.getTime() - now.getTime()
  const msToEnd = end.getTime() - now.getTime()
  const minToStart = msToStart / 60000
  const minToEnd = msToEnd / 60000

  // Within window
  if (now >= start && now <= end) {
    // Closing: less than 10 min remaining
    if (minToEnd <= 10) return 'closing'
    return 'active'
  }

  // Before window
  if (minToStart <= 30 && minToStart > 0) return 'forming'
  return 'horizon'
}

// ── Window pressure computation ──

export function computeWindowPressure(
  o: Pick<Opportunity, 'quand'>,
  now: Date = new Date()
): WindowPressure {
  const start = new Date(o.quand.start)
  const end = new Date(o.quand.end)
  const msToEnd = end.getTime() - now.getTime()
  const minToEnd = msToEnd / 60000

  if (now < start) return 'opening'
  if (minToEnd <= 10) return 'closing'
  return 'active'
}

// ── Minutes remaining computation ──

export function computeMinutesRemaining(
  o: Pick<Opportunity, 'quand'>,
  now: Date = new Date()
): number {
  const start = new Date(o.quand.start)
  const end = new Date(o.quand.end)

  // If window hasn't started, return minutes until start
  if (now < start) {
    return Math.round((start.getTime() - now.getTime()) / 60000)
  }

  // If within window, return minutes until end
  if (now <= end) {
    return Math.round((end.getTime() - now.getTime()) / 60000)
  }

  // Past window
  return 0
}

// ── Window progress computation ──

export function computeWindowProgress(
  o: Pick<Opportunity, 'quand'>,
  now: Date = new Date()
): number {
  const start = new Date(o.quand.start)
  const end = new Date(o.quand.end)
  const totalDuration = end.getTime() - start.getTime()

  if (totalDuration <= 0) return 1 // Invalid window

  if (now < start) return 0 // Not started
  if (now > end) return 1 // Finished

  const elapsed = now.getTime() - start.getTime()
  return Math.min(1, Math.max(0, elapsed / totalDuration))
}

// ── Momentum inference ──

export function inferMomentum(
  state: OpportunityState,
  confidence: number,
  windowProgress: number
): Momentum {
  // Closing windows are always fading
  if (state === 'closing') return 'fading'

  // Forming windows are building
  if (state === 'forming') return 'building'

  // Active windows: early = building, mid = stable, late = fading
  if (state === 'active') {
    if (windowProgress < 0.3) return 'building'
    if (windowProgress > 0.7) return 'fading'
    return 'stable'
  }

  // Horizon: depends on confidence
  if (confidence >= 0.7) return 'building'
  return 'stable'
}

// ── Pressure label for UI ──

export function getPressureLabel(
  state: OpportunityState,
  minutesRemaining: number
): string {
  if (state === 'forming' || state === 'horizon') {
    if (minutesRemaining < 60) return `ouvre ~${minutesRemaining} min`
    const hours = Math.floor(minutesRemaining / 60)
    return `ouvre ~${hours}h`
  }

  if (state === 'closing') {
    return `ferme ~${minutesRemaining} min`
  }

  // Active
  if (minutesRemaining < 60) return `~${minutesRemaining} min restant`
  const hours = Math.floor(minutesRemaining / 60)
  const mins = minutesRemaining % 60
  if (mins > 0) return `~${hours}h${mins.toString().padStart(2, '0')} restant`
  return `~${hours}h restant`
}

// ── Revision detection ──

export function detectRevisionReason(
  prev: FlowCard | null,
  next: FlowCard
): CardRevisionReason {
  if (!prev) return 'initial'

  // Top opportunity changed
  if (prev.actionZone !== next.actionZone) return 'new_top'

  // Opportunity count changed (expired or new)
  if (next.opportunities.length < prev.opportunities.length) return 'opportunity_expired'
  if (next.opportunities.length > prev.opportunities.length) return 'opportunity_added'

  // Weather or transport changed
  if (prev.context.weather !== next.context.weather) return 'weather_shift'
  if (prev.context.transport !== next.context.transport) return 'transport_disruption'

  // Confidence shifted materially (>15 percentage points)
  const confDelta = Math.abs(next.meta.overallConfidence - prev.meta.overallConfidence)
  if (confDelta > 0.15) return 'confidence_change'

  return 'scheduled'
}
