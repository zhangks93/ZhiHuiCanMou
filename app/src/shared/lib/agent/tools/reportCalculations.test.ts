import { describe, expect, it } from 'vitest'
import {
  assessGoalProbability,
  inferCumulativeToMonthPeriod,
  inferSchoolYearTargetPeriod,
  schoolYearProgressRate,
} from './reportCalculations'

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

  it('calculates school-year progress using July-June fiscal year', () => {
    expect(schoolYearProgressRate('202607')).toBeCloseTo(1 / 12)
    expect(schoolYearProgressRate('202603')).toBeCloseTo(9 / 12)
    expect(schoolYearProgressRate('202606')).toBeCloseTo(12 / 12)
  })

  it('classifies school-year goal probability by progress gap', () => {
    expect(assessGoalProbability({
      completionRate: 1,
      progressRate: 0.75,
      actual: 100,
      metric: 'revenue',
    })).toMatchObject({ probability: '已达成', risk: '低', progressGap: 0.25 })

    expect(assessGoalProbability({
      completionRate: 0.82,
      progressRate: 0.75,
      actual: 100,
      metric: 'revenue',
    })).toMatchObject({ probability: '较高', risk: '低' })

    expect(assessGoalProbability({
      completionRate: 0.72,
      progressRate: 0.75,
      actual: 100,
      metric: 'revenue',
    })).toMatchObject({ probability: '中等', risk: '中' })

    expect(assessGoalProbability({
      completionRate: 0.6,
      progressRate: 0.75,
      actual: 100,
      metric: 'revenue',
    })).toMatchObject({ probability: '较低', risk: '高' })
  })

  it('keeps negative pretax profit at high risk', () => {
    expect(assessGoalProbability({
      completionRate: 0.8,
      progressRate: 0.75,
      actual: -10,
      metric: 'pretax_profit',
    })).toMatchObject({ probability: '较低', risk: '高' })
  })

  it('marks missing completion rate as insufficient data', () => {
    expect(assessGoalProbability({
      completionRate: null,
      progressRate: 0.75,
      actual: 100,
      metric: 'revenue',
    })).toEqual({ probability: '数据不足', risk: '需补数', progressGap: null })
  })
})
