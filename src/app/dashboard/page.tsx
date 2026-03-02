'use client'

import { Panel } from '@/components/ui/panel'
import { SkeletonBrief } from '@/components/ui/skeleton'
import { StatusBar } from '@/components/ui/status-bar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import type { Alert, Brief, Profile, ReferralAccount, Subscription } from '@/types/database'
import { motion } from 'framer-motion'
import { AlertTriangle, Clock, Copy, ExternalLink, MapPin, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [brief, setBrief] = useState<Brief | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [referral, setReferral] = useState<ReferralAccount | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch all data in parallel
      const [profileRes, subRes, briefRes, alertsRes, referralRes] = await Promise.all([
        supabase.schema('app').from('profiles').select('*').eq('id', user.id).single(),
        supabase.schema('app').from('subscriptions').select('*').eq('user_id', user.id).eq('status', 'active').single(),
        supabase.schema('app').from('briefs').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(1).single(),
        supabase.schema('app').from('alerts').select('*').eq('user_id', user.id).eq('active', true).order('created_at', { ascending: false }),
        supabase.schema('app').from('referral_accounts').select('*').eq('user_id', user.id).single(),
      ])

      if (profileRes.data) setProfile(profileRes.data)
      if (subRes.data) setSubscription(subRes.data)
      if (briefRes.data) setBrief(briefRes.data)
      if (alertsRes.data) setAlerts(alertsRes.data)
      if (referralRes.data) setReferral(referralRes.data)

      setIsLoading(false)
    }

    fetchData()
  }, [supabase])

  function copyReferralCode() {
    if (referral?.referral_code) {
      navigator.clipboard.writeText(referral.referral_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const planLabel = subscription?.plan_id.includes('90') ? 'Priority' : 'Access'
  const lastUpdate = brief ? new Date(brief.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--'

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border-subtle">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-text-ghost uppercase tracking-[0.2em]">Flow Console</p>
            <h1 className="text-xl font-light text-text-primary">Field State</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-text-secondary">{profile?.email}</span>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <StatusBar
          items={[
            { label: 'Plan', value: `Flow ${planLabel}`, status: 'active' },
            { label: 'Field', value: alerts.length > 0 ? 'Perturbé' : 'Stable', status: alerts.length > 0 ? 'warming' : 'active' },
            { label: 'Mise à jour', value: lastUpdate },
          ]}
        />
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 pb-12">
        <Tabs defaultValue="today" className="space-y-6">
          <TabsList>
            <TabsTrigger value="today">Aujourd&apos;hui</TabsTrigger>
            <TabsTrigger value="alerts">Alertes</TabsTrigger>
            {referral && <TabsTrigger value="referral">Parrainage</TabsTrigger>}
          </TabsList>

          <TabsContent value="today">
            {isLoading ? (
              <SkeletonBrief />
            ) : brief ? (
              <BriefDisplay brief={brief} />
            ) : (
              <EmptyState />
            )}
          </TabsContent>

          <TabsContent value="alerts">
            <AlertsDisplay alerts={alerts} />
          </TabsContent>

          {referral && (
            <TabsContent value="referral">
              <ReferralDisplay referral={referral} onCopy={copyReferralCode} copied={copied} />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  )
}

function BriefDisplay({ brief }: { brief: Brief }) {
  const content = brief.content_json

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Summary */}
      <Panel>
        <h2 className="text-xs text-text-ghost uppercase tracking-wider mb-4">Synthèse</h2>
        <ul className="space-y-2">
          {content.summary.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-text-primary">
              <Zap className="w-4 h-4 text-signal mt-0.5 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </Panel>

      {/* Timeline */}
      <Panel>
        <h2 className="text-xs text-text-ghost uppercase tracking-wider mb-4">Timeline</h2>
        <div className="space-y-3">
          {content.timeline.map((slot, i) => (
            <div key={i} className="flex items-start gap-4 p-3 rounded-lg bg-surface-raised border border-border-subtle">
              <div className="flex items-center gap-2 w-24 flex-shrink-0">
                <Clock className="w-4 h-4 text-text-ghost" />
                <span className="text-sm font-mono text-text-secondary">{slot.window}</span>
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap gap-2 mb-1">
                  {slot.zones.map((zone, j) => (
                    <span key={j} className="text-sm text-signal">{zone}</span>
                  ))}
                </div>
                {slot.alternatives.length > 0 && (
                  <p className="text-xs text-text-ghost">
                    Alt: {slot.alternatives.join(', ')}
                  </p>
                )}
              </div>
              <SaturationBadge level={slot.saturation} />
            </div>
          ))}
        </div>
      </Panel>

      {/* Hotspots */}
      <Panel>
        <h2 className="text-xs text-text-ghost uppercase tracking-wider mb-4">Hotspots</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {content.hotspots.map((spot, i) => (
            <div key={i} className="p-4 rounded-lg bg-surface-raised border border-border-subtle">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-signal" />
                  <span className="font-medium text-text-primary">{spot.zone}</span>
                </div>
                <SaturationBadge level={spot.saturation_risk} />
              </div>
              <p className="text-sm text-text-secondary mb-2">{spot.window}</p>
              {spot.alternatives.length > 0 && (
                <p className="text-xs text-text-ghost mb-2">
                  Alternatives: {spot.alternatives.join(', ')}
                </p>
              )}
              {spot.waze_link && (
                <a
                  href={spot.waze_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-signal hover:underline"
                >
                  Ouvrir dans Waze <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      </Panel>

      {/* Rules */}
      <Panel glow="intent">
        <h2 className="text-xs text-intent uppercase tracking-wider mb-4">Règles du jour</h2>
        <div className="space-y-3">
          {content.rules.map((rule, i) => (
            <div key={i} className="p-3 rounded-lg border border-intent-glow bg-intent-glow/5">
              <p className="text-sm">
                <span className="text-intent">Si</span>{' '}
                <span className="text-text-primary">{rule.condition}</span>{' '}
                <span className="text-intent">→</span>{' '}
                <span className="text-text-primary">{rule.action}</span>
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </motion.div>
  )
}

function AlertsDisplay({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <Panel variant="glass" className="text-center py-12">
        <p className="text-text-ghost">Aucune alerte active</p>
      </Panel>
    )
  }

  const severityColors = {
    info: 'border-calm text-calm',
    warning: 'border-intent text-intent',
    critical: 'border-alert text-alert',
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert) => (
        <Panel key={alert.id} className={`border-l-4 ${severityColors[alert.severity]}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 mt-0.5 ${severityColors[alert.severity]}`} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs uppercase tracking-wider text-text-ghost">{alert.type}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${severityColors[alert.severity]} bg-current/10`}>
                  {alert.severity}
                </span>
              </div>
              <h3 className="font-medium text-text-primary mb-1">{alert.title}</h3>
              <p className="text-sm text-text-secondary">{alert.description}</p>
              {alert.zones.length > 0 && (
                <p className="text-xs text-text-ghost mt-2">
                  Zones: {alert.zones.join(', ')}
                </p>
              )}
            </div>
          </div>
        </Panel>
      ))}
    </div>
  )
}

function ReferralDisplay({ referral, onCopy, copied }: { referral: ReferralAccount; onCopy: () => void; copied: boolean }) {
  return (
    <Panel>
      <h2 className="text-xs text-text-ghost uppercase tracking-wider mb-6">Programme de parrainage</h2>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <div className="text-center p-4 rounded-lg bg-surface-raised">
          <p className="text-2xl font-light text-text-primary">{referral.total_referrals}</p>
          <p className="text-xs text-text-ghost uppercase tracking-wider">Invitations</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-surface-raised">
          <p className="text-2xl font-light text-signal">{referral.successful_referrals}</p>
          <p className="text-xs text-text-ghost uppercase tracking-wider">Conversions</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-surface-raised">
          <p className="text-2xl font-light text-intent">{referral.credits_earned}€</p>
          <p className="text-xs text-text-ghost uppercase tracking-wider">Crédits gagnés</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-surface-raised">
        <span className="text-text-ghost">Votre code:</span>
        <code className="flex-1 font-mono text-lg text-text-primary">{referral.referral_code}</code>
        <button
          onClick={onCopy}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border hover:border-text-ghost transition-colors"
        >
          <Copy className="w-4 h-4" />
          {copied ? 'Copié!' : 'Copier'}
        </button>
      </div>
    </Panel>
  )
}

function SaturationBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const colors = {
    low: 'bg-calm/20 text-calm',
    medium: 'bg-intent/20 text-intent',
    high: 'bg-alert/20 text-alert',
  }
  const labels = {
    low: 'Faible',
    medium: 'Modéré',
    high: 'Élevé',
  }

  return (
    <span className={`text-xs px-2 py-0.5 rounded ${colors[level]}`}>
      {labels[level]}
    </span>
  )
}

function EmptyState() {
  return (
    <Panel variant="glass" className="text-center py-16">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="w-16 h-16 rounded-full bg-surface-raised border border-border mx-auto mb-4 flex items-center justify-center">
          <Zap className="w-8 h-8 text-text-ghost" />
        </div>
        <h3 className="text-lg font-light text-text-primary mb-2">Briefing en préparation</h3>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          Votre premier briefing quotidien sera généré automatiquement.
          Revenez dans quelques instants.
        </p>
      </motion.div>
    </Panel>
  )
}
