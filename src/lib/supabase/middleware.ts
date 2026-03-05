import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

export async function updateSession(request: NextRequest) {
  // If Supabase is not configured (e.g. Edge env vars not set), bypass auth so the app doesn't 500
  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Supabase Middleware] Missing config - auth bypass (set NEXT_PUBLIC_SUPABASE_* or SUPABASE_* for auth)')
    } else {
      console.warn('[Supabase Middleware] Missing configuration - auth bypass enabled')
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public routes that don't require auth
  const publicRoutes = ['/login', '/auth/callback']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // If no user and trying to access protected route
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If user exists, check profile and subscription for gating
  if (user && !isPublicRoute && pathname !== '/onboarding' && pathname !== '/pay') {
    // Fetch profile to check onboarding status
    const { data: profile } = await supabase
      .schema('app')
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', user.id)
      .single()

    // No profile or onboarding incomplete -> /onboarding
    if (!profile || !profile.onboarding_complete) {
      if (pathname !== '/onboarding') {
        const url = request.nextUrl.clone()
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
      }
    } else {
      // Check subscription
      const { data: subscription } = await supabase
        .schema('app')
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      // No active subscription -> /pay
      if (!subscription && pathname !== '/pay' && pathname !== '/onboarding') {
        const url = request.nextUrl.clone()
        url.pathname = '/pay'
        return NextResponse.redirect(url)
      }
    }
  }

  // Redirect authenticated users away from login
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
