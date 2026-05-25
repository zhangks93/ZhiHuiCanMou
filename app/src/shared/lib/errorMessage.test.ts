import { describe, expect, it } from 'vitest'
import { getErrorMessage } from '@/shared/lib/errorMessage'

describe('getErrorMessage', () => {
  it('returns Error.message when present', () => {
    expect(getErrorMessage(new Error('network failed'), 'fallback')).toBe('network failed')
  })

  it('returns string errors directly', () => {
    expect(getErrorMessage('bad request', 'fallback')).toBe('bad request')
  })

  it('reads message field from plain objects', () => {
    expect(getErrorMessage({ message: 'db timeout' }, 'fallback')).toBe('db timeout')
  })

  it('falls back when value is empty', () => {
    expect(getErrorMessage(null, '操作失败')).toBe('操作失败')
    expect(getErrorMessage(new Error('   '), '操作失败')).toBe('操作失败')
  })
})
