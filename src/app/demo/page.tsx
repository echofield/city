'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ArrowLeft, Play, Pause } from 'lucide-react'
import Link from 'next/link'
import { FlowDashboard } from '@/components/ui/flow-dashboard'
import { DispatchPanel } from '@/components/ui/dispatch-panel'
import type { ActionType } from '@/lib/flow-engine/driver-anchor'
import type { ShiftPhase, CorridorStatus } from '@/types/flow-view-model'

// ════════════════════════════════════════════════════════════════
// DEMO TIMELINE
// ════════════════════════════════════════════════════════════════

interface DemoStep {
  time: string
  action: ActionType
  zone: string
  arrondissement: string
  cause: string
  windowLabel: string
  secondsLeft: number
  phase: ShiftPhase
  corridor: string
  confidence: number
  stats: {
    eta: number
    saturation: number
    opportunite: number
    eurH: { low: number; high: number }
  }
  friction?: { label: string; implication: string }
  prochain?: { time: string; zone: string; type: string }
  opp?: number
  fric?: number
  cost?: number
  signals?: Array<{ label: string; type: 'amber' | 'green' | 'grey' }>
}

const DEMO_TIMELINE: DemoStep[] = [
  {
    time: '18:30',
    action: 'maintenir',
    zone: 'Opéra',
    arrondissement: 'IX',
    cause: 'Calme. Pas encore de demande significative.',
    windowLabel: 'PHASE CALME',
    secondsLeft: 0,
    phase: 'calme',
    corridor: 'CENTRE',
    confidence: 0.65,
    stats: { eta: 0, saturation: 12, opportunite: 45, eurH: { low: 18, high: 24 } },
  },
  {
    time: '19:15',
    action: 'anticiper',
    zone: 'Gare de Lyon',
    arrondissement: 'XII',
    cause: 'Fenêtre en formation. Premiers TGV arrivent.',
    windowLabel: 'EN FORMATION',
    secondsLeft: 720,
    phase: 'montee',
    corridor: 'SUD',
    confidence: 0.72,
    stats: { eta: 18, saturation: 28, opportunite: 68, eurH: { low: 22, high: 30 } },
    friction: { label: 'Trafic dense périph sud', implication: '+8 min' },
    prochain: { time: '19:45', zone: 'Bercy', type: 'concert' },
    opp: 68,
    fric: 35,
    cost: 18,
    signals: [
      { label: 'Arrivée TGV Lyon 19:32', type: 'amber' },
      { label: 'Concert Bercy 20:00', type: 'green' },
    ],
  },
  {
    time: '20:10',
    action: 'rejoindre',
    zone: 'Bercy',
    arrondissement: 'XII',
    cause: 'Concert AccorArena. Sortie dans 45 min.',
    windowLabel: 'FENÊTRE ACTIVE',
    secondsLeft: 480,
    phase: 'montee',
    corridor: 'SUD',
    confidence: 0.85,
    stats: { eta: 8, saturation: 42, opportunite: 82, eurH: { low: 28, high: 38 } },
    friction: { label: 'Pluie forte', implication: 'Demande +25%' },
    prochain: { time: '21:00', zone: 'Bastille', type: 'nightlife' },
    opp: 82,
    fric: 42,
    cost: 8,
    signals: [
      { label: 'Sortie concert AccorArena', type: 'green' },
      { label: 'Pluie demande accrue', type: 'amber' },
    ],
  },
  {
    time: '21:00',
    action: 'maintenir',
    zone: 'Bercy',
    arrondissement: 'XII',
    cause: 'Sortie concert imminente. Queue position active.',
    windowLabel: 'PIC',
    secondsLeft: 300,
    phase: 'pic',
    corridor: 'SUD',
    confidence: 0.92,
    stats: { eta: 0, saturation: 65, opportunite: 95, eurH: { low: 35, high: 48 } },
    opp: 95,
    fric: 65,
    cost: 0,
    signals: [
      { label: 'Sortie concert 21:15', type: 'green' },
      { label: 'Surge x1.8', type: 'green' },
    ],
  },
  {
    time: '22:25',
    action: 'anticiper',
    zone: 'Montmartre',
    arrondissement: 'XVIII',
    cause: 'Champ favorise nord.',
    windowLabel: 'EN FORMATION',
    secondsLeft: 130,
    phase: 'pic',
    corridor: 'NORD',
    confidence: 0.68,
    stats: { eta: 24, saturation: 19, opportunite: 90, eurH: { low: 25, high: 34 } },
    friction: { label: 'Pluie forte +15min', implication: 'Demande accrue centre' },
    prochain: { time: '23:15', zone: 'Bastille', type: 'concert' },
    opp: 90,
    fric: 43,
    cost: 12,
    signals: [
      { label: 'Sortie théâtre Châtelet', type: 'amber' },
      { label: 'Surge x1.4 Bastille', type: 'green' },
    ],
  },
  {
    time: '23:45',
    action: 'rejoindre',
    zone: 'Oberkampf',
    arrondissement: 'XI',
    cause: 'Transition. Nightlife se déplace vers Est.',
    windowLabel: 'FLUX EN MOUVEMENT',
    secondsLeft: 360,
    phase: 'pic',
    corridor: 'EST',
    confidence: 0.78,
    stats: { eta: 12, saturation: 55, opportunite: 78, eurH: { low: 30, high: 42 } },
    prochain: { time: '00:30', zone: 'République', type: 'dispersion' },
    opp: 78,
    fric: 55,
    cost: 12,
    signals: [
      { label: 'Fermeture bars 02:00', type: 'amber' },
      { label: 'Dernier métro 00:45', type: 'amber' },
    ],
  },
  {
    time: '00:30',
    action: 'tenter',
    zone: 'République',
    arrondissement: 'III',
    cause: 'Dispersion post-pic. Dernières fenêtres.',
    windowLabel: 'FENÊTRE SE FERME',
    secondsLeft: 180,
    phase: 'dispersion',
    corridor: 'EST',
    confidence: 0.62,
    stats: { eta: 6, saturation: 38, opportunite: 55, eurH: { low: 22, high: 32 } },
    opp: 55,
    fric: 38,
    cost: 6,
    signals: [
      { label: 'Dernière vague nightlife', type: 'amber' },
    ],
  },
]

const CORRIDOR_STATUSES: CorridorStatus[] = [
  { direction: 'nord', status: 'fluide', pressure: 0.3, reason: null },
  { direction: 'est', status: 'dense', pressure: 0.7, reason: null },
  { direction: 'sud', status: 'fluide', pressure: 0.4, reason: null },
  { direction: 'ouest', status: 'dense', pressure: 0.65, reason: 'PSG sortie' },
]

const TIMELINE_EVENTS = [
  { time: '03:41', phase: 'pic' as const, zone: 'Quartier Latin' },
  { time: '04:11', phase: 'dispersion' as const, zone: 'Châtelet' },
  { time: '04:41', phase: 'transition' as const, zone: 'Bastille' },
  { time: '05:11', phase: 'nuit' as const, zone: 'Trocadéro' },
]

// ════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════

export default function DemoPage() {
  const [currentIndex, setCurrentIndex] = useState(4) // Start at Montmartre step
  const [isPlaying, setIsPlaying] = useState(false)
  const [showDispatch, setShowDispatch] = useState(false)

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
    }, 5000)

    return () => clearInterval(timer)
  }, [isPlaying])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentIndex < DEMO_TIMELINE.length - 1) {
        setCurrentIndex(currentIndex + 1)
        setIsPlaying(false)
      }
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1)
        setIsPlaying(false)
      }
      if (e.key === ' ') {
        e.preventDefault()
        setIsPlaying(!isPlaying)
      }
      if (e.key === 'd' || e.key === 'D') {
        setShowDispatch(!showDispatch)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, isPlaying, showDispatch])

  return (
    <div className="min-h-screen bg-void relative">
      {/* Demo header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2 bg-void/80 backdrop-blur-sm border-b border-border-subtle">
        <Link
          href="/"
          className="p-1.5 rounded border border-border text-text-ghost hover:text-text-secondary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex items-center gap-4">
          <span className="text-sm text-text-ghost">Démo</span>
          <span className="text-lg text-text-primary font-mono">{current.time}</span>
        </div>

        {/* Timeline dots */}
        <div className="flex items-center gap-1.5">
          {DEMO_TIMELINE.map((_, index) => (
            <button
              key={index}
              onClick={() => { setCurrentIndex(index); setIsPlaying(false) }}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? 'bg-signal' :
                index < currentIndex ? 'bg-text-ghost/50' : 'bg-border'
              }`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded border border-border text-text-ghost hover:text-text-secondary transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main dashboard */}
      <div className="pt-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <FlowDashboard
              action={current.action}
              zone={current.zone}
              arrondissement={current.arrondissement}
              cause={current.cause}
              secondsLeft={current.secondsLeft}
              windowLabel={current.windowLabel}
              stats={current.stats}
              friction={current.friction}
              prochain={current.prochain}
              currentPhase={current.phase}
              corridor={current.corridor}
              confidence={current.confidence}
              eurEstimate={current.stats.eurH}
              opp={current.opp}
              fric={current.fric}
              cost={current.cost}
              signals={current.signals}
              corridorStatuses={CORRIDOR_STATUSES}
              onDispatch={() => setShowDispatch(true)}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* DISPATCH Panel */}
      <AnimatePresence>
        {showDispatch && (
          <DispatchPanel
            isOpen={showDispatch}
            onClose={() => setShowDispatch(false)}
            currentPhase={current.phase}
            session={{
              duration: '4m',
              rides: 1,
              targetEur: 120,
              currentEur: 2,
              efficiency: 59,
            }}
            corridorStatuses={CORRIDOR_STATUSES}
            timeline={TIMELINE_EVENTS}
          />
        )}
      </AnimatePresence>

      {/* Keyboard hints */}
      <div className="fixed bottom-4 left-4 text-xs text-text-ghost/50 space-y-1">
        <p>← → naviguer</p>
        <p>R mode radar</p>
        <p>D dispatch</p>
        <p>Espace play/pause</p>
      </div>

      {/* CTA */}
      <div className="fixed bottom-4 right-4">
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-signal text-void text-sm font-medium hover:bg-signal-dark transition-colors"
        >
          <span>Commencer</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
