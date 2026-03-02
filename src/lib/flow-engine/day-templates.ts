/**
 * Day templates from daily pack — deterministic heuristics, no ML.
 * 3–4 templates: Matin, Midi, Soir, Nuit.
 */

import type { CitySignalsPackV1 } from '@/types/city-signals-pack'
import type { DayTemplate, DayTemplateWindow } from '@/types/flow-state'

const WINDOWS: { window: DayTemplateWindow; id: string; title: string }[] = [
  { window: 'morning', id: 'matin', title: 'Matin' },
  { window: 'midday', id: 'midi', title: 'Midi' },
  { window: 'evening', id: 'soir', title: 'Soir' },
  { window: 'night', id: 'nuit', title: 'Nuit' },
]

function reasonsFromPack(pack: CitySignalsPackV1, window: DayTemplateWindow): string[] {
  const reasons: string[] = []
  // Events: match PSG, concert, match, etc.
  for (const e of pack.events.slice(0, 2)) {
    const t = e.startTime ?? e.endTime ?? ''
    if (t) reasons.push(`${e.name} ${t}`)
    else reasons.push(e.name)
  }
  for (const w of pack.weather.slice(0, 1)) {
    const p = (w as { precipProb?: number }).precipProb
    if (p != null) reasons.push(`Pluie ${p}%`)
    else reasons.push(w.type === 'heavy_rain' ? 'Forte pluie' : w.type === 'rain_start' ? 'Pluie prévue' : 'Météo')
  }
  for (const t of pack.transport.slice(0, 1)) {
    const end = t.endTime ?? ''
    reasons.push(`${t.line} ${t.type === 'closure' ? 'coupé' : t.type === 'strike' ? 'grève' : 'incident'}${end ? ` ${end}` : ''}`)
  }
  return reasons.slice(0, 3)
}

function suggestedZonesFromPack(pack: CitySignalsPackV1, window: DayTemplateWindow): string[] {
  const zones = new Set<string>()
  for (const e of pack.events) {
    for (const z of (e.zoneImpact ?? []).slice(0, 2)) zones.add(z)
  }
  for (const t of pack.transport) {
    for (const z of (t.impactZones ?? []).slice(0, 2)) zones.add(z)
  }
  const fallbacks: Record<DayTemplateWindow, string[]> = {
    morning: ['Gare du Nord', 'Gare de Lyon', 'Opéra', 'Châtelet'],
    midday: ['Châtelet', 'Opéra', 'Grands Boulevards', 'Marais'],
    evening: ['Bercy', 'Accor Arena', 'Parc des Princes', 'La Défense'],
    night: ['Gare du Nord', 'Châtelet', 'Saint-Lazare', 'Bercy'],
  }
  const arr = Array.from(zones)
  if (arr.length >= 2) return arr.slice(0, 4)
  return fallbacks[window].slice(0, 3)
}

export function buildDayTemplates(pack: CitySignalsPackV1 | null): DayTemplate[] {
  if (!pack) return []

  const hasSport = pack.events.some((e) => e.type === 'sport' || (e as { category?: string }).category === 'sport')
  const hasProtest = (pack.social ?? []).some((s) => s.type === 'demonstration' || s.type === 'rally')
  const hasHeavyRain = pack.weather.some((w) => w.type === 'heavy_rain' || ((w as { precipProb?: number }).precipProb ?? 0) > 50)
  const hasClosure = pack.transport.some((t) => t.type === 'closure' || t.type === 'strike')
  const stadiumZones = pack.events.filter((e) => /parc|stade|arena|accor/i.test(e.venue || '')).map((e) => e.zoneImpact?.[0] ?? e.venue).filter(Boolean)

  return WINDOWS.map(({ window, id, title }) => {
    let description = ''
    let movement = 3
    let stress = 2
    let potential = 3
    let templateTitle = title

    if (window === 'morning') {
      templateTitle = hasClosure ? 'Flux Aéroport' : stadiumZones.length ? 'Boucles Courtes' : 'Ville Calme'
      description = hasClosure ? 'Gares et aéroports actifs.' : 'Démarrage progressif.'
      if (hasClosure) movement = 4
    } else if (window === 'midday') {
      templateTitle = 'Boucles Courtes'
      description = 'Corridors pro, flux réguliers.'
      movement = 3
      if (hasProtest) stress = 4
    } else if (window === 'evening') {
      templateTitle = hasSport && stadiumZones.length ? 'Stade/Arena' : 'Pics Fragmentés'
      description = hasSport ? `${stadiumZones[0] ?? 'Stade'} — pic sortie.` : 'Pics multi-zones.'
      movement = hasSport ? 4 : 4
      potential = hasSport ? 4 : 4
    } else {
      templateTitle = hasClosure ? 'Derniers Métros' : 'Sorties'
      description = hasClosure ? 'Report gares, derniers départs.' : 'Sorties bars et quartiers.'
      movement = 4
      potential = 4
    }

    if (hasHeavyRain) {
      movement = Math.min(5, movement + 1)
      potential = Math.min(5, potential + 1)
    }
    if (hasProtest) stress = Math.min(5, stress + 1)

    const reasons = reasonsFromPack(pack, window)
    const suggestedZones = suggestedZonesFromPack(pack, window)
    const fuelBand = movement >= 4 ? '~20–35€' : movement >= 3 ? '~15–25€' : '~12–20€'

    return {
      id: `day-${id}`,
      title: templateTitle,
      window,
      description: description.slice(0, 120),
      fuelBand,
      movement,
      stress,
      potential,
      suggestedZones,
      reasons,
    }
  })
}
