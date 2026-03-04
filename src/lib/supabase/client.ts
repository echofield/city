import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function createClient() {
  // During build/SSR, defer to runtime - don't throw
  if (typeof window === 'undefined') {
    return null as unknown as ReturnType<typeof createBrowserClient>
  }

  // Fail loudly in production runtime if Supabase is not configured
  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
    // Dev fallback - warn but allow local development without Supabase
    console.warn('[Supabase] Missing configuration - auth features disabled')
    return null as unknown as ReturnType<typeof createBrowserClient>
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
