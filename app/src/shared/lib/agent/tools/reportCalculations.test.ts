import { describe, expect, it } from 'vitest'
import { inferCumulativeToMonthPeriod, inferSchoolYearTargetPeriod } from './reportCalculations'

describe('business report period inference', () => {
  it('infers cumulative-to-month period from a monthly period', () => {
    expect(inferCumulativeToMonthPeriod('202603')).toBe('<202604')
    expect(inferCumulativeToMonthPeriod('202606')).toBe('<202607')
    expect(inferCumulativeToMonthPeriod('202612')).toBe('<202701')
  })

  it('infers school-year target period using July-June fiscal year', () => {
    expect(inferSchoolYearTargetPeriod('202603')).toBe('<202607')
    expect(inferSchoolYearTargetPeriod('202606')).toBe('<202607')
    expect(inferSchoolYearTargetPeriod('202607')).toBe('<202707')
    expect(inferSchoolYearTargetPeriod('202612')).toBe('<202707')
  })
})
