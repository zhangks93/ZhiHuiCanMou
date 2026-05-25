import { ROOT_ORG_NAME } from '@/shared/lib/orgConstants'
import type {
  FeeEffectPersonHospitalityProject,
  FeeEffectPersonSummary,
  FeeEffectPersonTravelProject,
  EduOrgHierarchyRow,
} from '../api/tripRepository'

export type SheetMode = 'personSummary' | 'personTravel' | 'personHospitality' | 'projectSummary'

type SheetRow =
  | FeeEffectPersonSummary
  | FeeEffectPersonTravelProject
  | FeeEffectPersonHospitalityProject

export type TreeLevel = 'department' | 'person' | 'detail'

export interface PersonSummaryMetrics {
  signing_revenue_amount: number
  signing_profit_amount: number
  travel_total_amount: number
  hospitality_total_amount: number
  total_expense_amount: number
}

export interface PersonTravelMetrics {
  travel_transportation_amount: number
  travel_lodging_amount: number
  travel_allowance_amount: number
  travel_total_amount: number
}

export interface PersonHospitalityMetrics {
  guest_count: number
  hospitality_total_amount: number
  per_capita_amount: number | null
}

type TreeMetrics = PersonSummaryMetrics | PersonTravelMetrics | PersonHospitalityMetrics

export interface TreeRow {
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

export function includesQuery(values: Array<string | null | undefined>, query: string) {
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

export function buildOrgHierarchyLookup(rows: EduOrgHierarchyRow[]) {
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

export function getDepartmentPath(value: string | null | undefined, orgLookup: Map<string, string[]>) {
  const department = getDepartment(value)
  if (department === '未分部门') return [ROOT_ORG_NAME, '未分部门']

  const splitPath = department
    .split(/\s*[-－—–>/>｜|\\]+\s*/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (splitPath.length > 1) {
    return splitPath[0] === ROOT_ORG_NAME ? splitPath : [ROOT_ORG_NAME, ...splitPath]
  }

  const exactPath = orgLookup.get(normalizeLookupKey(department))
  if (exactPath?.length) return exactPath

  return [ROOT_ORG_NAME, department]
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

export function buildPersonTree(
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

  const rootKey = `department:${ROOT_ORG_NAME}`
  const roots = departments.has(rootKey)
    ? [departments.get(rootKey)!]
    : Array.from(departments.values()).filter((row) => row.depth === 0)

  return sortTreeRows(roots.map(finalizeDepartmentMeta))
}

export function flattenTreeRows(rows: TreeRow[], collapsedKeys: Set<string>): TreeRow[] {
  const result: TreeRow[] = []

  rows.forEach((row) => {
    result.push(row)
    if (row.children && !collapsedKeys.has(row.key)) {
      result.push(...flattenTreeRows(row.children, collapsedKeys))
    }
  })

  return result
}

export function collectExpandableTreeKeys(rows: TreeRow[]) {
  const keys = new Set<string>()

  rows.forEach((row) => {
    if (row.children?.length) {
      keys.add(row.key)
      collectExpandableTreeKeys(row.children).forEach((key) => keys.add(key))
    }
  })

  return keys
}

export function collectDefaultExpandedTreeKeys(rows: TreeRow[]) {
  const keys = new Set<string>()

  rows.forEach((row) => {
    if (row.children?.length && row.depth < 1) {
      keys.add(row.key)
    }
    collectDefaultExpandedTreeKeys(row.children ?? []).forEach((key) => keys.add(key))
  })

  return keys
}
