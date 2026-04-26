import { lazy, Suspense, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { ReportTypeToggle } from '../components/ReportTypeToggle'
import { PeriodTypeToggle } from '../components/PeriodTypeToggle'
import { MonthSelector } from '../components/MonthSelector'
import { ViewModeToggle } from '../components/ViewModeToggle'
import { MetricSelector } from '../components/MetricSelector'
import { ChartHierarchyBreadcrumb } from '../components/ChartHierarchyBreadcrumb'
import type { DrillDownLevel } from '../components/ChartView'
import { HierarchyLevelFilter, type LevelVisibility } from '../components/HierarchyLevelFilter'
import { TableView } from '../components/TableView'
import {
  ActiveFiltersSummary,
  DataEmptyState,
  DataFreshnessBadge,
  DataLoadingState,
} from '@/shared/components/data-state'
import { useBizDataViewModel } from '../hooks/useBizDataViewModel'
import { buildTreeWithAggregation } from '../services/bizDataService'
import type { EnrichedBizDataNode } from '../types'

const ChartView = lazy(() => import('../components/ChartView').then((module) => ({ default: module.ChartView })))

function normalizeDrillDownPath(
  path: DrillDownLevel[],
  nodes: EnrichedBizDataNode[],
): DrillDownLevel[] {
  if (path.length <= 1) {
    return path
  }

  const aggregatedNodes = buildTreeWithAggregation(nodes)
  const hasMatchingNode = (target: EnrichedBizDataNode) =>
    aggregatedNodes.some((node) => (
      node.node_name === target.node_name
      && node.orgHierarchy.level_0 === target.orgHierarchy.level_0
      && node.orgHierarchy.level_1 === target.orgHierarchy.level_1
      && node.orgHierarchy.level_2 === target.orgHierarchy.level_2
    ))

  for (let index = 1; index < path.length; index += 1) {
    const currentNode = path[index]?.node
    if (!currentNode || !hasMatchingNode(currentNode)) {
      return [{ node: null, label: '全部' }]
    }
  }

  return path
}

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
  const effectiveDrillDownPath = useMemo(() => normalizeDrillDownPath(drillDownPath, nodes), [drillDownPath, nodes])
  const chartViewFallback = (
    <div className="biz-content-area">
      <div className="flex items-center justify-center h-[460px]">
        <div className="text-caption text-[var(--color-text-muted)]">图表加载中...</div>
      </div>
    </div>
  )

  return (
    <div className="app-page biz-data-page">
      <section className="space-y-3 min-w-0">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-2 flex-wrap">
            <ReportTypeToggle value={reportType} onChange={setReportType} />
            <PeriodTypeToggle value={periodType} onChange={setPeriodType} />
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </div>
          {availableMonths.length > 0 && (
            <div className="w-full xl:ml-auto xl:w-auto">
              <MonthSelector
                value={selectedMonth}
                options={availableMonths}
                onChange={setSelectedMonth}
              />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:flex-wrap">
          <DataFreshnessBadge source="Supabase / 经营数据" updatedAt={selectedMonth || undefined} />
          <ActiveFiltersSummary
            filters={[
              reportType === 'fone' ? 'Fone 版' : '突围版',
              periodType === 'cumulative' ? '累计' : '月度',
              selectedMonth || '未选择期间',
            ]}
          />
          {viewMode === 'table' ? (
            <HierarchyLevelFilter value={showLevels} onChange={setShowLevels} />
          ) : (
            <ChartHierarchyBreadcrumb
              items={effectiveDrillDownPath.map(({ label }) => ({ label }))}
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

      <div className="relative min-w-0 min-h-0 h-full">
        {dataLoading ? (
          <div className="biz-content-area">
            <DataLoadingState label="加载经营数据..." />
          </div>
        ) : nodes.length === 0 ? (
          <div className="biz-content-area">
            <DataEmptyState
              title="暂无经营数据"
              description={`${periodType === 'cumulative' ? '累计数据' : '月度数据'} · 请检查数据库或切换期间类型`}
              action={<AlertTriangle size={18} className="text-warning-700 opacity-60" />}
            />
          </div>
        ) : viewMode === 'table' ? (
          <TableView
            nodes={nodes}
            reportType={reportType}
            selectedMetrics={selectedMetrics}
            showLevels={showLevels}
          />
        ) : (
          <Suspense fallback={chartViewFallback}>
            <ChartView
              nodes={nodes}
              reportType={reportType}
              selectedMetrics={selectedMetrics}
              drillDownPath={effectiveDrillDownPath}
              onDrillDownPathChange={setDrillDownPath}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}
