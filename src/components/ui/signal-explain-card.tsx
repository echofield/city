'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Navigation, ArrowRight } from 'lucide-react'

/**
 * SignalExplainCard — tap-to-reveal intelligence
 *
 * 3-layer UX:
 * Layer 1: Verb-based title (visible)
 * Layer 2: Cause → Consequence (tap to reveal)
 * Layer 3: Corridor analysis (tap again)
 */

export interface SignalExplanationData {
  id: string
  /** Verb-based title: "Sorties TGV" not "EVENT" */
  title: string
  /** Zone affected */
  zone: string
  /** CAUSE: What triggered this */
  cause: string
  /** SOURCE: Where the signal comes from */
  source: string
  /** MAGNITUDE: Estimated impact */
  magnitude?: string
  /** WINDOW: Time frame */
  window?: string
  /** RAMIFICATION: Where flow goes */
  ramification?: string
  /** OPPORTUNITY: Expected ride value */
  opportunity?: string
  /** Confidence 0-1 */
  confidence: number
  /** Deeper flow analysis for Layer 3 */
  flowAnalysis?: {
    direction: 'nord' | 'est' | 'sud' | 'ouest'
    chain: string[]
    pressure: number
  }
}

interface SignalExplainCardProps {
  signal: SignalExplanationData
  onNavigate?: (zone: string) => void
}

export function SignalExplainCard({ signal, onNavigate }: SignalExplainCardProps) {
  const [expanded, setExpanded] = useState<0 | 1 | 2>(0) // 0=closed, 1=layer2, 2=layer3

  const toggleExpand = () => {
    if (expanded === 0) setExpanded(1)
    else if (expanded === 1 && signal.flowAnalysis) setExpanded(2)
    else setExpanded(0)
  }

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onNavigate) {
      onNavigate(signal.zone)
    } else {
      window.open(`https://waze.com/ul?q=${encodeURIComponent(signal.zone + ' Paris')}`, '_blank')
    }
  }

  return (
    <motion.div
      layout
      className="rounded-lg border border-border-subtle bg-surface overflow-hidden"
    >
      {/* Layer 1: Title (always visible) */}
      <button
        onClick={toggleExpand}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-raised transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-signal text-sm font-medium">{signal.title}</span>
          <span className="text-text-ghost">—</span>
          <span className="text-text-primary">{signal.zone}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-ghost">{Math.round(signal.confidence * 100)}%</span>
          {expanded === 0 ? (
            <ChevronDown className="w-4 h-4 text-text-ghost" />
          ) : (
            <ChevronUp className="w-4 h-4 text-text-ghost" />
          )}
        </div>
      </button>

      {/* Layer 2: Cause → Consequence */}
      <AnimatePresence>
        {expanded >= 1 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border-subtle"
          >
            <div className="px-4 py-4 space-y-3">
              {/* CAUSE */}
              <div>
                <p className="text-xs text-text-ghost uppercase tracking-wider mb-1">Cause</p>
                <p className="text-text-primary text-sm">{signal.cause}</p>
              </div>

              {/* SOURCE */}
              <div>
                <p className="text-xs text-text-ghost uppercase tracking-wider mb-1">Source</p>
                <p className="text-text-secondary text-sm">{signal.source}</p>
              </div>

              {/* MAGNITUDE (if present) */}
              {signal.magnitude && (
                <div>
                  <p className="text-xs text-text-ghost uppercase tracking-wider mb-1">Magnitude</p>
                  <p className="text-signal text-sm font-medium">{signal.magnitude}</p>
                </div>
              )}

              {/* WINDOW (if present) */}
              {signal.window && (
                <div>
                  <p className="text-xs text-text-ghost uppercase tracking-wider mb-1">Fenêtre</p>
                  <p className="text-text-primary text-sm">{signal.window}</p>
                </div>
              )}

              {/* RAMIFICATION (if present) */}
              {signal.ramification && (
                <div>
                  <p className="text-xs text-text-ghost uppercase tracking-wider mb-1">Ramification</p>
                  <p className="text-intent text-sm">{signal.ramification}</p>
                </div>
              )}

              {/* OPPORTUNITY (if present) */}
              {signal.opportunity && (
                <div>
                  <p className="text-xs text-text-ghost uppercase tracking-wider mb-1">Opportunité</p>
                  <p className="text-signal text-sm font-medium">{signal.opportunity}</p>
                </div>
              )}

              {/* Navigate button */}
              <button
                onClick={handleNavigate}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-signal/10 border border-signal/30 text-signal text-sm hover:bg-signal/20 transition-colors"
              >
                <Navigation className="w-4 h-4" />
                <span>Naviguer vers {signal.zone}</span>
              </button>

              {/* Show Layer 3 hint if available */}
              {signal.flowAnalysis && expanded === 1 && (
                <button
                  onClick={() => setExpanded(2)}
                  className="flex items-center gap-2 text-xs text-text-ghost hover:text-text-secondary"
                >
                  <span>Voir l'analyse du flux</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Layer 3: Corridor Analysis (deep) */}
      <AnimatePresence>
        {expanded === 2 && signal.flowAnalysis && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border-subtle bg-surface-raised"
          >
            <div className="px-4 py-4">
              <p className="text-xs text-text-ghost uppercase tracking-wider mb-3">Analyse du flux</p>

              {/* Flow chain visualization */}
              <div className="flex items-center gap-2 mb-4 overflow-x-auto">
                {signal.flowAnalysis.chain.map((zone, i) => (
                  <div key={zone} className="flex items-center">
                    <span className={`text-sm px-2 py-1 rounded ${
                      i === 0 ? 'bg-signal/20 text-signal' : 'bg-surface text-text-secondary'
                    }`}>
                      {zone}
                    </span>
                    {i < signal.flowAnalysis!.chain.length - 1 && (
                      <ArrowRight className="w-4 h-4 mx-1 text-text-ghost" />
                    )}
                  </div>
                ))}
              </div>

              {/* Direction & Pressure */}
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-text-ghost">Pression:</span>
                  <span className={`ml-2 ${
                    signal.flowAnalysis.pressure > 0.7 ? 'text-alert' :
                    signal.flowAnalysis.pressure > 0.4 ? 'text-intent' : 'text-calm'
                  }`}>
                    {signal.flowAnalysis.pressure > 0.7 ? 'Élevée' :
                     signal.flowAnalysis.pressure > 0.4 ? 'Modérée' : 'Faible'}
                  </span>
                </div>
                <div>
                  <span className="text-text-ghost">Confiance:</span>
                  <span className="ml-2 text-text-primary">{Math.round(signal.confidence * 100)}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/**
 * SignalExplainList — list of expandable signal cards
 */
interface SignalExplainListProps {
  signals: SignalExplanationData[]
  onNavigate?: (zone: string) => void
}

export function SignalExplainList({ signals, onNavigate }: SignalExplainListProps) {
  if (signals.length === 0) {
    return (
      <div className="text-center py-8 text-text-ghost text-sm">
        Pas de signaux actifs
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {signals.map((signal) => (
        <SignalExplainCard
          key={signal.id}
          signal={signal}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  )
}
