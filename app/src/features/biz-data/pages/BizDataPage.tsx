import { AlertTriangle } from 'lucide-react'
import { ReportTypeToggle } from '../components/ReportTypeToggle'
import { PeriodTypeToggle } from '../components/PeriodTypeToggle'
import { MonthSelector } from '../components/MonthSelector'
import { ViewModeToggle } from '../components/ViewModeToggle'
import { MetricSelector } from '../components/MetricSelector'
import { ChartView } from '../components/ChartView'
import { TableView } from '../components/TableView'
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
      <section className="app-section-card app-section-card-muted p-4 sm:p-5">
        <div className="app-section-header">
          <div>
            <div className="app-section-kicker">Business Lens</div>
            <div className="app-section-title mt-2">
              <h3 className="text-title font-semibold">经营分析视图</h3>
            </div>
            <p className="mt-2 text-body leading-6 text-[var(--color-text-muted)]">
              在同一页内切换口径、期间、图表与表格视角，让经营数据的筛选和阅读路径更集中。
            </p>
          </div>

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
        </div>
      </section>

      <div className="relative">
        {dataLoading ? (
          <div className="biz-content-area">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] mx-auto mb-3"></div>
                <div className="text-caption text-[var(--color-text-muted)]">加载中...</div>
              </div>
            </div>
          </div>
        ) : nodes.length === 0 ? (
          <div className="biz-content-area">
            <div className="app-empty-state">
              <AlertTriangle size={32} className="text-warning-700 opacity-60" />
              <div className="text-[var(--color-text-strong)] font-medium text-body">暂无数据</div>
              <div className="text-caption text-[var(--color-text-muted)]">
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
