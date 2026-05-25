/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import {
  parseAuthCallbackParams,
  validateCallbackState,
} from './authCallbackService'
import { storeAuthState } from '@/shared/lib/auth-storage'

describe('authCallbackService', () => {
  it('parses tokens from hash fragment', () => {
    const location = {
      href: 'https://app.example/#/auth-callback#access_token=abc&refresh_token=def&state=xyz',
      pathname: '/auth-callback',
      hash: '#/auth-callback#access_token=abc&refresh_token=def&state=xyz',
      search: '',
    } as Location

    const parsed = parseAuthCallbackParams(location)

    expect(parsed.accessToken).toBe('abc')
    expect(parsed.refreshToken).toBe('def')
    expect(parsed.state).toBe('xyz')
  })

  it('validates callback state against stored auth state', () => {
    storeAuthState('state-123', 'desktop')

    expect(validateCallbackState('state-123')).toBeNull()
    expect(validateCallbackState('wrong-state')?.code).toBe('STATE_VALIDATION_FAILED')
  })
})
