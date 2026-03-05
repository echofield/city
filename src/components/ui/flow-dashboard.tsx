'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Navigation, Radar, X, HelpCircle } from 'lucide-react'
import type { ActionType } from '@/lib/flow-engine/driver-anchor'
import type { ShiftPhase, CorridorStatus } from '@/types/flow-view-model'
import type { SignalCertainty, PisteCategory } from '@/lib/flow-vocabulary'
import type { Opportunity, OpportunityState, Momentum, WindowPressure } from '@/types/flow-card'
import { getPressureLabel } from '@/types/flow-card'

// ════════════════════════════════════════════════════════════════
// META TECHNIQUE CONSTANTS
// ════════════════════════════════════════════════════════════════

// THE NEEDLE — 120ms base transition
const NEEDLE = { duration: 0.12 }
const STAGGER_1 = { duration: 0.15, delay: 0.04 }
const STAGGER_2 = { duration: 0.15, delay: 0.08 }

// ════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════

export type ViewMode = 'read' | 'radar'
export type RideProfile = 'longues' | 'mixte' | 'courtes'

export interface FlowStats {
  eta: number // minutes
  saturation: number // 0-100
  opportunite: number // 0-100
  eurH: { low: number; high: number }
}

export interface FrictionInfo {
  label: string
  implication: string
}

export interface ProchainInfo {
  time: string
  zone: string
  type: string
}

/**
 * Signal with certainty — distinguishes confirmed from speculative
 *
 * CONFIRMÉ: Predictable movement (e.g., "Sortie théâtre Châtelet")
 * PISTE: Positioning bet (e.g., "Club Pantin ferme ~04:00")
 */
export interface FlowSignal {
  label: string
  type: 'amber' | 'green' | 'grey'
  certainty?: SignalCertainty // 'confirme' | 'piste'
  pisteCategory?: PisteCategory // 'nuit' | 'jour' | 'soiree'
}

/**
 * Quest chain — next lead in the night
 * "Surfing the city rhythm"
 */
export interface ProchainePiste {
  zone: string
  time: string // "~04:00"
  cause: string
  category: PisteCategory
}

/**
 * PICS CE SOIR — tonight's peak timeline
 * Chronological quest chain sorted by windowStart
 */
export interface TonightPeak {
  id: string
  zone: string
  action: ActionType
  windowStart: string // "22:30"
  windowEnd: string // "23:15"
  cause: string
  rideProfile?: RideProfile
}

export interface FlowDashboardProps {
  // Core action
  action: ActionType
  zone: string
  arrondissement: string
  cause: string

  // Timer
  secondsLeft?: number
  windowLabel?: string // "EN FORMATION", "FENÊTRE ACTIVE", etc.
  windowRange?: string // "03:10-03:12"

  // Position
  distanceKm?: number
  distanceM?: number // meters — more precise
  etaMin?: number
  entrySide?: string // "côte Gare du Nord"

  // Scores
  opp?: number // 0-100
  fric?: number // 0-100
  cost?: number // 0-100

  // Stats (for READ mode footer)
  stats?: FlowStats

  // Friction & next
  friction?: FrictionInfo
  prochain?: ProchainInfo

  // Shift arc
  currentPhase?: ShiftPhase
  corridor?: string
  confidence?: number
  eurEstimate?: { low: number; high: number }

  // Confidence label — vocabulary v3.0
  confidenceLabel?: string // "Ça se forme", "Bonne fenêtre", etc.

  // Ride profile — L/M/C
  rideProfile?: RideProfile

  // Corridor statuses
  corridorStatuses?: CorridorStatus[]

  // Signal list (with certainty: confirme vs piste)
  signals?: FlowSignal[]

  // Next lead in the quest chain
  prochainePiste?: ProchainePiste

  // PICS CE SOIR — tonight's peaks timeline
  tonightPeaks?: TonightPeak[]

  // AUTRES PISTES — alternative opportunities from card
  opportunities?: Opportunity[]

  // CONFIRME flow — session state locking
  isConfirmed?: boolean
  onConfirm?: () => void
  onUnconfirm?: () => void

  // Callbacks
  onNavigate?: () => void
  onDispatch?: () => void
  onEndShift?: () => void

  // Map component (injected)
  mapComponent?: React.ReactNode
}

// ════════════════════════════════════════════════════════════════
// COLORS
// ════════════════════════════════════════════════════════════════

// FLOW vocabulary — sound like an experienced Paris driver
const ACTION_STYLES: Record<ActionType, { text: string; border: string; bg: string }> = {
  maintenir: {
    text: 'text-text-ghost',
    border: 'border-l-text-ghost',
    bg: 'bg-text-ghost/5',
  },
  rejoindre: {
    text: 'text-signal',
    border: 'border-l-signal',
    bg: 'bg-signal/5',
  },
  anticiper: {
    text: 'text-intent',
    border: 'border-l-intent',
    bg: 'bg-intent/5',
  },
  contourner: {
    text: 'text-calm',
    border: 'border-l-calm',
    bg: 'bg-calm/5',
  },
  tenter: {
    text: 'text-amber-400',
    border: 'border-l-amber-400',
    bg: 'bg-amber-400/5',
  },
}

const ACTION_LABELS: Record<ActionType, string> = {
  maintenir: 'MAINTENIR',
  rejoindre: 'REJOINDRE',
  anticiper: 'ANTICIPER',
  contourner: 'CONTOURNER',
  tenter: 'TENTER',
}

// Phase labels — FLOW vocabulary v3.0
const PHASE_LABELS: Record<ShiftPhase, string> = {
  calme: 'Calme',
  montee: 'Monte',
  pic: 'Plein',
  dispersion: 'Sortie',
  nuit_profonde: 'Nuit',
}

// Piste category labels — speculative leads
const PISTE_LABELS: Record<PisteCategory, string> = {
  nuit: 'Piste nuit',
  jour: 'Piste',
  soiree: 'Piste soirée',
}

// Ride profile labels — L/M/C compact badges
const RIDE_PROFILE_LABELS: Record<RideProfile, string> = {
  longues: 'L',
  mixte: 'M',
  courtes: 'C',
}

// Opportunity state symbols — ● maintenant ⚠ closing ○ ça monte · horizon
const STATE_SYMBOLS: Record<OpportunityState, string> = {
  active: '●',
  closing: '⚠',
  forming: '○',
  horizon: '·',
}

// Momentum arrows — ▲ building → stable ▼ fading
const MOMENTUM_ARROWS: Record<Momentum, string> = {
  building: '▲',
  stable: '→',
  fading: '▼',
}

// State colors for UI
const STATE_COLORS: Record<OpportunityState, string> = {
  active: 'text-signal',
  closing: 'text-intent',
  forming: 'text-amber-400',
  horizon: 'text-text-ghost',
}

// Momentum colors
const MOMENTUM_COLORS: Record<Momentum, string> = {
  building: 'text-signal',
  stable: 'text-text-ghost',
  fading: 'text-intent',
}

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════

export function FlowDashboard(props: FlowDashboardProps) {
  const [mode, setMode] = useState<ViewMode>('read')
  const [countdown, setCountdown] = useState(props.secondsLeft || 0)

  // ═══════════════════════════════════════════════════════════
  // THE BREATH — Global sine wave at 60fps
  // Everything alive breathes together
  // ═══════════════════════════════════════════════════════════
  const [breathPhase, setBreathPhase] = useState(0.5)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    let t = 0
    const tick = () => {
      t += 0.015 // ~4 second full cycle
      setBreathPhase(Math.sin(t) * 0.5 + 0.5) // 0 → 1 → 0
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [])

  // Countdown timer
  useEffect(() => {
    if (!props.secondsLeft) return
    setCountdown(props.secondsLeft)

    const interval = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(interval)
  }, [props.secondsLeft])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        setMode(prev => prev === 'read' ? 'radar' : 'read')
      }
      if (e.key === 'Escape' && mode === 'radar') {
        setMode('read')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode])

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }, [])

  const handleNavigate = () => {
    if (props.onNavigate) {
      props.onNavigate()
    } else {
      window.open(`https://waze.com/ul?q=${encodeURIComponent(props.zone + ' Paris')}`, '_blank')
    }
  }

  const styles = ACTION_STYLES[props.action]

  return (
    <div className="min-h-screen bg-void">
      <AnimatePresence mode="wait">
        {mode === 'read' ? (
          <ReadMode
            key="read"
            {...props}
            styles={styles}
            countdown={countdown}
            formatTime={formatTime}
            breathPhase={breathPhase}
            onNavigate={handleNavigate}
            onOpenRadar={() => setMode('radar')}
          />
        ) : (
          <RadarMode
            key="radar"
            {...props}
            styles={styles}
            countdown={countdown}
            formatTime={formatTime}
            breathPhase={breathPhase}
            onNavigate={handleNavigate}
            onClose={() => setMode('read')}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// READ MODE
// ════════════════════════════════════════════════════════════════

interface ReadModeProps extends FlowDashboardProps {
  styles: { text: string; border: string; bg: string }
  countdown: number
  formatTime: (s: number) => string
  breathPhase: number
  onNavigate: () => void
  onOpenRadar: () => void
  opportunities?: Opportunity[]
}

function ReadMode({
  action,
  zone,
  arrondissement,
  cause,
  windowLabel,
  stats,
  friction,
  prochain,
  currentPhase,
  corridor,
  confidence,
  eurEstimate,
  confidenceLabel,
  rideProfile,
  opportunities,
  isConfirmed,
  onConfirm,
  onUnconfirm,
  styles,
  countdown,
  formatTime,
  breathPhase,
  onNavigate,
  onOpenRadar,
}: ReadModeProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={NEEDLE}
      className="min-h-screen flex flex-col relative"
    >
      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={STAGGER_1}
        className="flex items-center justify-between px-4 py-3 border-b border-border-subtle"
      >
        <div className="flex items-center gap-2">
          {/* PHASE DOT — only pulses during "pic" */}
          <motion.span
            className={`w-2 h-2 rounded-full ${
              currentPhase === 'pic' ? 'bg-signal' :
              currentPhase === 'montee' ? 'bg-intent' :
              'bg-text-ghost'
            }`}
            animate={currentPhase === 'pic' ? {
              scale: [1, 1.4, 1],
              opacity: [0.6, 1, 0.6],
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-xs text-text-ghost uppercase tracking-wider">
            {currentPhase ? PHASE_LABELS[currentPhase] : 'CALME'}
          </span>
          {corridor && (
            <>
              <span className="text-text-ghost/30">/</span>
              <span className="text-xs text-text-ghost uppercase">{corridor}</span>
            </>
          )}
          {/* Confidence label — "Ça se forme", etc. */}
          {confidenceLabel && (
            <>
              <span className="text-text-ghost/30">/</span>
              <span className="text-xs text-intent">{confidenceLabel}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          {/* L/M/C badge */}
          {rideProfile && (
            <span className="text-xs text-text-ghost border border-text-ghost/30 rounded px-1.5 py-0.5">
              {RIDE_PROFILE_LABELS[rideProfile]}
            </span>
          )}
          {confidence !== undefined && (
            <span className="text-text-ghost">{Math.round(confidence * 100)}%</span>
          )}
          {eurEstimate && (
            <span className="text-signal font-mono">
              {eurEstimate.low} EUR
            </span>
          )}
        </div>
      </motion.div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Timer */}
        {countdown > 0 && windowLabel && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={STAGGER_1}
            className="mb-6 text-center"
          >
            <p className="text-xs text-text-ghost uppercase tracking-wider mb-2">
              {windowLabel}
            </p>
            <p className={`text-6xl font-mono font-light tracking-tight ${
              countdown < 60 ? 'text-intent' : styles.text
            }`}>
              {formatTime(countdown)}
            </p>
          </motion.div>
        )}

        {/* ACTION with left border */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={NEEDLE}
          className={`border-l-4 ${styles.border} pl-6 mb-4`}
        >
          <p
            className={`text-5xl md:text-6xl font-light tracking-wide ${styles.text}`}
            style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}
          >
            {ACTION_LABELS[action]}
          </p>
        </motion.div>

        {/* ZONE + Arrondissement */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={STAGGER_1}
          className="flex items-baseline gap-3 mb-4"
        >
          <p className="text-3xl md:text-4xl text-text-primary font-light tracking-wide">
            {zone.toUpperCase()}
          </p>
          {arrondissement && (
            <span className="text-sm text-text-ghost uppercase tracking-wider">
              {arrondissement}
            </span>
          )}
        </motion.div>

        {/* CAUSE */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={STAGGER_2}
          className="text-sm text-text-ghost text-center max-w-sm"
        >
          {cause}
        </motion.p>

        {/* AUTRES PISTES — alternative opportunities */}
        {opportunities && Array.isArray(opportunities) && opportunities.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={STAGGER_2}
            className="mt-8 w-full max-w-md"
          >
            <p className="text-xs text-text-ghost uppercase tracking-wider mb-3 text-center">
              AUTRES PISTES
            </p>
            <div className="space-y-2">
              {opportunities
                .slice(1, 5)
                .filter(opp => opp && opp.id && opp.state)
                .map((opp, index) => (
                  <OpportunityRow
                    key={opp.id}
                    opportunity={opp}
                    index={index}
                    breathPhase={breathPhase}
                  />
                ))}
            </div>
          </motion.div>
        )}

        {/* CONFIRME button */}
        {onConfirm && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={STAGGER_2}
            onClick={isConfirmed ? onUnconfirm : onConfirm}
            whileTap={{ scale: 0.97 }}
            className={`mt-6 px-6 py-2 rounded-lg border text-sm uppercase tracking-wider transition-colors ${
              isConfirmed
                ? 'border-signal text-signal bg-signal/5'
                : 'border-text-ghost/30 text-text-ghost hover:border-text-ghost/50'
            }`}
          >
            {isConfirmed ? 'CONFIRMÉ' : 'CONFIRME'}
          </motion.button>
        )}
      </div>

      {/* Stats footer */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={STAGGER_2}
          className="grid grid-cols-4 gap-px bg-border-subtle mx-4 rounded-lg overflow-hidden"
        >
          <StatBox label="ETA" value={`${stats.eta}`} unit="min" />
          <StatBox label="SATURATION" value={`${stats.saturation}`} unit="%" color="green" />
          <StatBox label="OPPORTUNITÉ" value={`${stats.opportunite}`} unit="%" color="amber" />
          <StatBox label="EUR/H" value={`${stats.eurH.low}-${stats.eurH.high}`} color="signal" />
        </motion.div>
      )}

      {/* Friction & Prochain */}
      <div className="px-4 py-3 space-y-2 text-sm">
        {friction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={STAGGER_1}
            className="flex items-center gap-3"
          >
            <span className="text-intent text-xs uppercase tracking-wider w-16">FRICTION</span>
            <span className="text-text-secondary">{friction.label}</span>
            <span className="text-signal text-xs ml-auto">{friction.implication}</span>
          </motion.div>
        )}
        {prochain && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={STAGGER_2}
            className="flex items-center gap-3"
          >
            <span className="text-signal text-xs uppercase tracking-wider w-16">PROCHAIN</span>
            <span className="text-text-ghost font-mono">{prochain.time}</span>
            <span className="text-text-secondary">{prochain.zone}</span>
            <span className="text-text-ghost text-xs">{prochain.type}</span>
          </motion.div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="p-4 pb-8 flex items-center justify-end">
        <button
          onClick={onOpenRadar}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-ghost hover:text-text-secondary hover:border-border-subtle transition-colors"
        >
          <span className="text-sm uppercase tracking-wider">RADAR</span>
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* THE BREATH — breathing line at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-signal"
        style={{ opacity: 0.1 + breathPhase * 0.25 }}
      />
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════
// RADAR MODE
// ════════════════════════════════════════════════════════════════

interface RadarModeProps extends FlowDashboardProps {
  styles: { text: string; border: string; bg: string }
  countdown: number
  formatTime: (s: number) => string
  breathPhase: number
  onNavigate: () => void
  onClose: () => void
}

function RadarMode({
  action,
  zone,
  arrondissement,
  cause,
  windowLabel,
  windowRange,
  distanceKm,
  distanceM,
  etaMin,
  entrySide,
  opp,
  fric,
  cost,
  friction,
  eurEstimate,
  signals,
  prochainePiste,
  tonightPeaks,
  currentPhase,
  corridor,
  confidence,
  confidenceLabel,
  rideProfile,
  corridorStatuses,
  mapComponent,
  isConfirmed,
  onConfirm,
  onUnconfirm,
  styles,
  countdown,
  formatTime,
  breathPhase,
  onNavigate,
  onClose,
  onDispatch,
  onEndShift,
}: RadarModeProps) {
  // Format distance — prefer meters if available
  const distanceDisplay = distanceM !== undefined
    ? distanceM >= 1000
      ? `${(distanceM / 1000).toFixed(1)} km`
      : `${distanceM} m`
    : distanceKm !== undefined
      ? `${distanceKm} km`
      : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={NEEDLE}
      className="min-h-screen flex"
    >
      {/* Left: Map */}
      <div className="flex-1 relative">
        {/* Top bar */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={STAGGER_1}
          className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-border text-text-ghost hover:text-text-secondary text-xs uppercase tracking-wider"
            >
              READ
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-border">
              {/* PHASE DOT — only pulses during "pic" */}
              <motion.span
                className={`w-2 h-2 rounded-full ${
                  currentPhase === 'pic' ? 'bg-signal' :
                  currentPhase === 'montee' ? 'bg-intent' :
                  'bg-text-ghost'
                }`}
                animate={currentPhase === 'pic' ? {
                  scale: [1, 1.4, 1],
                  opacity: [0.6, 1, 0.6],
                } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-xs text-text-ghost uppercase">
                {currentPhase ? PHASE_LABELS[currentPhase] : 'CALME'}
              </span>
              {corridor && (
                <>
                  <span className="text-text-ghost/30">|</span>
                  <span className="text-xs text-text-ghost">{corridor}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-border">
            {confidence !== undefined && (
              <span className="text-xs text-text-ghost">{Math.round(confidence * 100)}%</span>
            )}
            {eurEstimate && (
              <span className="text-xs text-signal font-mono">
                {eurEstimate.low} EUR
              </span>
            )}
          </div>
        </motion.div>

        {/* Map area */}
        <div className="absolute inset-0 flex items-center justify-center">
          {mapComponent || (
            <div className="text-text-ghost text-sm">Map</div>
          )}
        </div>
      </div>

      {/* Right: Panel */}
      <div className="w-96 bg-void border-l border-border-subtle flex flex-col relative">
        {/* Timer section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={NEEDLE}
          className="p-6 border-b border-border-subtle"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {/* PHASE DOT — only pulses during "pic" */}
              <motion.span
                className={`w-2 h-2 rounded-full ${
                  currentPhase === 'pic' ? 'bg-signal' : 'bg-intent'
                }`}
                animate={currentPhase === 'pic' ? {
                  scale: [1, 1.4, 1],
                  opacity: [0.6, 1, 0.6],
                } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-xs text-intent uppercase tracking-wider">
                {windowLabel || 'FENÊTRE EN FORMATION'}
              </span>
            </div>
            <span className={`text-4xl font-mono font-light ${
              countdown < 60 ? 'text-intent' : 'text-text-primary'
            }`}>
              {formatTime(countdown)}
            </span>
          </div>

          {/* Confidence label */}
          {confidenceLabel && (
            <p className="text-xs text-intent mb-3">{confidenceLabel}</p>
          )}

          {/* Action */}
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={STAGGER_1}
            className={`border-l-4 ${styles.border} pl-4 mb-4`}
          >
            <p
              className={`text-4xl font-light tracking-wide ${styles.text}`}
              style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}
            >
              {ACTION_LABELS[action].split(' ').map((word, i) => (
                <span key={i} className="block">{word}</span>
              ))}
            </p>
          </motion.div>

          {/* Zone info */}
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-2xl text-text-primary font-light tracking-wide">
              {zone.toUpperCase()}
            </p>
            {arrondissement && (
              <span className="text-sm text-text-ghost">{arrondissement}</span>
            )}
            {/* L/M/C badge */}
            {rideProfile && (
              <span className="text-xs text-text-ghost border border-text-ghost/30 rounded px-1.5 py-0.5 ml-2">
                {RIDE_PROFILE_LABELS[rideProfile]}
              </span>
            )}
          </div>

          {/* Distance & ETA */}
          {(distanceDisplay || etaMin !== undefined) && (
            <div className="flex items-center gap-4 text-sm text-text-ghost mb-2">
              {distanceDisplay && <span>{distanceDisplay}</span>}
              {distanceDisplay && etaMin !== undefined && <span>|</span>}
              {etaMin !== undefined && <span>{etaMin} min</span>}
            </div>
          )}

          {/* Window range & Entry */}
          <div className="flex items-center gap-4 text-sm mb-4">
            {windowRange && (
              <div>
                <span className="text-text-ghost">Fenêtre </span>
                <span className="text-text-primary font-mono">{windowRange}</span>
              </div>
            )}
            {entrySide && (
              <div>
                <span className="text-text-ghost">Entrée </span>
                <span className="text-text-secondary">{entrySide}</span>
              </div>
            )}
          </div>

          {/* OPP / FRIC / COST boxes */}
          {(opp !== undefined || fric !== undefined || cost !== undefined) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={STAGGER_1}
              className="grid grid-cols-3 gap-2 mb-4"
            >
              <ScoreBox label="OPP" value={opp ?? 0} color="signal" />
              <ScoreBox label="FRIC" value={fric ?? 0} color="intent" />
              <ScoreBox label="COST" value={cost ?? 0} color="alert" />
            </motion.div>
          )}

          {/* Cause */}
          <p className="text-sm text-text-ghost mb-4">{cause}</p>

          {/* CONFIRME button */}
          {onConfirm && (
            <motion.button
              onClick={isConfirmed ? onUnconfirm : onConfirm}
              whileTap={{ scale: 0.97 }}
              className={`w-full py-3 mb-3 rounded-lg border text-sm uppercase tracking-wider transition-colors ${
                isConfirmed
                  ? 'border-signal text-signal bg-signal/5'
                  : 'border-text-ghost/30 text-text-ghost hover:border-text-ghost/50'
              }`}
            >
              {isConfirmed ? 'CONFIRMÉ' : 'CONFIRME'}
            </motion.button>
          )}

          {/* Navigate button */}
          <button
            onClick={onNavigate}
            className="w-full py-3 rounded-lg border border-border text-text-primary hover:bg-surface transition-colors flex items-center justify-center gap-2"
          >
            <span className="uppercase tracking-wider">NAVIGUER</span>
            <span>→</span>
          </button>
        </motion.div>

        {/* PICS CE SOIR — tonight's peaks timeline */}
        {tonightPeaks && tonightPeaks.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={STAGGER_2}
            className="px-6 py-4 border-b border-border-subtle"
          >
            <p className="text-xs text-text-ghost uppercase tracking-wider mb-3">PICS CE SOIR</p>
            <div className="space-y-3">
              {tonightPeaks.map((peak, index) => (
                <div key={peak.id} className="flex items-start gap-3">
                  {/* Timeline dot & connector */}
                  <div className="flex flex-col items-center">
                    <span className={`w-2 h-2 rounded-full ${
                      index === 0 ? 'bg-signal' : 'bg-text-ghost/50'
                    }`} />
                    {index < tonightPeaks.length - 1 && (
                      <div className="w-px h-8 bg-border-subtle mt-1" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs uppercase tracking-wider ${
                        ACTION_STYLES[peak.action]?.text || 'text-text-ghost'
                      }`}>
                        {ACTION_LABELS[peak.action]}
                      </span>
                      <span className="text-sm text-text-primary">{peak.zone}</span>
                      {peak.rideProfile && (
                        <span className="text-[10px] text-text-ghost border border-text-ghost/30 rounded px-1">
                          {RIDE_PROFILE_LABELS[peak.rideProfile]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-ghost">
                      <span className="font-mono">{peak.windowStart}-{peak.windowEnd}</span>
                      <span className="truncate">{peak.cause}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Friction section */}
        {friction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={STAGGER_1}
            className="px-6 py-4 border-b border-border-subtle"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-text-ghost uppercase tracking-wider">FRICTION</span>
                <p className="text-sm text-text-secondary">{friction.label}</p>
              </div>
              <span className="text-xs text-signal">{friction.implication}</span>
            </div>
          </motion.div>
        )}

        {/* EUR/h estimate */}
        {eurEstimate && (
          <div className="px-6 py-3 border-b border-border-subtle">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-ghost">EUR/h estimé</span>
              <span className="text-lg text-signal font-mono">
                {eurEstimate.low}--{eurEstimate.high}
              </span>
            </div>
          </div>
        )}

        {/* Prochaine piste — quest chain */}
        {prochainePiste && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={STAGGER_2}
            className="px-6 py-4 border-b border-border-subtle bg-amber-400/5"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-amber-400/70 uppercase tracking-wider border border-amber-400/30 rounded px-1">
                {PISTE_LABELS[prochainePiste.category]}
              </span>
              <span className="text-xs text-text-ghost">Prochaine piste</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg text-amber-400">{prochainePiste.zone}</p>
                <p className="text-xs text-text-ghost">{prochainePiste.cause}</p>
              </div>
              <span className="text-sm text-amber-400/70 font-mono">{prochainePiste.time}</span>
            </div>
          </motion.div>
        )}

        {/* Signals list — confirmed vs piste */}
        {signals && signals.length > 0 && (
          <div className="px-6 py-4 border-b border-border-subtle space-y-2">
            {signals.map((sig, i) => {
              const isPiste = sig.certainty === 'piste'
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: isPiste ? 0.75 : 1, x: 0 }}
                  transition={{ ...STAGGER_1, delay: 0.04 * i }}
                  className="flex items-center gap-2"
                >
                  {/* Piste indicator */}
                  {isPiste && sig.pisteCategory && (
                    <span className="text-[10px] text-amber-400/70 uppercase tracking-wider border border-amber-400/30 rounded px-1">
                      {PISTE_LABELS[sig.pisteCategory]}
                    </span>
                  )}
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    isPiste ? 'bg-amber-400/50 border border-dashed border-amber-400' :
                    sig.type === 'green' ? 'bg-signal' :
                    sig.type === 'amber' ? 'bg-intent' :
                    'bg-text-ghost'
                  }`} />
                  <span className={`text-sm ${
                    isPiste ? 'text-amber-400/70 italic' :
                    sig.type === 'green' ? 'text-signal' :
                    sig.type === 'amber' ? 'text-intent' :
                    'text-text-ghost'
                  }`}>
                    {sig.label}
                  </span>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Shift Arc */}
        <div className="px-6 py-4 mt-auto">
          <ShiftArcMini currentPhase={currentPhase} breathPhase={breathPhase} />
        </div>

        {/* Bottom buttons */}
        <div className="p-4 grid grid-cols-2 gap-2">
          <button
            onClick={onDispatch}
            className="py-3 rounded-lg border border-border text-text-secondary hover:bg-surface transition-colors uppercase text-sm tracking-wider"
          >
            DISPATCH
          </button>
          <button
            onClick={onEndShift}
            className="py-3 rounded-lg border border-border text-text-ghost hover:bg-surface transition-colors uppercase text-sm tracking-wider"
          >
            FIN SHIFT
          </button>
        </div>

        {/* THE BREATH — breathing line at bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-signal"
          style={{ opacity: 0.1 + breathPhase * 0.25 }}
        />
      </div>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════

function StatBox({
  label,
  value,
  unit,
  color,
}: {
  label: string
  value: string
  unit?: string
  color?: 'green' | 'amber' | 'signal'
}) {
  const colorClass = color === 'green' ? 'text-signal' :
                     color === 'amber' ? 'text-intent' :
                     color === 'signal' ? 'text-signal' :
                     'text-text-primary'

  return (
    <div className="bg-surface p-3 text-center">
      <p className="text-xs text-text-ghost uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-mono ${colorClass}`}>
        {value}
        {unit && <span className="text-xs text-text-ghost ml-0.5">{unit}</span>}
      </p>
    </div>
  )
}

function ScoreBox({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'signal' | 'intent' | 'alert'
}) {
  const borderColor = color === 'signal' ? 'border-signal/30' :
                      color === 'intent' ? 'border-intent/30' :
                      'border-alert/30'
  const textColor = color === 'signal' ? 'text-signal' :
                    color === 'intent' ? 'text-intent' :
                    'text-alert'

  return (
    <div className={`p-3 rounded-lg border ${borderColor} text-center`}>
      <p className="text-xs text-text-ghost uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-mono ${textColor}`}>{value}</p>
    </div>
  )
}

function ShiftArcMini({ currentPhase, breathPhase }: { currentPhase?: ShiftPhase; breathPhase: number }) {
  const phases: ShiftPhase[] = ['calme', 'montee', 'pic', 'dispersion']
  const currentIndex = currentPhase ? phases.indexOf(currentPhase) : 0

  return (
    <div className="flex items-center justify-between">
      {phases.map((phase, index) => {
        const isActive = phase === currentPhase
        const isPast = index < currentIndex

        return (
          <div key={phase} className="flex items-center">
            <div className="flex flex-col items-center">
              {/* THE BREATH — active dot breathes */}
              <span
                className={`w-2 h-2 rounded-full mb-1 transition-opacity ${
                  isActive ? (
                    phase === 'pic' ? 'bg-signal' :
                    phase === 'montee' ? 'bg-intent' :
                    'bg-text-ghost'
                  ) :
                  isPast ? 'bg-text-ghost/50' :
                  'bg-border'
                }`}
                style={isActive ? { opacity: 0.7 + breathPhase * 0.3 } : undefined}
              />
              <span className={`text-xs uppercase tracking-wider ${
                isActive ? 'text-text-secondary' : 'text-text-ghost/50'
              }`}>
                {PHASE_LABELS[phase]}
              </span>
            </div>
            {index < phases.length - 1 && (
              <div className={`w-12 h-px mx-2 ${
                isPast ? 'bg-text-ghost/30' : 'bg-border'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * OpportunityRow — Single opportunity line in AUTRES PISTES
 *
 * ● Bastille      ▲  ~18 min restant  [=====>    ]
 * ○ Pigalle       →  ouvre ~12 min
 * · Gare du Nord  ▼  ouvre ~45 min
 */
function OpportunityRow({
  opportunity,
  index,
  breathPhase,
}: {
  opportunity: Opportunity
  index: number
  breathPhase: number
}) {
  // Defensive: ensure opportunity has required fields
  if (!opportunity || !opportunity.state) return null

  const { state = 'horizon', momentum = 'stable', minutesRemaining = 0, windowProgress = 0, ou = '', kind = 'piste' } = opportunity
  const stateSymbol = STATE_SYMBOLS[state] || '·'
  const momentumArrow = MOMENTUM_ARROWS[momentum] || '→'
  const stateColor = STATE_COLORS[state] || 'text-text-ghost'
  const momentumColor = MOMENTUM_COLORS[momentum] || 'text-text-ghost'
  const pressureLabel = getPressureLabel(state, minutesRemaining)

  // Active dots pulse
  const isActive = state === 'active'
  const isClosing = state === 'closing'

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...STAGGER_1, delay: 0.04 * index }}
      className="flex items-center gap-3 px-4 py-2 rounded-lg bg-surface/50"
    >
      {/* State symbol with pulse animation for active */}
      <motion.span
        className={`text-lg ${stateColor}`}
        animate={isActive ? {
          opacity: [0.6, 1, 0.6],
          scale: [1, 1.1, 1],
        } : isClosing ? {
          opacity: [0.7, 1, 0.7],
        } : {}}
        transition={{ duration: 2, repeat: Infinity }}
        style={isActive ? { opacity: 0.6 + breathPhase * 0.4 } : undefined}
      >
        {stateSymbol}
      </motion.span>

      {/* Zone name */}
      <span className={`text-sm flex-1 ${
        state === 'active' ? 'text-text-primary' :
        state === 'closing' ? 'text-text-secondary' :
        'text-text-ghost'
      }`}>
        {ou}
        {/* Piste indicator */}
        {kind === 'piste' && (
          <span className="ml-2 text-[10px] text-amber-400/70 border border-amber-400/30 rounded px-1">
            à tenter
          </span>
        )}
      </span>

      {/* Momentum arrow */}
      <span className={`text-xs ${momentumColor}`}>
        {momentumArrow}
      </span>

      {/* Pressure label */}
      <span className="text-xs text-text-ghost w-28 text-right">
        {pressureLabel}
      </span>

      {/* Progress bar for active/closing windows */}
      {(state === 'active' || state === 'closing') && (
        <div className="w-16 h-1.5 bg-border-subtle rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              state === 'closing' ? 'bg-intent' : 'bg-signal'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, windowProgress * 100)}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}
    </motion.div>
  )
}
