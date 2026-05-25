import type { AttendanceMonthlyRecord } from '../api/attendanceRepository'
import { departmentRootKey, ROOT_ORG_NAME } from '@/shared/lib/orgConstants'

export { departmentRootKey }

export type AttendanceType = 'standard_day' | 'comprehensive_hour'
export type AttendanceTreeLevel = 'root' | 'department' | 'member'

export interface AttendanceTreeMetrics {
  employeeCount: number
  dayEmployeeCount: number
  hourEmployeeCount: number
  qualifiedEmployeeCount: number
  expectedWorkAmount: number
  actualWorkAmount: number
  qualifiedAttendanceAmount: number
  paidLeaveAmount: number
  unpaidLeaveAmount: number
  averageAttendanceRate: number
  lateRate: number
  lateUnder30Count: number
  lateUnder30Rate: number
  lateOver30Count: number
  lateOver30Rate: number
  lateTotalCount: number
  missingClockCount: number
  makeupClockCount: number
}

export interface AttendanceTreeRow {
  key: string
  level: AttendanceTreeLevel
  depth: number
  name: string
  departmentPath: string[]
  metrics: AttendanceTreeMetrics
  member?: AttendanceMonthlyRecord
  children?: AttendanceTreeRow[]
}

export interface OverallAttendanceStats extends AttendanceTreeMetrics {
  departmentCount: number
}

export function createEmptyAttendanceMetrics(): AttendanceTreeMetrics {
  return {
    employeeCount: 0,
    dayEmployeeCount: 0,
    hourEmployeeCount: 0,
    qualifiedEmployeeCount: 0,
    expectedWorkAmount: 0,
    actualWorkAmount: 0,
    qualifiedAttendanceAmount: 0,
    paidLeaveAmount: 0,
    unpaidLeaveAmount: 0,
    averageAttendanceRate: 0,
    lateRate: 0,
    lateUnder30Count: 0,
    lateUnder30Rate: 0,
    lateOver30Count: 0,
    lateOver30Rate: 0,
    lateTotalCount: 0,
    missingClockCount: 0,
    makeupClockCount: 0,
  }
}

function addRecordToMetrics(metrics: AttendanceTreeMetrics, record: AttendanceMonthlyRecord) {
  metrics.employeeCount += 1
  if (record.attendance_type === 'standard_day') metrics.dayEmployeeCount += 1
  if (record.attendance_type === 'comprehensive_hour') metrics.hourEmployeeCount += 1
  if ((record.attendance_rate ?? 0) >= 1) metrics.qualifiedEmployeeCount += 1
  metrics.expectedWorkAmount += record.expected_work_amount ?? 0
  metrics.actualWorkAmount += record.actual_work_amount ?? 0
  metrics.qualifiedAttendanceAmount += record.qualified_attendance_amount ?? 0
  metrics.paidLeaveAmount += record.paid_leave_amount ?? record.approved_leave_amount ?? 0
  metrics.unpaidLeaveAmount += record.unpaid_leave_amount ?? 0
  metrics.lateUnder30Count += record.late_under_30_count ?? 0
  metrics.lateOver30Count += record.late_30_to_120_count ?? 0
  metrics.lateTotalCount += record.late_total_count ?? 0
  metrics.missingClockCount += record.missing_clock_count ?? 0
  metrics.makeupClockCount += record.makeup_clock_count ?? 0
}

function getLateRateDenominator(actualWorkAmount: number) {
  return Math.ceil(Math.max(0, actualWorkAmount)) * 2
}

function finalizeMetrics(metrics: AttendanceTreeMetrics) {
  metrics.averageAttendanceRate = metrics.expectedWorkAmount > 0
    ? metrics.qualifiedAttendanceAmount / metrics.expectedWorkAmount
    : 0
  const lateRateDenominator = getLateRateDenominator(metrics.actualWorkAmount)
  metrics.lateRate = lateRateDenominator > 0
    ? metrics.lateTotalCount / lateRateDenominator
    : 0
  metrics.lateUnder30Rate = lateRateDenominator > 0
    ? metrics.lateUnder30Count / lateRateDenominator
    : 0
  metrics.lateOver30Rate = lateRateDenominator > 0
    ? metrics.lateOver30Count / lateRateDenominator
    : 0
}

export function normalizeDepartmentPath(path: string[] | null): string[] {
  const cleaned = (path ?? []).map((item) => item.trim()).filter(Boolean)
  if (cleaned.length === 0) return [ROOT_ORG_NAME, '未分部门']
  if (cleaned[0] === ROOT_ORG_NAME) return cleaned
  return [ROOT_ORG_NAME, ...cleaned]
}

function compareRows(a: AttendanceTreeRow, b: AttendanceTreeRow) {
  if (a.level !== b.level) {
    const order: Record<AttendanceTreeLevel, number> = { root: 0, department: 1, member: 2 }
    return order[a.level] - order[b.level]
  }

  if (a.level === 'department' && b.level === 'department') {
    return b.metrics.employeeCount - a.metrics.employeeCount || a.name.localeCompare(b.name, 'zh-CN')
  }

  if (a.level === 'member' && b.level === 'member') {
    return b.metrics.lateTotalCount - a.metrics.lateTotalCount || a.name.localeCompare(b.name, 'zh-CN')
  }

  return a.name.localeCompare(b.name, 'zh-CN')
}

export function buildAttendanceTree(records: AttendanceMonthlyRecord[]): AttendanceTreeRow[] {
  const root: AttendanceTreeRow = {
    key: departmentRootKey(),
    level: 'root',
    depth: 0,
    name: ROOT_ORG_NAME,
    departmentPath: [ROOT_ORG_NAME],
    metrics: createEmptyAttendanceMetrics(),
    children: [],
  }

  const nodeMap = new Map<string, AttendanceTreeRow>([[root.key, root]])

  records.forEach((record) => {
    const path = normalizeDepartmentPath(record.department_path)
    addRecordToMetrics(root.metrics, record)

    let parent = root
    path.slice(1).forEach((part, index) => {
      const departmentPath = path.slice(0, index + 2)
      const key = `department:${departmentPath.join('/')}`
      let node = nodeMap.get(key)
      if (!node) {
        node = {
          key,
          level: 'department',
          depth: departmentPath.length - 1,
          name: part,
          departmentPath,
          metrics: createEmptyAttendanceMetrics(),
          children: [],
        }
        nodeMap.set(key, node)
        parent.children?.push(node)
      }

      addRecordToMetrics(node.metrics, record)
      parent = node
    })

    const actualWorkAmount = record.actual_work_amount ?? 0
    const lateRateDenominator = getLateRateDenominator(actualWorkAmount)

    parent.children?.push({
      key: `member:${record.id}`,
      level: 'member',
      depth: path.length,
      name: record.employee_name,
      departmentPath: path,
      metrics: {
        ...createEmptyAttendanceMetrics(),
        employeeCount: 1,
        dayEmployeeCount: record.attendance_type === 'standard_day' ? 1 : 0,
        hourEmployeeCount: record.attendance_type === 'comprehensive_hour' ? 1 : 0,
        qualifiedEmployeeCount: (record.attendance_rate ?? 0) >= 1 ? 1 : 0,
        expectedWorkAmount: record.expected_work_amount ?? 0,
        actualWorkAmount,
        qualifiedAttendanceAmount: record.qualified_attendance_amount ?? 0,
        paidLeaveAmount: record.paid_leave_amount ?? record.approved_leave_amount ?? 0,
        unpaidLeaveAmount: record.unpaid_leave_amount ?? 0,
        averageAttendanceRate: record.attendance_rate ?? 0,
        lateRate: lateRateDenominator > 0 ? (record.late_total_count ?? 0) / lateRateDenominator : 0,
        lateUnder30Count: record.late_under_30_count ?? 0,
        lateUnder30Rate: lateRateDenominator > 0 ? (record.late_under_30_count ?? 0) / lateRateDenominator : 0,
        lateOver30Count: record.late_30_to_120_count ?? 0,
        lateOver30Rate: lateRateDenominator > 0 ? (record.late_30_to_120_count ?? 0) / lateRateDenominator : 0,
        lateTotalCount: record.late_total_count ?? 0,
        missingClockCount: record.missing_clock_count ?? 0,
        makeupClockCount: record.makeup_clock_count ?? 0,
      },
      member: record,
    })
  })

  nodeMap.forEach((node) => {
    finalizeMetrics(node.metrics)
  })

  const sortChildren = (row: AttendanceTreeRow) => {
    row.children = row.children?.sort(compareRows).map((child) => {
      sortChildren(child)
      return child
    })
  }
  sortChildren(root)

  return records.length > 0 ? [root] : []
}

export function filterAttendanceTree(rows: AttendanceTreeRow[], query: string): AttendanceTreeRow[] {
  if (!query) return rows

  const normalizedQuery = query.toLowerCase()

  const filterRow = (row: AttendanceTreeRow): AttendanceTreeRow | null => {
    const children = row.children?.map(filterRow).filter((child): child is AttendanceTreeRow => Boolean(child)) ?? []
    const selfMatches = [
      row.name,
      row.member?.employee_no,
      row.member?.attendance_type === 'standard_day' ? '按天' : row.member?.attendance_type === 'comprehensive_hour' ? '按小时' : null,
      ...row.departmentPath,
    ].some((value) => (value ?? '').toLowerCase().includes(normalizedQuery))

    if (selfMatches || children.length > 0) {
      return { ...row, children }
    }

    return null
  }

  return rows.map(filterRow).filter((row): row is AttendanceTreeRow => Boolean(row))
}

export function collectExpandableAttendanceKeys(rows: AttendanceTreeRow[]) {
  const keys = new Set<string>()
  rows.forEach((row) => {
    if (row.children?.length) {
      keys.add(row.key)
      collectExpandableAttendanceKeys(row.children).forEach((key) => keys.add(key))
    }
  })
  return keys
}

export function flattenAttendanceTreeRows(rows: AttendanceTreeRow[], expandedKeys: Set<string>): AttendanceTreeRow[] {
  const result: AttendanceTreeRow[] = []
  rows.forEach((row) => {
    result.push(row)
    if (row.children?.length && expandedKeys.has(row.key)) {
      result.push(...flattenAttendanceTreeRows(row.children, expandedKeys))
    }
  })
  return result
}
