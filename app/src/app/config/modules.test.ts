import { describe, expect, it } from 'vitest'
import { DATA_MODULE_IDS, isDataModuleId } from './modules'

describe('module registry', () => {
  it('validates known data module ids only', () => {
    expect(isDataModuleId('biz-data')).toBe(true)
    expect(isDataModuleId('collection')).toBe(true)
    expect(isDataModuleId('unknown-module')).toBe(false)
  })

  it('places collection immediately after business data', () => {
    expect(DATA_MODULE_IDS[DATA_MODULE_IDS.indexOf('biz-data') + 1]).toBe('collection')
  })
})
