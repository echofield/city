/**
 * Simple in-memory cache with TTL
 * For production scale, use Redis or Vercel KV
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>()

  /**
   * Get cached value if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key)

    if (!entry) return null

    if (entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return null
    }

    return entry.value as T
  }

  /**
   * Set value with TTL in seconds
   */
  set<T>(key: string, value: T, ttlSec: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSec * 1000,
    })
  }

  /**
   * Delete cached value
   */
  delete(key: string): void {
    this.store.delete(key)
  }

  /**
   * Clear all expired entries
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt < now) {
        this.store.delete(key)
      }
    }
  }

  /**
   * Get cache stats
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    }
  }
}

// Singleton instance
export const cache = new MemoryCache()

// Clean up expired entries every 10 minutes
setInterval(() => cache.cleanup(), 10 * 60 * 1000)

// ══════════════════════════════════════════════════════════════
// CACHE KEYS & TTLs
// ══════════════════════════════════════════════════════════════

export const CACHE_KEYS = {
  citySignals: (date: string) => `city-signals:${date}`,
  weeklySignals: () => 'weekly-signals',
} as const

export const CACHE_TTL = {
  /** City signals: 1 hour (data changes daily, but cache for performance) */
  citySignals: 60 * 60,
  /** Weekly signals: 6 hours */
  weeklySignals: 6 * 60 * 60,
} as const
