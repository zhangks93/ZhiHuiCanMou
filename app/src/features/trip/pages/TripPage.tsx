import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { AppLoading } from '@/shared/ui/AppLoading'
import { AppPagination } from '@/shared/ui/AppPagination'
import { DataEmptyState, DataErrorState, DataLoadingState } from '@/shared/components/data-state'
import { useTripData } from '../hooks/useTripData'
import type {
  FeeEffectPersonHospitalityProject,
  FeeEffectPersonSummary,
  FeeEffectPersonTravelProject,
  FeeEffectProjectSummary,
} from '../api/tripRepository'
import {
  buildOrgHierarchyLookup,
  buildPersonTree,
  collectDefaultExpandedTreeKeys,
  collectExpandableTreeKeys,
  flattenTreeRows,
  getDepartmentPath,
  includesQuery,
  type PersonHospitalityMetrics,
  type PersonSummaryMetrics,
  type PersonTravelMetrics,
  type SheetMode,
  type TreeRow,
} from '../services/tripTree'
const PAGE_SIZE = 12

type SheetRow =
  | FeeEffectPersonSummary
  | FeeEffectPersonTravelProject
  | FeeEffectPersonHospitalityProject
  | FeeEffectProjectSummary

const SHEET_TABS: Array<{ mode: SheetMode; label: string }> = [
  { mode: 'personSummary', label: '人员汇总' },
  { mode: 'personTravel', label: '人员差旅' },
  { mode: 'personHospitality', label: '人员招待' },
  { mode: 'projectSummary', label: '项目汇总' },
]

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatAmount(value: number | null | undefined) {
  const amount = value ?? 0
  if (Math.abs(amount) >= 10000) {
    return `${(amount / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })} 亿`
  }
  return `${amount.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 万`
}

function formatRatio(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}x`
}

function formatInteger(value: number | null | undefined) {
  return (value ?? 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

export function TripPage() {
  const {
    loading,
    error,
    activeSheetLoading,
    activeSheetLoaded,
    activeSheetMode,
    setActiveSheetMode,
    orgHierarchyRows,
    feeEffectBatches,
    personSummaries,
    projectSummaries,
    personTravelProjects,
    personHospitalityProjects,
  } = useTripData()
  const sheetMode = activeSheetMode as SheetMode
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [expandedTreeKeys, setExpandedTreeKeys] = useState<Set<string>>(() => new Set())
  const [collapsedTreeKeys, setCollapsedTreeKeys] = useState<Set<string>>(() => new Set())

  const normalizedQuery = query.trim().toLowerCase()
  const orgHierarchyLookup = useMemo(() => buildOrgHierarchyLookup(orgHierarchyRows), [orgHierarchyRows])

  const activeRows = useMemo<SheetRow[]>(() => {
    if (sheetMode === 'personTravel') return personTravelProjects
    if (sheetMode === 'personHospitality') return personHospitalityProjects
    if (sheetMode === 'projectSummary') return projectSummaries
    return personSummaries
  }, [personHospitalityProjects, personSummaries, personTravelProjects, projectSummaries, sheetMode])

  const filteredRows = useMemo(() => {
    return activeRows.filter((row) => {
      if ('project_tag' in row) return includesQuery([row.project_tag, row.region], normalizedQuery)
      const departmentPath = getDepartmentPath('department' in row ? row.department : null, orgHierarchyLookup)
      if ('mdm_project_name' in row) return includesQuery([row.person_name, row.department, row.mdm_project_name, ...departmentPath], normalizedQuery)
      return includesQuery([row.person_name, row.department, ...departmentPath], normalizedQuery)
    })
  }, [activeRows, normalizedQuery, orgHierarchyLookup])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const isPersonTreeMode = sheetMode !== 'projectSummary'

  const treeRows = useMemo(() => {
    if (sheetMode === 'personTravel') {
      return buildPersonTree(filteredRows as FeeEffectPersonTravelProject[], 'personTravel', orgHierarchyLookup)
    }
    if (sheetMode === 'personHospitality') {
      return buildPersonTree(filteredRows as FeeEffectPersonHospitalityProject[], 'personHospitality', orgHierarchyLookup)
    }
    if (sheetMode === 'personSummary') {
      return buildPersonTree(filteredRows as FeeEffectPersonSummary[], 'personSummary', orgHierarchyLookup)
    }
    return []
  }, [filteredRows, orgHierarchyLookup, sheetMode])

  const expandableTreeKeys = useMemo(() => collectExpandableTreeKeys(treeRows), [treeRows])
  const defaultExpandedTreeKeys = useMemo(() => collectDefaultExpandedTreeKeys(treeRows), [treeRows])
  const effectiveExpandedTreeKeys = useMemo(() => {
    const next = new Set(defaultExpandedTreeKeys)
    expandedTreeKeys.forEach((key) => next.add(key))
    collapsedTreeKeys.forEach((key) => next.delete(key))
    return next
  }, [collapsedTreeKeys, defaultExpandedTreeKeys, expandedTreeKeys])

  const visibleTreeRows = useMemo(() => {
    if (normalizedQuery) return flattenTreeRows(treeRows, new Set())
    const collapsedKeys = new Set(Array.from(expandableTreeKeys).filter((key) => !effectiveExpandedTreeKeys.has(key)))
    return flattenTreeRows(treeRows, collapsedKeys)
  }, [effectiveExpandedTreeKeys, expandableTreeKeys, normalizedQuery, treeRows])

  const handleSheetModeChange = (mode: SheetMode) => {
    setActiveSheetMode(mode)
    setPage(1)
    setExpandedTreeKeys(new Set())
    setCollapsedTreeKeys(new Set())
  }

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setPage(1)
    setExpandedTreeKeys(new Set())
    setCollapsedTreeKeys(new Set())
  }

  const toggleTreeRow = (key: string) => {
    if (effectiveExpandedTreeKeys.has(key)) {
      setExpandedTreeKeys((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
      setCollapsedTreeKeys((current) => {
        const next = new Set(current)
        next.add(key)
        return next
      })
    } else {
      setExpandedTreeKeys((current) => {
        const next = new Set(current)
        next.add(key)
        return next
      })
      setCollapsedTreeKeys((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  const renderTreeLabel = (row: TreeRow) => {
    const hasChildren = Boolean(row.children?.length)
    const isCollapsed = hasChildren && !effectiveExpandedTreeKeys.has(row.key)
    const indent = row.depth * 20
    const label = row.level === 'department'
      ? row.department
      : row.level === 'person'
        ? row.personName
        : row.projectName
    const meta = row.level === 'department'
      ? `${row.personCount ?? 0} 人`
      : row.level === 'person' && row.children?.length
        ? `${row.children.length} 项`
        : row.hospitalityType ?? ''

    return (
      <div className="biz-data-table__business-cell-content" style={{ paddingLeft: `${indent}px` }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggleTreeRow(row.key)}
            className="rounded-md p-0.5 transition-colors hover:bg-[rgba(34,197,94,0.08)]"
          >
            {isCollapsed ? (
              <ChevronRight size={14} className="text-[var(--color-text-muted)]" />
            ) : (
              <ChevronDown size={14} className="text-[var(--color-text-muted)]" />
            )}
          </button>
        ) : (
          <span className="w-[18px]" />
        )}
        <span className={`truncate ${row.level === 'detail' ? 'font-normal text-[var(--color-text)]' : 'font-medium text-[var(--color-text-strong)]'}`}>
          {label}
        </span>
        {meta ? <span className="shrink-0 text-caption text-[var(--color-text-muted)]">{meta}</span> : null}
      </div>
    )
  }

  const renderPersonSummaryTreeTable = () => (
    <table className="app-data-table app-data-table-compact biz-data-table__table">
      <thead>
        <tr>
          <th className="text-left">部门 / 人员</th>
          <th className="text-right">签单营收</th>
          <th className="text-right">签单利润</th>
          <th className="text-right">差旅合计</th>
          <th className="text-right">招待合计</th>
          <th className="text-right">差旅招待总计</th>
        </tr>
      </thead>
      <tbody>
        {visibleTreeRows.map((row) => {
          const metrics = row.metrics as PersonSummaryMetrics
          return (
            <tr key={row.key} className={row.level === 'department' ? 'app-data-row-emphasis' : undefined}>
              <td className="biz-data-table__business-cell">{renderTreeLabel(row)}</td>
              <td className="app-cell-muted app-cell-numeric text-right">{formatAmount(metrics.signing_revenue_amount)}</td>
              <td className="app-cell-muted app-cell-numeric text-right">{formatAmount(metrics.signing_profit_amount)}</td>
              <td className="app-cell-muted app-cell-numeric text-right">{formatAmount(metrics.travel_total_amount)}</td>
              <td className="app-cell-muted app-cell-numeric text-right">{formatAmount(metrics.hospitality_total_amount)}</td>
              <td className="app-cell-strong app-cell-numeric text-right">{formatAmount(metrics.total_expense_amount)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )

  const renderPersonTravelTreeTable = () => (
    <table className="app-data-table app-data-table-compact biz-data-table__table">
      <thead>
        <tr>
          <th className="text-left">部门 / 人员 / MDM项目名称</th>
          <th className="text-right">交通</th>
          <th className="text-right">住宿</th>
          <th className="text-right">差补</th>
          <th className="text-right">差旅合计</th>
        </tr>
      </thead>
      <tbody>
        {visibleTreeRows.map((row) => {
          const metrics = row.metrics as PersonTravelMetrics
          return (
            <tr key={row.key} className={row.level === 'department' ? 'app-data-row-emphasis' : undefined}>
              <td className="biz-data-table__business-cell">{renderTreeLabel(row)}</td>
              <td className="app-cell-muted app-cell-numeric text-right">{formatAmount(metrics.travel_transportation_amount)}</td>
              <td className="app-cell-muted app-cell-numeric text-right">{formatAmount(metrics.travel_lodging_amount)}</td>
              <td className="app-cell-muted app-cell-numeric text-right">{formatAmount(metrics.travel_allowance_amount)}</td>
              <td className="app-cell-strong app-cell-numeric text-right">{formatAmount(metrics.travel_total_amount)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )

  const renderPersonHospitalityTreeTable = () => (
    <table className="app-data-table app-data-table-compact biz-data-table__table">
      <thead>
        <tr>
          <th className="text-left">部门 / 人员 / MDM项目名称</th>
          <th className="text-left">招待性质</th>
          <th className="text-right">接待人数</th>
          <th className="text-right">招待费金额</th>
          <th className="text-right">人均标准</th>
        </tr>
      </thead>
      <tbody>
        {visibleTreeRows.map((row) => {
          const metrics = row.metrics as PersonHospitalityMetrics
          return (
            <tr key={row.key} className={row.level === 'department' ? 'app-data-row-emphasis' : undefined}>
              <td className="biz-data-table__business-cell">{renderTreeLabel(row)}</td>
              <td className="app-cell-muted">{row.level === 'detail' ? row.hospitalityType ?? '-' : '-'}</td>
              <td className="app-cell-muted app-cell-numeric text-right">{formatInteger(metrics.guest_count)}</td>
              <td className="app-cell-strong app-cell-numeric text-right">{formatAmount(metrics.hospitality_total_amount)}</td>
              <td className="app-cell-muted app-cell-numeric text-right">{metrics.per_capita_amount == null ? '-' : formatAmount(metrics.per_capita_amount)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )

  if (loading) {
    return <AppLoading label="加载费效分析数据..." variant="block" />
  }

  return (
    <div className="app-page">
      {error ? <DataErrorState message={error} /> : null}

      {feeEffectBatches.length > 0 ? (
        <>
          <section className="app-table-shell">
            <div className="app-table-toolbar">
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-full bg-[rgba(15,23,42,0.06)] p-1">
                  {SHEET_TABS.map((tab) => (
                    <button
                      key={tab.mode}
                      type="button"
                      className={`rounded-full px-3 py-1.5 text-caption font-medium transition ${sheetMode === tab.mode ? 'bg-white text-[var(--color-text-strong)] shadow-sm' : 'text-[var(--color-text-muted)]'}`}
                      onClick={() => handleSheetModeChange(tab.mode)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <label className="relative w-full lg:w-[280px]">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    type="text"
                    placeholder="搜索人员、部门、项目..."
                    value={query}
                    onChange={(event) => handleQueryChange(event.target.value)}
                    className="app-filter-control app-filter-search-input h-9"
                  />
                </label>
              </div>
            </div>

            {!activeSheetLoaded && !error ? (
              <DataLoadingState label="加载当前 sheet 数据..." />
            ) : (
              <>
                {activeSheetLoading ? (
                  <div className="px-3 pt-3 text-caption text-[var(--color-text-muted)]">正在刷新当前 sheet...</div>
                ) : null}

                <div className="app-table-scroll">
                  {sheetMode === 'projectSummary' ? (
                    <table className="app-data-table">
                      <thead>
                        <tr>
                          <th className="text-left">项目标签</th>
                          <th className="text-left">区域</th>
                          <th className="text-right">立项时间</th>
                          <th className="text-right">首年合同额</th>
                          <th className="text-right">首年利润</th>
                          <th className="text-right">差旅合计</th>
                          <th className="text-right">招待费</th>
                          <th className="text-right">市场奖金</th>
                          <th className="text-right">费用合计</th>
                          <th className="text-right">ROI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pagedRows as FeeEffectProjectSummary[]).map((row) => (
                          <tr key={row.id}>
                            <td className="app-cell-strong">{row.project_tag}</td>
                            <td className="app-cell-muted">{row.region ?? '-'}</td>
                            <td className="app-cell-muted app-cell-numeric text-right">{formatDate(row.launch_date)}</td>
                            <td className="app-cell-muted app-cell-numeric text-right">{formatAmount(row.first_year_contract_amount)}</td>
                            <td className="app-cell-muted app-cell-numeric text-right">{formatAmount(row.first_year_profit_amount)}</td>
                            <td className="app-cell-muted app-cell-numeric text-right">{formatAmount(row.travel_total_amount)}</td>
                            <td className="app-cell-muted app-cell-numeric text-right">{formatAmount(row.hospitality_total_amount)}</td>
                            <td className="app-cell-muted app-cell-numeric text-right">{formatAmount(row.paid_market_bonus_amount)}</td>
                            <td className="app-cell-strong app-cell-numeric text-right">{formatAmount(row.total_expense_amount)}</td>
                            <td className="app-cell-strong app-cell-numeric text-right">{formatRatio(row.first_year_roi)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : sheetMode === 'personHospitality' ? (
                    renderPersonHospitalityTreeTable()
                  ) : sheetMode === 'personTravel' ? (
                    renderPersonTravelTreeTable()
                  ) : (
                    renderPersonSummaryTreeTable()
                  )}
                </div>

                {filteredRows.length === 0 ? (
                  <DataEmptyState title="暂无匹配数据" description={query ? '请调整搜索条件。' : '当前 sheet 暂无数据。'} />
                ) : (
                  isPersonTreeMode ? null : (
                    <AppPagination page={safePage} total={filteredRows.length} pageSize={PAGE_SIZE} onChange={setPage} />
                  )
                )}
              </>
            )}
          </section>
        </>
      ) : (
        <DataEmptyState title="\u6682\u65e0\u8d39\u6548\u6570\u636e" description="\u8bf7\u5148\u8fd0\u884c\u8d39\u6548\u5206\u6790\u5bfc\u5165\u811a\u672c\uff0c\u518d\u56de\u5230\u5dee\u65c5\u9875\u67e5\u770b\u8d39\u7528\u4e0eROI\u3002" />
      )}
    </div>
  )
}
