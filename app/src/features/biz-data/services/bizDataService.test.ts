import { describe, expect, it } from 'vitest'
import type { EnrichedBizDataNode } from '../types'
import { buildOrgPath, buildOrgScopeKey } from './bizDataService'

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
