import { describe, expect, it } from 'vitest'
import { DATA_MODULE_IDS, isDataModuleId } from './modules'

describe('module registry', () => {
  it('keeps competitor in the shared data-module registry', () => {
    expect(DATA_MODULE_IDS).toContain('competitor')
  })

  it('validates known data module ids only', () => {
    expect(isDataModuleId('competitor')).toBe(true)
    expect(isDataModuleId('unknown-module')).toBe(false)
  })
})
