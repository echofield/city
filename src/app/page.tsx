'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Clock, MapPin, TrendingUp, Zap } from 'lucide-react'
import Link from 'next/link'
import { getMockShiftArc } from '@/lib/shift-conductor/shift-arc'
import { generateMockReplayData } from '@/lib/shift-conductor/replay'
import { ShiftArc } from '@/components/ui/shift-arc'
import { ParisHeroMap } from '@/components/map/ParisHeroMap'
import { Heartbeat } from '@/components/ui/heartbeat'

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

export default function LandingPage() {
  const mockArc = getMockShiftArc()
  const mockReplay = generateMockReplayData()

  return (
    <div className="min-h-screen bg-void">
      {/* HERO */}
      <section className="min-h-[90vh] flex flex-col justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl mx-auto text-center"
        >
          <h1 className="text-4xl md:text-5xl font-light text-text-primary mb-6 leading-tight">
            Arrête de chercher.
            <br />
            <span className="text-signal">Sache quand bouger.</span>
          </h1>

          <p className="text-lg text-text-secondary mb-8 max-w-md mx-auto">
            Flow te montre quand la demande va apparaître —
            pas quand elle est déjà partie.
          </p>

          {/* Paris Hero Map */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mb-8 max-w-md mx-auto"
          >
            <ParisHeroMap highlightedZone="gare-nord" className="h-48 rounded-xl overflow-hidden border border-border-subtle" />
          </motion.div>

          {/* Mini preview - Maintenant screen only */}
          <div className="mb-10 p-4 rounded-xl bg-surface border border-border-subtle max-w-sm mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-signal animate-pulse" />
              <span className="text-xs text-text-ghost uppercase tracking-wider">Maintenant</span>
            </div>
            <p className="text-2xl text-signal mb-1">Gare du Nord</p>
            <p className="text-sm text-text-ghost mb-3">Fenêtre active · 4-8 min</p>
            <ShiftArc arc={mockArc} compact />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/demo"
              className="px-6 py-3 rounded-lg bg-signal text-void font-medium hover:bg-signal-dark transition-colors"
            >
              Essayer la démo
            </Link>
            <Link
              href="/onboarding"
              className="px-6 py-3 rounded-lg border border-border text-text-primary hover:border-text-ghost transition-colors"
            >
              Commencer
            </Link>
          </div>
        </motion.div>
      </section>

      {/* SECTION 2 - THE PROBLEM */}
      <section className="px-6 py-16 border-t border-border-subtle">
        <motion.div
          variants={stagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <motion.h2 variants={fadeIn} className="text-2xl text-text-primary mb-8 text-center">
            Tu connais ça.
          </motion.h2>

          <div className="space-y-4">
            {[
              { icon: MapPin, text: 'Tourner à vide pendant 20 minutes' },
              { icon: Clock, text: 'Quitter une zone 5 minutes trop tôt' },
              { icon: TrendingUp, text: 'Arriver quand tout le monde est déjà là' },
              { icon: Zap, text: 'Des nuits totalement imprévisibles' },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={fadeIn}
                className="flex items-center gap-4 p-4 rounded-lg bg-surface border border-border-subtle"
              >
                <item.icon className="w-5 h-5 text-alert-muted flex-shrink-0" />
                <span className="text-text-secondary">{item.text}</span>
              </motion.div>
            ))}
          </div>

          <motion.p variants={fadeIn} className="text-center text-text-ghost mt-8">
            Le problème n'est pas ta conduite.
            <br />
            C'est le timing.
          </motion.p>
        </motion.div>
      </section>

      {/* SECTION 3 - THE SHIFT CONCEPT */}
      <section className="px-6 py-16 border-t border-border-subtle bg-surface">
        <motion.div
          variants={stagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <motion.h2 variants={fadeIn} className="text-2xl text-text-primary mb-4">
            Une nuit a un rythme.
          </motion.h2>
          <motion.p variants={fadeIn} className="text-text-secondary mb-10">
            Flow te montre où tu es dans ce rythme.
          </motion.p>

          {/* Shift Arc Demo */}
          <motion.div variants={fadeIn} className="mb-10">
            <ShiftArc arc={mockArc} />
          </motion.div>

          {/* NOW / NEXT / HORIZON */}
          <motion.div variants={fadeIn} className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-lg border border-signal/20">
              <p className="text-signal text-sm font-medium mb-1">MAINTENANT</p>
              <p className="text-xs text-text-ghost">0-45 min</p>
              <p className="text-xs text-text-ghost mt-2">Actions immédiates</p>
            </div>
            <div className="p-4 rounded-lg border border-intent/20">
              <p className="text-intent text-sm font-medium mb-1">PROCHAIN</p>
              <p className="text-xs text-text-ghost">45-180 min</p>
              <p className="text-xs text-text-ghost mt-2">Transitions à venir</p>
            </div>
            <div className="p-4 rounded-lg border border-calm/20">
              <p className="text-calm text-sm font-medium mb-1">CE SOIR</p>
              <p className="text-xs text-text-ghost">3-8h</p>
              <p className="text-xs text-text-ghost mt-2">Vue stratégique</p>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* SECTION 4 - PROOF (Replay Example) */}
      <section className="px-6 py-16 border-t border-border-subtle">
        <motion.div
          variants={stagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <motion.h2 variants={fadeIn} className="text-2xl text-text-primary mb-4 text-center">
            Tu verras ce qui a marché.
          </motion.h2>
          <motion.p variants={fadeIn} className="text-text-secondary mb-8 text-center">
            Chaque nuit, Flow te montre tes décisions et leurs résultats.
          </motion.p>

          {/* Mini Replay */}
          <motion.div variants={fadeIn} className="p-4 rounded-xl bg-surface border border-border-subtle">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-text-ghost uppercase tracking-wider">Replay</span>
              <span className="text-signal text-lg">{mockReplay.alignment.score}%</span>
            </div>

            <div className="space-y-3">
              {mockReplay.items.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-2 rounded bg-surface-raised">
                  <span className="text-xs font-mono text-text-ghost w-10">{item.time}</span>
                  <div className="flex-1">
                    <p className="text-sm text-text-primary">{item.action} · {item.zone}</p>
                    <p className="text-xs text-text-ghost">→ {item.window_context}</p>
                  </div>
                  {item.delta && (
                    <span className={`text-sm ${item.delta > 0 ? 'text-signal' : 'text-alert-muted'}`}>
                      {item.delta > 0 ? '+' : ''}{item.delta}€
                    </span>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs text-text-ghost mt-4 pt-3 border-t border-border-subtle">
              {mockReplay.rule_learned}
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* SECTION 5 - PRICING */}
      <section className="px-6 py-16 border-t border-border-subtle bg-surface">
        <motion.div
          variants={stagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="max-w-md mx-auto text-center"
        >
          <motion.h2 variants={fadeIn} className="text-2xl text-text-primary mb-8">
            Un outil de travail.
          </motion.h2>

          {/* Founders Price */}
          <motion.div
            variants={fadeIn}
            className="p-6 rounded-xl border border-signal/30 bg-signal/5 mb-4"
          >
            <p className="text-xs text-signal uppercase tracking-wider mb-2">Fondateurs · Limité</p>
            <p className="text-4xl text-text-primary mb-1">50€<span className="text-lg text-text-ghost">/mois</span></p>
            <p className="text-sm text-text-ghost mb-4">Pour les 50 premiers chauffeurs</p>
            <Link
              href="/onboarding"
              className="block w-full py-3 rounded-lg bg-signal text-void font-medium hover:bg-signal-dark transition-colors"
            >
              Rejoindre les fondateurs
            </Link>
          </motion.div>

          {/* Standard Price */}
          <motion.div
            variants={fadeIn}
            className="p-6 rounded-xl border border-border-subtle"
          >
            <p className="text-xs text-text-ghost uppercase tracking-wider mb-2">Standard</p>
            <p className="text-3xl text-text-secondary mb-1">90€<span className="text-lg text-text-ghost">/mois</span></p>
            <p className="text-sm text-text-ghost">Après la période fondateurs</p>
          </motion.div>

          <motion.p variants={fadeIn} className="text-xs text-text-ghost mt-6">
            Pas d'engagement. Annulable à tout moment.
          </motion.p>
        </motion.div>
      </section>

      {/* FINAL CTA */}
      <section className="px-6 py-16 border-t border-border-subtle">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-md mx-auto text-center"
        >
          <p className="text-lg text-text-primary mb-6">
            Flow ne conduit pas pour toi.
            <br />
            Il révèle le moment.
          </p>

          <Link
            href="/demo"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-signal text-void font-medium hover:bg-signal-dark transition-colors"
          >
            <span>Voir la démo</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-border-subtle">
        <div className="max-w-2xl mx-auto flex items-center justify-between text-xs text-text-ghost">
          <div className="flex items-center gap-4">
            <span>Flow · Paris</span>
            <Heartbeat isLive={true} />
          </div>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-text-secondary">Connexion</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
