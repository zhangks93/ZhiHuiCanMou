/**
 * Privacy-safe authentication analytics
 * Tracks auth success/failure rates, timing, and error types without PII
 */

import { env } from '@/app/config/env'

interface AuthEvent {
  type: 'auth_start' | 'auth_success' | 'auth_failure' | 'auth_retry' | 'session_refresh'
  timestamp: number
  duration?: number
  errorCode?: string
  platform?: 'desktop' | 'mobile' | 'web'
  retryAttempt?: number
}

interface AuthMetrics {
  totalAttempts: number
  successCount: number
  failureCount: number
  retryCount: number
  averageDuration: number
  errorCodes: Record<string, number>
  platformBreakdown: Record<string, { success: number; failure: number }>
}

class AuthAnalytics {
  private events: AuthEvent[] = []
  private maxEvents = 100 // Keep last 100 events
  private sessionStartTime: number | null = null

  /**
   * Track auth start
   */
  trackAuthStart(platform: 'desktop' | 'mobile' | 'web'): void {
    if (!env.auth.enableAnalytics) return

    this.sessionStartTime = Date.now()
    this.addEvent({
      type: 'auth_start',
      timestamp: Date.now(),
      platform,
    })

    if (env.auth.enableDebug) {
      console.log('[AuthAnalytics] Auth started', { platform })
    }
  }

  /**
   * Track auth success
   */
  trackAuthSuccess(platform: 'desktop' | 'mobile' | 'web'): void {
    if (!env.auth.enableAnalytics) return

    const duration = this.sessionStartTime ? Date.now() - this.sessionStartTime : undefined

    this.addEvent({
      type: 'auth_success',
      timestamp: Date.now(),
      duration,
      platform,
    })

    if (env.auth.enableDebug) {
      console.log('[AuthAnalytics] Auth succeeded', { platform, duration })
    }

    this.sessionStartTime = null
  }

  /**
   * Track auth failure
   */
  trackAuthFailure(errorCode: string, platform: 'desktop' | 'mobile' | 'web'): void {
    if (!env.auth.enableAnalytics) return

    const duration = this.sessionStartTime ? Date.now() - this.sessionStartTime : undefined

    this.addEvent({
      type: 'auth_failure',
      timestamp: Date.now(),
      duration,
      errorCode,
      platform,
    })

    if (env.auth.enableDebug) {
      console.log('[AuthAnalytics] Auth failed', { platform, errorCode, duration })
    }

    this.sessionStartTime = null
  }

  /**
   * Track auth retry
   */
  trackAuthRetry(attempt: number, errorCode: string, platform: 'desktop' | 'mobile' | 'web'): void {
    if (!env.auth.enableAnalytics) return

    this.addEvent({
      type: 'auth_retry',
      timestamp: Date.now(),
      errorCode,
      platform,
      retryAttempt: attempt,
    })

    if (env.auth.enableDebug) {
      console.log('[AuthAnalytics] Auth retry', { platform, attempt, errorCode })
    }
  }

  /**
   * Track session refresh
   */
  trackSessionRefresh(success: boolean): void {
    if (!env.auth.enableAnalytics) return

    this.addEvent({
      type: 'session_refresh',
      timestamp: Date.now(),
      errorCode: success ? undefined : 'REFRESH_FAILED',
    })

    if (env.auth.enableDebug) {
      console.log('[AuthAnalytics] Session refresh', { success })
    }
  }

  /**
   * Add event to history
   */
  private addEvent(event: AuthEvent): void {
    this.events.push(event)

    // Keep only last N events
    if (this.events.length > this.maxEvents) {
      this.events.shift()
    }
  }

  /**
   * Get metrics for the last N minutes
   */
  getMetrics(lastMinutes: number = 60): AuthMetrics {
    const cutoffTime = Date.now() - lastMinutes * 60 * 1000
    const recentEvents = this.events.filter(e => e.timestamp >= cutoffTime)

    const metrics: AuthMetrics = {
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      retryCount: 0,
      averageDuration: 0,
      errorCodes: {},
      platformBreakdown: {},
    }

    let totalDuration = 0
    let durationCount = 0

    for (const event of recentEvents) {
      if (event.type === 'auth_start') {
        metrics.totalAttempts++
      } else if (event.type === 'auth_success') {
        metrics.successCount++
        if (event.duration) {
          totalDuration += event.duration
          durationCount++
        }
      } else if (event.type === 'auth_failure') {
        metrics.failureCount++
        if (event.errorCode) {
          metrics.errorCodes[event.errorCode] = (metrics.errorCodes[event.errorCode] || 0) + 1
        }
        if (event.duration) {
          totalDuration += event.duration
          durationCount++
        }
      } else if (event.type === 'auth_retry') {
        metrics.retryCount++
      }

      // Platform breakdown
      if (event.platform && (event.type === 'auth_success' || event.type === 'auth_failure')) {
        if (!metrics.platformBreakdown[event.platform]) {
          metrics.platformBreakdown[event.platform] = { success: 0, failure: 0 }
        }
        if (event.type === 'auth_success') {
          metrics.platformBreakdown[event.platform].success++
        } else {
          metrics.platformBreakdown[event.platform].failure++
        }
      }
    }

    metrics.averageDuration = durationCount > 0 ? totalDuration / durationCount : 0

    return metrics
  }

  /**
   * Get success rate (0-100)
   */
  getSuccessRate(lastMinutes: number = 60): number {
    const metrics = this.getMetrics(lastMinutes)
    const total = metrics.successCount + metrics.failureCount
    if (total === 0) return 100
    return (metrics.successCount / total) * 100
  }

  /**
   * Get recent events
   */
  getRecentEvents(count: number = 10): AuthEvent[] {
    return this.events.slice(-count)
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = []
    this.sessionStartTime = null
  }

  /**
   * Export metrics for debugging
   */
  exportMetrics(): string {
    const metrics = this.getMetrics(60)
    return JSON.stringify({
      metrics,
      successRate: this.getSuccessRate(60),
      recentEvents: this.getRecentEvents(10),
    }, null, 2)
  }
}

// Global analytics instance
export const authAnalytics = new AuthAnalytics()

import { isTauriRuntime } from '@/shared/lib/tauri'

/**
 * Helper to determine platform
 */
export function getCurrentPlatform(): 'desktop' | 'mobile' | 'web' {
  if (typeof window === 'undefined') return 'web'

  const isTauri = isTauriRuntime()
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

  if (isTauri && isMobile) return 'mobile'
  if (isTauri) return 'desktop'
  return 'web'
}
