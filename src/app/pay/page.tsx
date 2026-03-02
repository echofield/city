'use client'

import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'
import { createClient } from '@/lib/supabase/client'
import type { Plan } from '@/types/database'
import { motion } from 'framer-motion'
import { Check, Loader2, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

export default function PayPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Fetch plans
  useEffect(() => {
    async function fetchPlans() {
      const { data } = await supabase
        .schema('app')
        .from('plan_catalog')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true })

      if (data) {
        setPlans(data)
        // Pre-select first plan
        if (data.length > 0 && !selectedPlan) {
          setSelectedPlan(data[0].id)
        }
      }
      setIsLoading(false)
    }
    fetchPlans()
  }, [supabase, selectedPlan])

  // Check subscription status
  const checkStatus = useCallback(async () => {
    setIsCheckingStatus(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: subscription } = await supabase
        .schema('app')
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (subscription) {
        router.push('/dashboard')
        router.refresh()
        return
      }
    }
    setIsCheckingStatus(false)
  }, [supabase, router])

  // Poll for subscription status after checkout
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('checkout') === 'success') {
      // Start polling
      const interval = setInterval(checkStatus, 3000)
      checkStatus() // Check immediately
      return () => clearInterval(interval)
    }
  }, [checkStatus])

  async function handleCheckout() {
    if (!selectedPlan) return
    setIsRedirecting(true)

    const plan = plans.find(p => p.id === selectedPlan)
    if (!plan?.stripe_price_id) {
      setIsRedirecting(false)
      return
    }

    // Redirect to Stripe checkout via API
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: plan.stripe_price_id }),
      })

      const { url } = await response.json()
      if (url) {
        window.location.href = url
      }
    } catch {
      setIsRedirecting(false)
    }
  }

  const planLabels: Record<number, { name: string; badge?: string }> = {
    50: { name: 'Flow Access' },
    90: { name: 'Flow Priority', badge: 'Recommandé' },
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-text-ghost animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs text-text-ghost uppercase tracking-[0.2em] mb-2">
            Abonnement
          </p>
          <h1 className="text-3xl font-light text-text-primary mb-2">
            Choisissez votre plan
          </h1>
          <p className="text-text-secondary">
            Accédez à l&apos;intelligence terrain en temps réel
          </p>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {plans.map((plan) => {
            const label = planLabels[plan.price] || { name: plan.name }
            const isSelected = selectedPlan === plan.id

            return (
              <motion.button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`relative text-left p-6 rounded-lg border transition-all ${
                  isSelected
                    ? 'border-signal bg-signal-glow'
                    : 'border-border bg-surface hover:border-text-ghost'
                }`}
              >
                {label.badge && (
                  <span className="absolute top-4 right-4 text-xs bg-intent text-void px-2 py-0.5 rounded">
                    {label.badge}
                  </span>
                )}

                <div className="mb-4">
                  <h3 className="text-lg font-medium text-text-primary mb-1">
                    {label.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-light text-text-primary">
                      {plan.price}€
                    </span>
                    <span className="text-text-secondary">/{plan.interval === 'month' ? 'mois' : 'an'}</span>
                  </div>
                </div>

                <ul className="space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                      <Check className="w-4 h-4 text-signal flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {isSelected && (
                  <motion.div
                    layoutId="selected-plan"
                    className="absolute inset-0 border-2 border-signal rounded-lg pointer-events-none"
                  />
                )}
              </motion.button>
            )
          })}
        </div>

        {/* Action */}
        <Panel variant="glass" className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-sm text-text-secondary">
              Paiement sécurisé par Stripe
            </p>
            <p className="text-xs text-text-ghost">
              Annulation possible à tout moment
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={checkStatus}
              disabled={isCheckingStatus}
            >
              {isCheckingStatus ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Vérifier statut
            </Button>
            <Button
              onClick={handleCheckout}
              disabled={!selectedPlan || isRedirecting}
            >
              {isRedirecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Redirection...
                </>
              ) : (
                'S\'abonner'
              )}
            </Button>
          </div>
        </Panel>
      </motion.div>
    </div>
  )
}
