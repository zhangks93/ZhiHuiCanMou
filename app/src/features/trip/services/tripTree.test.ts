import { describe, expect, it } from 'vitest'
import { ROOT_ORG_NAME } from '@/shared/lib/orgConstants'
import {
  buildOrgHierarchyLookup,
  buildPersonTree,
  collectDefaultExpandedTreeKeys,
  flattenTreeRows,
  getDepartmentPath,
} from './tripTree'
import type { FeeEffectPersonSummary } from '../api/tripRepository'

function personSummary(overrides: Partial<FeeEffectPersonSummary>): FeeEffectPersonSummary {
  return {
    id: overrides.id ?? 'row-1',
    batch_id: overrides.batch_id ?? 'batch-1',
    person_name: overrides.person_name ?? '张三',
    department: overrides.department ?? '华东区域',
    signing_revenue_amount: overrides.signing_revenue_amount ?? 100,
    signing_profit_amount: overrides.signing_profit_amount ?? 20,
    travel_transportation_amount: overrides.travel_transportation_amount ?? 0,
    travel_lodging_amount: overrides.travel_lodging_amount ?? 0,
    travel_allowance_amount: overrides.travel_allowance_amount ?? 0,
    travel_total_amount: overrides.travel_total_amount ?? 5,
    hospitality_total_amount: overrides.hospitality_total_amount ?? 2,
    total_expense_amount: overrides.total_expense_amount ?? 7,
    created_at: overrides.created_at ?? '2026-01-01T00:00:00Z',
  }
}

describe('tripTree', () => {
  it('resolves department path under root org', () => {
    const lookup = buildOrgHierarchyLookup([])
    const path = getDepartmentPath('华东区域', lookup)

    expect(path[0]).toBe(ROOT_ORG_NAME)
    expect(path).toContain('华东区域')
  })

  it('builds person summary tree grouped by department and person', () => {
    const lookup = buildOrgHierarchyLookup([])
    const tree = buildPersonTree([
      personSummary({ id: 'row-1', person_name: '张三', department: '华东区域' }),
      personSummary({ id: 'row-2', person_name: '李四', department: '华东区域' }),
    ], 'personSummary', lookup)

    expect(tree.length).toBeGreaterThan(0)

    const hasPerson = (rows: typeof tree): boolean =>
      rows.some((row) => row.level === 'person' || (row.children ? hasPerson(row.children) : false))

    expect(hasPerson(tree)).toBe(true)
  })

  it('expands first-level departments by default', () => {
    const lookup = buildOrgHierarchyLookup([])
    const tree = buildPersonTree([
      personSummary({ id: 'row-1', person_name: '张三', department: '华东区域' }),
    ], 'personSummary', lookup)
    const defaultExpanded = collectDefaultExpandedTreeKeys(tree)
    const visible = flattenTreeRows(tree, new Set(Array.from(defaultExpanded).filter((key) => !defaultExpanded.has(key))))

    expect(defaultExpanded.size).toBeGreaterThan(0)
    expect(visible.length).toBeGreaterThan(0)
  })
})
