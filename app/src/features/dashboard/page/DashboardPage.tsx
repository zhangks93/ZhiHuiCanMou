import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bot, Calendar, Sparkles } from 'lucide-react'
import { ROUTES } from '@/config/constants'
import { PageTitle } from '@/components/ui/PageTitle'
import { StatCard } from '@/components/ui/StatCard'
import { useDashboardData } from '../hooks/useDashboardData'

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

export function DashboardPage() {
  const navigate = useNavigate()
  const { stats, todaySchedules, warnings, opportunitySummary } = useDashboardData()

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
