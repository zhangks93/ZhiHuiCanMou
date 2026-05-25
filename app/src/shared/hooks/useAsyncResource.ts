import { useCallback, useEffect, useState, type DependencyList } from 'react'
import { getErrorMessage } from '@/shared/lib/errorMessage'
import { logger } from '@/shared/lib/logger'

export interface UseAsyncResourceOptions {
  enabled?: boolean
  errorFallback?: string
  initialData?: null
}

export function useAsyncResource<T>(
  loader: () => Promise<T>,
  deps: DependencyList,
  options: UseAsyncResourceOptions = {},
) {
  const { enabled = true, errorFallback = '加载失败，请稍后重试。' } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await loader()
      setData(result)
      return result
    } catch (caughtError) {
      const message = getErrorMessage(caughtError, errorFallback)
      setError(message)
      logger.error('Async resource load failed', caughtError)
      throw caughtError
    } finally {
      setLoading(false)
    }
  }, [errorFallback, loader])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)
      try {
        const result = await loader()
        if (!cancelled) {
          setData(result)
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(getErrorMessage(caughtError, errorFallback))
          logger.error('Async resource load failed', caughtError)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls invalidation via deps
  }, [enabled, errorFallback, loader, ...deps])

  return {
    data,
    loading,
    error,
    reload,
    setData,
  }
}
