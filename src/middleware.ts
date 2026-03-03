import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Protected routes requiring auth + subscription
    '/dashboard/:path*',
    '/replay/:path*',
    // Auth-required but not subscription-gated
    '/onboarding/:path*',
    '/pay/:path*',
    // Login page (redirect if already authenticated)
    '/login',
  ],
}
