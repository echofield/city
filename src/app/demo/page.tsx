'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ArrowLeft, Play, Pause } from 'lucide-react'
import Link from 'next/link'
import { ShiftArc } from '@/components/ui/shift-arc'
import type { ArcPhase } from '@/lib/shift-conductor/shift-arc'

// Demo shift timeline - a simulated evening
const DEMO_TIMELINE = [
  {
    time: '18:30',
    phase: 'calm' as ArcPhase,
    phase_progress: 80,
    state: 'RESET',
    zone: null,
    message: 'Calme. Pas encore de demande significative.',
    action: null,
    energy: 'CALM',
  },
  {
    time: '19:15',
    phase: 'build' as ArcPhase,
    phase_progress: 25,
    state: 'WINDOW_OPENING',
    zone: 'Gare de Lyon',
    message: 'Fenêtre en formation. Premiers signaux.',
    action: 'Se positionner',
    energy: 'BUILDING',
  },
  {
    time: '20:10',
    phase: 'build' as ArcPhase,
    phase_progress: 70,
    state: 'WINDOW_ACTIVE',
    zone: 'Bercy',
    message: 'Concert AccorArena. Sortie dans 45 min.',
    action: 'Arriver maintenant',
    energy: 'RISING',
  },
  {
    time: '21:00',
    phase: 'peak' as ArcPhase,
    phase_progress: 20,
    state: 'HOLD_POSITION',
    zone: 'Bercy',
    message: 'Sortie concert imminente. Queue position active.',
    action: 'Tenir position',
    energy: 'PEAK',
  },
  {
    time: '22:25',
    phase: 'peak' as ArcPhase,
    phase_progress: 60,
    state: 'WINDOW_ACTIVE',
    zone: 'Bastille',
    message: 'Fenêtre active. Flux nightlife en cours.',
    action: 'Zone chaude',
    energy: 'PEAK',
  },
  {
    time: '23:45',
    phase: 'peak' as ArcPhase,
    phase_progress: 90,
    state: 'FLOW_SHIFT',
    zone: 'Oberkampf',
    message: 'Transition. Nightlife se déplace vers l\'Est.',
    action: 'Suivre le flux',
    energy: 'PEAK',
  },
  {
    time: '00:30',
    phase: 'release' as ArcPhase,
    phase_progress: 40,
    state: 'WINDOW_CLOSING',
    zone: 'République',
    message: 'Dispersion post-pic. Dernières fenêtres.',
    action: 'Dernière vague',
    energy: 'DISPERSION',
  },
]

const STATE_LABELS: Record<string, string> = {
  RESET: 'Phase calme',
  WINDOW_OPENING: 'Fenêtre en formation',
  WINDOW_ACTIVE: 'Fenêtre active',
  HOLD_POSITION: 'Tenir position',
  FLOW_SHIFT: 'Flux en mouvement',
  WINDOW_CLOSING: 'Fenêtre se ferme',
}

const STATE_COLORS: Record<string, string> = {
  RESET: 'text-text-ghost',
  WINDOW_OPENING: 'text-intent',
  WINDOW_ACTIVE: 'text-signal',
  HOLD_POSITION: 'text-calm',
  FLOW_SHIFT: 'text-signal',
  WINDOW_CLOSING: 'text-alert-muted',
}

export default function DemoPage() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const current = DEMO_TIMELINE[currentIndex]

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying) return

    const timer = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= DEMO_TIMELINE.length - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 3000) // 3 seconds per step

    return () => clearInterval(timer)
  }, [isPlaying])

  const goNext = () => {
    if (currentIndex < DEMO_TIMELINE.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  return (
    <div className="min-h-screen bg-void">
      {/* Header */}
      <header className="border-b border-border-subtle sticky top-0 bg-void/95 backdrop-blur-sm z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="p-1.5 rounded border border-border text-text-ghost hover:text-text-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="text-center">
            <h1 className="text-sm text-text-primary">Démo</h1>
            <p className="text-xs text-text-ghost">Une soirée type</p>
          </div>
          <div className="w-8" /> {/* Spacer */}
        </div>
      </header>

      {/* Shift Arc */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <ShiftArc
          arc={{
            current_phase: current.phase,
            phase_progress: current.phase_progress,
            next_phase: currentIndex < DEMO_TIMELINE.length - 1
              ? DEMO_TIMELINE[currentIndex + 1].phase
              : null,
            next_phase_in_minutes: currentIndex < DEMO_TIMELINE.length - 1 ? 45 : null,
            energy: current.energy as any,
          }}
        />
      </div>

      {/* Main Demo Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Time indicator */}
        <div className="text-center mb-8">
          <motion.p
            key={current.time}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-5xl font-light text-text-primary"
          >
            {current.time}
          </motion.p>
        </div>

        {/* Current State Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="p-6 rounded-xl bg-surface border border-border-subtle mb-6"
          >
            {/* State indicator */}
            <div className="flex items-center gap-2 mb-4">
              <span className={`w-2 h-2 rounded-full ${
                current.state === 'WINDOW_ACTIVE' ? 'bg-signal animate-pulse' :
                current.state === 'HOLD_POSITION' ? 'bg-calm' :
                current.state === 'WINDOW_OPENING' ? 'bg-intent' :
                'bg-text-ghost'
              }`} />
              <span className={`text-xs uppercase tracking-wider ${STATE_COLORS[current.state]}`}>
                {STATE_LABELS[current.state]}
              </span>
            </div>

            {/* Zone */}
            {current.zone ? (
              <p className={`text-3xl font-light mb-2 ${STATE_COLORS[current.state]}`}>
                {current.zone}
              </p>
            ) : (
              <p className="text-3xl font-light mb-2 text-text-ghost">
                Pas de cible
              </p>
            )}

            {/* Message */}
            <p className="text-text-secondary mb-4">
              {current.message}
            </p>

            {/* Action */}
            {current.action && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-signal/10 border border-signal/20">
                <span className="text-signal text-sm">{current.action}</span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Timeline dots */}
        <div className="flex justify-center gap-2 mb-8">
          {DEMO_TIMELINE.map((_, index) => (
            <button
              key={index}
              onClick={() => { setCurrentIndex(index); setIsPlaying(false) }}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? 'bg-signal' :
                index < currentIndex ? 'bg-text-ghost' : 'bg-border'
              }`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="p-3 rounded-lg border border-border text-text-ghost hover:text-text-secondary disabled:opacity-30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <button
            onClick={togglePlay}
            className="p-4 rounded-lg bg-signal text-void hover:bg-signal-dark transition-colors"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          <button
            onClick={goNext}
            disabled={currentIndex === DEMO_TIMELINE.length - 1}
            className="p-3 rounded-lg border border-border text-text-ghost hover:text-text-secondary disabled:opacity-30 transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Explanation */}
        <div className="mt-12 p-4 rounded-lg bg-surface-raised border border-border-subtle">
          <p className="text-sm text-text-secondary text-center">
            Cette démo simule une soirée complète.
            <br />
            <span className="text-text-ghost">Flow te montre le rythme en temps réel.</span>
          </p>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-signal text-void font-medium hover:bg-signal-dark transition-colors"
          >
            <span>Commencer avec Flow</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  )
}
