/**
 * Mock compiled brief used when no daily pack is present or for fallback.
 */

import type { CompiledBrief } from './types'

export const MOCK_COMPILED_BRIEF: CompiledBrief = {
  now_block: {
    zones: ['Châtelet', 'Bercy', 'Marais', 'Gare du Nord'],
    rule: 'Fenêtre active — déplacement recommandé.',
    confidence: 72,
  },
  meta: {
    profile_variant: 'default',
  },
}
