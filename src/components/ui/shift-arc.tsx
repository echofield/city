'use client'

import { motion } from 'framer-motion'
import {
  type ShiftArcState,
  type ArcPhase,
  PHASE_LABELS,
  PHASE_COLORS,
  PHASE_BG_COLORS
} from '@/lib/shift-conductor/shift-arc'

interface ShiftArcProps {
  arc: ShiftArcState
  compact?: boolean
}

const PHASES: ArcPhase[] = ['calm', 'build', 'peak', 'release']

export function ShiftArc({ arc, compact = false }: ShiftArcProps) {
  const currentIndex = PHASES.indexOf(arc.current_phase)

  if (compact) {
    return <ShiftArcCompact arc={arc} />
  }

  return (
    <div
      className="px-3 py-2 rounded-lg bg-surface border border-border-subtle"
      style={{ transition: 'var(--transition-base)', boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Phase bar */}
      <div className="flex items-center gap-1 mb-2">
        {PHASES.map((phase, index) => {
          const isActive = phase === arc.current_phase
          const isPast = index < currentIndex
          const isFuture = index > currentIndex

          return (
            <div
              key={phase}
              className="flex-1 relative"
            >
              {/* Bar segment */}
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  isActive ? PHASE_BG_COLORS[phase] :
                  isPast ? 'bg-text-ghost/30' :
                  'bg-border-subtle'
                }`}
              >
                {/* Progress within active phase */}
                {isActive && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${arc.phase_progress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={`h-full rounded-full ${
                      phase === 'calm' ? 'bg-text-ghost' :
                      phase === 'build' ? 'bg-intent' :
                      phase === 'peak' ? 'bg-signal' :
                      'bg-calm'
                    }`}
                  />
                )}
              </div>

              {/* Phase label (only for active, ARCHÉ serif) */}
              {isActive && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2" style={{ fontFamily: 'var(--font-serif)' }}>
                  <span className={`text-[10px] uppercase tracking-wider ${PHASE_COLORS[phase]}`}>
                    {PHASE_LABELS[phase]}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Info row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${
            arc.current_phase === 'calm' ? 'bg-text-ghost' :
            arc.current_phase === 'build' ? 'bg-intent' :
            arc.current_phase === 'peak' ? 'bg-signal animate-pulse' :
            'bg-calm'
          }`} />
          <span className="text-text-secondary">
            {arc.phase_reason || PHASE_LABELS[arc.current_phase]}
          </span>
        </div>
        {arc.next_phase && arc.next_phase_in_minutes && (
          <span className="text-text-ghost">
            {PHASE_LABELS[arc.next_phase]} dans {arc.next_phase_in_minutes}m
          </span>
        )}
      </div>
    </div>
  )
}

function ShiftArcCompact({ arc }: { arc: ShiftArcState }) {
  const currentIndex = PHASES.indexOf(arc.current_phase)

  return (
    <div className="flex items-center gap-2">
      {/* Mini phase bar */}
      <div className="flex items-center gap-0.5">
        {PHASES.map((phase, index) => {
          const isActive = phase === arc.current_phase
          const isPast = index < currentIndex

          return (
            <div
              key={phase}
              className={`w-6 h-1 rounded-full transition-colors ${
                isActive ? (
                  phase === 'calm' ? 'bg-text-ghost' :
                  phase === 'build' ? 'bg-intent' :
                  phase === 'peak' ? 'bg-signal' :
                  'bg-calm'
                ) :
                isPast ? 'bg-text-ghost/30' :
                'bg-border-subtle'
              }`}
            />
          )
        })}
      </div>

      {/* Current phase label */}
      <span className={`text-xs ${PHASE_COLORS[arc.current_phase]}`}>
        {PHASE_LABELS[arc.current_phase]}
      </span>

      {/* Next phase timing */}
      {arc.next_phase_in_minutes && arc.next_phase_in_minutes <= 60 && (
        <span className="text-xs text-text-ghost">
          · {arc.next_phase_in_minutes}m
        </span>
      )}
    </div>
  )
}
