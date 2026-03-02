/**
 * Shift conductor: given brief + driver context, produce a move recommendation.
 */

import type { OrchestrateInput, MoveOutput } from '@/lib/flow-engine/types'

export function orchestrate(input: OrchestrateInput): { move: MoveOutput } {
  const zones = input.now_block.zones
  const currentZone = input.driver.current_zone
  const recommended = zones.includes(currentZone) ? currentZone : zones[0] ?? 'Châtelet'
  const alternatives = zones.filter((z) => z !== recommended).slice(0, 3)

  return {
    move: {
      recommended_zone: recommended,
      action: 'move',
      confidence: input.now_block.confidence,
      alternatives,
      message: `${recommended} recommandé.`,
    },
  }
}
