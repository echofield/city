/**
 * Dispatch View Builder
 * Builds the strategic context view (complementary to GUIDÉ action view)
 */

import type {
  DispatchView,
  CorridorState,
  CorridorStatus,
  TimelineEvent,
  SessionMetrics,
  Ramification,
  ShiftPhase,
} from '@/types/flow-state'
import type { CompiledBrief } from '@/lib/prompts/contracts'
import { MOVEMENT_CORRIDORS, type CorridorDirection } from '@/lib/geo'

/**
 * Determine corridor status based on ramifications and signals
 */
function computeCorridorStatus(
  direction: CorridorDirection,
  ramifications: Ramification[],
  brief: CompiledBrief
): { status: CorridorStatus; reason?: string } {
  // Check ramifications for this corridor direction
  const relevantRams = ramifications.filter((r) => {
    const corridor = r.corridor?.toLowerCase() || ''
    const zone = r.effect_zone?.toLowerCase() || ''

    // Match by corridor name
    if (corridor.includes(direction)) return true

    // Match by zone association
    const corridorsForDir = MOVEMENT_CORRIDORS.filter(c => c.direction === direction)
    for (const c of corridorsForDir) {
      if (c.serves.some(s => zone.includes(s))) return true
    }

    return false
  })

  // Check for saturation/friction ramifications
  const hasSaturation = relevantRams.some(r =>
    r.kind === 'fleet_saturation' || r.kind === 'event_dispersion'
  )
  const hasFriction = relevantRams.some(r =>
    r.kind === 'banlieue_x_friction' || r.kind === 'transport_disruption'
  )
  const hasPressure = relevantRams.some(r => r.kind === 'banlieue_pressure')

  // Check alerts for transport disruptions
  const hasTransitAlert = brief.alerts?.some(a => {
    const area = a.area?.toLowerCase() || ''
    const type = a.type?.toLowerCase() || ''
    if (type !== 'transit' && type !== 'strike') return false

    // RER A affects Est/Ouest
    if (area.includes('rer a')) {
      return direction === 'est' || direction === 'ouest'
    }
    // RER B affects Nord/Sud
    if (area.includes('rer b')) {
      return direction === 'nord' || direction === 'sud'
    }
    return false
  })

  // Determine status
  if (hasSaturation || (hasFriction && hasTransitAlert)) {
    const reason = relevantRams[0]?.explanation?.slice(0, 50) ||
                   (hasTransitAlert ? 'Perturbation transport' : undefined)
    return { status: 'sature', reason }
  }

  if (hasFriction || hasPressure || hasTransitAlert) {
    const reason = relevantRams[0]?.explanation?.slice(0, 50) ||
                   (hasTransitAlert ? 'Trafic perturbé' : undefined)
    return { status: 'dense', reason }
  }

  return { status: 'fluide' }
}

/**
 * Build corridor states for all 4 directions
 */
function buildCorridorStates(
  ramifications: Ramification[],
  brief: CompiledBrief
): CorridorState[] {
  const directions: CorridorDirection[] = ['nord', 'est', 'sud', 'ouest']

  return directions.map((direction) => {
    const { status, reason } = computeCorridorStatus(direction, ramifications, brief)
    return { direction, status, reason }
  })
}

/**
 * Build extended timeline (+2h from now)
 */
function buildExtendedTimeline(brief: CompiledBrief): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const now = new Date()
  const nowHour = now.getHours()

  // Add peaks from brief
  for (const peak of brief.horizon_block?.expected_peaks ?? []) {
    const match = peak.match(/^(\d{1,2}):?(\d{0,2})\s*(.*)$/)
    if (match) {
      const hour = parseInt(match[1], 10)
      const zone = match[3] || 'Paris'
      events.push({
        time: `${hour}:00`,
        label: 'pic',
        zone,
        type: 'pic',
      })
    }
  }

  // Add hotspots
  for (const hotspot of brief.horizon_block?.hotspots ?? []) {
    const [start] = (hotspot.window || '').split('-')
    if (start) {
      events.push({
        time: start.trim(),
        label: hotspot.why || 'pic',
        zone: hotspot.zone,
        type: 'pic',
      })
    }
  }

  // Add dispersion events (1h after pics)
  const picTimes = events.filter(e => e.type === 'pic').map(e => {
    const [h] = e.time.split(':')
    return parseInt(h, 10)
  })

  for (const picHour of picTimes) {
    const dispersionHour = (picHour + 1) % 24
    if (!events.some(e => e.time.startsWith(`${dispersionHour}:`))) {
      events.push({
        time: `${dispersionHour}:00`,
        label: 'dispersion',
        zone: 'banlieue',
        type: 'dispersion',
      })
    }
  }

  // Add night transition if evening
  if (nowHour >= 20 || nowHour < 4) {
    const nightHour = nowHour >= 20 ? 0 : nowHour + 2
    if (!events.some(e => e.time === '00:00')) {
      events.push({
        time: '00:00',
        label: 'nuit',
        zone: 'gares',
        type: 'nuit',
      })
    }
  }

  // Sort by time
  events.sort((a, b) => {
    const [ah] = a.time.split(':').map(Number)
    const [bh] = b.time.split(':').map(Number)
    return ah - bh
  })

  // Limit to 6 events
  return events.slice(0, 6)
}

/**
 * Build session metrics
 * NOTE: In production, this should come from driver session tracking
 * Currently shows degraded state when no real data available
 */
function buildSessionMetrics(
  sessionStart?: number,
  coursesCount?: number,
  earnings?: number
): SessionMetrics {
  const now = Date.now()
  const start = sessionStart ?? now - 2 * 60 * 60 * 1000 // default 2h ago
  const durationMin = Math.round((now - start) / 60000)

  // Use provided values or mark as unavailable
  const hasRealEarnings = earnings !== undefined
  const hasRealCourses = coursesCount !== undefined

  // Efficiency: only calculate if we have real data, otherwise show baseline
  // No random - use 75% as baseline "average" when no tracking data
  const baselineEfficiency = 75
  const calculatedEfficiency = hasRealEarnings && hasRealCourses && coursesCount > 0
    ? Math.min(100, Math.round((earnings / (durationMin * 0.6)) * 75)) // compare to target rate
    : baselineEfficiency

  return {
    duration_min: durationMin,
    courses_count: coursesCount ?? Math.floor(durationMin / 25), // estimate ~25 min per course
    earnings: earnings ?? Math.round(durationMin * 0.6), // estimate ~36€/h
    target_earnings: 120, // default shift target
    efficiency: calculatedEfficiency,
  }
}

/**
 * Determine current shift phase from time and signals
 */
function determinePhase(brief: CompiledBrief): ShiftPhase {
  const now = new Date()
  const hour = now.getHours()

  // Night
  if (hour >= 0 && hour < 6) return 'dispersion'
  // Morning calm
  if (hour >= 6 && hour < 11) return 'calme'
  // Lunch rise
  if (hour >= 11 && hour < 14) return 'montee'
  // Afternoon calm
  if (hour >= 14 && hour < 17) return 'calme'
  // Evening rise
  if (hour >= 17 && hour < 20) return 'montee'
  // Peak evening
  if (hour >= 20 && hour < 23) return 'pic'
  // Late dispersion
  return 'dispersion'
}

/**
 * Build complete DispatchView
 */
export function buildDispatchView(
  brief: CompiledBrief,
  ramifications: Ramification[],
  sessionStart?: number,
  coursesCount?: number,
  earnings?: number
): DispatchView {
  return {
    session: buildSessionMetrics(sessionStart, coursesCount, earnings),
    corridors: buildCorridorStates(ramifications, brief),
    timeline_extended: buildExtendedTimeline(brief),
    phase: determinePhase(brief),
    generatedAt: new Date().toISOString(),
  }
}
