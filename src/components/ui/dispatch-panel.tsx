'use client'

import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { ShiftPhase, CorridorStatus } from '@/types/flow-view-model'

// ════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════

export interface SessionStats {
  duration: string // "4m"
  rides: number
  targetEur: number
  currentEur: number
  efficiency: number // 0-100
}

export interface TimelineEvent {
  time: string // "03:41"
  phase: 'pic' | 'dispersion' | 'transition' | 'nuit'
  zone: string
}

export interface DispatchPanelProps {
  isOpen: boolean
  onClose: () => void
  currentPhase?: ShiftPhase
  session?: SessionStats
  corridorStatuses?: CorridorStatus[]
  timeline?: TimelineEvent[]
}

// ════════════════════════════════════════════════════════════════
// PHASE LABELS
// ════════════════════════════════════════════════════════════════

// FLOW vocabulary — feels alive, not analytical
const PHASE_LABELS: Record<ShiftPhase, string> = {
  calme: 'Calme',
  montee: 'Monte',
  pic: 'Plein',
  dispersion: 'Sortie',
  nuit_profonde: 'Nuit',
}

const PHASE_COLORS: Record<ShiftPhase, string> = {
  calme: 'bg-text-ghost text-void',
  montee: 'bg-intent text-void',
  pic: 'bg-signal text-void',
  dispersion: 'bg-calm text-void',
  nuit_profonde: 'bg-text-ghost/50 text-text-primary',
}

const CORRIDOR_STATUS_COLORS: Record<string, string> = {
  fluide: 'text-text-ghost',
  dense: 'text-signal',
  saturé: 'text-alert',
}

const EVENT_PHASE_COLORS: Record<string, string> = {
  pic: 'text-signal',
  dispersion: 'text-intent',
  transition: 'text-calm',
  nuit: 'text-text-ghost',
}

// ════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════

export function DispatchPanel({
  isOpen,
  onClose,
  currentPhase = 'calme',
  session,
  corridorStatuses,
  timeline,
}: DispatchPanelProps) {
  if (!isOpen) return null

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 bottom-0 w-80 bg-surface border-l border-border-subtle z-50 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <h2 className="text-sm uppercase tracking-[0.2em] text-text-primary">DISPATCH</h2>
          <span className={`px-2 py-0.5 rounded text-xs uppercase tracking-wider ${PHASE_COLORS[currentPhase]}`}>
            {PHASE_LABELS[currentPhase]}
          </span>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1 rounded border border-border text-text-ghost hover:text-text-secondary text-xs uppercase tracking-wider"
        >
          FERMER
        </button>
      </div>

      {/* Session stats */}
      {session && (
        <div className="p-4 border-b border-border-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-ghost uppercase tracking-wider">SESSION</span>
            <div className="text-right">
              <span className="text-text-ghost">{session.rides}</span>
              <span className="text-text-ghost/50"> / </span>
              <span className="text-text-secondary">{session.targetEur} EUR</span>
            </div>
          </div>

          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-light text-text-primary">{session.duration}</span>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-border-subtle rounded-full mb-2 overflow-hidden">
            <div
              className="h-full bg-signal rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (session.currentEur / session.targetEur) * 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-text-ghost">{session.rides} courses</span>
            <span className="text-text-secondary">Efficacité {session.efficiency}%</span>
          </div>
        </div>
      )}

      {/* Corridors */}
      {corridorStatuses && corridorStatuses.length > 0 && (
        <div className="p-4 border-b border-border-subtle">
          <p className="text-xs text-text-ghost uppercase tracking-wider mb-3">CORRIDORS</p>
          <div className="space-y-2">
            {corridorStatuses.map((corridor) => (
              <div key={corridor.direction} className="flex items-center justify-between">
                <span className="text-sm text-text-primary uppercase tracking-wider w-16">
                  {corridor.direction}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    corridor.status === 'fluide' ? 'bg-text-ghost/30 border border-text-ghost/50' :
                    corridor.status === 'dense' ? 'bg-signal' :
                    'bg-alert'
                  }`} />
                  <span className={`text-sm uppercase ${CORRIDOR_STATUS_COLORS[corridor.status]}`}>
                    {corridor.status.toUpperCase()}
                  </span>
                </div>
                {corridor.reason && (
                  <span className="text-xs text-text-ghost ml-auto">{corridor.reason}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {timeline && timeline.length > 0 && (
        <div className="flex-1 p-4 overflow-y-auto">
          <p className="text-xs text-text-ghost uppercase tracking-wider mb-3">+2H</p>
          <div className="space-y-3">
            {timeline.map((event, index) => (
              <div key={index} className="flex items-center gap-4">
                <span className="text-sm font-mono text-text-ghost w-12">{event.time}</span>
                <span className={`w-2 h-2 rounded-full ${
                  event.phase === 'pic' ? 'bg-signal' :
                  event.phase === 'dispersion' ? 'bg-intent' :
                  event.phase === 'transition' ? 'bg-calm' :
                  'bg-text-ghost'
                }`} />
                <span className={`text-xs uppercase tracking-wider ${EVENT_PHASE_COLORS[event.phase]}`}>
                  {event.phase.toUpperCase()}
                </span>
                <span className="text-sm text-text-secondary ml-auto">{event.zone}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shift Arc */}
      <div className="p-4 border-t border-border-subtle">
        <ShiftArcFull currentPhase={currentPhase} />
      </div>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════
// SHIFT ARC (Full visualization)
// ════════════════════════════════════════════════════════════════

function ShiftArcFull({ currentPhase }: { currentPhase: ShiftPhase }) {
  const phases: ShiftPhase[] = ['calme', 'montee', 'pic', 'dispersion']
  const currentIndex = phases.indexOf(currentPhase)

  return (
    <div className="flex items-center justify-between">
      {phases.map((phase, index) => {
        const isActive = phase === currentPhase
        const isPast = index < currentIndex

        return (
          <div key={phase} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <span className={`w-2.5 h-2.5 rounded-full mb-1.5 transition-colors ${
                isActive ? (
                  phase === 'pic' ? 'bg-signal' :
                  phase === 'montee' ? 'bg-intent' :
                  phase === 'dispersion' ? 'bg-calm' :
                  'bg-text-ghost'
                ) :
                isPast ? 'bg-text-ghost/50' :
                'bg-border'
              }`} />
              <span className={`text-[10px] uppercase tracking-wider transition-colors ${
                isActive ? 'text-text-secondary' : 'text-text-ghost/50'
              }`}>
                {PHASE_LABELS[phase]}
              </span>
            </div>
            {index < phases.length - 1 && (
              <div className={`flex-1 h-px mx-1 transition-colors ${
                isPast ? 'bg-text-ghost/30' : 'bg-border'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
