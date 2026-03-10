import { useEffect, useState, useMemo } from 'react'
import { PageTitle } from '@/components/ui/PageTitle'
import { Lightbulb, AlertTriangle, TrendingUp } from 'lucide-react'
import type { EnrichedBizDataNode } from '@/lib/supabase'
import {
  fetchBizReport,
  fetchMonthlyPlan,
  fetchAvailablePeriods,
  aggregateByNode,
  buildHierarchyTree,
} from '@/services/bizDataService'
import { IntegratedComparisonTable } from '@/components/BizData/IntegratedComparisonTable'
import { ReportTypeToggle } from '@/components/BizData/ReportTypeToggle'
import { PeriodSelector } from '@/components/BizData/PeriodSelector'
import { ViewModeTabs } from '@/components/BizData/ViewModeTabs'
import { ChartView } from '@/components/BizData/ChartView'

// --- Helpers ---

function fmt(v: number | null | undefined, suffix = ''): string {
  if (v == null) return '-'
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + suffix
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '-'
  return (v * 100).toFixed(1) + '%'
}

// --- Insights Engine ---

interface Insight {
  type: 'danger' | 'warning' | 'success' | 'info'
  title: string
  detail: string
}

function generateInsights(totalNode: EnrichedBizDataNode | undefined, centerNodes: EnrichedBizDataNode[]): Insight[] {
  if (!totalNode) return []
  const insights: Insight[] = []

  const revenue = totalNode.metrics.revenue
  const profit = totalNode.metrics.pretax_profit
  const margin = totalNode.metrics.gross_margin
  const laborCostRate = totalNode.metrics.labor_cost_rate

  // 1. 预算达成率分析
  if (revenue?.completion_fone != null && revenue.completion_fone < 0.80) {
    insights.push({
      type: 'danger',
      title: '营收预算达成率偏低',
      detail: `年初预算达成率 ${fmtPct(revenue.completion_fone)}，缺口 ${fmt(revenue.diff_fone)} 万元`,
    })
  }

  // 2. 突围对比分析
  if (revenue?.completion_tuwei != null && revenue.completion_tuwei < 0.85) {
    insights.push({
      type: 'warning',
      title: '营收突围目标未达成',
      detail: `突围考核达成率 ${fmtPct(revenue.completion_tuwei)}，需加大业务拓展力度`,
    })
  }

  // 3. Fone vs Tuwei 差异分析
  if (revenue?.completion_fone != null && revenue?.completion_tuwei != null) {
    const gap = Math.abs(revenue.completion_fone - revenue.completion_tuwei)
    if (gap > 0.10) {
      insights.push({
        type: 'info',
        title: '预算与突围目标存在较大差异',
        detail: `年初预算达成 ${fmtPct(revenue.completion_fone)}，突围考核达成 ${fmtPct(revenue.completion_tuwei)}，差距 ${(gap * 100).toFixed(1)} 个百分点`,
      })
    }
  }

  // 4. 利润分析
  if (profit?.completion_fone != null && profit.completion_fone < 0.70) {
    insights.push({
      type: 'danger',
      title: '利润达成严重不足',
      detail: `利润预算达成率 ${fmtPct(profit.completion_fone)}，实际 ${fmt(profit.actual)} vs 预算 ${fmt(profit.budget_fone)} 万元`,
    })
  }

  // 5. 同比增长分析
  if (revenue?.yoy != null && revenue.actual != null && revenue.yoy > 0) {
    const yoyGrowth = ((revenue.actual - revenue.yoy) / revenue.yoy) * 100
    if (yoyGrowth > 10) {
      insights.push({
        type: 'success',
        title: '营收同比大幅增长',
        detail: `同比增长 ${yoyGrowth.toFixed(1)}%，实际 ${fmt(revenue.actual)} vs 同期 ${fmt(revenue.yoy)} 万元`,
      })
    } else if (yoyGrowth < -5) {
      insights.push({
        type: 'warning',
        title: '营收同比下滑',
        detail: `同比下降 ${Math.abs(yoyGrowth).toFixed(1)}%，需关注业务下滑原因`,
      })
    }
  }

  // 6. 毛利率分析
  if (margin?.actual != null && margin?.budget_fone != null) {
    const marginDiff = margin.actual - margin.budget_fone
    if (marginDiff > 0.03) {
      insights.push({
        type: 'success',
        title: '毛利率优于预算',
        detail: `实际毛利率 ${fmtPct(margin.actual)} 高于预算 ${fmtPct(margin.budget_fone)}，超出 ${(marginDiff * 100).toFixed(1)} 个百分点`,
      })
    } else if (marginDiff < -0.03) {
      insights.push({
        type: 'warning',
        title: '毛利率低于预算',
        detail: `实际毛利率 ${fmtPct(margin.actual)} 低于预算 ${fmtPct(margin.budget_fone)}，需关注成本控制`,
      })
    }
  }

  // 7. 人力成本率分析
  if (laborCostRate?.actual != null && laborCostRate?.budget_fone != null) {
    const rateDiff = laborCostRate.actual - laborCostRate.budget_fone
    if (rateDiff > 0.03) {
      insights.push({
        type: 'warning',
        title: '人力成本率超预算',
        detail: `实际人力成本率 ${fmtPct(laborCostRate.actual)} 高于预算 ${fmtPct(laborCostRate.budget_fone)}，超出 ${(rateDiff * 100).toFixed(1)} 个百分点`,
      })
    }
  }

  // 8. 中心级表现分析
  const centerPerformance = centerNodes
    .filter(c => c.metrics.revenue?.completion_fone != null)
    .map(c => ({
      name: c.node_name,
      completion: c.metrics.revenue!.completion_fone!,
      actual: c.metrics.revenue!.actual,
    }))
    .sort((a, b) => b.completion - a.completion)

  if (centerPerformance.length > 0) {
    const best = centerPerformance[0]
    if (best.completion > 0.95) {
      insights.push({
        type: 'success',
        title: `${best.name} 表现突出`,
        detail: `营收预算达成率 ${fmtPct(best.completion)}，实际营收 ${fmt(best.actual)} 万元`,
      })
    }

    const worst = centerPerformance[centerPerformance.length - 1]
    if (worst.completion < 0.70 && (worst.actual ?? 0) > 100) {
      insights.push({
        type: 'warning',
        title: `${worst.name} 营收达成率低`,
        detail: `营收预算达成率 ${fmtPct(worst.completion)}，需重点关注`,
      })
    }
  }

  return insights
}

const INSIGHT_STYLE: Record<string, { icon: typeof AlertTriangle; bg: string; border: string; iconColor: string }> = {
  danger: { icon: AlertTriangle, bg: 'bg-error-100/60', border: 'border-error-200', iconColor: 'text-error-700' },
  warning: { icon: AlertTriangle, bg: 'bg-warning-100/60', border: 'border-warning-200', iconColor: 'text-warning-700' },
  success: { icon: TrendingUp, bg: 'bg-success-100/60', border: 'border-success-200', iconColor: 'text-success-700' },
  info: { icon: Lightbulb, bg: 'bg-accent-50', border: 'border-accent-200', iconColor: 'text-accent-600' },
}

// --- Main Component ---

export function BizData() {
  const [loading, setLoading] = useState(true)
  const [nodes, setNodes] = useState<EnrichedBizDataNode[]>([])
  const [periodType, setPeriodType] = useState<'cumulative' | 'monthly'>('cumulative')
  const [reportType, setReportType] = useState<'fone' | 'tuwei' | 'comparison'>('comparison')
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  const [availablePeriods, setAvailablePeriods] = useState<Array<{ period_type: 'cumulative' | 'monthly'; period: string; label: string }>>([])
  const [selectedPeriod, setSelectedPeriod] = useState<string>('')

  // Load available periods on mount
  useEffect(() => {
    async function loadPeriods() {
      const periods = await fetchAvailablePeriods()
      setAvailablePeriods(periods)
      if (periods.length > 0) {
        const defaultPeriod = periods.find(p => p.period_type === 'cumulative') || periods[0]
        setSelectedPeriod(defaultPeriod.period)
        setPeriodType(defaultPeriod.period_type)
      }
    }
    loadPeriods()
  }, [])

  // Load data when filters change
  useEffect(() => {
    async function loadData() {
      if (!selectedPeriod) return

      setLoading(true)
      try {
        console.log('[BizData] Loading data for:', { periodType, reportType, selectedPeriod })

        // Determine which report types to fetch
        const reportTypes = reportType === 'comparison' ? ['fone', 'tuwei'] : [reportType]

        const foneReports = reportTypes.includes('fone')
          ? await fetchBizReport({ periodType, reportTypes: ['fone'] })
          : []

        const tuweiReports = reportTypes.includes('tuwei')
          ? await fetchBizReport({ periodType, reportTypes: ['tuwei'] })
          : []

        console.log('[BizData] Fone reports:', foneReports.length)
        console.log('[BizData] Tuwei reports:', tuweiReports.length)

        const monthlyPlans = await fetchMonthlyPlan()
        console.log('[BizData] Monthly plans:', monthlyPlans.length)

        const aggregated = aggregateByNode(foneReports, tuweiReports, monthlyPlans)
        console.log('[BizData] Aggregated nodes:', aggregated.length)
        setNodes(aggregated)
      } catch (error) {
        console.error('[BizData] Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [periodType, reportType, selectedPeriod])

  const tree = useMemo(() => buildHierarchyTree(nodes), [nodes])
  const totalNode = tree.total[0]
  const insights = useMemo(() => generateInsights(totalNode, tree.centers), [totalNode, tree.centers])

  if (loading) {
    return (
      <>
        <PageTitle breadcrumb="数据中心 / 经营数据" title="经营数据" />
        <div className="flex items-center justify-center h-64 text-gray-400">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <div>加载中...</div>
          </div>
        </div>
      </>
    )
  }

  if (nodes.length === 0) {
    return (
      <>
        <PageTitle breadcrumb="数据中心 / 经营数据" title="经营数据" />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle size={48} className="text-warning-500 mx-auto mb-4" />
            <div className="text-gray-700 font-medium mb-2">暂无数据</div>
            <div className="text-sm text-gray-500">
              当前期间类型: {periodType === 'cumulative' ? '累计数据' : '月度数据'}
            </div>
            <div className="text-sm text-gray-500 mt-2">
              请检查数据库或切换期间类型
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageTitle breadcrumb="数据中心 / 经营数据" title="经营数据" subtitle="2025学年 · 单位：万元" />

      {/* Filter Bar */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <ReportTypeToggle value={reportType} onChange={setReportType} />
          {availablePeriods.length > 0 && (
            <PeriodSelector
              value={selectedPeriod}
              options={availablePeriods}
              onChange={(period, type) => {
                setSelectedPeriod(period)
                setPeriodType(type)
              }}
            />
          )}
        </div>
      </div>

      {/* View Mode Tabs */}
      <ViewModeTabs value={viewMode} onChange={setViewMode} />

      {/* Conditional View Rendering */}
      {viewMode === 'table' ? (
        <div className="mb-6">
          <IntegratedComparisonTable
            nodes={tree.centers}
            allNodes={nodes}
            reportType={reportType}
          />
        </div>
      ) : (
        <div className="mb-6">
          <ChartView nodes={nodes} reportType={reportType} />
        </div>
      )}

      {/* Smart Insights */}
      {insights.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={18} className="text-accent" />
            <span className="text-sm font-medium text-gray-700">智能洞察</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {insights.map((insight, i) => {
              const style = INSIGHT_STYLE[insight.type]
              const Icon = style.icon
              return (
                <div key={i} className={`rounded-lg border p-4 ${style.bg} ${style.border}`}>
                  <div className="flex items-start gap-3">
                    <Icon size={18} className={`${style.iconColor} mt-0.5 shrink-0`} />
                    <div>
                      <div className={`font-medium text-sm ${style.iconColor}`}>{insight.title}</div>
                      <div className="text-sm text-gray-600 mt-1 leading-relaxed">{insight.detail}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
