/**
 * Fetch JSON from Supabase Storage (private bucket).
 * Uses service role key - server-side only.
 */

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export class StorageFetchError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: string
  ) {
    super(`Storage fetch failed: ${status} ${statusText}`)
    this.name = 'StorageFetchError'
  }
}

/**
 * Fetch JSON from Supabase Storage private bucket.
 * @param bucket - Storage bucket name (e.g., 'flow-packs')
 * @param objectPath - Path within bucket (e.g., 'daily/2026-03-02.paris-idf.json')
 * @returns Parsed JSON object or null if 404
 * @throws StorageFetchError for non-200/404 responses
 */
export async function storageFetchJson<T>(
  bucket: string,
  objectPath: string
): Promise<T | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Storage] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }
    return null
  }

  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath}`

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    cache: 'no-store',
  })

  if (res.status === 404) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Storage] Not found: ${bucket}/${objectPath}`)
    }
    return null
  }

  if (!res.ok) {
    const body = await res.text()
    throw new StorageFetchError(res.status, res.statusText, body)
  }

  // Handle empty response body
  const text = await res.text()
  if (!text || text.trim() === '') {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Storage] Empty body: ${bucket}/${objectPath}`)
    }
    return null
  }

  let data: T
  try {
    data = JSON.parse(text) as T
  } catch {
    throw new StorageFetchError(200, 'Invalid JSON', text.slice(0, 200))
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Storage] Loaded: ${bucket}/${objectPath}`)
  }

  return data as T
}

/**
 * Check if Supabase Storage is configured.
 */
export function isStorageConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
}
