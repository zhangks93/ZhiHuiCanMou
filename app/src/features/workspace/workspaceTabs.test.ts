import { describe, expect, it } from 'vitest'
import { getWorkspaceTabs } from './workspaceTabs'

describe('getWorkspaceTabs', () => {
  it('returns no tabs when no workspace modules are enabled', () => {
    expect(getWorkspaceTabs([])).toEqual([])
  })

  it('adds schedule and inbox together when schedule is enabled', () => {
    expect(getWorkspaceTabs(['schedule'])).toEqual(['schedule', 'inbox'])
  })

  it('keeps links as an optional tail tab', () => {
    expect(getWorkspaceTabs(['links', 'schedule'])).toEqual(['schedule', 'inbox', 'links'])
  })
})
