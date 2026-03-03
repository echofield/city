import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Allowed redirect paths (prevents open redirect vulnerability)
const ALLOWED_REDIRECTS = ['/dashboard', '/replay', '/onboarding', '/pay']

function getSafeRedirect(next: string | null): string {
  if (!next) return '/dashboard'

  // Must start with / and be in allowed list
  const normalized = next.startsWith('/') ? next : `/${next}`
  const basePath = normalized.split('?')[0] // Remove query params for check

  if (ALLOWED_REDIRECTS.some(allowed => basePath.startsWith(allowed))) {
    return normalized
  }

  return '/dashboard'
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const safeRedirect = getSafeRedirect(next)
      return NextResponse.redirect(`${origin}${safeRedirect}`)
    }
  }

  // Return to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
