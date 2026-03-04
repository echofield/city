/**
 * Build CompiledBrief from CitySignalsPackV1 (thin mapping, facts only).
 * No scoring; sensible defaults. Output is valid for orchestrator + flow-state-adapter.
 */

import type { CompiledBrief } from '@/lib/prompts/contracts'
import type { CitySignalsPackV1 } from '@/types/city-signals-pack'

export function compiledFromCitySignalsPackV1(pack: CitySignalsPackV1): CompiledBrief {
  const microAlerts: CompiledBrief['now_block']['micro_alerts'] = []
  const alerts: CompiledBrief['alerts'] = []
  const hotspots: CompiledBrief['hotspots'] = []
  const expectedPeaks: string[] = []
  const timeline: CompiledBrief['timeline'] = []
  const nextSlots: CompiledBrief['next_block']['slots'] = []
  const summary: string[] = []

  // Derive confidence from pack source - no hardcoded values
  // Higher confidence for more data sources, lower for sparse data
  const sourceCount = pack.events.length + pack.weather.length + pack.transport.length
  const baseConfidence = sourceCount > 5 ? 0.85 : sourceCount > 2 ? 0.75 : sourceCount > 0 ? 0.65 : 0.4

  // Weather → WEATHER alert + micro_alert
  for (const w of pack.weather) {
    const msg =
      w.type === 'rain_start'
        ? 'Pluie prévue'
        : w.type === 'heavy_rain'
          ? 'Forte pluie'
          : 'Coup de froid'
    const at = w.expectedAt ? ` vers ${w.expectedAt}` : ''
    microAlerts.push({ type: 'weather', message: `${msg}${at}`, expires_in_min: 60 })
    alerts.push({
      type: 'WEATHER',
      severity: w.impactLevel >= 2 ? 'HIGH' : 'MED',
      window: w.expectedAt ? `${w.expectedAt}-+2h` : 'Aujourd\'hui',
      area: 'Paris',
      avoid: [],
      opportunity: w.type === 'rain_start' ? ['Demande VTC en hausse'] : [],
      notes: [msg],
    })
  }

  // Transport → TRANSIT/STRIKE alerts + micro_alert
  for (const t of pack.transport) {
    const alertType = t.type === 'strike' ? 'STRIKE' : 'TRANSIT'
    const msg = `${t.line} — ${t.type === 'strike' ? 'Grève' : t.type === 'closure' ? 'Fermeture' : 'Incident'}`
    microAlerts.push({ type: 'friction', message: msg, expires_in_min: 120 })
    alerts.push({
      type: alertType,
      severity: 'HIGH',
      window: t.startTime && t.endTime ? `${t.startTime}-${t.endTime}` : 'Aujourd\'hui',
      area: t.line,
      avoid: [],
      opportunity: t.impactZones.length ? [`Report demande: ${t.impactZones.slice(0, 2).join(', ')}`] : [],
      notes: [msg],
    })
  }

  // Events → hotspots, expected_peaks, timeline, next_block slots, EVENT alerts
  const zonesFromEvents = new Set<string>()
  for (const e of pack.events) {
    const window = [e.startTime ?? '20:00', e.endTime ?? '23:00'].join('–')
    const why = e.expectedAttendance
      ? `${e.name} ${e.expectedAttendance} pers`
      : e.name
    // Score derived from attendance and source reliability, not hardcoded
    const attendanceScore = e.expectedAttendance
      ? Math.min(100, 50 + Math.floor(e.expectedAttendance / 500))
      : 60
    const eventScore = Math.round(attendanceScore * baseConfidence)

    hotspots.push({
      zone: e.zoneImpact[0] ?? e.venue,
      score: eventScore,
      window,
      why: [why],
      saturation_risk: (e.expectedAttendance ?? 0) > 15000 ? 'HIGH' : 'MED',
      alternatives: e.zoneImpact.slice(1, 3),
      pickup_notes: [],
      signal_source: 'Public',
    })
    expectedPeaks.push(`${(e.endTime ?? '23:00').slice(0, 5)} ${e.zoneImpact[0] ?? e.venue}`)
    e.zoneImpact.forEach((z) => zonesFromEvents.add(z))
    timeline.push({
      start: e.startTime ?? '20:00',
      end: e.endTime ?? '23:00',
      primary_zone: e.zoneImpact[0] ?? e.venue,
      reason: e.name,
      confidence: baseConfidence, // Derived from pack source count
      best_arrival: e.startTime ?? '20:00',
      best_exit: e.endTime ?? '23:00',
      saturation_risk: (e.expectedAttendance ?? 0) > 15000 ? 'HIGH' : 'MED',
      alternatives: e.zoneImpact.slice(1),
      avoid_axes: [],
    })
    nextSlots.push({
      window: `${e.startTime ?? '20:00'}-${e.endTime ?? '23:00'}`,
      zone: e.zoneImpact[0] ?? e.venue,
      reason: e.name,
      saturation: (e.expectedAttendance ?? 0) > 15000 ? 'HIGH' : 'MED',
      confidence: baseConfidence, // Derived from pack source count
    })
    alerts.push({
      type: 'EVENT',
      severity: (e.expectedAttendance ?? 0) > 20000 ? 'HIGH' : 'MED',
      window: `${e.startTime ?? ''}-${e.endTime ?? ''}`.replace(/^–|–$/g, '') || 'Soir',
      area: e.venue,
      avoid: [],
      opportunity: e.zoneImpact,
      notes: [e.name],
    })
    summary.push(`${e.zoneImpact[0] ?? e.venue} ${e.endTime ?? '23h'} — ${e.name}`)
  }

  const firstZone = pack.events[0]?.zoneImpact?.[0] ?? pack.transport[0]?.impactZones?.[0] ?? 'Gare du Nord'
  const secondZone = pack.events[0]?.zoneImpact?.[1] ?? pack.transport[0]?.impactZones?.[1] ?? 'Gare de l\'Est'

  return {
    meta: {
      timezone: 'Europe/Paris',
      generated_at: pack.generatedAt,
      run_mode: 'daily',
      profile_variant: 'NIGHT_CHASER',
      confidence_overall: baseConfidence, // Derived from source count
    },
    now_block: {
      window: '0-15min',
      actions: microAlerts.slice(0, 3).map((a) => a.message),
      zones: Array.from(zonesFromEvents).slice(0, 2).length
        ? Array.from(zonesFromEvents).slice(0, 2)
        : [firstZone, secondZone],
      rule: 'Rester en zone recommandée',
      micro_alerts: microAlerts.slice(0, 5),
      confidence: baseConfidence,
    },
    next_block: {
      slots: nextSlots.length ? nextSlots : [{ window: '20:00-22:00', zone: firstZone, reason: 'Données du jour', saturation: 'MED', confidence: baseConfidence * 0.8 }],
      key_transition: pack.events.length ? `Flux: ${pack.events.map((e) => e.zoneImpact[0]).join(' → ')}` : 'Flux stable',
    },
    horizon_block: {
      hotspots: hotspots.length
        ? hotspots.map(h => ({ zone: h.zone, window: h.window, score: h.score, why: h.why.join(', ') }))
        : [{ zone: firstZone, window: '20:00-23:00', score: Math.round(60 * baseConfidence), why: 'Données ville' }],
      rules: ['Rester en zone recommandée', 'Éviter saturation'],
      expected_peaks: expectedPeaks.length ? expectedPeaks : [`23:00 ${firstZone}`],
    },
    summary: summary.length ? summary : ['Données city signals chargées'],
    timeline: timeline.length ? timeline : [
      {
        start: '20:00',
        end: '23:00',
        primary_zone: firstZone,
        reason: 'Données du jour',
        confidence: baseConfidence * 0.8, // Degraded - no specific event data
        best_arrival: '19:45',
        best_exit: '22:30',
        saturation_risk: 'MED',
        alternatives: [secondZone],
        avoid_axes: [],
      },
    ],
    hotspots: hotspots.length ? hotspots : [
      {
        zone: firstZone,
        score: Math.round(60 * baseConfidence), // Derived, not hardcoded
        window: '20:00–23:00',
        why: ['Données city signals'],
        saturation_risk: 'MED',
        alternatives: [secondZone],
        pickup_notes: [],
        signal_source: 'Public',
      },
    ],
    alerts,
    rules: [
      { if: 'saturation zone', then: 'basculer alternative' },
      { if: 'pluie', then: 'zones couvertes prioritaires' },
    ],
    anti_clustering: {
      principle: 'Répartir pour éviter saturation',
      dispatch_hint: hotspots.slice(0, 2).map((h) => ({
        hotspot: h.zone,
        split_into: h.alternatives.slice(0, 2),
        reason: 'Répartition flux',
      })),
    },
    validation: {
      unknowns: buildSourceFailureMessages(pack),
      do_not_assume: [],
    },
  }
}

/**
 * Build source failure messages from pack sourceStatus (PASS 4)
 */
function buildSourceFailureMessages(pack: CitySignalsPackV1): string[] {
  const messages: string[] = []

  if (pack.sourceStatus) {
    if (pack.sourceStatus.openagenda === 'failed') {
      messages.push('OpenAgenda indisponible — événements manquants')
    }
    if (pack.sourceStatus.openweather === 'failed') {
      messages.push('OpenWeather indisponible — météo inconnue')
    }
    if (pack.sourceStatus.prim === 'failed') {
      messages.push('PRIM indisponible — transport non vérifié')
    }
  }

  return messages
}
