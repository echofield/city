'use client'

// ============================================
// ONBOARDING — Field Calibration
// ============================================
// Not a questionnaire. A calibration ritual.
// The driver gains perception, not finishes setup.
//
// Progressive Reveal:
// - Start: city almost dark
// - Each step: city becomes more readable
// - End: "La ville devient lisible"
// ============================================

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { ParisFieldMap } from '@/components/map'
import { useFieldState } from '@/lib/field-state'

// ════════════════════════════════════════
// TYPES
// ════════════════════════════════════════

type ShiftPreference = 'day' | 'evening' | 'night'
type MovementStyle = 'patient' | 'active' | 'balanced'

interface CalibrationState {
  step: number
  shift: ShiftPreference | null
  style: MovementStyle | null
}

const TOTAL_STEPS = 4

// ════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════

export default function OnboardingPage() {
  const router = useRouter()
  const [state, setState] = useState<CalibrationState>({
    step: 0,
    shift: null,
    style: null,
  })

  // ── Field State Store ──
  const initializeZones = useFieldState((s) => s.initializeZones)
  const setShiftPreference = useFieldState((s) => s.setShiftPreference)
  const setMovementStyle = useFieldState((s) => s.setMovementStyle)
  const addSelectedZone = useFieldState((s) => s.addSelectedZone)
  const removeSelectedZone = useFieldState((s) => s.removeSelectedZone)
  const selectedZones = useFieldState((s) => s.state.driverContext.selectedZones)
  const applyCalibration = useFieldState((s) => s.applyCalibration)

  // ── Readability Controls ──
  const setReadabilityLevel = useFieldState((s) => s.setReadabilityLevel)
  const revealZones = useFieldState((s) => s.revealZones)
  const revealCorridors = useFieldState((s) => s.revealCorridors)
  const revealRhythm = useFieldState((s) => s.revealRhythm)
  const revealLabels = useFieldState((s) => s.revealLabels)
  const illuminateCategory = useFieldState((s) => s.illuminateCategory)
  const setBreathCycle = useFieldState((s) => s.setBreathCycle)

  // ── Initialize on mount ──
  useEffect(() => {
    initializeZones()
    // Start very dim - city almost dark
    setReadabilityLevel(0.1)
  }, [initializeZones, setReadabilityLevel])

  // ── Progressive Reveal based on step ──
  useEffect(() => {
    switch (state.step) {
      case 0:
        // Time preference - show zones faintly
        setReadabilityLevel(0.2)
        revealZones()
        break
      case 1:
        // Zone selection - zones visible, interactive
        setReadabilityLevel(0.5)
        revealLabels()
        break
      case 2:
        // Movement style - corridors appear, rhythm starts
        setReadabilityLevel(0.7)
        revealCorridors()
        revealRhythm()
        break
      case 3:
        // Ready - full clarity
        setReadabilityLevel(1.0)
        applyCalibration()
        break
    }
  }, [state.step, setReadabilityLevel, revealZones, revealLabels, revealCorridors, revealRhythm, applyCalibration])

  // ── Shift preference change ──
  const handleShiftChange = useCallback(
    (shift: ShiftPreference) => {
      setState((s) => ({ ...s, shift }))
      setShiftPreference(shift)

      // Illuminate relevant categories
      if (shift === 'night') {
        illuminateCategory('nightlife')
        setBreathCycle(1.5) // Faster rhythm for night
      } else if (shift === 'evening') {
        illuminateCategory('nightlife')
        illuminateCategory('event')
        setBreathCycle(2)
      } else {
        illuminateCategory('business')
        illuminateCategory('transit')
        setBreathCycle(2.5) // Slower rhythm for day
      }

      applyCalibration()
    },
    [setShiftPreference, illuminateCategory, setBreathCycle, applyCalibration]
  )

  // ── Movement style change ──
  const handleStyleChange = useCallback(
    (style: MovementStyle) => {
      setState((s) => ({ ...s, style }))
      setMovementStyle(style)

      // Adjust breath cycle based on style
      if (style === 'active') {
        setBreathCycle(1) // Fast breath
      } else if (style === 'patient') {
        setBreathCycle(3) // Slow breath
      } else {
        setBreathCycle(2) // Balanced
      }

      applyCalibration()
    },
    [setMovementStyle, setBreathCycle, applyCalibration]
  )

  // ── Zone toggle ──
  const handleZoneClick = useCallback(
    (zoneId: string) => {
      if (state.step !== 1) return // Only in zone selection step

      if (selectedZones.includes(zoneId)) {
        removeSelectedZone(zoneId)
      } else {
        addSelectedZone(zoneId)
      }
      applyCalibration()
    },
    [state.step, selectedZones, addSelectedZone, removeSelectedZone, applyCalibration]
  )

  // ── Navigation ──
  const canProceed = () => {
    switch (state.step) {
      case 0: return state.shift !== null
      case 1: return selectedZones.length >= 2
      case 2: return state.style !== null
      case 3: return true
      default: return false
    }
  }

  const handleNext = () => {
    if (state.step < TOTAL_STEPS - 1) {
      setState((s) => ({ ...s, step: s.step + 1 }))
    } else {
      // Save calibration and go to activation
      localStorage.setItem('flow_calibration', JSON.stringify({
        shift: state.shift,
        style: state.style,
        zones: selectedZones,
      }))
      router.push('/activate')
    }
  }

  const handleBack = () => {
    if (state.step > 0) {
      setState((s) => ({ ...s, step: s.step - 1 }))
    }
  }

  return (
    <div className="min-h-screen bg-void flex flex-col">
      {/* ── Header ── */}
      <header className="px-4 py-3 border-b border-border-subtle">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-text-ghost text-sm hover:text-text-secondary transition-colors"
          >
            Flow
          </Link>
          <span className="text-xs text-text-ghost uppercase tracking-wider">
            Calibration
          </span>
        </div>
      </header>

      {/* ── Progress Bar ── */}
      <div className="px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-1">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-0.5 flex-1 rounded-full transition-all duration-700 ${
                i <= state.step ? 'bg-signal' : 'bg-border'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col">
        {/* ── Field Map ── */}
        <div className="flex-1 relative">
          <ParisFieldMap
            interactive={state.step === 1}
            onZoneClick={handleZoneClick}
            className="absolute inset-0"
          />

          {/* ── Field Caption ── */}
          <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
            <FieldCaption step={state.step} selectedCount={selectedZones.length} />
          </div>
        </div>

        {/* ── Control Panel ── */}
        <div className="border-t border-border-subtle bg-surface/80 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <AnimatePresence mode="wait">
              {state.step === 0 && (
                <StepTimePreference
                  key="step-0"
                  value={state.shift}
                  onChange={handleShiftChange}
                />
              )}
              {state.step === 1 && (
                <StepZoneSelection key="step-1" count={selectedZones.length} />
              )}
              {state.step === 2 && (
                <StepMovementStyle
                  key="step-2"
                  value={state.style}
                  onChange={handleStyleChange}
                />
              )}
              {state.step === 3 && (
                <StepFieldReady key="step-3" />
              )}
            </AnimatePresence>

            {/* ── Actions ── */}
            <div className="mt-4 flex gap-3">
              {state.step > 0 && (
                <button
                  onClick={handleBack}
                  className="px-4 py-2.5 rounded-lg border border-border text-text-ghost hover:text-text-secondary transition-colors text-sm"
                >
                  Retour
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-signal text-void font-medium hover:bg-signal-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
              >
                <span>{state.step === TOTAL_STEPS - 1 ? 'Activer' : 'Continuer'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// ════════════════════════════════════════
// FIELD CAPTION — Live feedback
// ════════════════════════════════════════

function FieldCaption({ step, selectedCount }: { step: number; selectedCount: number }) {
  const captions = [
    {
      main: 'Le champ attend ta préférence',
      sub: 'Choisis ton créneau pour révéler les zones',
    },
    {
      main: selectedCount === 0
        ? 'Touche tes zones familières'
        : `${selectedCount} zone${selectedCount > 1 ? 's' : ''} sélectionnée${selectedCount > 1 ? 's' : ''}`,
      sub: selectedCount < 2 ? 'Minimum 2 zones' : 'Les corridors se forment',
    },
    {
      main: 'Le rythme attend ton style',
      sub: 'La respiration du champ va s\'adapter',
    },
    {
      main: 'Champ calibré',
      sub: 'La ville devient lisible',
    },
  ]

  const caption = captions[step]

  return (
    <motion.div
      key={`${step}-${selectedCount}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="text-center"
    >
      <p className="text-sm text-text-primary">{caption.main}</p>
      <p className="text-xs text-text-ghost">{caption.sub}</p>
    </motion.div>
  )
}

// ════════════════════════════════════════
// STEP COMPONENTS
// ════════════════════════════════════════

function StepTimePreference({
  value,
  onChange,
}: {
  value: ShiftPreference | null
  onChange: (v: ShiftPreference) => void
}) {
  const options: { id: ShiftPreference; label: string; sub: string }[] = [
    { id: 'evening', label: 'Soir', sub: '18h - 2h' },
    { id: 'night', label: 'Nuit', sub: '22h - 6h' },
    { id: 'day', label: 'Journée', sub: '6h - 18h' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <p className="text-xs text-text-ghost uppercase tracking-wider mb-3">
        Quand travailles-tu ?
      </p>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`flex-1 p-3 rounded-lg border transition-all duration-300 ${
              value === opt.id
                ? 'border-signal bg-signal/10'
                : 'border-border hover:border-text-ghost'
            }`}
          >
            <p className={`text-sm ${value === opt.id ? 'text-signal' : 'text-text-primary'}`}>
              {opt.label}
            </p>
            <p className="text-xs text-text-ghost">{opt.sub}</p>
          </button>
        ))}
      </div>
    </motion.div>
  )
}

function StepZoneSelection({ count }: { count: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <p className="text-xs text-text-ghost uppercase tracking-wider mb-2">
        Tes zones familières
      </p>
      <p className="text-sm text-text-secondary">
        {count < 2
          ? 'Touche les zones que tu connais bien. Minimum 2.'
          : `${count} zones sélectionnées. Les corridors se forment.`}
      </p>
    </motion.div>
  )
}

function StepMovementStyle({
  value,
  onChange,
}: {
  value: MovementStyle | null
  onChange: (v: MovementStyle) => void
}) {
  const options: { id: MovementStyle; label: string; sub: string }[] = [
    { id: 'patient', label: 'Attendre', sub: 'Fenêtres confirmées' },
    { id: 'active', label: 'Bouger', sub: 'Flux continu' },
    { id: 'balanced', label: 'Équilibre', sub: 'Adaptatif' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <p className="text-xs text-text-ghost uppercase tracking-wider mb-3">
        Ton style de mouvement
      </p>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`flex-1 p-3 rounded-lg border transition-all duration-300 ${
              value === opt.id
                ? 'border-signal bg-signal/10'
                : 'border-border hover:border-text-ghost'
            }`}
          >
            <p className={`text-sm ${value === opt.id ? 'text-signal' : 'text-text-primary'}`}>
              {opt.label}
            </p>
            <p className="text-xs text-text-ghost">{opt.sub}</p>
          </button>
        ))}
      </div>
    </motion.div>
  )
}

function StepFieldReady() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="text-center"
    >
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-signal animate-pulse" />
        <p className="text-signal text-sm">Calibration terminée</p>
      </div>
      <p className="text-text-ghost text-sm">
        Le champ est prêt. La ville devient lisible.
      </p>
    </motion.div>
  )
}
