/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAsyncResource } from './useAsyncResource'

describe('useAsyncResource', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('loads data on mount', async () => {
    const loader = vi.fn(async () => ['a', 'b'])

    const { result } = renderHook(() => useAsyncResource(loader, [], { errorFallback: 'failed' }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(loader).toHaveBeenCalledTimes(1)
    expect(result.current.data).toEqual(['a', 'b'])
    expect(result.current.error).toBeNull()
  })

  it('captures errors with fallback message', async () => {
    const loader = vi.fn(async () => {
      throw new Error('boom')
    })

    const { result } = renderHook(() =>
      useAsyncResource(loader, [], { errorFallback: '加载失败' }),
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('boom')
    expect(result.current.data).toBeNull()
  })

  it('skips loading when disabled', async () => {
    const loader = vi.fn(async () => 'value')

    const { result } = renderHook(() =>
      useAsyncResource(loader, [], { enabled: false }),
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(loader).not.toHaveBeenCalled()
    expect(result.current.data).toBeNull()
  })
})
