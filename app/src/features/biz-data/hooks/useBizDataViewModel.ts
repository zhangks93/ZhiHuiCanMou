import { useEffect, useState } from 'react'
import { ALL_METRICS } from '@/shared/lib/constants'
import { logger } from '@/shared/lib/logger'
import { loadAvailableMonths, loadBizData } from '../api/bizDataRepository'
import type { EnrichedBizDataNode, MetricCategory } from '../types'

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function useBizDataViewModel() {
  const [dataLoading, setDataLoading] = useState(false)
  const [monthsLoading, setMonthsLoading] = useState(true)
  const [nodes, setNodes] = useState<EnrichedBizDataNode[]>([])
  const [dataError, setDataError] = useState<string | null>(null)
  const [monthsError, setMonthsError] = useState<string | null>(null)
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null)
  const [reportType, setReportType] = useState<'fone' | 'tuwei'>('fone')
  const [periodType, setPeriodType] = useState<'cumulative' | 'monthly'>('cumulative')
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  const [selectedMetrics, setSelectedMetrics] = useState<MetricCategory[]>([
    'revenue',
    'pretax_profit',
    'gross_margin',
  ])

  useEffect(() => {
    let cancelled = false

    async function loadMonths() {
      setMonthsLoading(true)
      setMonthsError(null)
      try {
        const months = await loadAvailableMonths({ periodType, reportType })
        if (cancelled) return
        setAvailableMonths(months)
        setSelectedMonth((current) => (current && months.includes(current) ? current : (months[0] ?? '')))
      } catch (error) {
        if (cancelled) return
        logger.error('Biz month load failed', error)
        setAvailableMonths([])
        setSelectedMonth('')
        setMonthsError(getErrorMessage(error, '经营期间加载失败'))
      } finally {
        if (!cancelled) {
          setMonthsLoading(false)
        }
      }
    }

    void loadMonths()

    return () => {
      cancelled = true
    }
  }, [reportType, periodType])

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      if (!selectedMonth) {
        setNodes([])
        setDataError(null)
        setLastLoadedAt(null)
        return
      }

      setDataLoading(true)
      setDataError(null)
      try {
        const nextNodes = await loadBizData({
          reportType,
          periodType,
          selectedMonth,
        })
        if (cancelled) return
        setNodes(nextNodes)
        setLastLoadedAt(Date.now())
      } catch (error) {
        if (cancelled) return
        logger.error('Biz data load failed', error)
        setDataError(getErrorMessage(error, '经营数据加载失败'))
      } finally {
        if (!cancelled) {
          setDataLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      cancelled = true
    }
  }, [reportType, periodType, selectedMonth])

  return {
    dataLoading,
    monthsLoading,
    nodes,
    dataError,
    monthsError,
    lastLoadedAt,
    isInitializing: monthsLoading || (dataLoading && nodes.length === 0),
    isRefreshing: dataLoading && nodes.length > 0,
    reportType,
    setReportType,
    periodType,
    setPeriodType,
    availableMonths,
    selectedMonth,
    setSelectedMonth,
    viewMode,
    setViewMode,
    selectedMetrics,
    setSelectedMetrics,
    availableMetrics: ALL_METRICS,
  }
}
