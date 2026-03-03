/**
 * Simple in-memory rate limiter for API routes
 * For production scale, use Upstash Redis or Vercel KV
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitConfig {
  /** Maximum requests allowed in window */
  limit: number
  /** Window duration in seconds */
  windowSec: number
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Check rate limit for a given identifier (usually IP)
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const key = `${identifier}:${config.limit}:${config.windowSec}`

  let entry = store.get(key)

  // Reset if window expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowSec * 1000,
    }
  }

  entry.count++
  store.set(key, entry)

  const remaining = Math.max(0, config.limit - entry.count)

  return {
    success: entry.count <= config.limit,
    remaining,
    resetAt: entry.resetAt,
  }
}

/**
 * Get client IP from request headers (works with Vercel, Cloudflare, etc.)
 */
export function getClientIp(request: Request): string {
  const headers = new Headers(request.headers)

  // Vercel
  const xForwardedFor = headers.get('x-forwarded-for')
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim()
  }

  // Cloudflare
  const cfConnectingIp = headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  // Fallback
  return headers.get('x-real-ip') || 'unknown'
}

// Pre-configured rate limits
export const RATE_LIMITS = {
  // Flow API: 30 requests per minute
  flowApi: { limit: 30, windowSec: 60 },
  // Checkout: 5 requests per minute
  checkout: { limit: 5, windowSec: 60 },
  // Health check: 60 requests per minute
  health: { limit: 60, windowSec: 60 },
} as const
