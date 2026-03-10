import { useEffect, useState, useMemo } from 'react'
import { PageTitle } from '@/components/ui/PageTitle'
import { StatCard } from '@/components/ui/StatCard'
import { Lightbulb, AlertTriangle, TrendingUp } from 'lucide-react'
import type { BizDataNode, MetricCategory } from '@/lib/supabase'
import {
  fetchBizReport,
  fetchMonthlyPlan,
  fetchAvailablePeriods,
  aggregateByNode,
  buildHierarchyTree,
} from '@/services/bizDataService'
import { MetricSelector } from '@/components/BizData/MetricSelector'
import { IntegratedComparisonTable } from '@/components/BizData/IntegratedComparisonTable'

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

function generateInsights(totalNode: BizDataNode | undefined, centerNodes: BizDataNode[]): Insight[] {
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
  const [nodes, setNodes] = useState<BizDataNode[]>([])
  const [periodType, setPeriodType] = useState<'cumulative' | 'monthly'>('cumulative')
  const [metric, setMetric] = useState<MetricCategory>('revenue')

  // Load data
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        console.log('[BizData] Loading data for periodType:', periodType)

        // Fetch periods
        const periods = await fetchAvailablePeriods()
        console.log('[BizData] Available periods:', periods)

        // Fetch all reports for the selected period_type (don't filter by specific period)
        // This handles the case where fone and tuwei have different period formats
        const foneReports = await fetchBizReport({
          periodType,
          reportTypes: ['fone'],
        })
        console.log('[BizData] Fone reports:', foneReports.length)

        const tuweiReports = await fetchBizReport({
          periodType,
          reportTypes: ['tuwei'],
        })
        console.log('[BizData] Tuwei reports:', tuweiReports.length)

        // Fetch monthly plans
        const monthlyPlans = await fetchMonthlyPlan()
        console.log('[BizData] Monthly plans:', monthlyPlans.length)

        // Aggregate
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
  }, [periodType])

  const tree = useMemo(() => buildHierarchyTree(nodes), [nodes])
  const totalNode = tree.total[0]
  const insights = useMemo(() => generateInsights(totalNode, tree.centers), [totalNode, tree.centers])

  // Get metric data for KPI cards
  const revenueMetric = totalNode?.metrics.revenue
  const profitMetric = totalNode?.metrics.pretax_profit
  const marginMetric = totalNode?.metrics.gross_margin
  const headcountMetric = totalNode?.metrics.headcount

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

      {/* Period Type Selector */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setPeriodType('cumulative')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            periodType === 'cumulative'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          累计数据
        </button>
        <button
          onClick={() => setPeriodType('monthly')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            periodType === 'monthly'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          月度数据
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="实际营收"
          value={fmt(revenueMetric?.actual)}
          unit="万元"
          trend={`预算达成 ${fmtPct(revenueMetric?.completion_fone)}`}
          trendUp={(revenueMetric?.completion_fone ?? 0) >= 0.80}
          color={(revenueMetric?.completion_fone ?? 0) >= 0.80 ? 'success' : 'warning'}
        />
        <StatCard
          label="实际利润"
          value={fmt(profitMetric?.actual)}
          unit="万元"
          trend={`预算达成 ${fmtPct(profitMetric?.completion_fone)}`}
          trendUp={(profitMetric?.completion_fone ?? 0) >= 0.80}
          color={(profitMetric?.completion_fone ?? 0) >= 0.80 ? 'success' : 'error'}
        />
        <StatCard
          label="毛利率"
          value={fmtPct(marginMetric?.actual)}
          trend={`预算 ${fmtPct(marginMetric?.budget_fone)} | 同期 ${fmtPct(marginMetric?.yoy)}`}
          trendUp={(marginMetric?.diff_fone ?? 0) >= 0}
          color={(marginMetric?.diff_fone ?? 0) >= 0 ? 'success' : 'warning'}
        />
        <StatCard
          label="在岗人数"
          value={fmt(headcountMetric?.actual)}
          unit="人"
          trend={`预算 ${fmt(headcountMetric?.budget_fone)} | 差异 ${fmt(headcountMetric?.diff_fone)}`}
          trendUp={(headcountMetric?.diff_fone ?? 0) <= 0}
          color="default"
        />
      </div>

      {/* Metric Selector */}
      <div className="mb-4">
        <MetricSelector value={metric} onChange={setMetric} />
      </div>

      {/* Integrated Comparison Table */}
      <div className="mb-6">
        <IntegratedComparisonTable
          nodes={tree.centers}
          allNodes={nodes}
          metric={metric}
        />
      </div>

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
