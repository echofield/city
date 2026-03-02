/**
 * Adapt compiled brief + orchestrator move into FlowState for the API.
 */

import type { FlowState } from '@/types/flow-state'
import type { CompiledBrief, MoveOutput } from './types'

/** Zone IDs used for zoneHeat / zoneSaturation / zoneState (Paris arrondissements / areas). */
export const TERRITORY_IDS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20']

const ZONE_TO_ARR: Record<string, string> = {
  'Châtelet': 'I', 'Bercy': 'XII', 'Marais': 'III', 'Gare du Nord': 'X',
  'Gare de Lyon': 'XII', 'Opéra': 'IX', 'Accor Arena': 'XII', 'Parc des Princes': 'XVI',
  'La Défense': '92', 'République': 'XI', 'Bastille': 'XI', 'Saint-Lazare': 'VIII',
}
function zoneToArr(zone: string): string {
  return ZONE_TO_ARR[zone] ?? zone.slice(0, 2)
}

export function compiledBriefAndMoveToFlowState(
  brief: CompiledBrief,
  move: MoveOutput,
  sessionStart?: number
): FlowState {
  const now = Date.now()
  const start = sessionStart ?? now - 15 * 60 * 1000
  const elapsedSec = (now - start) / 1000
  const shiftDurSec = 25 * 60
  const progress = Math.min(1, Math.max(0, elapsedSec / shiftDurSec))
  let shiftPhase: FlowState['shiftPhase'] = 'calme'
  if (progress < 0.2) shiftPhase = 'calme'
  else if (progress < 0.5) shiftPhase = 'montee'
  else if (progress < 0.75) shiftPhase = 'pic'
  else shiftPhase = 'dispersion'

  const zones = brief.now_block.zones
  const targetZone = move.recommended_zone ?? zones[0] ?? 'Châtelet'
  const favoredIds = ['11', '12', '3', '1']
  const zoneHeat: Record<string, number> = {}
  const zoneSaturation: Record<string, number> = {}
  const zoneState: Record<string, FlowState['zoneState'][string]> = {}
  for (const id of TERRITORY_IDS) {
    const favored = favoredIds.includes(id)
    zoneHeat[id] = favored ? 0.5 + Math.sin((id.length + 1) * 0.7) * 0.2 : 0.1
    zoneSaturation[id] = favored ? 45 : 15
    zoneState[id] = favored ? (zoneHeat[id] > 0.6 ? 'hot' : 'warm') : 'cold'
  }

  const confidence = move.confidence ?? brief.now_block.confidence ?? 72
  const alternatives = move.alternatives ?? zones.filter((z) => z !== targetZone).slice(0, 3)

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    windowState: 'active',
    windowLabel: 'FENETRE ACTIVE',
    windowCountdownSec: 420,
    windowMinutes: 7,
    shiftPhase,
    shiftProgress: progress,
    action: move.action,
    actionLabel: move.action === 'move' ? 'BOUGER' : move.action === 'hold' ? 'MAINTENIR' : move.action === 'prepare' ? 'PREPARER' : 'REPOS',
    confidence,
    fieldMessage: move.message ?? `${targetZone} actif.`,
    temporalMessage: 'Fenêtre ouverte — 7 min restantes.',
    targetZone,
    targetZoneArr: zoneToArr(targetZone),
    favoredCorridor: 'Est',
    favoredZoneIds: favoredIds,
    alternatives,
    zoneHeat,
    zoneSaturation,
    zoneState,
    earningsEstimate: [28, 42],
    sessionEarnings: 12.5,
    signals: [
      { text: brief.now_block.rule, type: 'event' as const },
      { text: 'Fenêtre active', type: 'surge' as const },
    ],
    upcoming: [
      { time: '20:00', zone: zones[1] ?? 'Bercy', saturation: 65, earnings: 38 },
      { time: '21:00', zone: zones[2] ?? 'Marais', saturation: 50, earnings: 32 },
    ],
    peaks: [
      { time: '22h45', zone: zones[1] ?? 'Bercy', reason: 'Pic sortie', score: 85 },
      { time: '23h15', zone: targetZone, reason: brief.now_block.rule, score: 80 },
    ],
  }
}
