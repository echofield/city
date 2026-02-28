'use client'

import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'
import { Select } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import type { ProfilePreferences } from '@/types/database'
import { motion } from 'framer-motion'
import { Check, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const ZONES = [
  { value: 'centre', label: 'Centre / 1-4e' },
  { value: 'marais', label: 'Marais / Bastille' },
  { value: 'saint-germain', label: 'Saint-Germain / 5-6e' },
  { value: 'opera', label: 'Opéra / Grands Boulevards' },
  { value: 'champs', label: 'Champs-Élysées / 8e' },
  { value: 'gare-nord', label: 'Gare du Nord / 10e' },
  { value: 'gare-lyon', label: 'Gare de Lyon / 12e' },
  { value: 'montmartre', label: 'Montmartre / 18e' },
  { value: 'defense', label: 'La Défense' },
  { value: 'aeroports', label: 'Aéroports CDG/Orly' },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [preferences, setPreferences] = useState<ProfilePreferences>({
    shift: 'morning',
    zones: [],
    traffic_tolerance: 'medium',
    trip_type: 'mixed',
    driving_style: 'balanced',
    strategy: 'balanced',
  })
  const router = useRouter()
  const supabase = createClient()

  const steps = [
    {
      title: 'Créneau',
      description: 'Quand conduisez-vous principalement ?',
      field: 'shift' as const,
      options: [
        { value: 'morning', label: 'Matin (6h-14h)' },
        { value: 'afternoon', label: 'Après-midi (14h-22h)' },
        { value: 'night', label: 'Nuit (22h-6h)' },
      ],
    },
    {
      title: 'Zones',
      description: 'Vos zones préférées',
      field: 'zones' as const,
      options: ZONES,
      multi: true,
    },
    {
      title: 'Trafic',
      description: 'Tolérance aux embouteillages',
      field: 'traffic_tolerance' as const,
      options: [
        { value: 'low', label: 'Éviter au maximum' },
        { value: 'medium', label: 'Acceptable si rentable' },
        { value: 'high', label: 'Peu importe' },
      ],
    },
    {
      title: 'Courses',
      description: 'Type de courses préférées',
      field: 'trip_type' as const,
      options: [
        { value: 'short', label: 'Courtes (centre-ville)' },
        { value: 'long', label: 'Longues (banlieue)' },
        { value: 'airports', label: 'Aéroports' },
        { value: 'business', label: 'Business / Premium' },
        { value: 'mixed', label: 'Mixte' },
      ],
    },
    {
      title: 'Style',
      description: 'Votre style de conduite',
      field: 'driving_style' as const,
      options: [
        { value: 'safe', label: 'Prudent et régulier' },
        { value: 'balanced', label: 'Équilibré' },
        { value: 'chase', label: 'Dynamique / Chase' },
      ],
    },
    {
      title: 'Stratégie',
      description: 'Votre objectif principal',
      field: 'strategy' as const,
      options: [
        { value: 'min_dead_km', label: 'Minimiser les km à vide' },
        { value: 'max_euro_h', label: 'Maximiser €/heure' },
        { value: 'balanced', label: 'Équilibré' },
      ],
    },
  ]

  const currentStep = steps[step]

  function handleSelect(value: string) {
    if (currentStep.multi) {
      const current = preferences.zones
      const updated = current.includes(value)
        ? current.filter((z) => z !== value)
        : [...current, value]
      setPreferences({ ...preferences, zones: updated })
    } else {
      setPreferences({ ...preferences, [currentStep.field]: value })
    }
  }

  function getValue() {
    return preferences[currentStep.field]
  }

  function isSelected(value: string) {
    if (currentStep.multi) {
      return preferences.zones.includes(value)
    }
    return getValue() === value
  }

  async function handleNext() {
    if (step < steps.length - 1) {
      setStep(step + 1)
    } else {
      // Save profile
      setIsLoading(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            email: user.email!,
            preferences,
            onboarding_complete: true,
            updated_at: new Date().toISOString(),
          })

        if (!error) {
          router.push('/pay')
          router.refresh()
        }
      }
      setIsLoading(false)
    }
  }

  const canProceed = currentStep.multi
    ? preferences.zones.length > 0
    : !!getValue()

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        key={step}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg"
      >
        {/* Progress */}
        <div className="flex gap-1 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-signal' : 'bg-surface-raised'
              }`}
            />
          ))}
        </div>

        {/* Header */}
        <div className="mb-6">
          <p className="text-xs text-text-ghost uppercase tracking-[0.2em] mb-2">
            Configuration • {step + 1}/{steps.length}
          </p>
          <h1 className="text-2xl font-light text-text-primary mb-1">
            {currentStep.title}
          </h1>
          <p className="text-text-secondary">{currentStep.description}</p>
        </div>

        {/* Options */}
        <Panel variant="glass" className="space-y-3 mb-6">
          {currentStep.options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all ${
                isSelected(option.value)
                  ? 'border-signal bg-signal-glow'
                  : 'border-border hover:border-text-ghost'
              }`}
            >
              <span className="text-text-primary">{option.label}</span>
              {isSelected(option.value) && (
                <Check className="w-4 h-4 text-signal" />
              )}
            </button>
          ))}
        </Panel>

        {/* Actions */}
        <div className="flex gap-3">
          {step > 0 && (
            <Button
              variant="secondary"
              onClick={() => setStep(step - 1)}
              disabled={isLoading}
            >
              Retour
            </Button>
          )}
          <Button
            className="flex-1"
            onClick={handleNext}
            disabled={!canProceed || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enregistrement...
              </>
            ) : step < steps.length - 1 ? (
              'Continuer'
            ) : (
              'Terminer'
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
