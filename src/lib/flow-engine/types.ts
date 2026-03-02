/**
 * Internal types for flow-engine: compiled brief and orchestrator I/O.
 */

export interface CompiledBrief {
  now_block: {
    zones: string[]
    rule: string
    confidence: number
  }
  meta: {
    profile_variant: string
  }
}

export interface OrchestrateInput {
  brief_id: string
  now_block: CompiledBrief['now_block']
  driver: {
    id: string
    profile_variant: string
    current_zone: string
    shift_started_at: string
  }
  signals: {
    fleet_density: Record<string, unknown>
    surge_active: string[]
    events_ending_soon: string[]
  }
}

export type MoveAction = 'hold' | 'prepare' | 'move' | 'rest'

export interface MoveOutput {
  recommended_zone: string
  action: MoveAction
  confidence?: number
  alternatives?: string[]
  message?: string
}
