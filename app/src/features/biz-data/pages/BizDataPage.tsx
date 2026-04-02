import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { ReportTypeToggle } from '../components/ReportTypeToggle'
import { PeriodTypeToggle } from '../components/PeriodTypeToggle'
import { MonthSelector } from '../components/MonthSelector'
import { ViewModeToggle } from '../components/ViewModeToggle'
import { MetricSelector } from '../components/MetricSelector'
import { ChartHierarchyBreadcrumb } from '../components/ChartHierarchyBreadcrumb'
import { ChartView, type DrillDownLevel } from '../components/ChartView'
import { HierarchyLevelFilter, type LevelVisibility } from '../components/HierarchyLevelFilter'
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

  const [drillDownPath, setDrillDownPath] = useState<DrillDownLevel[]>([{ node: null, label: '全部' }])
  const [showLevels, setShowLevels] = useState<LevelVisibility>({
    level0: true,
    level1: true,
    level2: true,
    level3: true,
  })

  useEffect(() => {
    setDrillDownPath([{ node: null, label: '全部' }])
  }, [nodes])

  return (
    <div className="app-page biz-data-page">
      <section className="space-y-3 min-w-0">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <ReportTypeToggle value={reportType} onChange={setReportType} />
            <PeriodTypeToggle value={periodType} onChange={setPeriodType} />
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </div>
          {availableMonths.length > 0 && (
            <div className="xl:ml-auto">
              <MonthSelector
                value={selectedMonth}
                options={availableMonths}
                onChange={setSelectedMonth}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:flex-wrap">
          {viewMode === 'table' ? (
            <HierarchyLevelFilter value={showLevels} onChange={setShowLevels} />
          ) : (
            <ChartHierarchyBreadcrumb
              items={drillDownPath.map(({ label }) => ({ label }))}
              onSelect={(index) => setDrillDownPath((prev) => prev.slice(0, index + 1))}
            />
          )}
          <MetricSelector
            selectedMetrics={selectedMetrics}
            onChange={setSelectedMetrics}
            availableMetrics={availableMetrics}
            maxSelection={6}
          />
        </div>
      </section>

      <div className="relative min-w-0">
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
          <TableView
            nodes={nodes}
            reportType={reportType}
            selectedMetrics={selectedMetrics}
            showLevels={showLevels}
          />
        ) : (
          <ChartView
            nodes={nodes}
            reportType={reportType}
            selectedMetrics={selectedMetrics}
            drillDownPath={drillDownPath}
            onDrillDownPathChange={setDrillDownPath}
          />
        )}
      </div>
    </div>
  )
}
