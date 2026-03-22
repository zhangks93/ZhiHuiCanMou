import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bot, Calendar, Sparkles } from 'lucide-react'
import { ROUTES } from '@/config/constants'
import { PageTitle } from '@/components/ui/PageTitle'
import { StatCard } from '@/components/ui/StatCard'
import { supabase } from '@/lib/supabase'

const PERIOD_LABEL: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
}

const TYPE_TAG: Record<string, { label: string; cls: string }> = {
  meeting: { label: '会议', cls: 'bg-error-100 text-error-700' },
  business: { label: '商务', cls: 'bg-accent-100 text-accent-700' },
  routine: { label: '例行', cls: 'bg-primary-100 text-[var(--color-text)]' },
  urgent: { label: '紧急', cls: 'bg-error-100 text-error-700' },
}

const barColorMap = {
  ok: 'bg-success',
  warn: 'bg-warning',
  error: 'bg-error',
}

interface OverallStats {
  headcount: number
  revenueRate: number
  profitRate: number
  yoyRevenue: number
  createdAt: string | null
}

interface ScheduleRow {
  id: string
  title: string
  period: string
  type: string | null
  description: string | null
  location: string | null
  created_at: string | null
}

interface CenterWarning {
  name: string
  value: number
  status: 'ok' | 'warn' | 'error'
}

interface OpportunitySummary {
  latestSnapshotDate: string | null
  activeCount: number
  weightedAmount: number
  lastUpdated: string | null
}

function fmtToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function asRate(v: number | null | undefined): number {
  if (v == null || Number.isNaN(v)) return 0
  return Math.round(Number(v) * 10000) / 100
}

export function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<OverallStats | null>(null)
  const [todaySchedules, setTodaySchedules] = useState<ScheduleRow[]>([])
  const [warnings, setWarnings] = useState<CenterWarning[]>([])
  const [opportunitySummary, setOpportunitySummary] = useState<OpportunitySummary>({
    latestSnapshotDate: null,
    activeCount: 0,
    weightedAmount: 0,
    lastUpdated: null,
  })

  useEffect(() => {
    const today = fmtToday()

    async function loadDashboard() {
      try {
        const [bizRes, scheduleRes, warningRes, opportunityRes, membersRes] = await Promise.all([
          supabase
            .from('edu_logistics_biz_data')
            .select('revenue_completion_rate,profit_completion_rate,yoy_revenue,created_at')
            .is('center', null)
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('schedule_items')
            .select('id,title,period,type,description,location,created_at')
            .eq('date', today)
            .order('period'),
          supabase
            .from('edu_logistics_biz_data')
            .select('node_name,revenue_completion_rate')
            .not('center', 'is', null)
            .is('biz_class', null)
            .not('revenue_completion_rate', 'is', null),
          supabase
            .from('opportunity_ledger')
            .select('snapshot_date,status,estimated_amount,win_probability,updated_at')
            .order('snapshot_date', { ascending: false })
            .limit(500),
          supabase.from('feishu_members').select('user_id'),
        ])

        if (!bizRes.error && bizRes.data?.[0]) {
          const row = bizRes.data[0]
          setStats({
            headcount: membersRes.data?.length ?? 0,
            revenueRate: asRate(Number(row.revenue_completion_rate)),
            profitRate: asRate(Number(row.profit_completion_rate)),
            yoyRevenue: Math.round((Number(row.yoy_revenue) || 0) * 100) / 100,
            createdAt: row.created_at ?? null,
          })
        } else if (!membersRes.error) {
          setStats({
            headcount: membersRes.data?.length ?? 0,
            revenueRate: 0,
            profitRate: 0,
            yoyRevenue: 0,
            createdAt: null,
          })
        }

        if (!scheduleRes.error) {
          setTodaySchedules((scheduleRes.data as ScheduleRow[]) ?? [])
        }

        if (!warningRes.error && warningRes.data) {
          const rows = warningRes.data
            .map((r) => {
              const value = asRate(Number(r.revenue_completion_rate))
              return {
                name: r.node_name as string,
                value,
                status: value >= 85 ? 'ok' : value >= 70 ? 'warn' : 'error',
              } as CenterWarning
            })
            .sort((a, b) => a.value - b.value)
            .slice(0, 6)

          setWarnings(rows)
        }

        if (!opportunityRes.error && opportunityRes.data) {
          const rows = opportunityRes.data as Array<{
            snapshot_date: string | null
            status: string | null
            estimated_amount: number | null
            win_probability: number | null
            updated_at: string | null
          }>

          const latestSnapshotDate = rows[0]?.snapshot_date ?? null
          const latestRows = latestSnapshotDate ? rows.filter((r) => r.snapshot_date === latestSnapshotDate) : []

          const activeCount = latestRows.filter((r) => r.status === 'tracking').length
          const weightedAmount = latestRows.reduce((sum, r) => {
            const amount = Number(r.estimated_amount) || 0
            const probability = Number(r.win_probability) || 0
            return sum + amount * probability
          }, 0)

          const lastUpdated =
            latestRows
              .map((r) => r.updated_at)
              .filter(Boolean)
              .sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0] ?? null

          setOpportunitySummary({
            latestSnapshotDate,
            activeCount,
            weightedAmount,
            lastUpdated: lastUpdated ?? latestSnapshotDate,
          })
        }
      } catch (error) {
        console.error('Failed to load dashboard:', error)
      }
    }

    void loadDashboard()
  }, [])

  return (
    <div className="app-page">
      <PageTitle
        title="运营驾驶舱"
        subtitle="围绕经营、组织、日程与智能分析重新组织首页布局，所有高频入口统一为导航栏同源的冷蓝磨砂语言。"
        badge="Overview"
        icon={Sparkles}
        meta={[
          { label: '人员规模', value: stats ? `${stats.headcount} 人` : '-' },
          { label: '今日日程', value: `${todaySchedules.length} 项` },
          { label: '在途商机', value: `${opportunitySummary.activeCount}` },
        ]}
        actions={
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(ROUTES.BIZ_DATA)}>
              查看经营面板
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(ROUTES.AI_ANALYSIS)}>
              打开 AI 分析
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="营收达成"
          value={stats ? `${stats.revenueRate.toFixed(1)}%` : '-'}
          trend={stats?.createdAt ? `更新于 ${stats.createdAt.slice(0, 10)}` : '等待最新数据'}
          trendUp
          onClick={() => navigate(ROUTES.BIZ_DATA)}
        />
        <StatCard
          label="利润达成"
          value={stats ? `${stats.profitRate.toFixed(1)}%` : '-'}
          trend={stats ? `同比 ${stats.yoyRevenue.toFixed(2)}` : '等待最新数据'}
          color="warning"
          onClick={() => navigate(ROUTES.BIZ_DATA)}
        />
        <StatCard
          label="组织在岗"
          value={stats ? stats.headcount.toLocaleString('zh-CN') : '-'}
          unit="人"
          color="success"
          onClick={() => navigate(ROUTES.ORG_DATA)}
        />
        <StatCard
          label="活跃商机"
          value={opportunitySummary.activeCount}
          unit="项"
          trend={
            opportunitySummary.lastUpdated
              ? `快照 ${opportunitySummary.lastUpdated.slice(0, 10)}`
              : '暂无快照'
          }
          onClick={() => navigate(ROUTES.OPPORTUNITY)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_0.95fr]">
        <section className="app-section-card p-5 sm:p-6">
          <div className="app-section-header mb-4">
            <div>
              <div className="app-section-kicker">Daily Focus</div>
              <div className="app-section-title mt-2">
                <Calendar size={18} className="text-accent" />
                <h3 className="text-lg font-semibold">今日重点安排</h3>
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(ROUTES.SCHEDULE)}>
              查看全部
            </button>
          </div>

          {todaySchedules.length === 0 ? (
            <div className="app-empty-state">
              <Calendar size={28} className="text-[var(--color-text-muted)]/60" />
              <p className="text-sm">今日暂无日程安排</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaySchedules.slice(0, 4).map((row) => {
                const tag = TYPE_TAG[row.type || ''] || TYPE_TAG.routine
                const isUrgent = row.type === 'urgent' || row.type === 'meeting'

                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => navigate(ROUTES.SCHEDULE)}
                    className={[
                      'flex w-full items-start gap-3 rounded-[22px] border p-4 text-left transition-all duration-200',
                      isUrgent
                        ? 'border-error-200 bg-error-50 hover:shadow-[0_18px_44px_rgba(220,38,38,0.08)]'
                        : 'border-accent-200 bg-accent-50 hover:shadow-[0_18px_44px_rgba(37,99,235,0.08)]',
                    ].join(' ')}
                  >
                    <div className="min-w-[60px] rounded-2xl bg-white/70 px-3 py-2 text-center">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                        时段
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[var(--color-text-strong)]">
                        {PERIOD_LABEL[row.period] || row.period}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-semibold text-[var(--color-text-strong)]">
                          {row.title}
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${tag.cls}`}>
                          {tag.label}
                        </span>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                        {[row.location, row.description].filter(Boolean).join(' · ') || '暂无附加说明'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="app-section-card p-5 sm:p-6">
          <div className="app-section-header mb-4">
            <div>
              <div className="app-section-kicker">Risk Radar</div>
              <div className="app-section-title mt-2">
                <AlertTriangle size={18} className="text-warning" />
                <h3 className="text-lg font-semibold">营收预警</h3>
              </div>
            </div>
            <span className="app-pill app-pill-warning">{warnings.length} 项关注</span>
          </div>

          {warnings.length === 0 ? (
            <div className="app-empty-state">
              <AlertTriangle size={28} className="text-[var(--color-text-muted)]/60" />
              <p className="text-sm">暂无预警数据</p>
            </div>
          ) : (
            <div className="space-y-3">
              {warnings.slice(0, 4).map((warning) => (
                <div key={warning.name} className="rounded-[22px] border border-[var(--color-border)] bg-white/72 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[var(--color-text-strong)]">{warning.name}</span>
                    <span className="text-sm font-semibold text-[var(--color-text-strong)]">{warning.value}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[rgba(15,23,42,0.08)]">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColorMap[warning.status]}`}
                      style={{ width: `${Math.min(warning.value, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="app-section-card app-section-card-muted p-5 sm:p-6">
        <div className="app-section-header mb-4">
          <div>
            <div className="app-section-kicker">Intelligence</div>
            <div className="app-section-title mt-2">
              <Bot size={18} className="text-accent" />
              <h3 className="text-lg font-semibold">智能分析入口</h3>
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(ROUTES.AI_ANALYSIS)}>
            进入分析会话
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[24px] border border-[var(--color-border)] bg-white/78 p-5">
            <p className="text-sm leading-7 text-[var(--color-text-muted)]">
              基于经营数据、商机台账、组织结构与月度计划，首页把关键入口收束为同一套分析路径。你可以直接进入 AI 模块，生成异常分析、部门对比或管理层摘要。
            </p>
          </div>
          <div className="rounded-[24px] border border-accent-200 bg-accent-50 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-700">Recommended</div>
            <div className="mt-2 text-base font-semibold text-[var(--color-text-strong)]">
              优先处理营收预警与日程冲突
            </div>
            <div className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
              先查看预警中心，再把高优先任务同步给 AI 输出行动建议。
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
