'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, X, Minus } from 'lucide-react'
import Link from 'next/link'
import { generateMockReplayData, type ReplayResult, type ReplayItem } from '@/lib/shift-conductor/replay'
import { getMockShiftArc } from '@/lib/shift-conductor/shift-arc'
import { ShiftArc } from '@/components/ui/shift-arc'

// Instrument-speed animations
const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.18 }
}

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.08
    }
  }
}

const slideIn = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.22 }
}

export default function ReplayPage() {
  const [replay, setReplay] = useState<ReplayResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // In production: fetch from API based on session
    // For now: use mock data
    const data = generateMockReplayData()
    setReplay(data)
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void">
        <div className="text-text-ghost text-sm">Chargement...</div>
      </div>
    )
  }

  if (!replay) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void">
        <div className="text-text-ghost text-sm">Pas de données</div>
      </div>
    )
  }

  const shiftDate = new Date(replay.shift_date)
  const formattedDate = shiftDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })

  return (
    <div className="min-h-screen bg-void">
      {/* Header */}
      <header className="border-b border-border-subtle sticky top-0 bg-void/95 backdrop-blur-sm z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-1.5 rounded border border-border text-text-ghost hover:text-text-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-sm text-text-primary">Replay</h1>
            <p className="text-xs text-text-ghost capitalize">{formattedDate}</p>
          </div>
        </div>
      </header>

      {/* Shift Arc - Night's Rhythm */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <ShiftArc arc={getMockShiftArc()} />
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Alignment Score - Top metric */}
        <motion.div {...fadeIn} className="text-center py-4">
          <p className="text-xs text-text-ghost uppercase tracking-wider mb-2">
            Alignement Flow
          </p>
          <p className={`text-4xl font-light ${
            replay.alignment.score >= 70 ? 'text-signal' :
            replay.alignment.score >= 50 ? 'text-intent' : 'text-text-primary'
          }`}>
            {replay.alignment.score}%
          </p>
          <p className="text-sm text-text-ghost mt-1">
            {replay.alignment.followed} / {replay.alignment.favorable} fenêtres favorables suivies
          </p>
        </motion.div>

        {/* Replay Items - The narrative */}
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="space-y-3"
        >
          {replay.items.map((item) => (
            <ReplayItemCard key={item.id} item={item} />
          ))}
        </motion.div>

        {/* Top Win / Top Miss */}
        <div className="grid grid-cols-2 gap-3">
          {replay.top_win && (
            <motion.div
              {...fadeIn}
              className="p-3 rounded-lg bg-surface border border-signal/20"
            >
              <p className="text-xs text-text-ghost mb-1">Meilleur move</p>
              <p className="text-sm text-text-primary">{replay.top_win.zone}</p>
              <p className="text-signal text-sm">
                +{replay.top_win.delta}€
              </p>
            </motion.div>
          )}
          {replay.top_miss && (
            <motion.div
              {...fadeIn}
              className="p-3 rounded-lg bg-surface border border-alert/20"
            >
              <p className="text-xs text-text-ghost mb-1">Opportunité manquée</p>
              <p className="text-sm text-text-primary">{replay.top_miss.zone}</p>
              <p className="text-alert-muted text-sm">
                {replay.top_miss.delta && replay.top_miss.delta > 0 ? '+' : ''}{replay.top_miss.delta}€
              </p>
            </motion.div>
          )}
        </div>

        {/* Rule Learned */}
        <motion.div
          {...fadeIn}
          className="p-4 rounded-lg bg-surface-raised border border-border-subtle"
        >
          <p className="text-xs text-text-ghost uppercase tracking-wider mb-2">
            Ce que cette nuit enseigne
          </p>
          <p className="text-text-primary">
            {replay.rule_learned}
          </p>
        </motion.div>

        {/* Shift Duration */}
        <div className="flex items-center justify-between text-xs text-text-ghost px-1">
          <span>Durée shift</span>
          <span>{replay.shift_duration_hours}h</span>
        </div>
      </main>
    </div>
  )
}

function ReplayItemCard({ item }: { item: ReplayItem }) {
  const outcomeStyles = {
    win: {
      border: 'border-signal/20',
      icon: <Check className="w-3.5 h-3.5 text-signal" />,
      bg: 'bg-signal/5'
    },
    loss: {
      border: 'border-alert/20',
      icon: <X className="w-3.5 h-3.5 text-alert-muted" />,
      bg: 'bg-alert/5'
    },
    neutral: {
      border: 'border-border-subtle',
      icon: <Minus className="w-3.5 h-3.5 text-text-ghost" />,
      bg: 'bg-surface'
    }
  }

  const style = outcomeStyles[item.outcome]

  return (
    <motion.div
      variants={slideIn}
      className={`p-3 rounded-lg border ${style.border} ${style.bg}`}
    >
      <div className="flex items-start gap-3">
        {/* Time */}
        <div className="w-12 flex-shrink-0">
          <span className="text-xs font-mono text-text-ghost">{item.time}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-text-primary">{item.action}</span>
            <span className="text-sm text-text-secondary">· {item.zone}</span>
          </div>
          <p className="text-xs text-text-ghost">
            → {item.window_context}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            {style.icon}
            <span className="text-xs text-text-secondary">{item.outcome_label}</span>
            {item.delta !== undefined && (
              <span className={`text-xs ${
                item.delta > 0 ? 'text-signal' :
                item.delta < 0 ? 'text-alert-muted' : 'text-text-ghost'
              }`}>
                {item.delta > 0 ? '+' : ''}{item.delta}€
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
