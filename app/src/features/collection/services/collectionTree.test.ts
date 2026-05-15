import { describe, expect, it } from 'vitest'
import {
  buildCollectionTree,
  collectDefaultExpandedCollectionKeys,
  flattenCollectionTreeRows,
} from './collectionTree'
import type { CollectionReceivableRow } from '../api/collectionRepository'

function row(overrides: Partial<CollectionReceivableRow>): CollectionReceivableRow {
  return {
    id: overrides.id ?? `id-${overrides.row_order}`,
    period_label: '2025累计回款率统计——4月',
    row_order: overrides.row_order ?? 1,
    item_name: overrides.item_name ?? '',
    parent_item_name: overrides.parent_item_name ?? null,
    business_category: overrides.business_category ?? null,
    org_tag: overrides.org_tag ?? null,
    prior_school_year_receivable: overrides.prior_school_year_receivable ?? 0,
    current_school_year_new_receivable: overrides.current_school_year_new_receivable ?? 0,
    current_school_year_collection_amount: overrides.current_school_year_collection_amount ?? 0,
    remaining_receivable: overrides.remaining_receivable ?? 0,
    collection_rate: overrides.collection_rate ?? null,
    growth_base_label: overrides.growth_base_label ?? null,
    analysis_level_1: overrides.analysis_level_1 ?? null,
    analysis_level_2: overrides.analysis_level_2 ?? null,
    permission_people: overrides.permission_people ?? null,
    source_file_name: 'source.xlsx',
    source_sheet_name: 'sheet',
    imported_at: '2026-05-14T00:00:00Z',
    created_at: '2026-05-14T00:00:00Z',
  }
}

describe('collectionTree', () => {
  it('builds hierarchy from parent_item_name', () => {
    const tree = buildCollectionTree([
      row({ id: 'root', row_order: 1, item_name: '大后勤合计' }),
      row({ id: 'east', row_order: 2, item_name: '东部区域', parent_item_name: '大后勤合计' }),
      row({ id: 'project', row_order: 3, item_name: '亳州配送', parent_item_name: '东部区域' }),
    ])

    expect(tree).toHaveLength(1)
    expect(tree[0].row.item_name).toBe('大后勤合计')
    expect(tree[0].children[0].row.item_name).toBe('东部区域')
    expect(tree[0].children[0].children[0].row.item_name).toBe('亳州配送')
    expect(tree[0].children[0].children[0].depth).toBe(2)
  })

  it('defaults to expanding the first two levels', () => {
    const tree = buildCollectionTree([
      row({ id: 'root', row_order: 1, item_name: '大后勤合计' }),
      row({ id: 'east', row_order: 2, item_name: '东部区域', parent_item_name: '大后勤合计' }),
      row({ id: 'project', row_order: 3, item_name: '亳州配送', parent_item_name: '东部区域' }),
    ])
    const expanded = collectDefaultExpandedCollectionKeys(tree)
    const flattened = flattenCollectionTreeRows(tree, expanded)

    expect(expanded.has('root')).toBe(true)
    expect(expanded.has('east')).toBe(true)
    expect(flattened.map((item) => item.row.item_name)).toEqual(['大后勤合计', '东部区域', '亳州配送'])
  })

  it('can search hidden structure fields without making them display columns', () => {
    const tree = buildCollectionTree([
      row({ id: 'root', row_order: 1, item_name: '大后勤合计' }),
      row({
        id: 'project',
        row_order: 2,
        item_name: '鸠江配送',
        parent_item_name: '大后勤合计',
        analysis_level_2: '区域配送业务',
      }),
    ])
    const flattened = flattenCollectionTreeRows(tree, new Set(['root']), '配送业务')

    expect(flattened.map((item) => item.row.item_name)).toContain('鸠江配送')
  })
})
