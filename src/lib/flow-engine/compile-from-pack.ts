/**
 * Build a CompiledBrief from a daily city-signals pack (facts → operational brief).
 */

import type { CitySignalsPackV1 } from '@/types/city-signals-pack'
import type { CompiledBrief } from './types'

export function compiledFromCitySignalsPackV1(pack: CitySignalsPackV1): CompiledBrief {
  const zones = new Set<string>()
  for (const e of pack.events) {
    for (const z of (e.zoneImpact ?? []).slice(0, 3)) zones.add(z)
  }
  for (const t of pack.transport) {
    for (const z of (t.impactZones ?? []).slice(0, 2)) zones.add(z)
  }
  const zoneList = Array.from(zones)
  const defaultZones = ['Châtelet', 'Bercy', 'Marais', 'Gare du Nord']
  const nowZones = zoneList.length >= 2 ? zoneList.slice(0, 4) : defaultZones

  const hasEvent = pack.events.length > 0
  const hasTransport = pack.transport.some((t) => t.type === 'closure' || t.type === 'strike')
  const confidence = Math.min(85, 65 + (hasEvent ? 10 : 0) + (hasTransport ? 5 : 0))

  return {
    now_block: {
      zones: nowZones,
      rule: hasEvent
        ? 'Événements actifs — zones recommandées.'
        : hasTransport
          ? 'Perturbations transport — adapter les zones.'
          : 'Fenêtre active — déplacement recommandé.',
      confidence,
    },
    meta: {
      profile_variant: 'default',
    },
  }
}
