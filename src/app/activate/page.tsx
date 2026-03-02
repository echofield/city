'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Volume2, VolumeX } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ShiftArc } from '@/components/ui/shift-arc'
import { getMockShiftArc } from '@/lib/shift-conductor/shift-arc'

// Audio briefing text (would be TTS in production)
const BRIEFING_TEXT = `
Ce soir, le champ est calme jusqu'à 20h.
Première fenêtre attendue vers Gare de Lyon.
Concert Bercy à 21h, sortie prévue 23h15.
Reste en observation. Je t'alerte quand bouger.
`

export default function ActivatePage() {
  const [phase, setPhase] = useState<'ready' | 'briefing' | 'activated'>('ready')
  const [isMuted, setIsMuted] = useState(false)
  const [briefingProgress, setBriefingProgress] = useState(0)
  const router = useRouter()
  const shiftArc = getMockShiftArc()

  // Simulate audio briefing
  useEffect(() => {
    if (phase !== 'briefing') return

    const duration = 4000 // 4 seconds for demo
    const interval = 50
    let elapsed = 0

    const timer = setInterval(() => {
      elapsed += interval
      setBriefingProgress((elapsed / duration) * 100)

      if (elapsed >= duration) {
        clearInterval(timer)
        setPhase('activated')
      }
    }, interval)

    return () => clearInterval(timer)
  }, [phase])

  // Redirect to dashboard after activation
  useEffect(() => {
    if (phase === 'activated') {
      const timer = setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [phase, router])

  const startShift = () => {
    setPhase('briefing')
  }

  return (
    <div className="min-h-screen bg-void flex flex-col">
      {/* Header */}
      <header className="px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <span className="text-text-ghost text-sm">Flow</span>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded border border-border text-text-ghost"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 flex flex-col items-center justify-center">
        <div className="max-w-lg w-full">
          <AnimatePresence mode="wait">
            {/* PHASE 1: READY */}
            {phase === 'ready' && (
              <motion.div
                key="ready"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                {/* Arc preview */}
                <div className="mb-8">
                  <ShiftArc arc={shiftArc} />
                </div>

                <h1 className="text-2xl text-text-primary mb-4">
                  Prêt à démarrer ta nuit ?
                </h1>

                <p className="text-text-ghost mb-8">
                  Flow va analyser le champ et te donner un briefing de 15 secondes.
                </p>

                <button
                  onClick={startShift}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-signal text-void font-medium hover:bg-signal-dark transition-colors"
                >
                  <Play className="w-5 h-5" />
                  <span>Démarrer ma nuit</span>
                </button>
              </motion.div>
            )}

            {/* PHASE 2: BRIEFING */}
            {phase === 'briefing' && (
              <motion.div
                key="briefing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                {/* Audio indicator */}
                <div className="w-20 h-20 rounded-full bg-signal/10 border border-signal/30 flex items-center justify-center mx-auto mb-8">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-4 h-4 rounded-full bg-signal"
                  />
                </div>

                <p className="text-xs text-text-ghost uppercase tracking-wider mb-4">
                  Briefing en cours
                </p>

                {/* Briefing text */}
                <div className="p-4 rounded-lg bg-surface border border-border-subtle text-left mb-6">
                  <p className="text-text-secondary leading-relaxed whitespace-pre-line">
                    {BRIEFING_TEXT.trim()}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-border rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-signal"
                    initial={{ width: 0 }}
                    animate={{ width: `${briefingProgress}%` }}
                  />
                </div>
              </motion.div>
            )}

            {/* PHASE 3: ACTIVATED */}
            {phase === 'activated' && (
              <motion.div
                key="activated"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                {/* Success indicator */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="w-20 h-20 rounded-full bg-signal/20 border border-signal flex items-center justify-center mx-auto mb-8"
                >
                  <span className="w-4 h-4 rounded-full bg-signal" />
                </motion.div>

                <h2 className="text-2xl text-text-primary mb-4">
                  Shift activé
                </h2>

                {/* First instruction - CALM */}
                <div className="p-6 rounded-xl bg-surface border border-calm/20 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-calm" />
                    <span className="text-xs text-calm uppercase tracking-wider">
                      Phase calme
                    </span>
                  </div>

                  <p className="text-xl text-text-primary mb-2">
                    Tenir position
                  </p>

                  <p className="text-text-ghost">
                    Pas de fenêtre active. Reste en observation.
                    <br />
                    Je t'alerte au prochain mouvement.
                  </p>
                </div>

                <p className="text-sm text-text-ghost">
                  Redirection vers le dashboard...
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
