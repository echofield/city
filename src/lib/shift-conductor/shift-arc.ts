/**
 * SHIFT ARC - Temporal Rhythm Engine
 *
 * Shows drivers where they are in the night's rhythm.
 * Creates emotional scaffold: Calm → Build → Peak → Release
 *
 * "Drivers stop feeling lost in time."
 */

import type { EnergyPhase } from './contracts'

// ============================================
// ARC PHASES (simplified for driver cognition)
// ============================================

export type ArcPhase = 'calm' | 'build' | 'peak' | 'release'

export interface ShiftArcState {
  current_phase: ArcPhase
  phase_progress: number      // 0-100, how far into this phase
  next_phase: ArcPhase | null
  next_phase_in_minutes: number | null
  phase_reason?: string       // "Concert Bercy ends 23h"
  energy: EnergyPhase         // Detailed energy for internal use
}

// ============================================
// HEURISTIC CONFIGURATION
// ============================================

interface TimeSlot {
  start: number  // Hour (0-23)
  end: number    // Hour (0-23)
  phase: ArcPhase
  energy: EnergyPhase
}

// Default rhythm by day of week
const WEEKDAY_RHYTHM: TimeSlot[] = [
  { start: 6, end: 9, phase: 'build', energy: 'BUILDING' },
  { start: 9, end: 12, phase: 'peak', energy: 'RISING' },
  { start: 12, end: 14, phase: 'peak', energy: 'PEAK' },
  { start: 14, end: 17, phase: 'calm', energy: 'CALM' },
  { start: 17, end: 20, phase: 'build', energy: 'RISING' },
  { start: 20, end: 23, phase: 'peak', energy: 'PEAK' },
  { start: 23, end: 2, phase: 'release', energy: 'DISPERSION' },
  { start: 2, end: 6, phase: 'calm', energy: 'NIGHT_DRIFT' }
]

const WEEKEND_RHYTHM: TimeSlot[] = [
  { start: 6, end: 10, phase: 'calm', energy: 'CALM' },
  { start: 10, end: 13, phase: 'build', energy: 'BUILDING' },
  { start: 13, end: 16, phase: 'calm', energy: 'CALM' },
  { start: 16, end: 19, phase: 'build', energy: 'BUILDING' },
  { start: 19, end: 23, phase: 'peak', energy: 'PEAK' },
  { start: 23, end: 3, phase: 'peak', energy: 'PEAK' },  // Weekend late night
  { start: 3, end: 6, phase: 'release', energy: 'DISPERSION' }
]

// ============================================
// CONTEXT INPUTS
// ============================================

export interface ArcContext {
  // Time
  now: Date
  dayOfWeek: number  // 0 = Sunday, 6 = Saturday

  // Events (optional)
  majorEvents?: Array<{
    name: string
    zone: string
    starts_at: string   // ISO
    ends_at: string     // ISO
    capacity: 'SMALL' | 'MED' | 'LARGE'
  }>

  // Weather (optional)
  rainExpectedIn?: number  // minutes until rain, null if none

  // Transit (optional)
  transitDisruptions?: Array<{
    line: string
    severity: 'LOW' | 'MED' | 'HIGH'
    until?: string  // ISO
  }>
}

// ============================================
// PHASE CALCULATION
// ============================================

function getTimeSlot(hour: number, slots: TimeSlot[]): TimeSlot {
  for (const slot of slots) {
    // Handle overnight slots (e.g., 23 to 2)
    if (slot.start > slot.end) {
      if (hour >= slot.start || hour < slot.end) {
        return slot
      }
    } else {
      if (hour >= slot.start && hour < slot.end) {
        return slot
      }
    }
  }
  // Default fallback
  return { start: 0, end: 24, phase: 'calm', energy: 'CALM' }
}

function getNextSlot(currentSlot: TimeSlot, slots: TimeSlot[]): TimeSlot | null {
  const currentIndex = slots.findIndex(s =>
    s.start === currentSlot.start && s.end === currentSlot.end
  )
  if (currentIndex === -1 || currentIndex === slots.length - 1) {
    return slots[0] // Wrap to first
  }
  return slots[currentIndex + 1]
}

function calculatePhaseProgress(hour: number, minute: number, slot: TimeSlot): number {
  const currentMinutes = hour * 60 + minute
  let slotStartMinutes = slot.start * 60
  let slotEndMinutes = slot.end * 60

  // Handle overnight slots
  if (slot.start > slot.end) {
    slotEndMinutes += 24 * 60
    if (currentMinutes < slot.start * 60) {
      // We're after midnight
      const adjustedCurrent = currentMinutes + 24 * 60
      const duration = slotEndMinutes - slotStartMinutes
      const elapsed = adjustedCurrent - slotStartMinutes
      return Math.round((elapsed / duration) * 100)
    }
  }

  const duration = slotEndMinutes - slotStartMinutes
  const elapsed = currentMinutes - slotStartMinutes
  return Math.round((elapsed / duration) * 100)
}

function minutesUntilNextPhase(hour: number, minute: number, slot: TimeSlot): number {
  const currentMinutes = hour * 60 + minute
  let slotEndMinutes = slot.end * 60

  // Handle overnight slots
  if (slot.start > slot.end && currentMinutes >= slot.start * 60) {
    slotEndMinutes += 24 * 60
  }

  return slotEndMinutes - currentMinutes
}

// ============================================
// MAIN CALCULATION
// ============================================

export function calculateShiftArc(context: ArcContext): ShiftArcState {
  const { now, dayOfWeek, majorEvents, rainExpectedIn, transitDisruptions } = context
  const hour = now.getHours()
  const minute = now.getMinutes()

  // Select rhythm based on day
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6
  const rhythm = isWeekend ? WEEKEND_RHYTHM : WEEKDAY_RHYTHM

  // Get base phase from time
  const currentSlot = getTimeSlot(hour, rhythm)
  const nextSlot = getNextSlot(currentSlot, rhythm)

  let phase = currentSlot.phase
  let energy = currentSlot.energy
  let phaseReason: string | undefined

  // Adjust for major events
  if (majorEvents && majorEvents.length > 0) {
    const now_ms = now.getTime()

    for (const event of majorEvents) {
      const eventEnd = new Date(event.ends_at).getTime()
      const eventStart = new Date(event.starts_at).getTime()
      const minutesUntilEnd = (eventEnd - now_ms) / (1000 * 60)
      const minutesSinceStart = (now_ms - eventStart) / (1000 * 60)

      // Event is happening and large → boost to peak
      if (minutesSinceStart > 0 && minutesUntilEnd > 0) {
        if (event.capacity === 'LARGE') {
          if (minutesUntilEnd <= 30) {
            // 30 min before end = peak
            phase = 'peak'
            energy = 'PEAK'
            phaseReason = `${event.name} finit bientôt`
          } else if (phase === 'calm') {
            phase = 'build'
            energy = 'BUILDING'
            phaseReason = `${event.name} en cours`
          }
        }
      }

      // Event ended within last 45 min → release
      if (minutesUntilEnd <= 0 && minutesUntilEnd >= -45) {
        if (event.capacity === 'LARGE' || event.capacity === 'MED') {
          phase = 'release'
          energy = 'DISPERSION'
          phaseReason = `Sortie ${event.name}`
        }
      }
    }
  }

  // Adjust for rain
  if (rainExpectedIn !== undefined && rainExpectedIn <= 60) {
    if (rainExpectedIn <= 15) {
      // Rain imminent → boost demand
      if (phase === 'calm') {
        phase = 'build'
        energy = 'BUILDING'
        phaseReason = phaseReason || 'Pluie imminente'
      }
    }
  }

  // Adjust for transit disruptions
  if (transitDisruptions && transitDisruptions.length > 0) {
    const severeDisruption = transitDisruptions.find(d => d.severity === 'HIGH')
    if (severeDisruption && phase === 'calm') {
      phase = 'build'
      energy = 'BUILDING'
      phaseReason = phaseReason || `Perturbation ${severeDisruption.line}`
    }
  }

  // Calculate progress and time to next
  const progress = calculatePhaseProgress(hour, minute, currentSlot)
  const minutesToNext = minutesUntilNextPhase(hour, minute, currentSlot)

  return {
    current_phase: phase,
    phase_progress: Math.min(100, Math.max(0, progress)),
    next_phase: nextSlot?.phase || null,
    next_phase_in_minutes: minutesToNext > 0 ? minutesToNext : null,
    phase_reason: phaseReason,
    energy
  }
}

// ============================================
// PHASE LABELS (French, ecological)
// ============================================

export const PHASE_LABELS: Record<ArcPhase, string> = {
  calm: 'Calme',
  build: 'Montée',
  peak: 'Pic',
  release: 'Dispersion'
}

export const PHASE_COLORS: Record<ArcPhase, string> = {
  calm: 'text-text-ghost',
  build: 'text-intent',
  peak: 'text-signal',
  release: 'text-calm'
}

export const PHASE_BG_COLORS: Record<ArcPhase, string> = {
  calm: 'bg-text-ghost/20',
  build: 'bg-intent/30',
  peak: 'bg-signal/30',
  release: 'bg-calm/30'
}

// ============================================
// MOCK FOR TESTING
// ============================================

export function getMockShiftArc(): ShiftArcState {
  return {
    current_phase: 'build',
    phase_progress: 65,
    next_phase: 'peak',
    next_phase_in_minutes: 42,
    phase_reason: 'Concert Bercy 21h',
    energy: 'RISING'
  }
}
