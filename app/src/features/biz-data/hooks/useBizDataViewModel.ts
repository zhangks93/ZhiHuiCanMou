import { useEffect, useState } from 'react'
import { ALL_METRICS } from '@/shared/lib/constants'
import { loadAvailableMonths, loadBizData } from '../api/bizDataRepository'
import type { EnrichedBizDataNode, MetricCategory } from '../types'

export function useBizDataViewModel() {
  const [dataLoading, setDataLoading] = useState(false)
  const [nodes, setNodes] = useState<EnrichedBizDataNode[]>([])
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
    async function loadMonths() {
      const months = await loadAvailableMonths({ periodType, reportType })
      setAvailableMonths(months)
      setSelectedMonth((current) => (current && months.includes(current) ? current : (months[0] ?? '')))
    }

    void loadMonths()
  }, [reportType, periodType])

  useEffect(() => {
    async function loadData() {
      if (!selectedMonth) return

      setDataLoading(true)
      try {
        const nextNodes = await loadBizData({
          reportType,
          periodType,
          selectedMonth,
        })
        setNodes(nextNodes)
      } catch (error) {
        console.error('[BizData] Failed to load data:', error)
        setNodes([])
      } finally {
        setDataLoading(false)
      }
    }

    void loadData()
  }, [reportType, periodType, selectedMonth])

  return {
    dataLoading,
    nodes,
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
