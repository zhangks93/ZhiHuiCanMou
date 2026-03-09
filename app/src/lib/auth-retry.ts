/**
 * Retry utility with exponential backoff for handling transient failures
 */

export interface RetryOptions {
  maxAttempts?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  retryableErrors?: string[]
  onRetry?: (attempt: number, error: unknown) => void
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: unknown
  attempts: number
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [],
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(attempt: number, options: Required<Omit<RetryOptions, 'onRetry'>>): number {
  const delay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt - 1)
  return Math.min(delay, options.maxDelayMs)
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown, retryableErrors: string[]): boolean {
  if (retryableErrors.length === 0) {
    // If no specific errors specified, retry all errors
    return true
  }

  if (error instanceof Error) {
    return retryableErrors.some(pattern =>
      error.name.includes(pattern) || error.message.includes(pattern)
    )
  }

  if (typeof error === 'object' && error !== null) {
    const errorObj = error as { code?: string; error_code?: string }
    const code = errorObj.code || errorObj.error_code
    if (code) {
      return retryableErrors.includes(code)
    }
  }

  return false
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: unknown

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const data = await fn()
      return {
        success: true,
        data,
        attempts: attempt,
      }
    } catch (error) {
      lastError = error

      // Check if we should retry
      const shouldRetry =
        attempt < opts.maxAttempts &&
        isRetryableError(error, opts.retryableErrors)

      if (!shouldRetry) {
        return {
          success: false,
          error,
          attempts: attempt,
        }
      }

      // Call onRetry callback
      if (options.onRetry) {
        options.onRetry(attempt, error)
      }

      // Wait before retrying
      const delay = calculateDelay(attempt, opts)
      await sleep(delay)
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: opts.maxAttempts,
  }
}

/**
 * Retry specifically for Supabase setSession
 */
export async function retrySetSession(
  setSessionFn: () => Promise<{ error: unknown }>,
  onRetry?: (attempt: number, error: unknown) => void
): Promise<RetryResult<void>> {
  return retryWithBackoff(
    async () => {
      const { error } = await setSessionFn()
      if (error) {
        throw error
      }
    },
    {
      maxAttempts: 3,
      initialDelayMs: 2000,
      maxDelayMs: 8000,
      backoffMultiplier: 2,
      onRetry,
    }
  )
}

/**
 * Retry with timeout
 */
export async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
  })

  try {
    const result = await Promise.race([
      retryWithBackoff(fn, options),
      timeoutPromise,
    ])
    return result
  } catch (error) {
    return {
      success: false,
      error,
      attempts: 0,
    }
  }
}

/**
 * Create a retry-enabled fetch wrapper
 */
export function createRetryFetch(options: RetryOptions = {}) {
  return async function retryFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const result = await retryWithBackoff(
      () => fetch(input, init),
      {
        ...options,
        retryableErrors: ['TypeError', 'NetworkError', 'AbortError', ...(options.retryableErrors || [])],
      }
    )

    if (!result.success || !result.data) {
      throw result.error || new Error('Fetch failed after retries')
    }

    return result.data
  }
}
