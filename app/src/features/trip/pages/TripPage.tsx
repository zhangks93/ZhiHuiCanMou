import { useEffect, useMemo, useState } from 'react'
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
  EduOrgHierarchyRow,
} from '../api/tripRepository'

const PAGE_SIZE = 12

type SheetMode = 'personSummary' | 'personTravel' | 'personHospitality' | 'projectSummary'

type SheetRow =
  | FeeEffectPersonSummary
  | FeeEffectPersonTravelProject
  | FeeEffectPersonHospitalityProject
  | FeeEffectProjectSummary

type TreeLevel = 'department' | 'person' | 'detail'

interface PersonSummaryMetrics {
  signing_revenue_amount: number
  signing_profit_amount: number
  travel_total_amount: number
  hospitality_total_amount: number
  total_expense_amount: number
}

interface PersonTravelMetrics {
  travel_transportation_amount: number
  travel_lodging_amount: number
  travel_allowance_amount: number
  travel_total_amount: number
}

interface PersonHospitalityMetrics {
  guest_count: number
  hospitality_total_amount: number
  per_capita_amount: number | null
}

type TreeMetrics = PersonSummaryMetrics | PersonTravelMetrics | PersonHospitalityMetrics

interface TreeRow {
  key: string
  level: TreeLevel
  depth: number
  department: string
  departmentPath: string[]
  personName?: string
  projectName?: string
  hospitalityType?: string | null
  metrics: TreeMetrics
  personCount?: number
  detailCount?: number
  children?: TreeRow[]
}

const SHEET_TABS: Array<{ mode: SheetMode; label: string }> = [
  { mode: 'personSummary', label: '人员汇总' },
  { mode: 'personTravel', label: '人员差旅' },
  { mode: 'personHospitality', label: '人员招待' },
  { mode: 'projectSummary', label: '项目汇总' },
]

const ROOT_DEPARTMENT = '海亮智汇后勤集团'

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

function includesQuery(values: Array<string | null | undefined>, query: string) {
  if (!query) return true
  return values.some((value) => (value ?? '').toLowerCase().includes(query))
}

function getDepartment(value: string | null | undefined) {
  return value?.trim() || '未分部门'
}

function getPersonName(value: string | null | undefined) {
  return value?.trim() || '未命名'
}

function normalizeLookupKey(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, '').toLocaleLowerCase()
}

function uniquePath(parts: Array<string | null | undefined>) {
  const path: string[] = []
  parts.forEach((part) => {
    const value = part?.trim()
    if (value && path[path.length - 1] !== value) path.push(value)
  })
  return path
}

function buildOrgHierarchyLookup(rows: EduOrgHierarchyRow[]) {
  const lookup = new Map<string, string[]>()
  const setIfAbsent = (key: string, path: string[]) => {
    if (key && path.length > 0 && !lookup.has(key)) lookup.set(key, path)
  }

  rows.forEach((row) => {
    const nodePath = uniquePath([row.level_0, row.level_1, row.level_2, row.node_name])
    const level1Path = uniquePath([row.level_0, row.level_1])
    const level2Path = uniquePath([row.level_0, row.level_1, row.level_2])

    setIfAbsent(normalizeLookupKey(row.node_name), nodePath)
    setIfAbsent(normalizeLookupKey(row.level_1), level1Path)
    setIfAbsent(normalizeLookupKey(row.level_2), level2Path)
  })

  return lookup
}

function getDepartmentPath(value: string | null | undefined, orgLookup: Map<string, string[]>) {
  const department = getDepartment(value)
  if (department === '未分部门') return [ROOT_DEPARTMENT, '未分部门']

  const splitPath = department
    .split(/\s*[-－—–>/>｜|\\]+\s*/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (splitPath.length > 1) {
    return splitPath[0] === ROOT_DEPARTMENT ? splitPath : [ROOT_DEPARTMENT, ...splitPath]
  }

  const exactPath = orgLookup.get(normalizeLookupKey(department))
  if (exactPath?.length) return exactPath

  return [ROOT_DEPARTMENT, department]
}

function createPersonSummaryMetrics(): PersonSummaryMetrics {
  return {
    signing_revenue_amount: 0,
    signing_profit_amount: 0,
    travel_total_amount: 0,
    hospitality_total_amount: 0,
    total_expense_amount: 0,
  }
}

function createPersonTravelMetrics(): PersonTravelMetrics {
  return {
    travel_transportation_amount: 0,
    travel_lodging_amount: 0,
    travel_allowance_amount: 0,
    travel_total_amount: 0,
  }
}

function createPersonHospitalityMetrics(): PersonHospitalityMetrics {
  return {
    guest_count: 0,
    hospitality_total_amount: 0,
    per_capita_amount: null,
  }
}

function addPersonSummaryMetrics(target: PersonSummaryMetrics, row: FeeEffectPersonSummary) {
  target.signing_revenue_amount += row.signing_revenue_amount ?? 0
  target.signing_profit_amount += row.signing_profit_amount ?? 0
  target.travel_total_amount += row.travel_total_amount ?? 0
  target.hospitality_total_amount += row.hospitality_total_amount ?? 0
  target.total_expense_amount += row.total_expense_amount ?? 0
}

function addPersonTravelMetrics(target: PersonTravelMetrics, row: FeeEffectPersonTravelProject) {
  target.travel_transportation_amount += row.travel_transportation_amount ?? 0
  target.travel_lodging_amount += row.travel_lodging_amount ?? 0
  target.travel_allowance_amount += row.travel_allowance_amount ?? 0
  target.travel_total_amount += row.travel_total_amount ?? 0
}

function addPersonHospitalityMetrics(target: PersonHospitalityMetrics, row: FeeEffectPersonHospitalityProject) {
  target.guest_count += row.guest_count ?? 0
  target.hospitality_total_amount += row.hospitality_total_amount ?? 0
  target.per_capita_amount = target.guest_count > 0 ? target.hospitality_total_amount / target.guest_count : null
}

function addTreeMetrics(metrics: TreeMetrics, row: SheetRow, mode: SheetMode) {
  if (mode === 'personSummary') {
    addPersonSummaryMetrics(metrics as PersonSummaryMetrics, row as FeeEffectPersonSummary)
  } else if (mode === 'personTravel') {
    addPersonTravelMetrics(metrics as PersonTravelMetrics, row as FeeEffectPersonTravelProject)
  } else if (mode === 'personHospitality') {
    addPersonHospitalityMetrics(metrics as PersonHospitalityMetrics, row as FeeEffectPersonHospitalityProject)
  }
}

function createTreeMetrics(mode: SheetMode): TreeMetrics {
  if (mode === 'personTravel') return createPersonTravelMetrics()
  if (mode === 'personHospitality') return createPersonHospitalityMetrics()
  return createPersonSummaryMetrics()
}

function getTreeAmount(row: TreeRow) {
  if ('total_expense_amount' in row.metrics) return row.metrics.total_expense_amount
  if ('travel_total_amount' in row.metrics) return row.metrics.travel_total_amount
  return row.metrics.hospitality_total_amount
}

function sortTreeRows(rows: TreeRow[]): TreeRow[] {
  return rows
    .sort((a, b) => {
      if (a.level === 'department' && b.level === 'department') {
        return getTreeAmount(b) - getTreeAmount(a) || a.department.localeCompare(b.department, 'zh-CN')
      }

      const amountA = getTreeAmount(a)
      const amountB = getTreeAmount(b)
      return amountB - amountA
    })
    .map((row) => ({
      ...row,
      children: row.children ? sortTreeRows(row.children) : undefined,
    }))
}

function finalizeDepartmentMeta(row: TreeRow): TreeRow {
  if (row.level !== 'department') return row

  const people = new Set<string>()
  let detailCount = 0

  const visit = (current: TreeRow) => {
    if (current.level === 'person' && current.personName) people.add(`${current.departmentPath.join('/')}|${current.personName}`)
    if (current.level === 'detail') detailCount += 1
    current.children?.forEach(visit)
  }

  row.children?.forEach(visit)
  row.personCount = people.size
  row.detailCount = detailCount
  row.children = row.children?.map(finalizeDepartmentMeta)
  return row
}

function buildPersonTree(
  rows: Array<FeeEffectPersonSummary | FeeEffectPersonTravelProject | FeeEffectPersonHospitalityProject>,
  mode: Exclude<SheetMode, 'projectSummary'>,
  orgLookup: Map<string, string[]>
): TreeRow[] {
  const departments = new Map<string, TreeRow>()
  const people = new Map<string, TreeRow>()

  rows.forEach((row) => {
    const departmentPath = getDepartmentPath(row.department, orgLookup)
    const department = departmentPath[departmentPath.length - 1] ?? '未分部门'
    const personName = getPersonName(row.person_name)
    let parentDepartment: TreeRow | null = null

    departmentPath.forEach((part, index) => {
      const path = departmentPath.slice(0, index + 1)
      const departmentKey = `department:${path.join('/')}`
      if (!departments.has(departmentKey)) {
        const departmentRow: TreeRow = {
          key: departmentKey,
          level: 'department',
          depth: index,
          department: part,
          departmentPath: path,
          metrics: createTreeMetrics(mode),
          children: [],
        }
        departments.set(departmentKey, departmentRow)
        parentDepartment?.children?.push(departmentRow)
      }

      addTreeMetrics(departments.get(departmentKey)?.metrics as TreeMetrics, row, mode)
      parentDepartment = departments.get(departmentKey) ?? null
    })

    const leafDepartment = departments.get(`department:${departmentPath.join('/')}`)
    if (!leafDepartment) return

    const departmentKey = leafDepartment.key
    const personKey = `${departmentKey}:person:${personName}`

    if (!people.has(personKey)) {
      const personRow: TreeRow = {
        key: personKey,
        level: 'person',
        depth: departmentPath.length,
        department,
        departmentPath,
        personName,
        metrics: createTreeMetrics(mode),
        children: mode === 'personSummary' ? undefined : [],
      }
      people.set(personKey, personRow)
      leafDepartment.children?.push(personRow)
    }

    addTreeMetrics(people.get(personKey)?.metrics as TreeMetrics, row, mode)

    if (mode === 'personTravel') {
      const travelRow = row as FeeEffectPersonTravelProject
      people.get(personKey)?.children?.push({
        key: `${personKey}:detail:${travelRow.id}`,
        level: 'detail',
        depth: departmentPath.length + 1,
        department,
        departmentPath,
        personName,
        projectName: travelRow.mdm_project_name ?? '-',
        metrics: {
          travel_transportation_amount: travelRow.travel_transportation_amount ?? 0,
          travel_lodging_amount: travelRow.travel_lodging_amount ?? 0,
          travel_allowance_amount: travelRow.travel_allowance_amount ?? 0,
          travel_total_amount: travelRow.travel_total_amount ?? 0,
        },
      })
    } else if (mode === 'personHospitality') {
      const hospitalityRow = row as FeeEffectPersonHospitalityProject
      people.get(personKey)?.children?.push({
        key: `${personKey}:detail:${hospitalityRow.id}`,
        level: 'detail',
        depth: departmentPath.length + 1,
        department,
        departmentPath,
        personName,
        projectName: hospitalityRow.mdm_project_name ?? '-',
        hospitalityType: hospitalityRow.hospitality_type,
        metrics: {
          guest_count: hospitalityRow.guest_count ?? 0,
          hospitality_total_amount: hospitalityRow.hospitality_total_amount ?? 0,
          per_capita_amount: hospitalityRow.per_capita_amount ?? null,
        },
      })
    }
  })

  const rootKey = `department:${ROOT_DEPARTMENT}`
  const roots = departments.has(rootKey)
    ? [departments.get(rootKey)!]
    : Array.from(departments.values()).filter((row) => row.depth === 0)

  return sortTreeRows(roots.map(finalizeDepartmentMeta))
}

function flattenTreeRows(rows: TreeRow[], collapsedKeys: Set<string>): TreeRow[] {
  const result: TreeRow[] = []

  rows.forEach((row) => {
    result.push(row)
    if (row.children && !collapsedKeys.has(row.key)) {
      result.push(...flattenTreeRows(row.children, collapsedKeys))
    }
  })

  return result
}

function collectExpandableTreeKeys(rows: TreeRow[]) {
  const keys = new Set<string>()

  rows.forEach((row) => {
    if (row.children?.length) {
      keys.add(row.key)
      collectExpandableTreeKeys(row.children).forEach((key) => keys.add(key))
    }
  })

  return keys
}

function MobileSheetCard({ mode, row }: { mode: SheetMode; row: SheetRow }) {
  const title =
    'project_tag' in row
      ? row.project_tag ?? '-'
      : `${row.person_name ?? '-'}`
  const subtitle =
    'mdm_project_name' in row
      ? row.mdm_project_name ?? '-'
      : 'department' in row
        ? row.department ?? '未分部门'
        : ''
  const amount =
    mode === 'projectSummary' && 'total_expense_amount' in row
      ? row.total_expense_amount
      : mode === 'personHospitality' && 'hospitality_total_amount' in row
        ? row.hospitality_total_amount
        : 'travel_total_amount' in row
          ? row.travel_total_amount
          : 'total_expense_amount' in row
            ? row.total_expense_amount
            : 0
  const displayAmount = typeof amount === 'number' ? amount : 0

  return (
    <div className="rounded-[20px] border border-[rgba(148,163,184,0.12)] bg-white/92 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-[var(--color-text-strong)]">{title}</div>
          <div className="mt-1 line-clamp-2 text-caption text-[var(--color-text-muted)]">{subtitle}</div>
        </div>
        <span className="rounded-full bg-accent-50 px-2.5 py-1 text-caption font-semibold text-accent">
          {formatAmount(displayAmount)}
        </span>
      </div>
    </div>
  )
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

  const collapsedTreeKeys = useMemo(() => collectExpandableTreeKeys(treeRows), [treeRows])

  useEffect(() => {
    setExpandedTreeKeys((current) => {
      const next = new Set(current)
      let changed = false
      treeRows.forEach((row) => {
        if (!next.has(row.key)) {
          next.add(row.key)
          changed = true
        }
      })
      return changed ? next : current
    })
  }, [treeRows])

  const visibleTreeRows = useMemo(() => {
    if (normalizedQuery) return flattenTreeRows(treeRows, new Set())
    const collapsedKeys = new Set(Array.from(collapsedTreeKeys).filter((key) => !expandedTreeKeys.has(key)))
    return flattenTreeRows(treeRows, collapsedKeys)
  }, [collapsedTreeKeys, expandedTreeKeys, normalizedQuery, treeRows])

  const handleSheetModeChange = (mode: SheetMode) => {
    setActiveSheetMode(mode)
    setPage(1)
    setExpandedTreeKeys(new Set())
  }

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setPage(1)
    setExpandedTreeKeys(new Set())
  }

  const toggleTreeRow = (key: string) => {
    setExpandedTreeKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const renderTreeLabel = (row: TreeRow) => {
    const hasChildren = Boolean(row.children?.length)
    const isCollapsed = hasChildren && !expandedTreeKeys.has(row.key)
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

                <div className="space-y-2 px-3 py-3 lg:hidden">
                  {isPersonTreeMode
                    ? visibleTreeRows.map((row) => (
                      <div key={row.key} className="rounded-[20px] border border-[rgba(148,163,184,0.12)] bg-white/92 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">{renderTreeLabel(row)}</div>
                          <span className="rounded-full bg-accent-50 px-2.5 py-1 text-caption font-semibold text-accent">
                            {'total_expense_amount' in row.metrics
                              ? formatAmount(row.metrics.total_expense_amount)
                              : 'travel_total_amount' in row.metrics
                                ? formatAmount(row.metrics.travel_total_amount)
                                : formatAmount(row.metrics.hospitality_total_amount)}
                          </span>
                        </div>
                      </div>
                    ))
                    : pagedRows.map((row, index) => (
                      <MobileSheetCard key={`${sheetMode}-${index}`} mode={sheetMode} row={row} />
                    ))}
                </div>

                <div className="app-table-scroll hidden lg:block">
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
        <DataEmptyState title="暂无费效数据" description="请先运行费效分析导入脚本，再回到差旅页查看费用与ROI。" />
      )}
    </div>
  )
}
