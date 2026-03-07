/**
 * WEEKLY PULSE BUILDER
 *
 * Bridges the weekly pulse model (weekly-pulse.ts) to the FlowState API contract.
 * Converts WaveWithDayContext to the simplified WeeklyPulse shape for the frontend.
 */

import {
  getActiveWaves,
  getUpcomingWaves,
  generateDailySummary,
  getWaveLabel,
  getDayLabelFr,
} from './weekly-pulse'
import type { WaveWithDayContext } from './weekly-pulse'
import type { WeeklyPulse, ActiveWave, UpcomingWave } from '@/types/flow-state'

/**
 * Convert internal WaveWithDayContext to API ActiveWave
 */
function toActiveWave(wave: WaveWithDayContext): ActiveWave {
  return {
    category: wave.category,
    name: getWaveLabel(wave.category),
    strength: wave.adjusted_strength,
    minutes_remaining: wave.minutes_until_end,
    core_zones: wave.core_zones.slice(0, 4), // Limit for display
    ride_profile: wave.ride_profile,
  }
}

/**
 * Convert internal WaveWithDayContext to API UpcomingWave
 */
function toUpcomingWave(wave: WaveWithDayContext): UpcomingWave {
  return {
    category: wave.category,
    name: getWaveLabel(wave.category),
    strength: wave.adjusted_strength,
    minutes_until_start: wave.minutes_until_start,
    typical_start: wave.typical_start,
    core_zones: wave.core_zones.slice(0, 4), // Limit for display
  }
}

/**
 * Build the WeeklyPulse object for FlowState
 */
export function buildWeeklyPulse(date?: Date): WeeklyPulse {
  // Get current active and upcoming waves
  const activeWaves = getActiveWaves(date)
  const upcomingWaves = getUpcomingWaves(date, 180) // 3 hours ahead

  // Get daily summary for strategic context
  const summary = generateDailySummary(date)

  return {
    day: getDayLabelFr(summary.day),
    active_waves: activeWaves.map(toActiveWave),
    upcoming_waves: upcomingWaves.slice(0, 3).map(toUpcomingWave), // Top 3 upcoming
    best_window: summary.best_window,
    peak_strength: summary.expected_peak_strength,
    strategic_notes: summary.strategic_notes,
  }
}

/**
 * Get a concise pulse summary for the flow card
 */
export function getPulseSummaryLine(date?: Date): string {
  const activeWaves = getActiveWaves(date)

  if (activeWaves.length === 0) {
    const upcoming = getUpcomingWaves(date, 60)
    if (upcoming.length > 0) {
      const next = upcoming[0]
      const label = getWaveLabel(next.category)
      return `Prochain: ${label} dans ${next.minutes_until_start} min`
    }
    return 'Creux — pas de vague active'
  }

  // Build summary of active waves
  const strongest = activeWaves[0]
  const label = getWaveLabel(strongest.category)

  if (activeWaves.length === 1) {
    return `${label} (${strongest.adjusted_strength}%)`
  }

  const secondLabel = getWaveLabel(activeWaves[1].category)
  return `${label} + ${secondLabel}`
}

/**
 * Get pulse strength class for UI styling
 */
export function getPulseStrengthClass(strength: number): 'fort' | 'bon' | 'moyen' | 'faible' | 'calme' {
  if (strength >= 80) return 'fort'
  if (strength >= 60) return 'bon'
  if (strength >= 40) return 'moyen'
  if (strength >= 20) return 'faible'
  return 'calme'
}
