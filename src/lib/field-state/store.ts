// ============================================
// FIELD STATE STORE (Zustand)
// ============================================
// Single source of truth for field visualization.
// Both onboarding and dashboard read from here.
// ============================================

import { create } from 'zustand'
import {
  FieldState,
  ZoneState,
  CorridorState,
  FieldRhythm,
  FieldReadability,
  createInitialFieldState,
  createEmptyZoneState,
} from './types'
import { PARIS_ZONES, buildCorridors, getZoneById } from './paris-zones'

// ════════════════════════════════════════
// STORE INTERFACE
// ════════════════════════════════════════

interface FieldStateStore {
  // The complete field state
  state: FieldState

  // ── Zone Actions ──
  setZoneIntensity: (zoneId: string, intensity: number) => void
  setZonePhase: (zoneId: string, phase: ZoneState['phase']) => void
  setZoneVolatility: (zoneId: string, volatility: number) => void
  updateZone: (zoneId: string, updates: Partial<ZoneState>) => void

  // ── Corridor Actions ──
  setCorridorStrength: (from: string, to: string, strength: number) => void
  setCorridorRecommended: (from: string, to: string, recommended: boolean) => void

  // ── Rhythm Actions ──
  setBreathCycle: (seconds: number) => void
  setBreathPhase: (phase: number) => void
  setEnergy: (energy: FieldRhythm['energy']) => void
  tickBreath: (deltaMs: number) => void

  // ── Readability Actions (Progressive Reveal) ──
  setReadabilityLevel: (level: number) => void
  revealZones: () => void
  revealCorridors: () => void
  revealRhythm: () => void
  revealLabels: () => void
  illuminateCategory: (category: keyof FieldReadability['illuminated']) => void
  dimCategory: (category: keyof FieldReadability['illuminated']) => void

  // ── Driver Context Actions ──
  setCurrentZone: (zoneId: string | null) => void
  addSelectedZone: (zoneId: string) => void
  removeSelectedZone: (zoneId: string) => void
  setSelectedZones: (zoneIds: string[]) => void
  setMovementStyle: (style: 'patient' | 'active' | 'balanced' | null) => void
  setShiftPreference: (pref: 'day' | 'evening' | 'night' | null) => void

  // ── Bulk Actions ──
  initializeZones: () => void
  applyCalibration: () => void
  reset: () => void
}

// ════════════════════════════════════════
// STORE IMPLEMENTATION
// ════════════════════════════════════════

export const useFieldState = create<FieldStateStore>((set, get) => ({
  state: createInitialFieldState(),

  // ── Zone Actions ──
  setZoneIntensity: (zoneId, intensity) => {
    set((s) => {
      const zones = new Map(s.state.zones)
      const zone = zones.get(zoneId) ?? createEmptyZoneState(zoneId)
      zones.set(zoneId, { ...zone, intensity: Math.max(0, Math.min(1, intensity)) })
      return { state: { ...s.state, zones, timestamp: Date.now() } }
    })
  },

  setZonePhase: (zoneId, phase) => {
    set((s) => {
      const zones = new Map(s.state.zones)
      const zone = zones.get(zoneId) ?? createEmptyZoneState(zoneId)
      zones.set(zoneId, { ...zone, phase })
      return { state: { ...s.state, zones, timestamp: Date.now() } }
    })
  },

  setZoneVolatility: (zoneId, volatility) => {
    set((s) => {
      const zones = new Map(s.state.zones)
      const zone = zones.get(zoneId) ?? createEmptyZoneState(zoneId)
      zones.set(zoneId, { ...zone, volatility: Math.max(0, Math.min(1, volatility)) })
      return { state: { ...s.state, zones, timestamp: Date.now() } }
    })
  },

  updateZone: (zoneId, updates) => {
    set((s) => {
      const zones = new Map(s.state.zones)
      const zone = zones.get(zoneId) ?? createEmptyZoneState(zoneId)
      zones.set(zoneId, { ...zone, ...updates })
      return { state: { ...s.state, zones, timestamp: Date.now() } }
    })
  },

  // ── Corridor Actions ──
  setCorridorStrength: (from, to, strength) => {
    set((s) => {
      const corridors = s.state.corridors.map((c) => {
        if ((c.from === from && c.to === to) || (c.from === to && c.to === from)) {
          return { ...c, strength: Math.max(0, Math.min(1, strength)) }
        }
        return c
      })
      return { state: { ...s.state, corridors, timestamp: Date.now() } }
    })
  },

  setCorridorRecommended: (from, to, recommended) => {
    set((s) => {
      const corridors = s.state.corridors.map((c) => {
        if ((c.from === from && c.to === to) || (c.from === to && c.to === from)) {
          return { ...c, recommended }
        }
        return c
      })
      return { state: { ...s.state, corridors, timestamp: Date.now() } }
    })
  },

  // ── Rhythm Actions ──
  setBreathCycle: (seconds) => {
    set((s) => ({
      state: {
        ...s.state,
        rhythm: { ...s.state.rhythm, breathCycle: Math.max(0.5, Math.min(4, seconds)) },
        timestamp: Date.now(),
      },
    }))
  },

  setBreathPhase: (phase) => {
    set((s) => ({
      state: {
        ...s.state,
        rhythm: { ...s.state.rhythm, breathPhase: phase % 1 },
        timestamp: Date.now(),
      },
    }))
  },

  setEnergy: (energy) => {
    set((s) => ({
      state: {
        ...s.state,
        rhythm: { ...s.state.rhythm, energy },
        timestamp: Date.now(),
      },
    }))
  },

  tickBreath: (deltaMs) => {
    set((s) => {
      const { breathCycle, breathPhase } = s.state.rhythm
      const increment = deltaMs / 1000 / breathCycle
      return {
        state: {
          ...s.state,
          rhythm: { ...s.state.rhythm, breathPhase: (breathPhase + increment) % 1 },
        },
      }
    })
  },

  // ── Readability Actions ──
  setReadabilityLevel: (level) => {
    set((s) => ({
      state: {
        ...s.state,
        readability: { ...s.state.readability, level: Math.max(0, Math.min(1, level)) },
        timestamp: Date.now(),
      },
    }))
  },

  revealZones: () => {
    set((s) => ({
      state: {
        ...s.state,
        readability: { ...s.state.readability, zones: true },
        timestamp: Date.now(),
      },
    }))
  },

  revealCorridors: () => {
    set((s) => ({
      state: {
        ...s.state,
        readability: { ...s.state.readability, corridors: true },
        timestamp: Date.now(),
      },
    }))
  },

  revealRhythm: () => {
    set((s) => ({
      state: {
        ...s.state,
        readability: { ...s.state.readability, rhythm: true },
        timestamp: Date.now(),
      },
    }))
  },

  revealLabels: () => {
    set((s) => ({
      state: {
        ...s.state,
        readability: { ...s.state.readability, labels: true },
        timestamp: Date.now(),
      },
    }))
  },

  illuminateCategory: (category) => {
    set((s) => ({
      state: {
        ...s.state,
        readability: {
          ...s.state.readability,
          illuminated: { ...s.state.readability.illuminated, [category]: true },
        },
        timestamp: Date.now(),
      },
    }))
  },

  dimCategory: (category) => {
    set((s) => ({
      state: {
        ...s.state,
        readability: {
          ...s.state.readability,
          illuminated: { ...s.state.readability.illuminated, [category]: false },
        },
        timestamp: Date.now(),
      },
    }))
  },

  // ── Driver Context Actions ──
  setCurrentZone: (zoneId) => {
    set((s) => ({
      state: {
        ...s.state,
        driverContext: { ...s.state.driverContext, currentZone: zoneId },
        timestamp: Date.now(),
      },
    }))
  },

  addSelectedZone: (zoneId) => {
    set((s) => {
      const selected = s.state.driverContext.selectedZones
      if (selected.includes(zoneId)) return s
      return {
        state: {
          ...s.state,
          driverContext: {
            ...s.state.driverContext,
            selectedZones: [...selected, zoneId],
          },
          timestamp: Date.now(),
        },
      }
    })
  },

  removeSelectedZone: (zoneId) => {
    set((s) => ({
      state: {
        ...s.state,
        driverContext: {
          ...s.state.driverContext,
          selectedZones: s.state.driverContext.selectedZones.filter((id) => id !== zoneId),
        },
        timestamp: Date.now(),
      },
    }))
  },

  setSelectedZones: (zoneIds) => {
    set((s) => ({
      state: {
        ...s.state,
        driverContext: { ...s.state.driverContext, selectedZones: zoneIds },
        timestamp: Date.now(),
      },
    }))
  },

  setMovementStyle: (style) => {
    set((s) => ({
      state: {
        ...s.state,
        driverContext: { ...s.state.driverContext, movementStyle: style },
        timestamp: Date.now(),
      },
    }))
  },

  setShiftPreference: (pref) => {
    set((s) => ({
      state: {
        ...s.state,
        driverContext: { ...s.state.driverContext, shiftPreference: pref },
        timestamp: Date.now(),
      },
    }))
  },

  // ── Bulk Actions ──
  initializeZones: () => {
    set((s) => {
      const zones = new Map<string, ZoneState>()
      const corridors: CorridorState[] = []

      // Initialize all zones from definitions
      for (const def of PARIS_ZONES) {
        zones.set(def.id, createEmptyZoneState(def.id))
      }

      // Initialize all corridors
      for (const { from, to } of buildCorridors()) {
        corridors.push({
          from,
          to,
          strength: 0,
          direction: 0,
          recommended: false,
        })
      }

      return {
        state: {
          ...s.state,
          zones,
          corridors,
          timestamp: Date.now(),
        },
      }
    })
  },

  applyCalibration: () => {
    // Apply driver context to zone intensities
    const { state } = get()
    const { shiftPreference, selectedZones, movementStyle } = state.driverContext
    const zones = new Map(state.zones)

    for (const def of PARIS_ZONES) {
      const zone = zones.get(def.id) ?? createEmptyZoneState(def.id)
      let intensity = 0.1 // Base dim

      // Apply shift preference
      if (shiftPreference === 'night') {
        intensity = Math.max(intensity, def.intensity.nightlife * 0.8)
      } else if (shiftPreference === 'evening') {
        intensity = Math.max(intensity, def.intensity.nightlife * 0.6)
        intensity = Math.max(intensity, def.intensity.event * 0.5)
      } else if (shiftPreference === 'day') {
        intensity = Math.max(intensity, def.intensity.business * 0.7)
        intensity = Math.max(intensity, def.intensity.transit * 0.6)
      }

      // Boost selected zones
      if (selectedZones.includes(def.id)) {
        intensity = Math.max(intensity, 0.9)
      }

      // Determine phase based on intensity
      let phase: ZoneState['phase'] = 'dormant'
      if (intensity > 0.7) phase = 'active'
      else if (intensity > 0.4) phase = 'forming'
      else if (intensity > 0.15) phase = 'echo'

      // Apply movement style to volatility
      let volatility = 0.3 // Default
      if (movementStyle === 'active') volatility = 0.7
      else if (movementStyle === 'patient') volatility = 0.15

      zones.set(def.id, {
        ...zone,
        intensity,
        phase,
        volatility,
        confidence: selectedZones.includes(def.id) ? 0.9 : 0.5,
      })
    }

    // Update corridors based on selected zones
    const corridors = state.corridors.map((c) => {
      const fromSelected = selectedZones.includes(c.from)
      const toSelected = selectedZones.includes(c.to)

      if (fromSelected && toSelected) {
        return { ...c, strength: 0.7, recommended: true }
      } else if (fromSelected || toSelected) {
        return { ...c, strength: 0.3, recommended: false }
      }
      return { ...c, strength: 0, recommended: false }
    })

    // Apply movement style to rhythm
    let breathCycle = 2 // Default
    if (movementStyle === 'active') breathCycle = 1
    else if (movementStyle === 'patient') breathCycle = 3

    set({
      state: {
        ...state,
        zones,
        corridors,
        rhythm: { ...state.rhythm, breathCycle },
        timestamp: Date.now(),
      },
    })
  },

  reset: () => {
    set({ state: createInitialFieldState() })
  },
}))

// ════════════════════════════════════════
// SELECTOR HOOKS
// ════════════════════════════════════════

export const useZone = (zoneId: string) =>
  useFieldState((s) => s.state.zones.get(zoneId))

export const useCorridors = () =>
  useFieldState((s) => s.state.corridors)

export const useRhythm = () =>
  useFieldState((s) => s.state.rhythm)

export const useReadability = () =>
  useFieldState((s) => s.state.readability)

export const useDriverContext = () =>
  useFieldState((s) => s.state.driverContext)
