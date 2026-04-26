import { describe, expect, it } from 'vitest'
import { getWorkspaceTabs } from './workspaceTabs'

describe('getWorkspaceTabs', () => {
  it('always exposes briefing first', () => {
    expect(getWorkspaceTabs([])).toEqual(['briefing'])
  })

  it('adds schedule and inbox together when schedule is enabled', () => {
    expect(getWorkspaceTabs(['schedule'])).toEqual(['briefing', 'schedule', 'inbox'])
  })

  it('keeps links as an optional tail tab', () => {
    expect(getWorkspaceTabs(['links', 'schedule'])).toEqual(['briefing', 'schedule', 'inbox', 'links'])
  })
})
