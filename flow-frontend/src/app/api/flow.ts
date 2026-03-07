/**
 * FLOW API client — single source for backend state.
 * Backend is the source of truth; frontend only renders.
 *
 * When VITE_FLOW_API_URL is unset or empty, uses relative /api so Vite proxy
 * (→ http://localhost:3000) is used; no CORS. For cross-origin (e.g. Vercel frontend
 * calling Vercel backend), set VITE_FLOW_API_URL without trailing slash.
 *
 * API v1.6 returns { card, depth?, meta } — we need depth=1 to get FlowState.
 */

const BASE = (import.meta.env.VITE_FLOW_API_URL ?? '').replace(/\/+$/, '')

function apiUrl(path: string): string {
  if (!BASE) return path
  const p = path.startsWith('/') ? path : `/${path}`
  return `${BASE}${p}`
}

interface FlowApiResponse {
  card: unknown
  depth?: unknown
  meta: { source: string; stale: boolean; lastUpdate: string }
}

export async function fetchFlowState(sessionStart?: number): Promise<unknown> {
  const params = new URLSearchParams({ depth: '1' })
  if (sessionStart != null) params.set('sessionStart', String(sessionStart))
  const path = `/api/flow/state?${params}`
  const res = await fetch(apiUrl(path), { cache: 'no-store' })
  if (!res.ok) throw new Error('Flow API error')
  const data: FlowApiResponse = await res.json()
  // Return depth (FlowState) if available, otherwise return empty object
  return data.depth ?? {}
}

/** Hero/demo: fetch mock state (slower poll). */
export async function fetchFlowStateMock(sessionStart?: number): Promise<unknown> {
  const params = new URLSearchParams({ mock: '1' })
  if (sessionStart != null) params.set('sessionStart', String(sessionStart))
  const path = `/api/flow/state?${params}`
  const res = await fetch(apiUrl(path), { cache: 'no-store' })
  if (!res.ok) throw new Error('Flow API error')
  // Mock mode returns FlowState directly (not wrapped)
  return res.json()
}
