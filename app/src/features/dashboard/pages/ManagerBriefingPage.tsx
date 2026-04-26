import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarDays, Inbox, Sparkles, TrendingUp } from 'lucide-react'
import { buildWorkspaceHref } from '@/app/config/constants'
import { listIncomingScheduleTransfers } from '@/features/schedule/api/scheduleTransferRepository'
import { fetchScheduleItemsByRange, type ScheduleItem } from '@/features/schedule/api/scheduleRepository'
import { fetchOpportunitySnapshotDates, fetchOpportunitySnapshotItems } from '@/features/opportunity/api/opportunityRepository'
import type { OpportunitySnapshotItem } from '@/features/opportunity/types'
import { loadAvailableMonths } from '@/features/biz-data/api/bizDataRepository'
import { DataEmptyState, DataErrorState, DataFreshnessBadge, DataLoadingState } from '@/shared/components/data-state'

interface BriefingState {
  loading: boolean
  error: string | null
  todayItems: ScheduleItem[]
  pendingInboxCount: number
  latestSnapshotDate: string | null
  topOpportunities: OpportunitySnapshotItem[]
  latestBizMonth: string | null
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function formatMonthLabel(value: string | null) {
  if (!value) return null
  return value.replace(/^(\d{4})(\d{2})$/, '$1-$2')
}

function formatMoney(value: number | null) {
  if (value == null) return '-'
  return `${value.toLocaleString('zh-CN')} 万`
}

export function ManagerBriefingPage() {
  const [state, setState] = useState<BriefingState>({
    loading: true,
    error: null,
    todayItems: [],
    pendingInboxCount: 0,
    latestSnapshotDate: null,
    topOpportunities: [],
    latestBizMonth: null,
  })

  useEffect(() => {
    let cancelled = false

    async function loadBriefing() {
      const today = formatDate(new Date())

      try {
        const [todayItems, incoming, snapshotDates, cumulativeMonths] = await Promise.all([
          fetchScheduleItemsByRange(today, today),
          listIncomingScheduleTransfers(),
          fetchOpportunitySnapshotDates(),
          loadAvailableMonths({ periodType: 'cumulative', reportType: 'fone' }),
        ])

        const latestSnapshotDate = snapshotDates[0] ?? null
        const topOpportunities = latestSnapshotDate
          ? await fetchOpportunitySnapshotItems(latestSnapshotDate)
          : []

        if (cancelled) return

        setState({
          loading: false,
          error: null,
          todayItems,
          pendingInboxCount: incoming.filter((item) => item.status === 'pending').length,
          latestSnapshotDate,
          topOpportunities: [...topOpportunities]
            .sort((left, right) => (right.first_year_revenue ?? 0) - (left.first_year_revenue ?? 0))
            .slice(0, 3),
          latestBizMonth: cumulativeMonths[0] ?? null,
        })
      } catch (error) {
        if (cancelled) return
        setState((previous) => ({
          ...previous,
          loading: false,
          error: error instanceof Error ? error.message : '经营简报加载失败，请稍后重试。',
        }))
      }
    }

    void loadBriefing()

    return () => {
      cancelled = true
    }
  }, [])

  const quickQuestions = useMemo(() => {
    const bizMonth = formatMonthLabel(state.latestBizMonth) ?? '最近一期'
    const snapshotDate = state.latestSnapshotDate?.slice(0, 10) ?? '最近快照'
    const inboxNote = `当前收件箱待处理 ${state.pendingInboxCount} 份日程包`

    return [
      `基于经营数据 ${bizMonth}，帮我总结本月收入异常的部门和优先处理顺序。`,
      `基于商机快照 ${snapshotDate}，有哪些商机超过 30 天未推进，按风险从高到低列出。`,
      `结合今日 ${state.todayItems.length} 条日程和收件箱状态（${inboxNote}），帮我整理今天的管理重点。`,
    ]
  }, [state.latestBizMonth, state.latestSnapshotDate, state.pendingInboxCount, state.todayItems.length])

  if (state.loading) {
    return <DataLoadingState label="正在生成今日经营简报..." />
  }

  if (state.error) {
    return <DataErrorState message={state.error} />
  }

  return (
    <div className="grid grid-cols-1 gap-5">
      <section className="app-table-shell p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-caption uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Manager Briefing</div>
            <h2 className="mt-2 text-title font-semibold text-[var(--color-text-strong)]">今日经营简报</h2>
            <p className="mt-1 text-body text-[var(--color-text-muted)]">
              默认聚焦今天的日程、待处理协作、商机风险与最新经营数据入口。
            </p>
          </div>
          <div className="flex flex-col items-start gap-2">
            <DataFreshnessBadge source="Supabase / 本地日程" updatedAt={formatMonthLabel(state.latestBizMonth) ?? state.latestSnapshotDate ?? undefined} />
            <Link to={buildWorkspaceHref('inbox')} className="btn btn-sm">
              查看收件箱
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <section className="app-table-shell p-5">
          <div className="flex items-center gap-2 text-[var(--color-text-strong)]">
            <CalendarDays size={18} />
            <h3 className="font-medium">今日日程</h3>
          </div>
          <div className="mt-3 text-caption text-[var(--color-text-muted)]">{state.todayItems.length} 条安排</div>
          {state.todayItems.length === 0 ? (
            <DataEmptyState title="今日暂无已登记日程" description="可从飞书日程导入，或直接在本地新增安排。" />
          ) : (
            <div className="mt-4 space-y-3">
              {state.todayItems.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-2xl bg-primary-50/70 px-3 py-3">
                  <div className="font-medium text-[var(--color-text-strong)]">{item.title}</div>
                  <div className="mt-1 text-caption text-[var(--color-text-muted)]">
                    {item.date} · {item.start_time ?? '未设置时间'} {item.location ? `· ${item.location}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="app-table-shell p-5">
          <div className="flex items-center gap-2 text-[var(--color-text-strong)]">
            <Inbox size={18} />
            <h3 className="font-medium">协作提醒</h3>
          </div>
          <div className="mt-4 rounded-[22px] border border-[var(--color-border)] bg-white/86 p-4">
            <div className="text-caption text-[var(--color-text-muted)]">待接收日程包</div>
            <div className="mt-2 text-[32px] font-semibold leading-none text-[var(--color-text-strong)]">
              {state.pendingInboxCount}
            </div>
            <div className="mt-3 text-body text-[var(--color-text-muted)]">
              导入后仅生成当前设备的本地副本，不会自动与发件人继续同步。
            </div>
          </div>
          <div className="mt-4 rounded-[22px] border border-[var(--color-border)] bg-white/86 p-4">
            <div className="text-caption text-[var(--color-text-muted)]">经营数据最新期间</div>
            <div className="mt-2 text-body font-medium text-[var(--color-text-strong)]">
              {formatMonthLabel(state.latestBizMonth) ?? '暂无可用期间'}
            </div>
          </div>
        </section>

        <section className="app-table-shell p-5">
          <div className="flex items-center gap-2 text-[var(--color-text-strong)]">
            <TrendingUp size={18} />
            <h3 className="font-medium">Top 商机</h3>
          </div>
          <div className="mt-3 text-caption text-[var(--color-text-muted)]">
            最新快照：{state.latestSnapshotDate?.slice(0, 10) ?? '暂无'}
          </div>
          {state.topOpportunities.length === 0 ? (
            <DataEmptyState title="暂无商机快照" description="导入商机台账后，这里会显示首年营收最高的项目。" />
          ) : (
            <div className="mt-4 space-y-3">
              {state.topOpportunities.map((item) => (
                <div key={item.id} className="rounded-[20px] border border-[var(--color-border)] bg-white/86 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-[var(--color-text-strong)]">{item.project_name}</div>
                      <div className="mt-1 text-caption text-[var(--color-text-muted)]">
                        {item.region ?? '未分区域'} · {item.stage_label}
                      </div>
                    </div>
                    <div className="text-body font-semibold text-[var(--color-text-strong)]">
                      {formatMoney(item.first_year_revenue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="app-table-shell p-5 sm:p-6">
        <div className="flex items-center gap-2 text-[var(--color-text-strong)]">
          <Sparkles size={18} />
          <h3 className="font-medium">AI 快捷问题</h3>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
          {quickQuestions.map((prompt) => (
            <Link
              key={prompt}
              to={`/ai/financial-analysis?prompt=${encodeURIComponent(prompt)}`}
              className="rounded-[20px] border border-[var(--color-border)] bg-white/86 px-4 py-4 text-body text-[var(--color-text-strong)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.06)]"
            >
              {prompt}
            </Link>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-primary-50/70 px-4 py-3 text-caption text-[var(--color-text-muted)]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          AI 助手会基于对应模块的当前数据上下文生成建议，但不会自动执行任何业务动作。
        </div>
      </section>
    </div>
  )
}
