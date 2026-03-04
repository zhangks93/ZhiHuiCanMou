import { useEffect, useState, useMemo } from 'react'
import { PageTitle } from '@/components/ui/PageTitle'
import { StatCard } from '@/components/ui/StatCard'
import { supabase, type BizDataSnapshot } from '@/lib/supabase'
import {
  BarChart3, TrendingUp, ChevronDown, ChevronRight,
  AlertTriangle, Lightbulb, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'

// --- helpers ---

function fmt(v: number | null | undefined, suffix = ''): string {
  if (v == null) return '-'
  const abs = Math.abs(v)
  if (abs >= 10000) return (v / 10000).toFixed(2) + '亿' + suffix
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + suffix
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '-'
  return (v * 100).toFixed(1) + '%'
}

function rateColor(rate: number | null | undefined): string {
  if (rate == null) return 'text-gray-400'
  if (rate >= 0.90) return 'text-success-700'
  if (rate >= 0.70) return 'text-warning-700'
  return 'text-error-700'
}

function rateBg(rate: number | null | undefined): string {
  if (rate == null) return 'bg-gray-100 text-gray-500'
  if (rate >= 0.90) return 'bg-success-100 text-success-700'
  if (rate >= 0.70) return 'bg-warning-100 text-warning-700'
  return 'bg-error-100 text-error-700'
}

function diffArrow(v: number | null | undefined) {
  if (v == null || v === 0) return null
  return v > 0
    ? <ArrowUpRight size={14} className="text-success-700 inline" />
    : <ArrowDownRight size={14} className="text-error-700 inline" />
}

// --- bar component ---

function MiniBar({ value, max, color = 'bg-accent' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// --- analysis engine ---

interface Insight {
  type: 'danger' | 'warning' | 'success' | 'info'
  title: string
  detail: string
}

function generateInsights(total: BizDataSnapshot | undefined, level1: BizDataSnapshot[]): Insight[] {
  if (!total) return []
  const insights: Insight[] = []

  // Overall revenue completion
  const revRate = total.revenue_completion_rate
  if (revRate != null && revRate < 0.80) {
    insights.push({
      type: 'danger',
      title: '整体营收预算达成率偏低',
      detail: `大后勤合计营收达成率仅 ${fmtPct(revRate)}，预实差异 ${fmt(total.revenue_diff)} 万元，需重点关注营收缺口较大的业务板块。`,
    })
  }

  // Profit completion
  const profRate = total.profit_completion_rate
  if (profRate != null && profRate < 0.50) {
    insights.push({
      type: 'danger',
      title: '利润达成严重不足',
      detail: `整体利润达成率 ${fmtPct(profRate)}，实际利润 ${fmt(total.actual_profit)} 万元 vs 预算 ${fmt(total.budget_profit)} 万元，缺口 ${fmt(total.profit_diff)} 万元。`,
    })
  }

  // Labor cost rate
  if (total.actual_labor_cost_rate != null && total.budget_labor_cost_rate != null) {
    const diff = total.actual_labor_cost_rate - total.budget_labor_cost_rate
    if (diff > 0.03) {
      insights.push({
        type: 'warning',
        title: '人力成本率超预算',
        detail: `实际人力成本率 ${fmtPct(total.actual_labor_cost_rate)} 高于预算 ${fmtPct(total.budget_labor_cost_rate)}，超出 ${(diff * 100).toFixed(1)} 个百分点，建议优化人员配置。`,
      })
    }
  }

  // Best performing unit
  const profitable = level1
    .filter(d => d.actual_profit != null && d.actual_profit > 0 && d.profit_completion_rate != null)
    .sort((a, b) => (b.profit_completion_rate ?? 0) - (a.profit_completion_rate ?? 0))
  if (profitable.length > 0) {
    const best = profitable[0]
    insights.push({
      type: 'success',
      title: `${best.node_name} 表现突出`,
      detail: `利润达成率 ${fmtPct(best.profit_completion_rate)}，实际利润 ${fmt(best.actual_profit)} 万元，超额完成 ${fmt(best.profit_diff)} 万元。`,
    })
  }

  // Worst performing units
  const underperformers = level1
    .filter(d => d.revenue_completion_rate != null && d.revenue_completion_rate < 0.70 && (d.budget_revenue ?? 0) > 100)
    .sort((a, b) => (a.revenue_completion_rate ?? 0) - (b.revenue_completion_rate ?? 0))
  for (const u of underperformers.slice(0, 2)) {
    insights.push({
      type: 'warning',
      title: `${u.node_name} 营收达成率低`,
      detail: `营收达成率 ${fmtPct(u.revenue_completion_rate)}，缺口 ${fmt(u.revenue_diff)} 万元，需加大业务拓展力度。`,
    })
  }

  // Headcount efficiency
  if (total.actual_headcount != null && total.yoy_headcount != null && total.yoy_headcount > 0) {
    const growth = ((total.actual_headcount - total.yoy_headcount) / total.yoy_headcount * 100)
    if (growth > 20) {
      insights.push({
        type: 'info',
        title: '人员规模同比大幅增长',
        detail: `当前 ${fmt(total.actual_headcount)} 人，同比增长 ${growth.toFixed(1)}%，需关注人效指标变化。`,
      })
    }
  }

  // Gross margin analysis
  if (total.gross_margin_diff != null && total.gross_margin_diff > 0.03) {
    insights.push({
      type: 'success',
      title: '毛利率优于预算',
      detail: `实际毛利率 ${fmtPct(total.actual_gross_margin)} 高于预算 ${fmtPct(total.budget_gross_margin)}，差异 +${(total.gross_margin_diff * 100).toFixed(1)} 个百分点。`,
    })
  }

  return insights
}

const INSIGHT_STYLE: Record<string, { icon: typeof AlertTriangle; bg: string; border: string; iconColor: string }> = {
  danger: { icon: AlertTriangle, bg: 'bg-error-100/60', border: 'border-error-200', iconColor: 'text-error-700' },
  warning: { icon: AlertTriangle, bg: 'bg-warning-100/60', border: 'border-warning-200', iconColor: 'text-warning-700' },
  success: { icon: TrendingUp, bg: 'bg-success-100/60', border: 'border-success-200', iconColor: 'text-success-700' },
  info: { icon: Lightbulb, bg: 'bg-accent-50', border: 'border-accent-200', iconColor: 'text-accent-600' },
}

// --- main component ---

export function BizData() {
  const [data, setData] = useState<BizDataSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'revenue' | 'profit' | 'cost'>('revenue')

  useEffect(() => {
    supabase
      .from('edu_logistics_biz_data')
      .select('*')
      .order('node_name')
      .then(({ data: rows }) => {
        // Compute node_level and parent_name from center/biz_class/org_tag
        const enriched: BizDataSnapshot[] = (rows ?? []).map(row => {
          let node_level: number
          let parent_name: string | null = null
          if (!row.center) {
            node_level = 0
          } else if (!row.biz_class) {
            node_level = 1
          } else if (!row.org_tag || row.node_name === row.biz_class) {
            node_level = 2
            parent_name = row.center
          } else {
            node_level = 3
            parent_name = row.biz_class
          }
          return { ...row, node_level, parent_name }
        })
        setData(enriched)
        setLoading(false)
      })
  }, [])

  const total = useMemo(() => data.find(d => d.node_level === 0), [data])
  const level1 = useMemo(() => data.filter(d => d.node_level === 1), [data])
  const level2 = useMemo(() => data.filter(d => d.node_level === 2), [data])
  const level3 = useMemo(() => data.filter(d => d.node_level === 3), [data])

  const insights = useMemo(() => generateInsights(total, level1), [total, level1])

  const toggleExpand = (name: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const getChildren = (parentName: string) =>
    [...level2, ...level3].filter(d => d.parent_name === parentName)

  if (loading) {
    return (
      <>
        <PageTitle breadcrumb="数据中心 / 经营数据" title="经营数据" />
        <div className="flex items-center justify-center h-64 text-gray-400">加载中...</div>
      </>
    )
  }

  const maxRevenue = Math.max(...level1.map(d => d.budget_revenue ?? 0))

  return (
    <>
      <PageTitle breadcrumb="数据中心 / 经营数据" title="经营数据" subtitle="2025学年 · 单位：万元" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="实际营收"
          value={fmt(total?.actual_revenue)}
          unit="万元"
          trend={`预算达成 ${fmtPct(total?.revenue_completion_rate)}`}
          trendUp={(total?.revenue_completion_rate ?? 0) >= 0.80}
          color={(total?.revenue_completion_rate ?? 0) >= 0.80 ? 'success' : 'warning'}
        />
        <StatCard
          label="实际利润"
          value={fmt(total?.actual_profit)}
          unit="万元"
          trend={`预算达成 ${fmtPct(total?.profit_completion_rate)}`}
          trendUp={(total?.profit_completion_rate ?? 0) >= 0.80}
          color={(total?.profit_completion_rate ?? 0) >= 0.80 ? 'success' : 'error'}
        />
        <StatCard
          label="毛利率"
          value={fmtPct(total?.actual_gross_margin)}
          trend={`预算 ${fmtPct(total?.budget_gross_margin)} | 同期 ${fmtPct(total?.yoy_gross_margin)}`}
          trendUp={(total?.gross_margin_diff ?? 0) >= 0}
          color={(total?.gross_margin_diff ?? 0) >= 0 ? 'success' : 'warning'}
        />
        <StatCard
          label="在岗人数"
          value={fmt(total?.actual_headcount)}
          unit="人"
          trend={`预算 ${fmt(total?.budget_headcount)} | 差异 ${fmt(total?.headcount_diff)}`}
          trendUp={(total?.headcount_diff ?? 0) <= 0}
          color="default"
        />
      </div>

      {/* Tab Selector */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          ['revenue', '营收分析'],
          ['profit', '利润分析'],
          ['cost', '成本分析'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === key
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Data Table */}
      <div className="bg-surface rounded-lg border border-gray-200 shadow-card mb-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600 min-w-[180px]">业务板块</th>
                {activeTab === 'revenue' && (
                  <>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">实际营收</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">预算营收</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600 min-w-[100px]">达成率</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">预实差异</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">同期营收</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600 min-w-[120px]">营收占比</th>
                  </>
                )}
                {activeTab === 'profit' && (
                  <>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">实际利润</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">预算利润</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600 min-w-[100px]">达成率</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">利润率</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">毛利率</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">同期利润</th>
                  </>
                )}
                {activeTab === 'cost' && (
                  <>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">人力成本</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">人力成本率</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">其他成本</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">在岗人数</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">预算人数</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">人数差异</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {level1.map(row => {
                const children = getChildren(row.node_name)
                const isExpanded = expandedNodes.has(row.node_name)
                const hasChildren = children.length > 0

                return (
                  <TableGroup
                    key={row.node_name}
                    row={row}
                    children={children}
                    isExpanded={isExpanded}
                    hasChildren={hasChildren}
                    onToggle={() => toggleExpand(row.node_name)}
                    activeTab={activeTab}
                    maxRevenue={maxRevenue}
                    totalRevenue={total?.actual_revenue ?? 1}
                    level={0}
                    allData={data}
                    expandedNodes={expandedNodes}
                    onToggleChild={toggleExpand}
                  />
                )
              })}
              {/* Total row */}
              {total && (
                <tr className="bg-primary-50 font-semibold border-t-2 border-primary-200">
                  <td className="py-3 px-4 text-primary-700">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={16} />
                      {total.node_name}
                    </div>
                  </td>
                  <DataCells row={total} activeTab={activeTab} maxRevenue={maxRevenue} totalRevenue={total.actual_revenue ?? 1} isTotal />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Smart Analysis */}
      {insights.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={18} className="text-accent" />
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

// --- Table sub-components ---

function TableGroup({
  row, children, isExpanded, hasChildren, onToggle, activeTab, maxRevenue, totalRevenue, level, allData, expandedNodes, onToggleChild,
}: {
  row: BizDataSnapshot
  children: BizDataSnapshot[]
  isExpanded: boolean
  hasChildren: boolean
  onToggle: () => void
  activeTab: 'revenue' | 'profit' | 'cost'
  maxRevenue: number
  totalRevenue: number
  level: number
  allData: BizDataSnapshot[]
  expandedNodes: Set<string>
  onToggleChild: (name: string) => void
}) {
  return (
    <>
      <tr
        className={`hover:bg-gray-50/60 transition-colors ${hasChildren ? 'cursor-pointer' : ''} ${level === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
        onClick={hasChildren ? onToggle : undefined}
      >
        <td className="py-2.5 px-4">
          <div className="flex items-center gap-1.5" style={{ paddingLeft: level * 20 }}>
            {hasChildren ? (
              isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />
            ) : (
              <span className="w-3.5" />
            )}
            <span className={`${level === 0 ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
              {row.node_name}
            </span>
            {row.revenue_completion_rate != null && row.revenue_completion_rate < 0.70 && (row.budget_revenue ?? 0) > 50 && (
              <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
            )}
          </div>
        </td>
        <DataCells row={row} activeTab={activeTab} maxRevenue={maxRevenue} totalRevenue={totalRevenue} />
      </tr>
      {isExpanded && children.map(child => {
        const grandChildren = allData.filter(d => d.parent_name === child.node_name && (d.node_level ?? 0) > (child.node_level ?? 0))
        const childExpanded = expandedNodes.has(child.node_name)
        if (grandChildren.length > 0) {
          return (
            <TableGroup
              key={child.node_name}
              row={child}
              children={grandChildren}
              isExpanded={childExpanded}
              hasChildren
              onToggle={() => onToggleChild(child.node_name)}
              activeTab={activeTab}
              maxRevenue={maxRevenue}
              totalRevenue={totalRevenue}
              level={level + 1}
              allData={allData}
              expandedNodes={expandedNodes}
              onToggleChild={onToggleChild}
            />
          )
        }
        return (
          <tr key={child.node_name} className="hover:bg-gray-50/40 transition-colors bg-gray-50/20">
            <td className="py-2 px-4">
              <div className="flex items-center gap-1.5" style={{ paddingLeft: (level + 1) * 20 }}>
                <span className="w-3.5" />
                <span className="text-gray-600 text-xs">{child.node_name}</span>
              </div>
            </td>
            <DataCells row={child} activeTab={activeTab} maxRevenue={maxRevenue} totalRevenue={totalRevenue} />
          </tr>
        )
      })}
    </>
  )
}

function DataCells({
  row, activeTab, maxRevenue, totalRevenue, isTotal,
}: {
  row: BizDataSnapshot
  activeTab: 'revenue' | 'profit' | 'cost'
  maxRevenue: number
  totalRevenue: number
  isTotal?: boolean
}) {
  const cls = isTotal ? 'text-primary-700' : 'text-gray-700'
  const clsSub = isTotal ? 'text-primary-500' : 'text-gray-500'

  if (activeTab === 'revenue') {
    const share = totalRevenue > 0 && row.actual_revenue ? ((row.actual_revenue / totalRevenue) * 100) : 0
    return (
      <>
        <td className={`text-right py-2.5 px-4 tabular-nums font-medium ${cls}`}>{fmt(row.actual_revenue)}</td>
        <td className={`text-right py-2.5 px-4 tabular-nums ${clsSub}`}>{fmt(row.budget_revenue)}</td>
        <td className="text-right py-2.5 px-4">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${rateBg(row.revenue_completion_rate)}`}>
            {fmtPct(row.revenue_completion_rate)}
          </span>
        </td>
        <td className={`text-right py-2.5 px-4 tabular-nums ${cls}`}>
          {fmt(row.revenue_diff)} {diffArrow(row.revenue_diff)}
        </td>
        <td className={`text-right py-2.5 px-4 tabular-nums ${clsSub}`}>{fmt(row.yoy_revenue)}</td>
        <td className="py-2.5 px-4">
          {!isTotal && row.node_level === 1 && (
            <div className="flex items-center gap-2">
              <MiniBar value={row.actual_revenue ?? 0} max={maxRevenue} />
              <span className="text-xs text-gray-500 w-10 text-right">{share.toFixed(1)}%</span>
            </div>
          )}
        </td>
      </>
    )
  }

  if (activeTab === 'profit') {
    return (
      <>
        <td className={`text-right py-2.5 px-4 tabular-nums font-medium ${(row.actual_profit ?? 0) < 0 ? 'text-error-700' : cls}`}>
          {fmt(row.actual_profit)}
        </td>
        <td className={`text-right py-2.5 px-4 tabular-nums ${clsSub}`}>{fmt(row.budget_profit)}</td>
        <td className="text-right py-2.5 px-4">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${rateBg(row.profit_completion_rate)}`}>
            {fmtPct(row.profit_completion_rate)}
          </span>
        </td>
        <td className={`text-right py-2.5 px-4 tabular-nums ${rateColor(row.actual_profit_margin)}`}>
          {fmtPct(row.actual_profit_margin)}
        </td>
        <td className={`text-right py-2.5 px-4 tabular-nums ${cls}`}>{fmtPct(row.actual_gross_margin)}</td>
        <td className={`text-right py-2.5 px-4 tabular-nums ${clsSub}`}>{fmt(row.yoy_profit)}</td>
      </>
    )
  }

  // cost tab
  return (
    <>
      <td className={`text-right py-2.5 px-4 tabular-nums ${cls}`}>{fmt(row.actual_labor_cost)}</td>
      <td className={`text-right py-2.5 px-4 tabular-nums ${rateColor(row.actual_labor_cost_rate != null && row.actual_labor_cost_rate <= (row.budget_labor_cost_rate ?? 1) ? 0.90 : 0.60)}`}>
        {fmtPct(row.actual_labor_cost_rate)}
      </td>
      <td className={`text-right py-2.5 px-4 tabular-nums ${cls}`}>{fmt(row.actual_other_cost)}</td>
      <td className={`text-right py-2.5 px-4 tabular-nums ${cls}`}>{fmt(row.actual_headcount)}</td>
      <td className={`text-right py-2.5 px-4 tabular-nums ${clsSub}`}>{fmt(row.budget_headcount)}</td>
      <td className={`text-right py-2.5 px-4 tabular-nums ${(row.headcount_diff ?? 0) > 0 ? 'text-warning-700' : cls}`}>
        {fmt(row.headcount_diff)} {diffArrow(row.headcount_diff)}
      </td>
    </>
  )
}
