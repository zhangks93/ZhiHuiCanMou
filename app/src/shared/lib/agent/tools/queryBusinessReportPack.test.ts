import { describe, expect, it } from 'vitest'
import type { EnrichedBizDataNode } from '@/features/biz-data/types'
import { __queryBusinessReportPackTestUtils } from './queryBusinessReportPack'

function node(overrides: Partial<EnrichedBizDataNode> = {}): EnrichedBizDataNode {
  return {
    node_name: '后勤管理中心',
    sort_order: 1,
    hierarchy: {
      center_region: null,
      business_segment: null,
      report_level1: null,
      report_level2: null,
      is_aggregated: false,
      aggregation_level: null,
    },
    orgHierarchy: {
      level_0: '智汇后勤集团',
      level_1: '后勤管理中心',
      level_2: null,
    },
    metrics: {},
    ...overrides,
  }
}

describe('query business report pack helpers', () => {
  it('derives completion rate and diff when source fields are missing', () => {
    const fields = __queryBusinessReportPackTestUtils.getReportTypeFields({
      actual: 120,
      actual_fone: 120,
      actual_tuwei: 100,
      budget_fone: 80,
      budget_tuwei: 125,
      completion_fone: null,
      completion_tuwei: null,
      diff_fone: null,
      diff_tuwei: null,
      yoy: null,
      yoy_fone: null,
      yoy_tuwei: null,
    }, 'fone')

    expect(fields.target).toBe(80)
    expect(fields.completionRate).toBe(1.5)
    expect(fields.diff).toBe(40)
    expect(fields.status).toBe('good')
  })

  it('keeps cumulative wide rows when only per-report-type actuals exist', () => {
    const rows = __queryBusinessReportPackTestUtils.buildMetricComparisonWideTable({
      monthRoot: null,
      previousRoot: null,
      cumulativeToMonthRoot: node({
        metrics: {
          revenue: {
            actual: null,
            actual_fone: 90,
            actual_tuwei: 85,
            budget_fone: null,
            budget_tuwei: null,
            completion_fone: null,
            completion_tuwei: null,
            diff_fone: null,
            diff_tuwei: null,
            yoy: null,
            yoy_fone: null,
            yoy_tuwei: null,
          },
        },
      }),
      schoolYearTargetRoot: null,
      metrics: ['revenue'],
      labelMap: new Map([['revenue', '营业收入']]),
    })

    expect(rows).toHaveLength(1)
    expect(rows[0].period_scope).toBe('cumulative_to_month')
    expect(rows[0].school_year_budget_actual).toBe(90)
    expect(rows[0].breakthrough_assessment_actual).toBe(85)
  })

  it('writes school year goal actuals by both budget and breakthrough assessment', () => {
    const rows = __queryBusinessReportPackTestUtils.buildSchoolYearGoalAssessmentTable({
      month: '202603',
      labelMap: new Map([
        ['revenue', '营业收入'],
        ['pretax_profit', '税前利润'],
      ]),
      schoolYearTargetRoot: node({
        metrics: {
          revenue: {
            actual: null,
            actual_fone: 800,
            actual_tuwei: 760,
            budget_fone: 1000,
            budget_tuwei: 1100,
            completion_fone: null,
            completion_tuwei: null,
            diff_fone: null,
            diff_tuwei: null,
            yoy: null,
            yoy_fone: null,
            yoy_tuwei: null,
          },
        },
      }),
    })

    const revenue = rows.find(row => row.metric === 'revenue')
    expect(revenue?.actual).toBeNull()
    expect(revenue?.school_year_budget_actual).toBe(800)
    expect(revenue?.breakthrough_assessment_actual).toBe(760)
    expect(revenue?.school_year_budget_completion_rate).toBe(0.8)
    expect(revenue?.breakthrough_assessment_completion_rate).toBeCloseTo(760 / 1100)
  })

  it('identifies support units from department name and cost profile', () => {
    const role = __queryBusinessReportPackTestUtils.inferBusinessRole(node({
      node_name: '战略支持中心',
      orgHierarchy: {
        level_0: '智汇后勤集团',
        level_1: '战略支持中心',
        level_2: null,
      },
      metrics: {
        labor_cost: {
          actual: 30,
          actual_fone: 30,
          actual_tuwei: 30,
          budget_fone: 28,
          budget_tuwei: 28,
          completion_fone: null,
          completion_tuwei: null,
          diff_fone: null,
          diff_tuwei: null,
          yoy: null,
          yoy_fone: null,
          yoy_tuwei: null,
        },
      },
    }))

    expect(role).toBe('职能支持型')
  })
})
