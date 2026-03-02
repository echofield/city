/**
 * FLOW Intelligence Engine
 * Main entry point for the anticipatory urban mobility system
 */

export * from './mock-data'
export * from '../prompts/contracts'
export * from '../prompts/flow-compiler'
export * from '../prompts/profile-interpreter'
export * from '../prompts/city-signals-osint'

/**
 * Convert compiled brief to dashboard-friendly format
 * Bridge between FLOW engine output and UI components
 */
import type { CompiledBrief } from '../prompts/contracts'
import type { BriefContent } from '@/types/database'

export function briefToDashboard(compiled: CompiledBrief): BriefContent {
  return {
    summary: compiled.summary,
    timeline: compiled.timeline.map((slot) => ({
      window: `${slot.start}-${slot.end}`,
      zones: [slot.primary_zone],
      alternatives: slot.alternatives,
      saturation: slot.saturation_risk.toLowerCase() as 'low' | 'medium' | 'high',
    })),
    hotspots: compiled.hotspots.map((h) => ({
      zone: h.zone,
      window: h.window,
      saturation_risk: h.saturation_risk.toLowerCase() as 'low' | 'medium' | 'high',
      alternatives: h.alternatives,
      waze_link: `https://waze.com/ul?q=${encodeURIComponent(h.zone + ' Paris')}`,
    })),
    alerts: compiled.alerts.map((a) => ({
      type: a.type.toLowerCase() as 'manifestation' | 'travaux' | 'event' | 'meteo',
      title: `${a.type} - ${a.area}`,
      description: a.notes.join('. '),
      zones: [a.area],
      window: a.window,
    })),
    rules: compiled.rules.map((r) => ({
      condition: r.if,
      action: r.then,
    })),
  }
}

/**
 * Calculate potential gain estimate from compiled brief
 * Simple heuristic based on hotspot scores and event sizes
 */
export function estimatePotentialGain(compiled: CompiledBrief): {
  min: number
  max: number
  confidence: number
} {
  const baseGain = 25 // Base evening gain
  const topHotspots = compiled.hotspots.slice(0, 3)
  const avgScore = topHotspots.reduce((sum, h) => sum + h.score, 0) / topHotspots.length

  // Events boost
  const hasLargeEvent = compiled.alerts.some(
    (a) => a.type === 'EVENT' && a.severity === 'HIGH'
  )
  const eventBoost = hasLargeEvent ? 1.3 : 1.0

  // Weather boost (rain = more demand)
  const hasRain = compiled.alerts.some(
    (a) => a.type === 'WEATHER' && a.notes.some((n) => n.toLowerCase().includes('pluie'))
  )
  const weatherBoost = hasRain ? 1.15 : 1.0

  const multiplier = (avgScore / 100) * eventBoost * weatherBoost

  return {
    min: Math.round(baseGain * multiplier * 0.8),
    max: Math.round(baseGain * multiplier * 1.4),
    confidence: compiled.meta.confidence_overall,
  }
}

/**
 * Get driver performance stats (mock for now)
 * Will be computed from feedback data later
 */
export function getDriverPerformance(userId: string): {
  activeTimeChange: number // percentage
  gainVsAverage: number // euros
  repositioningsYesterday: number
  modelConfidenceTrend: 'up' | 'down' | 'stable'
} {
  // Mock data - will be computed from brief_runs + driver_feedback
  return {
    activeTimeChange: 21,
    gainVsAverage: 34,
    repositioningsYesterday: 3,
    modelConfidenceTrend: 'up',
  }
}
