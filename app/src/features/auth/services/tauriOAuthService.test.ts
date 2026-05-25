/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { isTauriRuntime } from '@/shared/lib/tauri'

describe('tauriOAuthService runtime detection', () => {
  it('returns false in vitest jsdom without Tauri globals', () => {
    expect(isTauriRuntime()).toBe(false)
  })

  it('detects Tauri when __TAURI__ is present', () => {
    const original = (window as Window & { __TAURI__?: unknown }).__TAURI__
    ;(window as Window & { __TAURI__?: unknown }).__TAURI__ = {}

    expect(isTauriRuntime()).toBe(true)

    if (original === undefined) {
      delete (window as Window & { __TAURI__?: unknown }).__TAURI__
    } else {
      ;(window as Window & { __TAURI__?: unknown }).__TAURI__ = original
    }
  })
})
