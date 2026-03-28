import { AlertTriangle } from 'lucide-react'
import { ReportTypeToggle } from '@/components/BizData/ReportTypeToggle'
import { PeriodTypeToggle } from '@/components/BizData/PeriodTypeToggle'
import { MonthSelector } from '@/components/BizData/MonthSelector'
import { ViewModeToggle } from '@/components/BizData/ViewModeToggle'
import { MetricSelector } from '@/components/BizData/MetricSelector'
import { ChartView } from '@/components/BizData/ChartView'
import { TableView } from '@/components/BizData/TableView'
import { useBizDataViewModel } from '../hooks/useBizDataViewModel'

export function BizDataPage() {
  const {
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
    availableMetrics,
  } = useBizDataViewModel()

  return (
    <div className="app-page">
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
            availableMetrics={availableMetrics}
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
