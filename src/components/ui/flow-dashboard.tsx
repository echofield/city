'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Navigation, Radar, X, HelpCircle } from 'lucide-react'
import type { ActionType } from '@/lib/flow-engine/driver-anchor'
import type { ShiftPhase, CorridorStatus } from '@/types/flow-view-model'
import type { SignalCertainty, PisteCategory } from '@/lib/flow-vocabulary'

// ════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════

export type ViewMode = 'read' | 'radar'

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

  // Corridor statuses
  corridorStatuses?: CorridorStatus[]

  // Signal list (with certainty: confirme vs piste)
  signals?: FlowSignal[]

  // Next lead in the quest chain
  prochainePiste?: ProchainePiste

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

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════

export function FlowDashboard(props: FlowDashboardProps) {
  const [mode, setMode] = useState<ViewMode>('read')
  const [countdown, setCountdown] = useState(props.secondsLeft || 0)

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
  onNavigate: () => void
  onOpenRadar: () => void
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
  styles,
  countdown,
  formatTime,
  onNavigate,
  onOpenRadar,
}: ReadModeProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            currentPhase === 'pic' ? 'bg-signal animate-pulse' :
            currentPhase === 'montee' ? 'bg-intent' :
            'bg-text-ghost'
          }`} />
          <span className="text-xs text-text-ghost uppercase tracking-wider">
            {currentPhase ? PHASE_LABELS[currentPhase] : 'CALME'}
          </span>
          {corridor && (
            <>
              <span className="text-text-ghost/30">/</span>
              <span className="text-xs text-text-ghost uppercase">{corridor}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          {confidence !== undefined && (
            <span className="text-text-ghost">{Math.round(confidence * 100)}%</span>
          )}
          {eurEstimate && (
            <span className="text-signal font-mono">
              {eurEstimate.low} EUR
            </span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Timer */}
        {countdown > 0 && windowLabel && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
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
          transition={{ delay: 0.1 }}
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
          transition={{ delay: 0.2 }}
          className="text-sm text-text-ghost text-center max-w-sm"
        >
          {cause}
        </motion.p>
      </div>

      {/* Stats footer */}
      {stats && (
        <div className="grid grid-cols-4 gap-px bg-border-subtle mx-4 rounded-lg overflow-hidden">
          <StatBox label="ETA" value={`${stats.eta}`} unit="min" />
          <StatBox label="SATURATION" value={`${stats.saturation}`} unit="%" color="green" />
          <StatBox label="OPPORTUNITÉ" value={`${stats.opportunite}`} unit="%" color="amber" />
          <StatBox label="EUR/H" value={`${stats.eurH.low}-${stats.eurH.high}`} color="signal" />
        </div>
      )}

      {/* Friction & Prochain */}
      <div className="px-4 py-3 space-y-2 text-sm">
        {friction && (
          <div className="flex items-center gap-3">
            <span className="text-intent text-xs uppercase tracking-wider w-16">FRICTION</span>
            <span className="text-text-secondary">{friction.label}</span>
            <span className="text-signal text-xs ml-auto">{friction.implication}</span>
          </div>
        )}
        {prochain && (
          <div className="flex items-center gap-3">
            <span className="text-signal text-xs uppercase tracking-wider w-16">PROCHAIN</span>
            <span className="text-text-ghost font-mono">{prochain.time}</span>
            <span className="text-text-secondary">{prochain.zone}</span>
            <span className="text-text-ghost text-xs">{prochain.type}</span>
          </div>
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
  etaMin,
  entrySide,
  opp,
  fric,
  cost,
  friction,
  eurEstimate,
  signals,
  prochainePiste,
  currentPhase,
  corridor,
  confidence,
  corridorStatuses,
  mapComponent,
  styles,
  countdown,
  formatTime,
  onNavigate,
  onClose,
  onDispatch,
  onEndShift,
}: RadarModeProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex"
    >
      {/* Left: Map */}
      <div className="flex-1 relative">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-border text-text-ghost hover:text-text-secondary text-xs uppercase tracking-wider"
            >
              READ
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-border">
              <span className={`w-2 h-2 rounded-full ${
                currentPhase === 'pic' ? 'bg-signal' :
                currentPhase === 'montee' ? 'bg-intent' :
                'bg-text-ghost'
              }`} />
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
        </div>

        {/* Map area */}
        <div className="absolute inset-0 flex items-center justify-center">
          {mapComponent || (
            <div className="text-text-ghost text-sm">Map</div>
          )}
        </div>
      </div>

      {/* Right: Panel */}
      <div className="w-96 bg-void border-l border-border-subtle flex flex-col">
        {/* Timer section */}
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                currentPhase === 'pic' ? 'bg-signal animate-pulse' : 'bg-intent'
              }`} />
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

          {/* Action */}
          <div className={`border-l-4 ${styles.border} pl-4 mb-4`}>
            <p
              className={`text-4xl font-light tracking-wide ${styles.text}`}
              style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}
            >
              {ACTION_LABELS[action].split(' ').map((word, i) => (
                <span key={i} className="block">{word}</span>
              ))}
            </p>
          </div>

          {/* Zone info */}
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-2xl text-text-primary font-light tracking-wide">
              {zone.toUpperCase()}
            </p>
            {arrondissement && (
              <span className="text-sm text-text-ghost">{arrondissement}</span>
            )}
          </div>

          {/* Distance & ETA */}
          {(distanceKm !== undefined || etaMin !== undefined) && (
            <div className="flex items-center gap-4 text-sm text-text-ghost mb-2">
              {distanceKm !== undefined && <span>{distanceKm} km</span>}
              {distanceKm !== undefined && etaMin !== undefined && <span>|</span>}
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
            <div className="grid grid-cols-3 gap-2 mb-4">
              <ScoreBox label="OPP" value={opp ?? 0} color="signal" />
              <ScoreBox label="FRIC" value={fric ?? 0} color="intent" />
              <ScoreBox label="COST" value={cost ?? 0} color="alert" />
            </div>
          )}

          {/* Cause */}
          <p className="text-sm text-text-ghost mb-4">{cause}</p>

          {/* Navigate button */}
          <button
            onClick={onNavigate}
            className="w-full py-3 rounded-lg border border-border text-text-primary hover:bg-surface transition-colors flex items-center justify-center gap-2"
          >
            <span className="uppercase tracking-wider">NAVIGUER</span>
            <span>→</span>
          </button>
        </div>

        {/* Friction section */}
        {friction && (
          <div className="px-6 py-4 border-b border-border-subtle">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-text-ghost uppercase tracking-wider">FRICTION</span>
                <p className="text-sm text-text-secondary">{friction.label}</p>
              </div>
              <span className="text-xs text-signal">{friction.implication}</span>
            </div>
          </div>
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
          <div className="px-6 py-4 border-b border-border-subtle bg-amber-400/5">
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
          </div>
        )}

        {/* Signals list — confirmed vs piste */}
        {signals && signals.length > 0 && (
          <div className="px-6 py-4 border-b border-border-subtle space-y-2">
            {signals.map((sig, i) => {
              const isPiste = sig.certainty === 'piste'
              return (
                <div key={i} className={`flex items-center gap-2 ${isPiste ? 'opacity-75' : ''}`}>
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
                </div>
              )
            })}
          </div>
        )}

        {/* Shift Arc */}
        <div className="px-6 py-4 mt-auto">
          <ShiftArcMini currentPhase={currentPhase} />
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

function ShiftArcMini({ currentPhase }: { currentPhase?: ShiftPhase }) {
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
              <span className={`w-2 h-2 rounded-full mb-1 ${
                isActive ? (
                  phase === 'pic' ? 'bg-signal' :
                  phase === 'montee' ? 'bg-intent' :
                  'bg-text-ghost'
                ) :
                isPast ? 'bg-text-ghost/50' :
                'bg-border'
              }`} />
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
