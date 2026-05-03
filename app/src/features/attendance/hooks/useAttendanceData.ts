import { useEffect, useMemo, useState } from 'react'
import {
  fetchAvailableAttendanceMonths,
  fetchAttendanceMonthlyRecords,
  type AttendanceMonthlyRecord,
} from '../api/attendanceRepository'

export type AttendanceType = 'standard_day' | 'comprehensive_hour'
export type AttendanceTreeLevel = 'root' | 'department' | 'member'

export interface AttendanceTreeMetrics {
  employeeCount: number
  dayEmployeeCount: number
  hourEmployeeCount: number
  qualifiedEmployeeCount: number
  averageAttendanceRate: number
  lateEmployeeCount: number
  lateUnder30Count: number
  late30To120Count: number
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

const ROOT_NAME = '海亮智汇后勤集团'

function createEmptyMetrics(): AttendanceTreeMetrics {
  return {
    employeeCount: 0,
    dayEmployeeCount: 0,
    hourEmployeeCount: 0,
    qualifiedEmployeeCount: 0,
    averageAttendanceRate: 0,
    lateEmployeeCount: 0,
    lateUnder30Count: 0,
    late30To120Count: 0,
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
  if ((record.late_total_count ?? 0) > 0) metrics.lateEmployeeCount += 1
  metrics.lateUnder30Count += record.late_under_30_count ?? 0
  metrics.late30To120Count += record.late_30_to_120_count ?? 0
  metrics.lateTotalCount += record.late_total_count ?? 0
  metrics.missingClockCount += record.missing_clock_count ?? 0
  metrics.makeupClockCount += record.makeup_clock_count ?? 0
}

function finalizeMetrics(metrics: AttendanceTreeMetrics, records: AttendanceMonthlyRecord[]) {
  metrics.averageAttendanceRate = records.length > 0
    ? records.reduce((sum, record) => sum + (record.attendance_rate ?? 0), 0) / records.length
    : 0
}

function normalizePath(path: string[] | null): string[] {
  const cleaned = (path ?? []).map((item) => item.trim()).filter(Boolean)
  if (cleaned.length === 0) return [ROOT_NAME, '未分部门']
  if (cleaned[0] === ROOT_NAME) return cleaned
  return [ROOT_NAME, ...cleaned]
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

function buildTree(records: AttendanceMonthlyRecord[]): AttendanceTreeRow[] {
  const rootRecords: AttendanceMonthlyRecord[] = []
  const root: AttendanceTreeRow = {
    key: `department:${ROOT_NAME}`,
    level: 'root',
    depth: 0,
    name: ROOT_NAME,
    departmentPath: [ROOT_NAME],
    metrics: createEmptyMetrics(),
    children: [],
  }

  const nodeMap = new Map<string, AttendanceTreeRow>([[root.key, root]])

  records.forEach((record) => {
    const path = normalizePath(record.department_path)
    rootRecords.push(record)
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
          metrics: createEmptyMetrics(),
          children: [],
        }
        nodeMap.set(key, node)
        parent.children?.push(node)
      }

      addRecordToMetrics(node.metrics, record)
      parent = node
    })

    parent.children?.push({
      key: `member:${record.id}`,
      level: 'member',
      depth: path.length,
      name: record.employee_name,
      departmentPath: path,
      metrics: {
        ...createEmptyMetrics(),
        employeeCount: 1,
        dayEmployeeCount: record.attendance_type === 'standard_day' ? 1 : 0,
        hourEmployeeCount: record.attendance_type === 'comprehensive_hour' ? 1 : 0,
        qualifiedEmployeeCount: (record.attendance_rate ?? 0) >= 1 ? 1 : 0,
        averageAttendanceRate: record.attendance_rate ?? 0,
        lateEmployeeCount: (record.late_total_count ?? 0) > 0 ? 1 : 0,
        lateUnder30Count: record.late_under_30_count ?? 0,
        late30To120Count: record.late_30_to_120_count ?? 0,
        lateTotalCount: record.late_total_count ?? 0,
        missingClockCount: record.missing_clock_count ?? 0,
        makeupClockCount: record.makeup_clock_count ?? 0,
      },
      member: record,
    })
  })

  nodeMap.forEach((node) => {
    const nodeRecords = records.filter((record) => {
      const path = normalizePath(record.department_path)
      return node.departmentPath.every((part, index) => path[index] === part)
    })
    finalizeMetrics(node.metrics, nodeRecords)
  })
  finalizeMetrics(root.metrics, rootRecords)

  const sortChildren = (row: AttendanceTreeRow) => {
    row.children = row.children?.sort(compareRows).map((child) => {
      sortChildren(child)
      return child
    })
  }
  sortChildren(root)

  return records.length > 0 ? [root] : []
}

function filterTree(rows: AttendanceTreeRow[], query: string): AttendanceTreeRow[] {
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

function collectExpandableKeys(rows: AttendanceTreeRow[]) {
  const keys = new Set<string>()
  rows.forEach((row) => {
    if (row.children?.length) {
      keys.add(row.key)
      collectExpandableKeys(row.children).forEach((key) => keys.add(key))
    }
  })
  return keys
}

function flattenRows(rows: AttendanceTreeRow[], expandedKeys: Set<string>): AttendanceTreeRow[] {
  const result: AttendanceTreeRow[] = []
  rows.forEach((row) => {
    result.push(row)
    if (row.children?.length && expandedKeys.has(row.key)) {
      result.push(...flattenRows(row.children, expandedKeys))
    }
  })
  return result
}

export function useAttendanceData() {
  const [records, setRecords] = useState<AttendanceMonthlyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [availableMonths, setAvailableMonths] = useState<number[]>([])
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set())
  const [query, setQuery] = useState('')

  useEffect(() => {
    async function loadMonths() {
      try {
        const months = await fetchAvailableAttendanceMonths()
        setAvailableMonths(months)
        if (months.length > 0) setSelectedMonth(months[0])
      } catch (loadError) {
        console.error('获取考勤月份失败:', loadError)
        setError('获取考勤月份失败')
        setLoading(false)
      }
    }

    void loadMonths()
  }, [])

  useEffect(() => {
    if (!selectedMonth) return
    const month = selectedMonth

    async function loadRecords() {
      setLoading(true)
      setError(null)
      try {
        const nextRecords = await fetchAttendanceMonthlyRecords(month)
        setRecords(nextRecords)
        setExpandedKeys(new Set([`department:${ROOT_NAME}`]))
      } catch (loadError) {
        console.error('获取考勤数据失败:', loadError)
        setError('获取考勤数据失败')
      } finally {
        setLoading(false)
      }
    }

    void loadRecords()
  }, [selectedMonth])

  const treeRows = useMemo(() => buildTree(records), [records])
  const filteredTreeRows = useMemo(() => filterTree(treeRows, query.trim()), [query, treeRows])
  const expandableKeys = useMemo(() => collectExpandableKeys(filteredTreeRows), [filteredTreeRows])
  const visibleRows = useMemo(() => {
    if (query.trim()) {
      return flattenRows(filteredTreeRows, expandableKeys)
    }
    return flattenRows(filteredTreeRows, expandedKeys)
  }, [expandableKeys, expandedKeys, filteredTreeRows, query])

  const overallStats = useMemo<OverallAttendanceStats>(() => {
    const root = treeRows[0]
    const metrics = root?.metrics ?? createEmptyMetrics()
    const departmentCount = records.reduce((paths, record) => {
      const path = normalizePath(record.department_path)
      for (let index = 1; index < path.length; index += 1) {
        paths.add(path.slice(0, index + 1).join('/'))
      }
      return paths
    }, new Set<string>()).size

    return {
      ...metrics,
      departmentCount,
    }
  }, [records, treeRows])

  const toggleRow = (key: string) => {
    setExpandedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return {
    records,
    loading,
    error,
    selectedMonth,
    setSelectedMonth,
    availableMonths,
    expandedKeys,
    query,
    setQuery,
    visibleRows,
    expandableKeys,
    toggleRow,
    overallStats,
  }
}
