/**
 * NIGHT REPLAY - Perception Feedback Engine
 *
 * "You didn't get lucky. You understood the city."
 *
 * Transforms shift history into narrative memory.
 * Creates cause → effect continuity that builds trust.
 */

import type { PastMove, FieldState, ShiftSession } from './contracts'

// ============================================
// REPLAY ITEM (what driver sees)
// ============================================

export interface ReplayItem {
  id: string
  time: string           // "18:42"
  action: string         // "You held position"
  zone: string           // "Gare de Lyon"
  window_context: string // "Window opened 6 min later"
  outcome: 'win' | 'loss' | 'neutral'
  outcome_label: string  // "Pickup achieved" or "Zone became cold"
  delta?: number         // +18 or -9
}

export interface ReplayResult {
  items: ReplayItem[]
  alignment: {
    score: number           // 0-100
    followed: number
    favorable: number
  }
  top_win: ReplayItem | null
  top_miss: ReplayItem | null
  rule_learned: string
  shift_date: string
  shift_duration_hours: number
}

// ============================================
// NARRATIVE GENERATION
// ============================================

// Field states that represent favorable windows
const FAVORABLE_STATES: FieldState[] = [
  'WINDOW_OPENING',
  'WINDOW_ACTIVE',
  'WINDOW_CLOSING'
]

// Confidence threshold for favorable window
const CONFIDENCE_THRESHOLD = 0.65

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function getActionLabel(move: PastMove): string {
  if (move.outcome === 'followed') {
    if (move.state === 'HOLD_POSITION' || move.state === 'WINDOW_ACTIVE') {
      return 'Tu as tenu position'
    }
    if (move.state === 'FLOW_SHIFT') {
      return 'Tu as bougé tôt'
    }
    if (move.state === 'WINDOW_OPENING') {
      return 'Tu as anticipé'
    }
    return 'Tu as suivi'
  }
  if (move.outcome === 'ignored') {
    return 'Zone ignorée'
  }
  return 'Mouvement partiel'
}

function getWindowContext(move: PastMove): string {
  if (move.outcome === 'followed') {
    if (move.result.pickup_achieved) {
      const time = move.result.time_to_pickup_minutes
      if (time && time <= 5) {
        return `Fenêtre active · pickup en ${time} min`
      }
      return 'Fenêtre confirmée'
    }
    return 'Positionnement favorable'
  }

  if (move.outcome === 'ignored') {
    if (move.result.earnings_delta && move.result.earnings_delta < 0) {
      return 'Zone devenue froide'
    }
    return 'Fenêtre manquée'
  }

  return 'Résultat mitigé'
}

function getOutcomeLabel(move: PastMove): string {
  if (move.result.pickup_achieved) {
    return 'Pickup obtenu'
  }
  if (move.outcome === 'ignored' && move.result.earnings_delta && move.result.earnings_delta < 0) {
    return 'Perte évitée'
  }
  if (move.outcome === 'followed' && !move.result.pickup_achieved) {
    return 'Position tenue'
  }
  if (move.outcome === 'ignored') {
    return 'Opportunité passée'
  }
  return 'Résultat neutre'
}

function determineOutcome(move: PastMove): 'win' | 'loss' | 'neutral' {
  const delta = move.result.earnings_delta || 0

  // Win: followed and got pickup, OR ignored a bad zone
  if (move.outcome === 'followed' && move.result.pickup_achieved) {
    return 'win'
  }
  if (move.outcome === 'ignored' && delta < -5) {
    return 'win' // Avoided loss
  }

  // Loss: ignored a good window, or followed but no result
  if (move.outcome === 'ignored' && delta > 5) {
    return 'loss'
  }

  return 'neutral'
}

function generateRuleLearned(items: ReplayItem[], moves: PastMove[]): string {
  // Analyze patterns to suggest a rule
  const wins = items.filter(i => i.outcome === 'win')
  const losses = items.filter(i => i.outcome === 'loss')

  // Check for holding pattern
  const holdWins = moves.filter(m =>
    m.outcome === 'followed' &&
    (m.state === 'HOLD_POSITION' || m.state === 'WINDOW_ACTIVE') &&
    m.result.pickup_achieved
  )

  if (holdWins.length >= 2) {
    return 'Tenir position paie quand la fenêtre est active'
  }

  // Check for early movement pattern
  const earlyMoveWins = moves.filter(m =>
    m.outcome === 'followed' &&
    m.state === 'WINDOW_OPENING' &&
    m.result.pickup_achieved
  )

  if (earlyMoveWins.length >= 2) {
    return 'Arriver avant la foule donne l\'avantage'
  }

  // Check for avoided losses
  const avoidedLosses = items.filter(i =>
    i.outcome === 'win' &&
    i.delta && i.delta < 0
  )

  if (avoidedLosses.length >= 2) {
    return 'Ignorer les zones saturées protège les gains'
  }

  // Default rules based on win/loss ratio
  if (wins.length > losses.length * 2) {
    return 'Ton alignement avec le champ est fort ce soir'
  }

  if (losses.length > wins.length) {
    return 'Les fenêtres courtes demandent plus de réactivité'
  }

  return 'Chaque nuit enseigne un nouveau rythme'
}

// ============================================
// MAIN EXPORT
// ============================================

export function generateReplayNarrative(session: ShiftSession): ReplayResult {
  const history = session.history

  if (history.length === 0) {
    return {
      items: [],
      alignment: { score: 0, followed: 0, favorable: 0 },
      top_win: null,
      top_miss: null,
      rule_learned: 'Pas assez de données pour ce shift',
      shift_date: session.started_at,
      shift_duration_hours: 0
    }
  }

  // Generate replay items (max 10, most recent first)
  const items: ReplayItem[] = history
    .slice(0, 10)
    .map(move => ({
      id: move.id,
      time: formatTime(move.timestamp),
      action: getActionLabel(move),
      zone: move.target,
      window_context: getWindowContext(move),
      outcome: determineOutcome(move),
      outcome_label: getOutcomeLabel(move),
      delta: move.result.earnings_delta
    }))

  // Calculate alignment score
  const favorableWindows = history.filter(m =>
    FAVORABLE_STATES.includes(m.state)
  )
  const followedFavorable = favorableWindows.filter(m =>
    m.outcome === 'followed'
  )

  const alignmentScore = favorableWindows.length > 0
    ? Math.round((followedFavorable.length / favorableWindows.length) * 100)
    : 0

  // Find top win and top miss
  const wins = items.filter(i => i.outcome === 'win')
  const losses = items.filter(i => i.outcome === 'loss')

  const topWin = wins.length > 0
    ? wins.reduce((best, item) =>
        (item.delta || 0) > (best.delta || 0) ? item : best
      )
    : null

  const topMiss = losses.length > 0
    ? losses.reduce((worst, item) =>
        (item.delta || 0) < (worst.delta || 0) ? item : worst
      )
    : null

  // Calculate shift duration
  const startTime = new Date(session.started_at).getTime()
  const lastMoveTime = history.length > 0
    ? new Date(history[0].timestamp).getTime()
    : startTime
  const durationHours = (lastMoveTime - startTime) / (1000 * 60 * 60)

  return {
    items,
    alignment: {
      score: alignmentScore,
      followed: followedFavorable.length,
      favorable: favorableWindows.length
    },
    top_win: topWin,
    top_miss: topMiss,
    rule_learned: generateRuleLearned(items, history),
    shift_date: session.started_at,
    shift_duration_hours: Math.round(durationHours * 10) / 10
  }
}

// ============================================
// MOCK DATA FOR TESTING
// ============================================

export function generateMockReplayData(): ReplayResult {
  return {
    items: [
      {
        id: 'r1',
        time: '18:42',
        action: 'Tu as tenu position',
        zone: 'Gare de Lyon',
        window_context: 'Fenêtre ouverte 6 min après',
        outcome: 'win',
        outcome_label: 'Pickup obtenu',
        delta: 12
      },
      {
        id: 'r2',
        time: '21:15',
        action: 'Tu as bougé tôt',
        zone: 'Bercy',
        window_context: 'Arrivée avant sortie concert',
        outcome: 'win',
        outcome_label: 'Pickup obtenu',
        delta: 18
      },
      {
        id: 'r3',
        time: '22:30',
        action: 'Tu as anticipé',
        zone: 'Bastille',
        window_context: 'Fenêtre confirmée',
        outcome: 'win',
        outcome_label: 'Pickup obtenu',
        delta: 8
      },
      {
        id: 'r4',
        time: '23:50',
        action: 'Zone ignorée',
        zone: 'Opéra',
        window_context: 'Zone devenue froide',
        outcome: 'win',
        outcome_label: 'Perte évitée',
        delta: -9
      },
      {
        id: 'r5',
        time: '00:15',
        action: 'Zone ignorée',
        zone: 'Châtelet',
        window_context: 'Fenêtre manquée',
        outcome: 'loss',
        outcome_label: 'Opportunité passée',
        delta: 15
      }
    ],
    alignment: {
      score: 74,
      followed: 5,
      favorable: 7
    },
    top_win: {
      id: 'r2',
      time: '21:15',
      action: 'Tu as bougé tôt',
      zone: 'Bercy',
      window_context: 'Arrivée avant sortie concert',
      outcome: 'win',
      outcome_label: 'Pickup obtenu',
      delta: 18
    },
    top_miss: {
      id: 'r5',
      time: '00:15',
      action: 'Zone ignorée',
      zone: 'Châtelet',
      window_context: 'Fenêtre manquée',
      outcome: 'loss',
      outcome_label: 'Opportunité passée',
      delta: 15
    },
    rule_learned: 'Tenir position paie quand la fenêtre est active',
    shift_date: new Date().toISOString(),
    shift_duration_hours: 6.5
  }
}
