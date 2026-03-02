'use client'

import { Panel } from '@/components/ui/panel'
import { StatusBar } from '@/components/ui/status-bar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchCompiledBrief } from '@/lib/flow-engine/client'
import { estimatePotentialGain, getDriverPerformance } from '@/lib/flow-engine'
import { createMockSession, generateNextMove, calculateShiftArc, type ArcContext } from '@/lib/shift-conductor'
import { ShiftArc } from '@/components/ui/shift-arc'
import { ParisFieldMap } from '@/components/map/ParisFieldMap'
import { useFieldState } from '@/lib/field-state'
import type { CompiledBrief, NowBlock, NextBlock, HorizonBlock } from '@/lib/prompts/contracts'
import type { ShiftSession, NextMove, PastMove } from '@/lib/shift-conductor/contracts'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Copy, History, Map, Moon, Navigation, Sun, Terminal } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, useCallback, useRef } from 'react'

// Instrument-speed animations (180-220ms)
const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.18 }
}

const slideUp = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22 }
}

// Haptic feedback for mobile
function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(10)
  }
}

// Map zone names from brief to zone IDs (matching paris-zones.ts)
function mapZoneNameToId(name: string): string | null {
  const normalizedName = name.toLowerCase().trim()

  // Direct ID matches
  const directIds = [
    'gare-nord', 'gare-est', 'gare-lyon', 'saint-lazare', 'montparnasse',
    'bastille', 'oberkampf', 'pigalle', 'marais', 'chatelet',
    'opera', 'madeleine', 'champs', 'trocadero', 'invalides',
    'defense', 'latin', 'republique', 'belleville', 'nation', 'bercy'
  ]

  for (const id of directIds) {
    if (normalizedName.includes(id.replace('-', ' ')) || normalizedName.includes(id)) {
      return id
    }
  }

  // Common name mappings to zone IDs
  const mappings: Record<string, string> = {
    'opéra': 'opera',
    'opera': 'opera',
    'gare de lyon': 'gare-lyon',
    'lyon': 'gare-lyon',
    'gare du nord': 'gare-nord',
    'nord': 'gare-nord',
    'gare de l\'est': 'gare-est',
    'est': 'gare-est',
    'lazare': 'saint-lazare',
    'st lazare': 'saint-lazare',
    'montmartre': 'pigalle',
    'pigalle': 'pigalle',
    'bastille': 'bastille',
    'république': 'republique',
    'republique': 'republique',
    'marais': 'marais',
    'châtelet': 'chatelet',
    'chatelet': 'chatelet',
    'louvre': 'chatelet',
    'saint-germain': 'latin',
    'st-germain': 'latin',
    'latin': 'latin',
    'quartier latin': 'latin',
    'montparnasse': 'montparnasse',
    'belleville': 'belleville',
    'ménilmontant': 'belleville',
    'nation': 'nation',
    'étoile': 'champs',
    'etoile': 'champs',
    'champs-élysées': 'champs',
    'champs-elysees': 'champs',
    'champs': 'champs',
    'trocadéro': 'trocadero',
    'trocadero': 'trocadero',
    'bercy': 'bercy',
    'invalides': 'invalides',
    'tour eiffel': 'invalides',
    'eiffel': 'invalides',
    'la défense': 'defense',
    'defense': 'defense',
    'défense': 'defense',
    'oberkampf': 'oberkampf',
    'madeleine': 'madeleine',
  }

  for (const [key, value] of Object.entries(mappings)) {
    if (normalizedName.includes(key)) {
      return value
    }
  }

  return null
}

export default function DashboardPage() {
  const [brief, setBrief] = useState<CompiledBrief | null>(null)
  const [session, setSession] = useState<ShiftSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [denseMode, setDenseMode] = useState(false)
  const [rulesCopied, setRulesCopied] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [timeView, setTimeView] = useState<'now' | 'next' | 'tonight' | 'full'>('now')
  const [showOps, setShowOps] = useState(false)
  const [showMap, setShowMap] = useState(true)

  // Field state actions for map initialization
  const initializeZones = useFieldState((s) => s.initializeZones)
  const setReadabilityLevel = useFieldState((s) => s.setReadabilityLevel)
  const revealZones = useFieldState((s) => s.revealZones)
  const revealCorridors = useFieldState((s) => s.revealCorridors)
  const revealLabels = useFieldState((s) => s.revealLabels)
  const revealRhythm = useFieldState((s) => s.revealRhythm)
  const updateZone = useFieldState((s) => s.updateZone)

  // Calculate shift arc (updates on each render, could be memoized)
  const shiftArc = calculateShiftArc({
    now: new Date(),
    dayOfWeek: new Date().getDay(),
    // In production: pass events, rain, disruptions from brief
    majorEvents: brief?.alerts
      ?.filter(a => a.type === 'EVENT')
      ?.map(a => ({
        name: a.area,
        zone: a.area,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        capacity: 'MED' as const
      })),
  })

  // Initialize shift session
  useEffect(() => {
    fetchCompiledBrief()
      .then(setBrief)
      .catch((e) => setError(e?.message ?? 'Erreur chargement'))
      .finally(() => setLoading(false))

    // Create mock shift session
    setSession(createMockSession('mock-driver-001'))

    // Initialize field map state
    initializeZones()
    setReadabilityLevel(1)
    revealZones()
    revealCorridors()
    revealLabels()
    revealRhythm()

    // Set base intensity for all zones so they're visible
    const baseZones = [
      'gare-nord', 'gare-est', 'gare-lyon', 'saint-lazare', 'montparnasse',
      'bastille', 'oberkampf', 'pigalle', 'marais', 'chatelet',
      'opera', 'madeleine', 'champs', 'trocadero', 'invalides',
      'defense', 'latin', 'republique', 'belleville', 'nation', 'bercy'
    ]
    baseZones.forEach(zoneId => {
      updateZone(zoneId, { intensity: 0.3, phase: 'echo', volatility: 0.2, confidence: 0.5 })
    })
  }, [initializeZones, setReadabilityLevel, revealZones, revealCorridors, revealLabels, revealRhythm, updateZone])

  // Sync brief data to field map
  useEffect(() => {
    if (!brief) return

    // Map hotspot zones to field state
    const zoneScoreMap: Record<string, number> = {}

    // Process hotspots
    brief.hotspots.forEach((spot) => {
      const zoneId = mapZoneNameToId(spot.zone)
      if (zoneId) {
        zoneScoreMap[zoneId] = Math.max(zoneScoreMap[zoneId] ?? 0, spot.score / 100)
      }
    })

    // Process timeline
    brief.timeline.forEach((slot) => {
      const zoneId = mapZoneNameToId(slot.primary_zone)
      if (zoneId) {
        const intensity = slot.saturation_risk === 'HIGH' ? 0.9 :
                         slot.saturation_risk === 'MED' ? 0.7 : 0.5
        zoneScoreMap[zoneId] = Math.max(zoneScoreMap[zoneId] ?? 0, intensity)
      }
    })

    // Process alerts
    brief.alerts.forEach((alert) => {
      const zoneId = mapZoneNameToId(alert.area)
      if (zoneId) {
        const intensity = alert.severity === 'HIGH' ? 0.95 :
                         alert.severity === 'MED' ? 0.75 : 0.5
        zoneScoreMap[zoneId] = Math.max(zoneScoreMap[zoneId] ?? 0, intensity)
      }
    })

    // Apply to field state
    Object.entries(zoneScoreMap).forEach(([zoneId, intensity]) => {
      const phase = intensity > 0.8 ? 'peak' :
                   intensity > 0.6 ? 'active' :
                   intensity > 0.4 ? 'forming' : 'echo'
      updateZone(zoneId, {
        intensity,
        phase,
        volatility: 0.3 + intensity * 0.4,
        confidence: brief.meta.confidence_overall,
      })
    })
  }, [brief, updateZone])

  // Auto-refresh move every 90 seconds (simulating real orchestration)
  useEffect(() => {
    if (!session) return

    const interval = setInterval(() => {
      const newMove = generateNextMove(session.position.zone)
      setSession(prev => prev ? {
        ...prev,
        current_move: newMove,
        // Add to history if previous move existed
        history: prev.current_move ? [
          {
            id: prev.current_move.id,
            timestamp: prev.current_move.timing.issued_at,
            state: prev.current_move.state,
            target: prev.current_move.target.zone,
            outcome: Math.random() > 0.3 ? 'followed' : 'ignored',
            result: {
              followed: Math.random() > 0.3,
              pickup_achieved: Math.random() > 0.4,
              time_to_pickup_minutes: 4 + Math.floor(Math.random() * 8),
              earnings_delta: Math.floor(Math.random() * 25) - 5,
            },
          },
          ...prev.history.slice(0, 4), // Keep last 5
        ] : prev.history,
      } : null)
      triggerHaptic()
    }, 90000) // 90 seconds

    return () => clearInterval(interval)
  }, [session?.position.zone])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }, [])

  const copyRules = useCallback(() => {
    if (!brief) return
    const rulesText = brief.rules
      .map((r, i) => `${i + 1}. Si ${r.if} → ${r.then}`)
      .join('\n')
    navigator.clipboard.writeText(`Règles ${new Date().toLocaleDateString('fr-FR')}\n\n${rulesText}`)
    setRulesCopied(true)
    triggerHaptic()
    setTimeout(() => setRulesCopied(false), 2000)
  }, [brief])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void">
        <div className="text-text-ghost text-sm">Chargement...</div>
      </div>
    )
  }

  if (error || !brief) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void">
        <Panel className="p-6">
          <p className="text-alert text-sm">{error ?? 'Données non disponibles'}</p>
        </Panel>
      </div>
    )
  }

  const gain = estimatePotentialGain(brief)
  const performance = getDriverPerformance('mock-user')
  const lastUpdate = new Date(brief.meta.generated_at)
  const minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 60000)
  const timeAgo = minutesAgo < 60 ? `${minutesAgo}min` : `${Math.floor(minutesAgo / 60)}h`

  return (
    <div className="min-h-screen bg-void">
      {/* LAYER 1: ORIENTATION (0-0.5s) - Field State Header */}
      <header className="border-b border-border-subtle sticky top-0 bg-void/95 backdrop-blur-sm z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-signal animate-field-pulse" />
              <span className="text-xs text-text-secondary uppercase tracking-wider">Champ confirmé</span>
            </div>
            <span className="text-xs text-text-ghost">·</span>
            <span className="text-xs text-text-ghost">{Math.round(brief.meta.confidence_overall * 100)}%</span>
            <span className="text-xs text-text-ghost">·</span>
            <span className="text-xs text-text-ghost">{timeAgo}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/replay"
              className="p-1.5 rounded border border-border text-text-ghost hover:text-text-secondary transition-colors"
            >
              <History className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={() => { setShowMap(!showMap); triggerHaptic() }}
              className={`p-1.5 rounded border transition-colors ${
                showMap ? 'border-signal/50 text-signal' : 'border-border text-text-ghost'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowOps(!showOps)}
              className={`p-1.5 rounded border transition-colors ${
                showOps ? 'border-signal/50 text-signal' : 'border-border text-text-ghost'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded border border-border text-text-ghost"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </header>

      {/* SHIFT ARC - Temporal Rhythm */}
      <div className="max-w-2xl mx-auto px-4 pt-3">
        <ShiftArc arc={shiftArc} />
      </div>

      {/* PARIS FIELD MAP - Spatial Intelligence */}
      <AnimatePresence>
        {showMap && (
          <motion.div
            className="max-w-2xl mx-auto px-4 pt-3"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="rounded-lg border border-border-subtle overflow-hidden bg-surface">
              <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
                <span className="text-xs text-text-ghost uppercase tracking-wider">Champ spatial</span>
                <span className="text-xs text-text-ghost">{Math.round((brief?.meta.confidence_overall ?? 0) * 100)}% confiance</span>
              </div>
              <div className="relative" style={{ height: '280px' }}>
                <ParisFieldMap className="w-full h-full" />
              </div>
              {/* Map legend */}
              <div className="px-3 py-2 border-t border-border-subtle flex items-center gap-4 text-xs text-text-ghost">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#2a5542]" />
                  <span>Actif</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#5c4d2e]" />
                  <span>Formation</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#252422]" />
                  <span>Calme</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Time View Selector - compact */}
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex gap-1 text-xs">
          {(['now', 'next', 'tonight', 'full'] as const).map((view) => (
            <button
              key={view}
              onClick={() => { setTimeView(view); triggerHaptic() }}
              className={`px-3 py-1.5 rounded transition-colors ${
                timeView === view
                  ? 'bg-surface-raised text-text-primary'
                  : 'text-text-ghost'
              }`}
            >
              {view === 'now' && 'Maintenant'}
              {view === 'next' && 'Prochain'}
              {view === 'tonight' && 'Ce soir'}
              {view === 'full' && 'Complet'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content - Mobile-first vertical reading */}
      <main className="max-w-2xl mx-auto px-4 pb-12">
        <AnimatePresence mode="wait">
          {timeView === 'now' && session && (
            <FlowActiveView key="now" session={session} gain={gain} />
          )}
          {timeView === 'next' && <NextView key="next" block={brief.next_block} dense={denseMode} />}
          {timeView === 'tonight' && <TonightView key="tonight" block={brief.horizon_block} dense={denseMode} />}
          {timeView === 'full' && (
            <motion.div key="full" {...fadeIn}>
              <Tabs defaultValue="today" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="today">Aujourd'hui</TabsTrigger>
                  <TabsTrigger value="alerts">Alertes</TabsTrigger>
                  <TabsTrigger value="dispatch">Dispatch</TabsTrigger>
                </TabsList>

                <TabsContent value="today">
                  <BriefDisplay brief={brief} dense={denseMode} gain={gain} performance={performance} onCopyRules={copyRules} rulesCopied={rulesCopied} />
                </TabsContent>

                <TabsContent value="alerts">
                  <AlertsDisplay alerts={brief.alerts} dense={denseMode} />
                </TabsContent>

                <TabsContent value="dispatch">
                  <DispatchDisplay antiClustering={brief.anti_clustering} validation={brief.validation} />
                </TabsContent>
              </Tabs>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Operator Panel */}
        {showOps && <OperatorPanel brief={brief} />}
      </main>
    </div>
  )
}

interface BriefDisplayProps {
  brief: CompiledBrief
  dense: boolean
  gain: { min: number; max: number; confidence: number }
  performance: { activeTimeChange: number; gainVsAverage: number; repositioningsYesterday: number; modelConfidenceTrend: 'up' | 'down' | 'stable' }
  onCopyRules: () => void
  rulesCopied: boolean
}

function BriefDisplay({ brief, dense, gain, performance, onCopyRules, rulesCopied }: BriefDisplayProps) {
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null)
  const spacing = dense ? 'space-y-3' : 'space-y-4'

  return (
    <motion.div {...fadeIn} className={spacing}>
      {/* LAYER 2: DECISION - Actions prioritaires (FIRST) */}
      <div className="action-block rounded-lg">
        <h2 className="text-xs text-text-ghost uppercase tracking-wider mb-3">Actions prioritaires</h2>
        <ul className="space-y-2">
          {brief.summary.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-signal">↑</span>
              <span className="text-text-primary">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* LAYER 3: CONFIRMATION - Gain estimate */}
      <div className="flex items-center justify-between px-3 py-3 rounded bg-surface border border-border-subtle">
        <div>
          <p className="text-xs text-text-ghost mb-0.5">Gain estimé ce soir</p>
          <p className="text-lg text-text-primary">
            <span className="text-signal">+{gain.min}€</span>
            <span className="text-text-ghost mx-1">–</span>
            <span className="text-signal">+{gain.max}€</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-ghost">Confiance</p>
          <p className="text-lg text-text-primary">{Math.round(gain.confidence * 100)}%</p>
        </div>
      </div>

      {/* Performance stats - scroll reward (lower priority) */}
      <div className="px-3 py-3 rounded bg-surface border border-border-subtle">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs text-text-ghost uppercase tracking-wider">Résultats 7j</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-text-primary">+{performance.activeTimeChange}%</p>
            <p className="text-xs text-text-ghost">temps actif</p>
          </div>
          <div>
            <p className="text-text-primary"><span className="text-signal">+{performance.gainVsAverage}€</span>/soir</p>
            <p className="text-xs text-text-ghost">vs moyenne</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border-subtle text-sm text-text-secondary">
          <div className="flex items-center gap-2">
            <span className="text-signal">●</span>
            <span>{performance.repositioningsYesterday} repositionnements hier</span>
          </div>
        </div>
      </div>

      {/* Timeline - reduced contrast, background cognition */}
      <div className="px-3 py-3 rounded bg-surface border border-border-subtle">
        <h2 className="text-xs text-text-ghost uppercase tracking-wider mb-3">Timeline</h2>
        <div className="space-y-2">
          {brief.timeline.map((slot, i) => (
            <div key={i} className="timeline-slot">
              <button
                onClick={() => setExpandedSlot(expandedSlot === i ? null : i)}
                className="w-full text-left flex items-center gap-3 p-2 rounded hover:bg-surface-raised transition-colors"
              >
                <div className="w-20 flex-shrink-0">
                  <span className="text-xs font-mono text-text-ghost">{slot.start}–{slot.end}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-text-primary">{slot.primary_zone}</span>
                </div>
                <SaturationBadge level={slot.saturation_risk} />
                <span className="text-text-ghost">{expandedSlot === i ? '−' : '+'}</span>
              </button>
              {expandedSlot === i && (
                <motion.div {...fadeIn} className="ml-20 pl-3 pb-2 text-xs space-y-2">
                  <p className="text-text-ghost">{slot.reason}</p>
                  <p className="text-text-secondary">Arriver {slot.best_arrival} · Sortir {slot.best_exit}</p>
                  {slot.alternatives.length > 0 && (
                    <p className="text-text-ghost">Alt: {slot.alternatives.join(', ')}</p>
                  )}
                  {slot.avoid_axes.length > 0 && (
                    <p className="text-alert-muted">Éviter: {slot.avoid_axes.join(', ')}</p>
                  )}
                  <a
                    href={`https://waze.com/ul?q=${encodeURIComponent(slot.primary_zone + ' Paris')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => triggerHaptic()}
                    className="inline-flex items-center gap-1 text-signal"
                  >
                    <Navigation className="w-3 h-3" /> Ouvrir
                  </a>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Hotspots - compact list */}
      <div className="px-3 py-3 rounded bg-surface border border-border-subtle">
        <h2 className="text-xs text-text-ghost uppercase tracking-wider mb-3">Zones chaudes</h2>
        <div className="space-y-2">
          {brief.hotspots.map((spot, i) => (
            <a
              key={i}
              href={`https://waze.com/ul?q=${encodeURIComponent(spot.zone + ' Paris')}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => triggerHaptic()}
              className="flex items-center gap-3 p-2 rounded hover:bg-surface-raised transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-text-primary text-sm">{spot.zone}</span>
                  <span className="text-signal text-xs font-mono">{spot.score}</span>
                  <SaturationBadge level={spot.saturation_risk} />
                </div>
                <p className="text-xs text-text-ghost">{spot.window} · {spot.why.join(' · ')}</p>
              </div>
              <Navigation className="w-4 h-4 text-signal flex-shrink-0" />
            </a>
          ))}
        </div>
      </div>

      {/* Rules - copyable */}
      <div className="px-3 py-3 rounded bg-surface border border-border-subtle">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs text-text-ghost uppercase tracking-wider">Règles du jour</h2>
          <button
            onClick={onCopyRules}
            className="text-xs text-text-ghost hover:text-text-secondary"
          >
            {rulesCopied ? '● Copié' : 'Copier'}
          </button>
        </div>
        <div className="space-y-1.5 text-sm">
          {brief.rules.map((rule, i) => (
            <div key={i} className="flex items-start gap-2 text-text-secondary">
              <span className="text-text-ghost">{i + 1}.</span>
              <span>
                Si <span className="text-text-primary">{rule.if}</span>
                {' → '}
                <span className="text-text-primary">{rule.then}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback - minimal */}
      {brief.feedback && (
        <div className="flex items-center justify-between px-3 py-2 text-xs text-text-ghost">
          <span>Utilité 7j: {Math.round(brief.feedback.last_7d_helpfulness * 100)}%</span>
          <span>Précision hier: {Math.round(brief.feedback.yesterday_accuracy_estimate * 100)}%</span>
        </div>
      )}
    </motion.div>
  )
}

function AlertsDisplay({ alerts, dense }: { alerts: CompiledBrief['alerts']; dense: boolean }) {
  if (alerts.length === 0) {
    return (
      <div className="px-3 py-8 text-center">
        <p className="text-text-ghost text-sm">Aucune alerte active</p>
      </div>
    )
  }

  const severityGlyphs = {
    LOW: '○',
    MED: '◐',
    HIGH: '●',
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`px-3 py-3 rounded border-l-2 bg-surface ${
            alert.severity === 'HIGH' ? 'border-alert' :
            alert.severity === 'MED' ? 'border-intent' : 'border-calm'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className={alert.severity === 'HIGH' ? 'text-alert' : 'text-intent'}>
              {severityGlyphs[alert.severity]}
            </span>
            <span className="text-xs uppercase tracking-wider text-text-ghost">{alert.type}</span>
            <span className="text-xs text-text-ghost">· {alert.window}</span>
          </div>
          <p className="text-text-primary text-sm mb-2">{alert.area}</p>
          <div className="space-y-1 text-xs">
            {alert.avoid.length > 0 && (
              <p className="text-text-secondary">
                <span className="text-alert-muted">Éviter:</span> {alert.avoid.join(', ')}
              </p>
            )}
            {alert.opportunity.length > 0 && (
              <p className="text-text-secondary">
                <span className="text-signal">↑</span> {alert.opportunity.join(', ')}
              </p>
            )}
            {alert.notes.length > 0 && (
              <p className="text-text-ghost">{alert.notes.join(' · ')}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function DispatchDisplay({ antiClustering, validation }: { antiClustering: CompiledBrief['anti_clustering']; validation: CompiledBrief['validation'] }) {
  return (
    <div className="space-y-3">
      {/* Répartition */}
      <div className="px-3 py-3 rounded bg-surface border border-border-subtle">
        <h2 className="text-xs text-text-ghost uppercase tracking-wider mb-3">Répartition</h2>
        <p className="text-sm text-text-secondary mb-3">{antiClustering.principle}</p>
        <div className="space-y-2">
          {antiClustering.dispatch_hint.map((hint, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="text-text-primary">{hint.hotspot}</span>
              <span className="text-text-ghost">→</span>
              <span className="text-signal">{hint.split_into.join(' / ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Incertitudes */}
      <div className="px-3 py-3 rounded bg-surface border border-border-subtle">
        <h2 className="text-xs text-text-ghost uppercase tracking-wider mb-3">Incertitudes</h2>
        {validation.unknowns.length > 0 && (
          <ul className="text-sm text-text-secondary space-y-1 mb-3">
            {validation.unknowns.map((u, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-text-ghost">?</span>
                <span>{u}</span>
              </li>
            ))}
          </ul>
        )}
        {validation.do_not_assume.length > 0 && (
          <ul className="text-sm text-text-secondary space-y-1">
            {validation.do_not_assume.map((d, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-intent">▲</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function SaturationBadge({ level }: { level: 'LOW' | 'MED' | 'HIGH' }) {
  // Reduced intensity - background cognition
  const styles = {
    LOW: 'saturation-low',
    MED: 'saturation-med',
    HIGH: 'saturation-high',
  }
  const glyphs = {
    LOW: '○',
    MED: '◐',
    HIGH: '●',
  }

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${styles[level]}`}>
      {glyphs[level]}
    </span>
  )
}

// ============================================
// FLOW ACTIVE VIEW (Shift Conductor)
// ============================================

interface FlowActiveViewProps {
  session: ShiftSession
  gain: { min: number; max: number; confidence: number }
}

function FlowActiveView({ session, gain }: FlowActiveViewProps) {
  const [countdown, setCountdown] = useState(0)
  const move = session.current_move

  // Live countdown timer
  useEffect(() => {
    if (!move) return

    const updateCountdown = () => {
      const elapsed = (Date.now() - new Date(move.timing.issued_at).getTime()) / 1000
      const remaining = Math.max(0, move.timing.expiry_seconds - elapsed)
      setCountdown(Math.floor(remaining))
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [move])

  if (!move) {
    return (
      <div className="px-3 py-8 text-center">
        <p className="text-text-ghost">Initialisation du flux...</p>
      </div>
    )
  }

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Field state labels - ecological, not analytical
  const stateLabels: Record<string, string> = {
    WINDOW_OPENING: 'Fenêtre en formation',
    WINDOW_ACTIVE: 'Fenêtre active',
    WINDOW_CLOSING: 'Fenêtre se ferme',
    FLOW_SHIFT: 'Flux en mouvement',
    HOLD_POSITION: 'Maintenir position',
    RESET: 'Phase calme',
  }

  const stateColors: Record<string, string> = {
    WINDOW_OPENING: 'text-intent',
    WINDOW_ACTIVE: 'text-signal',
    WINDOW_CLOSING: 'text-alert-muted',
    FLOW_SHIFT: 'text-signal',
    HOLD_POSITION: 'text-calm',
    RESET: 'text-text-ghost',
  }

  // CSS class for window animation
  const windowClass = move.state === 'WINDOW_ACTIVE' ? 'window-active' :
                      move.state === 'WINDOW_OPENING' ? 'window-opening' :
                      move.state === 'WINDOW_CLOSING' ? 'window-closing' : ''

  const isHoldState = move.state === 'HOLD_POSITION' || move.state === 'WINDOW_ACTIVE'

  return (
    <motion.div {...slideUp} className="space-y-3">
      {/* FIELD STATE - The living instrument */}
      <div className={`action-block rounded-lg relative overflow-hidden ${windowClass}`}>
        {/* State indicator + window timing */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${stateColors[move.state]} ${move.state === 'WINDOW_ACTIVE' ? 'animate-field-pulse' : ''}`}
              style={{ backgroundColor: 'currentColor' }}
            />
            <span className={`text-xs uppercase tracking-wider ${stateColors[move.state]}`}>
              {stateLabels[move.state] || move.state}
            </span>
          </div>
          <div className="text-right">
            <span className={`font-mono text-lg ${countdown < 60 ? 'text-intent' : 'text-text-primary'}`}>
              {formatCountdown(countdown)}
            </span>
          </div>
        </div>

        {/* Primary target - THE action (ARCHÉ serif) */}
        <div className="mb-3">
          <p className={`text-2xl font-light ${stateColors[move.state]}`} style={{ fontFamily: 'var(--font-serif)' }}>
            {isHoldState ? 'Reste ici' : move.target.zone}
          </p>
          {move.target.specifics && (
            <p className="text-sm text-text-ghost mt-1">{move.target.specifics}</p>
          )}
        </div>

        {/* Temporal confidence - the key insight */}
        <div className="mb-4 p-2 rounded bg-surface/50">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-text-ghost">Pickup attendu</span>
            <span className="text-text-primary">
              {move.timing.pickup_window.min_minutes}–{move.timing.pickup_window.max_minutes} min
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-ghost">Probabilité</span>
            <span className={move.confidence_label === 'HIGH' ? 'text-signal' : 'text-text-primary'}>
              {move.confidence_label || 'MODERATE'}
            </span>
          </div>
        </div>

        {/* Hold message - temporal confidence */}
        {move.hold_message && (
          <p className="text-xs text-intent mb-4 flex items-center gap-2">
            <span>▲</span>
            <span>{move.hold_message}</span>
          </p>
        )}

        {/* Signals - physical, not analytical */}
        <div className="flex flex-wrap gap-2 mb-4">
          {move.signals.map((signal, i) => (
            <span key={i} className="text-xs px-2 py-1 rounded bg-surface text-text-secondary">
              {signal}
            </span>
          ))}
        </div>

        {/* Action button (ARCHÉ: 400ms + shadow) */}
        <a
          href={`https://waze.com/ul?q=${encodeURIComponent(move.target.zone + ' Paris')}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => triggerHaptic()}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-signal/10 border border-signal/30 text-signal text-sm font-medium hover:bg-signal/20 active:bg-signal/30"
          style={{ transition: 'var(--transition-base)', boxShadow: 'var(--shadow-sm)' }}
        >
          <Navigation className="w-4 h-4" />
          <span>Ouvrir navigation</span>
        </a>

        {/* Alternatives */}
        {move.alternatives && move.alternatives.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border-subtle">
            <p className="text-xs text-text-ghost mb-2">Si saturé:</p>
            <div className="flex gap-2">
              {move.alternatives.map((alt, i) => (
                <a
                  key={i}
                  href={`https://waze.com/ul?q=${encodeURIComponent(alt + ' Paris')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => triggerHaptic()}
                  className="text-xs px-2 py-1 rounded border border-border text-text-secondary hover:border-text-ghost"
                >
                  {alt}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* GAIN confirmation */}
      <div className="flex items-center justify-between px-1 py-2 text-sm">
        <span className="text-signal">+{gain.min}€ – {gain.max}€</span>
        <span className="text-text-ghost">estimé ce soir</span>
      </div>

      {/* FLOW MEMORY - Continuity ribbon */}
      {session.history.length > 0 && (
        <div className="px-3 py-3 rounded bg-surface border border-border-subtle">
          <h3 className="text-xs text-text-ghost uppercase tracking-wider mb-3">Ce shift</h3>

          {/* Mini flow wave */}
          <div className="flow-wave mb-3">
            {session.history.slice(0, 5).reverse().map((past, i) => (
              <div
                key={past.id}
                className={`flow-wave-bar ${i === session.history.length - 1 ? 'current' : 'past'}`}
                style={{
                  height: `${Math.max(8, Math.min(32, (past.result.earnings_delta || 0) + 16))}px`,
                  opacity: past.outcome === 'followed' ? 1 : 0.4,
                }}
              />
            ))}
            <div className="flow-wave-bar current" style={{ height: '24px' }} />
            <div className="flow-wave-bar future" style={{ height: '16px' }} />
            <div className="flow-wave-bar future" style={{ height: '12px' }} />
          </div>

          {/* History list */}
          <div className="space-y-2">
            {session.history.slice(0, 3).map((past) => (
              <div key={past.id} className="flex items-center gap-3 text-sm">
                <span className="text-xs text-text-ghost w-10">
                  {new Date(past.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={past.outcome === 'followed' ? 'text-signal' : 'text-alert-muted'}>
                  {past.outcome === 'followed' ? '●' : '○'}
                </span>
                <span className="text-text-secondary flex-1">{past.target}</span>
                {past.result.earnings_delta !== undefined && (
                  <span className={past.result.earnings_delta >= 0 ? 'text-signal' : 'text-alert-muted'}>
                    {past.result.earnings_delta >= 0 ? '+' : ''}{past.result.earnings_delta}€
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Alignment score */}
          <div className="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between text-xs">
            <span className="text-text-ghost">Alignement</span>
            <span className={session.stats.flow_score >= 70 ? 'text-signal' : 'text-text-secondary'}>
              {session.stats.flow_score}%
            </span>
          </div>
        </div>
      )}
    </motion.div>
  )
}

// Keep NowView for backward compatibility / full view
interface NowViewProps {
  block: NowBlock
  dense: boolean
  gain: { min: number; max: number; confidence: number }
}

function NowView({ block, dense, gain }: NowViewProps) {
  return (
    <motion.div {...slideUp} className="space-y-3">
      <div className="action-block rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-text-ghost uppercase tracking-wider">Actions</span>
        </div>
        <div className="space-y-2">
          {block.actions.map((action, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-signal">↑</span>
              <span className="text-text-primary">{action}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          {block.zones.map((zone, i) => (
            <a
              key={i}
              href={`https://waze.com/ul?q=${encodeURIComponent(zone + ' Paris')}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => triggerHaptic()}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-surface border border-border text-text-primary text-sm"
            >
              <span>{zone}</span>
              <Navigation className="w-3.5 h-3.5 text-signal" />
            </a>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function NextView({ block, dense }: { block: NextBlock; dense: boolean }) {
  return (
    <motion.div {...slideUp} className="space-y-3">
      {/* Key transition - primary info */}
      <div className="action-block rounded-lg">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-text-ghost uppercase tracking-wider">Transition attendue</span>
        </div>
        <p className="text-text-primary">{block.key_transition}</p>
      </div>

      {/* Timeline Slots - compact */}
      <div className="space-y-2">
        {block.slots.map((slot, i) => (
          <a
            key={i}
            href={`https://waze.com/ul?q=${encodeURIComponent(slot.zone + ' Paris')}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => triggerHaptic()}
            className="timeline-slot flex items-center gap-3 p-3 rounded-lg bg-surface border border-border-subtle hover:border-signal/20 transition-colors"
          >
            <div className="w-16 flex-shrink-0">
              <span className="text-xs font-mono text-text-ghost">{slot.window}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-text-primary text-sm">{slot.zone}</span>
                <Navigation className="w-3 h-3 text-signal opacity-0 group-hover:opacity-100" />
              </div>
              <p className="text-xs text-text-ghost truncate">{slot.reason}</p>
            </div>
            <SaturationBadge level={slot.saturation} />
          </a>
        ))}
      </div>
    </motion.div>
  )
}

function TonightView({ block, dense }: { block: HorizonBlock; dense: boolean }) {
  return (
    <motion.div {...slideUp} className="space-y-3">
      {/* Expected Peaks - quick scan */}
      <div className="flex gap-2 flex-wrap">
        {block.expected_peaks.map((peak, i) => (
          <span key={i} className="px-2.5 py-1 rounded bg-signal/8 text-signal text-sm">
            {peak}
          </span>
        ))}
      </div>

      {/* Hotspots - tap targets */}
      <div className="space-y-2">
        {block.hotspots.map((spot, i) => (
          <a
            key={i}
            href={`https://waze.com/ul?q=${encodeURIComponent(spot.zone + ' Paris')}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => triggerHaptic()}
            className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border-subtle hover:border-signal/20 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-text-primary">{spot.zone}</span>
                <span className="text-xs text-signal font-mono">{spot.score}</span>
              </div>
              <p className="text-xs text-text-ghost">{spot.window} · {spot.why}</p>
            </div>
            <Navigation className="w-4 h-4 text-signal" />
          </a>
        ))}
      </div>

      {/* Rules - background cognition */}
      <div className="px-3 py-3 rounded bg-surface border border-border-subtle">
        <h3 className="text-xs text-text-ghost uppercase tracking-wider mb-2">Règles</h3>
        <div className="space-y-1.5 text-sm">
          {block.rules.map((rule, i) => (
            <div key={i} className="flex items-start gap-2 text-text-secondary">
              <span className="text-text-ghost">{i + 1}.</span>
              <span>{rule}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ============================================
// OPERATOR VIEW
// ============================================

interface RunStatus {
  status: 'success' | 'running' | 'scheduled' | 'failed'
  time: string
  profiles: number
  tokens?: number
  confidence?: number
  errors?: string[]
}

function OperatorPanel({ brief }: { brief: CompiledBrief }) {
  // Run data - production: fetch from Supabase brief_runs table
  const pastRun: RunStatus = {
    status: 'success',
    time: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    profiles: 24,
    tokens: 12840,
    confidence: 0.76,
  }

  const presentRun: RunStatus = {
    status: 'success',
    time: brief.meta.generated_at,
    profiles: 28,
    tokens: 14200,
    confidence: brief.meta.confidence_overall,
  }

  const nextRun: RunStatus = {
    status: 'scheduled',
    time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    profiles: 28,
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  function formatRelative(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(Math.abs(diff) / 60000)
    if (diff > 0) {
      return mins < 60 ? `${mins}min` : `${Math.floor(mins / 60)}h`
    }
    return mins < 60 ? `+${mins}min` : `+${Math.floor(mins / 60)}h`
  }

  return (
    <motion.div {...slideUp} className="mt-6">
      <div className="px-3 py-3 rounded bg-surface border border-signal/20">
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-3.5 h-3.5 text-signal" />
          <span className="text-xs text-text-ghost uppercase tracking-wider">Pipeline</span>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          {/* PAST */}
          <div className="p-2 rounded bg-surface-raised">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-text-ghost">○</span>
              <span className="text-text-ghost">Passé</span>
            </div>
            <p className="font-mono text-text-secondary">{formatTime(pastRun.time)}</p>
            <p className="text-text-ghost">{formatRelative(pastRun.time)}</p>
          </div>

          {/* PRESENT */}
          <div className="p-2 rounded bg-surface-raised border border-signal/20">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-signal animate-field-pulse">●</span>
              <span className="text-signal">Actif</span>
            </div>
            <p className="font-mono text-text-primary">{formatTime(presentRun.time)}</p>
            <p className="text-text-ghost">{formatRelative(presentRun.time)}</p>
          </div>

          {/* NEXT */}
          <div className="p-2 rounded bg-surface-raised">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-intent">◐</span>
              <span className="text-intent">Prochain</span>
            </div>
            <p className="font-mono text-text-secondary">{formatTime(nextRun.time)}</p>
            <p className="text-text-ghost">{formatRelative(nextRun.time)}</p>
          </div>
        </div>

        {/* Pipeline flow */}
        <div className="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between text-xs text-text-ghost">
          <div className="flex items-center gap-2">
            <span>Sources</span>
            <span className="text-signal">→</span>
            <span>Compilation</span>
            <span className="text-signal">→</span>
            <span>Dispatch</span>
          </div>
          <span>{presentRun.profiles} profils</span>
        </div>
      </div>
    </motion.div>
  )
}
