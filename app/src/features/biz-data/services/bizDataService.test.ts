import { describe, expect, it } from 'vitest'
import type { EduBizReport, EnrichedBizDataNode } from '../types'
import { aggregateByNode, buildOrgPath, buildOrgScopeKey, buildTreeWithAggregation } from './bizDataService'

function node(nodeName: string, level1: string, level2: string): EnrichedBizDataNode {
  return {
    node_name: nodeName,
    sort_order: 0,
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
      level_1: level1,
      level_2: level2,
    },
    metrics: {},
  }
}

describe('biz data org scope identity', () => {
  it('builds distinct scope keys for duplicate node names under different paths', () => {
    const first = node('第一食堂', '东部区域', '餐饮中心')
    const second = node('第一食堂', '北部区域', '餐饮中心')

    expect(buildOrgScopeKey(first)).toBe('智汇后勤集团 / 东部区域 / 餐饮中心 / 第一食堂')
    expect(buildOrgScopeKey(second)).toBe('智汇后勤集团 / 北部区域 / 餐饮中心 / 第一食堂')
    expect(buildOrgScopeKey(first)).not.toBe(buildOrgScopeKey(second))
  })

  it('deduplicates repeated path names for synthetic hierarchy nodes', () => {
    const synthetic = node('餐饮中心', '东部区域', '餐饮中心')

    expect(buildOrgPath(synthetic)).toEqual(['智汇后勤集团', '东部区域', '餐饮中心'])
    expect(buildOrgScopeKey(synthetic)).toBe('智汇后勤集团 / 东部区域 / 餐饮中心')
  })
})

function report(overrides: Partial<EduBizReport>): EduBizReport {
  return {
    id: `${overrides.report_type}-${overrides.node_name}-${overrides.metric_category}`,
    sheet_code: '1.1',
    report_type: 'fone',
    period_type: 'cumulative',
    period: '<202604',
    period_yoy: null,
    node_name: '一号食堂',
    sort_order: 1,
    metric_category: 'revenue',
    metric_category_cn: '营业收入',
    actual_value: null,
    budget_value: null,
    completion_rate: null,
    diff_value: null,
    yoy_value: null,
    created_at: '2026-05-05T00:00:00.000Z',
    org_hierarchy: {
      level_0: '智汇后勤集团',
      level_1: '后勤管理中心',
      level_2: '餐饮中心',
    },
    ...overrides,
  }
}

describe('biz data report-type actual aggregation', () => {
  it('preserves separate cumulative actual values for school-year budget and breakthrough assessment', () => {
    const nodes = aggregateByNode([
      report({ report_type: 'fone', node_name: '一号食堂', sort_order: 1, actual_value: 100, budget_value: 80, completion_rate: 1.25, diff_value: 20 }),
    ], [
      report({ report_type: 'tuwei', node_name: '一号食堂', sort_order: 1, actual_value: 90, budget_value: 100, completion_rate: 0.9, diff_value: -10 }),
    ], [])

    const metric = nodes[0].metrics.revenue
    expect(metric?.actual).toBe(100)
    expect(metric?.actual_fone).toBe(100)
    expect(metric?.actual_tuwei).toBe(90)
    expect(metric?.completion_fone).toBe(1.25)
    expect(metric?.completion_tuwei).toBe(0.9)
  })

  it('aggregates synthetic parent completion rates from each report-type actual', () => {
    const reportsFone = [
      report({ report_type: 'fone', node_name: '一号食堂', sort_order: 1, actual_value: 100, budget_value: 80 }),
      report({ report_type: 'fone', node_name: '二号食堂', sort_order: 2, actual_value: 50, budget_value: 70 }),
    ]
    const reportsTuwei = [
      report({ report_type: 'tuwei', node_name: '一号食堂', sort_order: 1, actual_value: 90, budget_value: 100 }),
      report({ report_type: 'tuwei', node_name: '二号食堂', sort_order: 2, actual_value: 40, budget_value: 80 }),
    ]

    const tree = buildTreeWithAggregation(aggregateByNode(reportsFone, reportsTuwei, []))
    const parent = tree.find(item => item.node_name === '餐饮中心')
    const metric = parent?.metrics.revenue

    expect(metric?.actual_fone).toBe(150)
    expect(metric?.actual_tuwei).toBe(130)
    expect(metric?.completion_fone).toBeCloseTo(150 / 150)
    expect(metric?.completion_tuwei).toBeCloseTo(130 / 180)
  })
})
