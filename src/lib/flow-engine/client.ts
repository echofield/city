import type { CompiledBrief } from '@/lib/prompts/contracts'

/**
 * Fetch compiled brief from API
 * Toggleable between mock and live mode via NEXT_PUBLIC_FLOW_MODE
 */
export async function fetchCompiledBrief(): Promise<CompiledBrief> {
  const mode = process.env.NEXT_PUBLIC_FLOW_MODE ?? 'mock'

  if (mode === 'mock') {
    const res = await fetch('/api/flow/brief', { cache: 'no-store' })
    if (!res.ok) throw new Error('Failed to load brief')
    return res.json()
  }

  // V2: live mode - fetch from Supabase
  // Will fetch latest app.briefs row for authenticated user
  throw new Error('FLOW_MODE=live not implemented yet')
}

/**
 * Hook-friendly version with loading state
 */
export function useBrief() {
  // This would be a proper React hook with useState/useEffect
  // For now, the page handles this directly
  return { fetchCompiledBrief }
}
