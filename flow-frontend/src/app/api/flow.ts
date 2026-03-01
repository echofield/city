/**
 * FLOW API client — single source for backend state.
 * Backend is the source of truth; frontend only renders.
 *
 * When VITE_FLOW_API_URL is unset or empty, uses relative /api so Vite proxy
 * (→ http://localhost:3000) is used; no CORS. For a different backend port, set
 * e.g. VITE_FLOW_API_URL=http://localhost:3001 in .env
 */

const BASE = import.meta.env.VITE_FLOW_API_URL ?? ''

export async function fetchFlowState(sessionStart?: number): Promise<unknown> {
  const path = '/api/flow/state' + (sessionStart != null ? `?sessionStart=${sessionStart}` : '')
  const url = BASE ? `${BASE}${path}` : path
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error('Flow API error')
  return res.json()
}

/** Hero/demo: fetch mock state (slower poll). */
export async function fetchFlowStateMock(sessionStart?: number): Promise<unknown> {
  const params = new URLSearchParams({ mock: '1' })
  if (sessionStart != null) params.set('sessionStart', String(sessionStart))
  const path = `/api/flow/state?${params}`
  const url = BASE ? `${BASE}${path}` : path
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error('Flow API error')
  return res.json()
}
