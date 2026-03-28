import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { EnrichedBizDataNode, MetricCategory } from '@/lib/supabase'
import {
  fetchBizReport,
  fetchMonthlyPlan,
  fetchAvailableMonths,
  aggregateByNode,
} from '@/services/bizDataService'
import { ReportTypeToggle } from '@/components/BizData/ReportTypeToggle'
import { PeriodTypeToggle } from '@/components/BizData/PeriodTypeToggle'
import { MonthSelector } from '@/components/BizData/MonthSelector'
import { ViewModeToggle } from '@/components/BizData/ViewModeToggle'
import { MetricSelector } from '@/components/BizData/MetricSelector'
import { ChartView } from '@/components/BizData/ChartView'
import { TableView } from '@/components/BizData/TableView'
import { ALL_METRICS } from '@/lib/constants'

// --- Main Component ---

export function BizData() {
  const [dataLoading, setDataLoading] = useState(false)
  const [nodes, setNodes] = useState<EnrichedBizDataNode[]>([])
  const [reportType, setReportType] = useState<'fone' | 'tuwei'>('fone')
  const [periodType, setPeriodType] = useState<'cumulative' | 'monthly'>('cumulative')
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('chart')
  const [selectedMetrics, setSelectedMetrics] = useState<MetricCategory[]>([
    'revenue',
    'pretax_profit',
    'gross_margin',
  ])

  // Load available months when reportType or periodType changes
  useEffect(() => {
    async function loadMonths() {
      const months = await fetchAvailableMonths(periodType, reportType)
      setAvailableMonths(months)
      if (months.length > 0) {
        setSelectedMonth(months[0])
      }
    }
    loadMonths()
  }, [reportType, periodType])

  // Load data when filters change
  useEffect(() => {
    async function loadData() {
      if (!selectedMonth) return

      setDataLoading(true)
      try {
        console.log('[BizData] Loading data for:', { reportType, periodType, selectedMonth })

        const reports = await fetchBizReport({
          period: selectedMonth,
          periodType,
          reportTypes: [reportType],
        })

        console.log('[BizData] Reports:', reports.length)

        const monthlyPlans = await fetchMonthlyPlan()
        console.log('[BizData] Monthly plans:', monthlyPlans.length)

        // For single report type, pass empty array for the other type
        const foneReports = reportType === 'fone' ? reports : []
        const tuweiReports = reportType === 'tuwei' ? reports : []

        const aggregated = aggregateByNode(foneReports, tuweiReports, monthlyPlans)
        console.log('[BizData] Aggregated nodes:', aggregated.length)
        setNodes(aggregated)
      } catch (error) {
        console.error('[BizData] Failed to load data:', error)
      } finally {
        setDataLoading(false)
      }
    }

    loadData()
  }, [reportType, periodType, selectedMonth])

  return (
    <div className="app-page">
      {/* Filter Toolbar */}
      <div className="biz-toolbar">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <ReportTypeToggle value={reportType} onChange={setReportType} />
          <div className="w-px h-6 bg-[var(--color-border)]" />
          <PeriodTypeToggle value={periodType} onChange={setPeriodType} />
          <div className="w-px h-6 bg-[var(--color-border)]" />
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          <MetricSelector
            selectedMetrics={selectedMetrics}
            onChange={setSelectedMetrics}
            availableMetrics={ALL_METRICS}
            maxSelection={6}
          />
        </div>
        {availableMonths.length > 0 && (
          <MonthSelector
            value={selectedMonth}
            options={availableMonths}
            onChange={setSelectedMonth}
          />
        )}
      </div>

      {/* View Content with Loading State */}
      <div className="relative">
        {dataLoading ? (
          <div className="biz-content-area">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] mx-auto mb-3"></div>
                <div className="text-xs text-[var(--color-text-muted)]">加载中...</div>
              </div>
            </div>
          </div>
        ) : nodes.length === 0 ? (
          <div className="biz-content-area">
            <div className="app-empty-state">
              <AlertTriangle size={32} className="text-warning-700 opacity-60" />
              <div className="text-[var(--color-text-strong)] font-medium text-sm">暂无数据</div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {periodType === 'cumulative' ? '累计数据' : '月度数据'} · 请检查数据库或切换期间类型
              </div>
            </div>
          </div>
        ) : viewMode === 'table' ? (
          <TableView nodes={nodes} reportType={reportType} selectedMetrics={selectedMetrics} />
        ) : (
          <ChartView nodes={nodes} reportType={reportType} selectedMetrics={selectedMetrics} />
        )}
      </div>

    </div>
  )
}
