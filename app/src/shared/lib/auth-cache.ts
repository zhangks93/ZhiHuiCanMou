/**
 * Request deduplication and caching for authentication flows
 * Prevents duplicate concurrent requests and caches responses
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

interface PendingRequest<T> {
  promise: Promise<T>
  timestamp: number
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

class AuthCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map()
  private pendingRequests: Map<string, PendingRequest<unknown>> = new Map()

  /**
   * Get cached value if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cached value with TTL
   */
  set<T>(key: string, data: T, ttlMs: number = DEFAULT_CACHE_TTL_MS): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs,
    }
    this.cache.set(key, entry)
  }

  /**
   * Delete cached value
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cached values
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Execute function with deduplication
   * If the same request is already in flight, return the existing promise
   */
  async deduplicate<T>(
    key: string,
    fn: () => Promise<T>,
    options: { cacheTtl?: number; deduplicateTimeout?: number } = {}
  ): Promise<T> {
    const { cacheTtl = DEFAULT_CACHE_TTL_MS, deduplicateTimeout = 30000 } = options

    // Check cache first
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Check if request is already pending
    const pending = this.pendingRequests.get(key)
    if (pending) {
      // Check if pending request is not too old
      if (Date.now() - pending.timestamp < deduplicateTimeout) {
        return pending.promise as Promise<T>
      } else {
        // Pending request timed out, remove it
        this.pendingRequests.delete(key)
      }
    }

    // Execute new request
    const promise = fn()
      .then((result) => {
        // Cache the result
        this.set(key, result, cacheTtl)
        // Remove from pending
        this.pendingRequests.delete(key)
        return result
      })
      .catch((error) => {
        // Remove from pending on error
        this.pendingRequests.delete(key)
        throw error
      })

    // Store as pending
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
    })

    return promise
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now()
    let validEntries = 0
    let expiredEntries = 0

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expiredEntries++
      } else {
        validEntries++
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      pendingRequests: this.pendingRequests.size,
    }
  }
}

// Global cache instance
const authCache = new AuthCache()

// Periodically clear expired entries (every 5 minutes)
if (typeof window !== 'undefined') {
  setInterval(() => {
    authCache.clearExpired()
  }, 5 * 60 * 1000)
}

export { authCache, AuthCache }

/**
 * Create a cache key from parameters
 */
export function createCacheKey(prefix: string, ...params: unknown[]): string {
  return `${prefix}:${params.map(p => String(p)).join(':')}`
}

/**
 * Cached fetch wrapper
 */
export async function cachedFetch(
  url: string,
  options?: RequestInit,
  cacheTtl?: number
): Promise<Response> {
  const cacheKey = createCacheKey('fetch', url, JSON.stringify(options))

  return authCache.deduplicate(
    cacheKey,
    () => fetch(url, options),
    { cacheTtl }
  )
}

/**
 * Clear all auth-related caches
 */
export function clearAuthCache(): void {
  authCache.clear()
}

/**
 * Get cache statistics
 */
export function getAuthCacheStats() {
  return authCache.getStats()
}
