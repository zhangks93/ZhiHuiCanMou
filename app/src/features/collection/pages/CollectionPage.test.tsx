/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CollectionPage } from './CollectionPage'

vi.mock('../hooks/useCollectionData', () => ({
  useCollectionData: () => ({
    loading: false,
    refreshing: false,
    periodLoading: false,
    error: null,
    availablePeriods: ['2025累计回款率统计——4月'],
    selectedPeriod: '2025累计回款率统计——4月',
    setSelectedPeriod: vi.fn(),
    query: '',
    setQuery: vi.fn(),
    visibleRows: [],
    overallStats: {
      root: {
        current_school_year_collection_amount: 100,
        remaining_receivable: 10,
        collection_rate: 0.95,
      },
      projectCount: 2,
      rowCount: 3,
    },
    expandableKeys: new Set<string>(),
    expandedKeys: new Set<string>(),
    toggleRow: vi.fn(),
  }),
}))

describe('CollectionPage', () => {
  it('renders primary collection table headers', () => {
    render(<CollectionPage />)

    expect(screen.getByText('项目 / 单位')).toBeTruthy()
    expect(screen.getByText('本学年回款金额')).toBeTruthy()
    expect(screen.queryByText('业务板块一级')).toBeNull()
    expect(screen.queryByText('人员权限')).toBeNull()
  })
})
