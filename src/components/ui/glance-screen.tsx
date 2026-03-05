'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Navigation, ChevronUp, Zap } from 'lucide-react'
import type { ActionType } from '@/lib/flow-engine/driver-anchor'

/**
 * GlanceScreen — READ MODE
 *
 * The 3-element instrument screen for driving.
 * Drivers glance for 0.5s and understand everything.
 *
 * Structure:
 *   [ TIMER ]
 *   [ ACTION ]
 *   [ PLACE ]
 *   [ CAUSE ]
 */

// ════════════════════════════════════════════════════════════════
// ACTION COLORS
// ════════════════════════════════════════════════════════════════

const ACTION_COLORS: Record<ActionType, { bg: string; text: string; glow: string }> = {
  maintenir: {
    bg: 'bg-text-ghost/10',
    text: 'text-text-ghost',
    glow: '',
  },
  bouger: {
    bg: 'bg-signal/10',
    text: 'text-signal',
    glow: 'shadow-[0_0_30px_rgba(46,204,113,0.2)]',
  },
  opportunite: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    glow: 'shadow-[0_0_30px_rgba(245,158,11,0.25)]',
  },
}

const ACTION_LABELS: Record<ActionType, string> = {
  maintenir: 'MAINTENIR',
  bouger: 'BOUGER',
  opportunite: 'OPPORTUNITÉ',
}

// ════════════════════════════════════════════════════════════════
// PROPS
// ════════════════════════════════════════════════════════════════

interface GlanceScreenProps {
  /** Primary action */
  action: ActionType
  /** Target zone */
  zone: string
  /** Cause (why this action) */
  cause: string
  /** Seconds remaining in window */
  secondsLeft?: number
  /** Window label (e.g., "Fenêtre ferme") */
  windowLabel?: string
  /** Confidence 0-1 */
  confidence?: number
  /** On expand to radar mode */
  onExpand?: () => void
  /** On navigate */
  onNavigate?: () => void
  /** Strategic opportunity (out of zone) */
  strategicOpportunity?: {
    zone: string
    cause: string
    distanceMin: number
  }
}

export function GlanceScreen({
  action,
  zone,
  cause,
  secondsLeft,
  windowLabel,
  confidence,
  onExpand,
  onNavigate,
  strategicOpportunity,
}: GlanceScreenProps) {
  const [countdown, setCountdown] = useState(secondsLeft || 0)
  const colors = ACTION_COLORS[action]

  // Countdown timer
  useEffect(() => {
    if (!secondsLeft) return
    setCountdown(secondsLeft)

    const interval = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(interval)
  }, [secondsLeft])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleNavigate = () => {
    if (onNavigate) {
      onNavigate()
    } else {
      window.open(`https://waze.com/ul?q=${encodeURIComponent(zone + ' Paris')}`, '_blank')
    }
  }

  return (
    <div className="min-h-screen bg-void flex flex-col">
      {/* Main glance area - takes most of screen */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Timer (if window active) */}
        {countdown > 0 && windowLabel && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 text-center"
          >
            <p className="text-xs text-text-ghost uppercase tracking-wider mb-1">
              {windowLabel}
            </p>
            <p className={`text-4xl font-mono ${countdown < 60 ? 'text-intent' : 'text-text-primary'}`}>
              {formatTime(countdown)}
            </p>
          </motion.div>
        )}

        {/* ACTION — The big word */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`px-8 py-4 rounded-2xl ${colors.bg} ${colors.glow} mb-4`}
        >
          <p className={`text-4xl md:text-5xl font-light tracking-wide ${colors.text}`}
             style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}>
            {ACTION_LABELS[action]}
          </p>
        </motion.div>

        {/* PLACE — Target zone */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-2xl md:text-3xl text-text-primary mb-4"
        >
          {zone}
        </motion.p>

        {/* CAUSE — Why */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-sm text-text-secondary text-center max-w-xs"
        >
          {cause}
        </motion.p>

        {/* Confidence indicator */}
        {confidence !== undefined && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 flex items-center gap-2 text-xs text-text-ghost"
          >
            <span>Confiance</span>
            <span className={confidence > 0.7 ? 'text-signal' : 'text-text-secondary'}>
              {Math.round(confidence * 100)}%
            </span>
          </motion.div>
        )}
      </div>

      {/* Strategic opportunity banner (if present) */}
      {strategicOpportunity && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30"
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-amber-400 uppercase tracking-wider">
              Opportunité longue course
            </span>
          </div>
          <p className="text-lg text-amber-400 mb-1">{strategicOpportunity.zone}</p>
          <p className="text-xs text-text-ghost">
            {strategicOpportunity.distanceMin} min · {strategicOpportunity.cause}
          </p>
        </motion.div>
      )}

      {/* Bottom action bar */}
      <div className="p-4 pb-8 space-y-3">
        {/* Navigate button */}
        <button
          onClick={handleNavigate}
          className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 ${colors.bg} border border-current/20 ${colors.text} text-lg font-medium active:scale-[0.98] transition-transform`}
        >
          <Navigation className="w-5 h-5" />
          <span>NAVIGUER</span>
        </button>

        {/* Expand to radar mode */}
        {onExpand && (
          <button
            onClick={onExpand}
            className="w-full py-3 flex items-center justify-center gap-2 text-text-ghost text-sm"
          >
            <ChevronUp className="w-4 h-4" />
            <span>Voir détails</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// MINI GLANCE (for embedded use)
// ════════════════════════════════════════════════════════════════

interface MiniGlanceProps {
  action: ActionType
  zone: string
  cause: string
  secondsLeft?: number
  onClick?: () => void
}

export function MiniGlance({ action, zone, cause, secondsLeft, onClick }: MiniGlanceProps) {
  const colors = ACTION_COLORS[action]

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-xl ${colors.bg} ${colors.glow} border border-current/10 text-left active:scale-[0.98] transition-transform`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs uppercase tracking-wider ${colors.text}`}>
          {ACTION_LABELS[action]}
        </span>
        {secondsLeft && secondsLeft > 0 && (
          <span className={`text-sm font-mono ${secondsLeft < 60 ? 'text-intent' : 'text-text-ghost'}`}>
            {formatTime(secondsLeft)}
          </span>
        )}
      </div>
      <p className={`text-xl font-light ${colors.text} mb-1`}
         style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}>
        {zone}
      </p>
      <p className="text-xs text-text-ghost truncate">{cause}</p>
    </button>
  )
}
