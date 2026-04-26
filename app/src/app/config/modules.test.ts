import { describe, expect, it } from 'vitest'
import { isDataModuleId } from './modules'

describe('module registry', () => {
  it('validates known data module ids only', () => {
    expect(isDataModuleId('biz-data')).toBe(true)
    expect(isDataModuleId('unknown-module')).toBe(false)
  })
})
