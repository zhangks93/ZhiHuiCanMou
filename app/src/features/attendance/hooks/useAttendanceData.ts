import { useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '@/shared/lib/errorMessage'
import { logger } from '@/shared/lib/logger'
import {
  fetchAvailableAttendanceMonths,
  fetchAttendanceMonthlyRecords,
  type AttendanceMonthlyRecord,
} from '../api/attendanceRepository'
import {
  buildAttendanceTree,
  collectExpandableAttendanceKeys,
  createEmptyAttendanceMetrics,
  departmentRootKey,
  filterAttendanceTree,
  flattenAttendanceTreeRows,
  normalizeDepartmentPath,
  type OverallAttendanceStats,
} from '../services/attendanceTree'

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
        logger.error('获取考勤月份失败', loadError)
        setError(getErrorMessage(loadError, '获取考勤月份失败'))
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
        setExpandedKeys(new Set([departmentRootKey()]))
      } catch (loadError) {
        logger.error('获取考勤数据失败', loadError)
        setError(getErrorMessage(loadError, '获取考勤数据失败'))
      } finally {
        setLoading(false)
      }
    }

    void loadRecords()
  }, [selectedMonth])

  const treeRows = useMemo(() => buildAttendanceTree(records), [records])
  const filteredTreeRows = useMemo(() => filterAttendanceTree(treeRows, query.trim()), [query, treeRows])
  const expandableKeys = useMemo(() => collectExpandableAttendanceKeys(filteredTreeRows), [filteredTreeRows])
  const visibleRows = useMemo(() => {
    if (query.trim()) {
      return flattenAttendanceTreeRows(filteredTreeRows, expandableKeys)
    }
    return flattenAttendanceTreeRows(filteredTreeRows, expandedKeys)
  }, [expandableKeys, expandedKeys, filteredTreeRows, query])

  const overallStats = useMemo<OverallAttendanceStats>(() => {
    const root = treeRows[0]
    const metrics = root?.metrics ?? createEmptyAttendanceMetrics()
    const departmentCount = records.reduce((paths, record) => {
      const path = normalizeDepartmentPath(record.department_path)
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
