import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/config/constants'
import { PageTitle } from '@/components/ui/PageTitle'
import { StatCard } from '@/components/ui/StatCard'
import { supabase } from '@/lib/supabase'
import { loadSessions, loadSessionMessages } from '@/lib/agent/memory'
import { Calendar, AlertTriangle, Bot, MessageSquare } from 'lucide-react'

const PERIOD_LABEL: Record<string, string> = { morning: '上午', afternoon: '下午', evening: '晚上' }
const TYPE_TAG: Record<string, { label: string; cls: string }> = {
  meeting: { label: '会议', cls: 'bg-error-100 text-error-700' },
  business: { label: '商务', cls: 'bg-accent-100 text-accent-700' },
  routine: { label: '例行', cls: 'bg-gray-100 text-gray-600' },
  urgent: { label: '紧急', cls: 'bg-error-100 text-error-700' },
}

const barColorMap = { ok: 'bg-success', warn: 'bg-warning', error: 'bg-error' }

function fmtToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface OverallStats {
  headcount: number
  revenueRate: number
  profitRate: number
  yoyRevenue: number
}

interface ScheduleRow {
  id: string; title: string; period: string; type: string | null; description: string | null; location: string | null
}

interface CenterWarning {
  name: string; value: number; status: 'ok' | 'warn' | 'error'
}

interface SessionSummary {
  id: string; title: string; updatedAt: number; lastUserMsg: string; lastAssistantMsg: string
}

export function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<OverallStats | null>(null)
  const [oppCount, setOppCount] = useState<number>(0)
  const [todaySchedules, setTodaySchedules] = useState<ScheduleRow[]>([])
  const [warnings, setWarnings] = useState<CenterWarning[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])

  useEffect(() => {
    // Fetch overall stats (level 0 = no center)
    supabase.from('edu_logistics_biz_data').select('actual_headcount,revenue_completion_rate,profit_completion_rate,yoy_revenue').is('center', null).limit(1)
      .then(({ data }) => {
        if (data?.[0]) {
          const r = data[0]
          setStats({
            headcount: Math.round(Number(r.actual_headcount) || 0),
            revenueRate: Math.round((Number(r.revenue_completion_rate) || 0) * 10000) / 100,
            profitRate: Math.round((Number(r.profit_completion_rate) || 0) * 10000) / 100,
            yoyRevenue: Math.round((Number(r.yoy_revenue) || 0) * 100) / 100,
          })
        }
      })

    // Fetch active opportunities count
    supabase.from('opportunity_ledger').select('id', { count: 'exact', head: true })
      .in('status', ['tracking', 'bidding', 'contracted', 'operating'])
      .then(({ count }) => setOppCount(count || 0))

    // Fetch today's schedules
    supabase.from('schedule_items').select('id,title,period,type,description,location')
      .eq('date', fmtToday()).order('period')
      .then(({ data }) => setTodaySchedules((data as ScheduleRow[]) || []))

    // Fetch center-level warnings (level 1 = has center, no biz_class)
    supabase.from('edu_logistics_biz_data').select('node_name,revenue_completion_rate').not('center', 'is', null).is('biz_class', null)
      .then(({ data }) => {
        if (data) {
          setWarnings(data.map(r => {
            const v = Math.round((Number(r.revenue_completion_rate) || 0) * 10000) / 100
            return { name: r.node_name, value: v, status: v >= 85 ? 'ok' as const : v >= 70 ? 'warn' as const : 'error' as const }
          }).sort((a, b) => a.value - b.value))
        }
      })

    // Load recent chat sessions
    const allSessions = loadSessions().slice(0, 5)
    const summaries: SessionSummary[] = allSessions.map(s => {
      const msgs = loadSessionMessages(s.id)
      const lastUser = [...msgs].reverse().find(m => m.role === 'user')
      const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant' && m.content)
      return {
        id: s.id,
        title: s.title,
        updatedAt: s.updatedAt,
        lastUserMsg: lastUser?.content || '',
        lastAssistantMsg: lastAssistant?.content?.slice(0, 120) || '',
      }
    }).filter(s => s.lastUserMsg)
    setSessions(summaries)
  }, [])

  const revenueColor = stats && stats.revenueRate >= 85 ? 'success' : stats && stats.revenueRate >= 70 ? 'warning' : 'error'
  const revenueTrend = stats ? `${stats.yoyRevenue >= 0 ? '▲' : '▼'} 同比 ${stats.yoyRevenue >= 0 ? '+' : ''}${stats.yoyRevenue}%` : ''

  return (
    <>
      <PageTitle
        breadcrumb="首页 / 总览"
        title="今日总览"
        subtitle={`数据更新：${new Date().toLocaleString('zh-CN')}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 [&>*]:animate-slide-up [&>*:nth-child(2)]:[animation-delay:75ms] [&>*:nth-child(3)]:[animation-delay:150ms] [&>*:nth-child(4)]:[animation-delay:225ms]">
        <StatCard
          label="集团总人数"
          value={stats ? stats.headcount.toLocaleString() : '—'}
          unit="人"
          onClick={() => navigate(ROUTES.ORG_DATA)}
        />
        <StatCard
          label="营收达成率"
          value={stats ? stats.revenueRate : '—'}
          unit="%"
          trend={revenueTrend}
          trendUp={stats ? stats.yoyRevenue >= 0 : undefined}
          color={revenueColor as 'success' | 'warning' | 'error'}
          onClick={() => navigate(ROUTES.BIZ_DATA)}
        />
        <StatCard
          label="进行中商机"
          value={oppCount}
          unit="项"
          color="success"
          onClick={() => navigate(ROUTES.OPPORTUNITY)}
        />
        <StatCard
          label="利润达成率"
          value={stats ? stats.profitRate : '—'}
          unit="%"
          trend={stats && stats.profitRate < 80 ? '⚠ 低于预期' : ''}
          trendUp={stats ? stats.profitRate >= 80 : undefined}
          color={stats && stats.profitRate >= 85 ? 'success' : stats && stats.profitRate >= 70 ? 'warning' : 'error'}
          onClick={() => navigate(ROUTES.BIZ_DATA)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-surface rounded-xl border border-[var(--color-border)] p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} strokeWidth={1.5} className="text-accent" />
            <h3 className="font-medium text-[var(--color-text-strong)] font-serif">今日日程（{todaySchedules.length}条）</h3>
          </div>
          {todaySchedules.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">今日暂无日程安排</p>
          ) : (
            <div className="space-y-2">
              {todaySchedules.map((r) => {
                const tag = TYPE_TAG[r.type || ''] || TYPE_TAG.routine
                const isUrgent = r.type === 'urgent' || r.type === 'meeting'
                return (
                  <div
                    key={r.id}
                    onClick={() => navigate(ROUTES.SCHEDULE)}
                    className={`flex gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200
                      ${isUrgent ? 'bg-error-100/50 border-l-[3px] border-error' : 'bg-primary-50/80 border-l-[3px] border-accent'}
                      hover:bg-primary-50`}
                  >
                    <div className="text-[var(--color-text-muted)] font-medium text-sm whitespace-nowrap">{PERIOD_LABEL[r.period] || r.period}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[var(--color-text-strong)] truncate">{r.title}</div>
                      <div className="text-sm text-[var(--color-text-muted)] truncate">{[r.location, r.description].filter(Boolean).join(' · ') || '—'}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${tag.cls}`}>{tag.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-surface rounded-xl border border-[var(--color-border)] p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} strokeWidth={1.5} className="text-accent" />
            <h3 className="font-medium text-[var(--color-text-strong)] font-serif">经营预警 · 各中心营收达成</h3>
          </div>
          {warnings.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">加载中...</p>
          ) : (
            <div className="space-y-4">
              {warnings.map((w) => (
                <div key={w.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[var(--color-text-muted)]">{w.name}</span>
                    <span className="font-medium text-[var(--color-text-strong)]">{w.value}%</span>
                  </div>
                  <div className="w-full h-2 bg-primary-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColorMap[w.status]}`} style={{ width: `${Math.min(w.value, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-[var(--color-border)] p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot size={18} strokeWidth={1.5} className="text-accent" />
            <h3 className="font-medium text-[var(--color-text-strong)] font-serif">智能分析 · 近期对话</h3>
          </div>
          <button onClick={() => navigate(ROUTES.AI_ANALYSIS)} className="text-xs text-accent hover:underline">查看全部</button>
        </div>
        {sessions.length === 0 ? (
          <div className="text-center py-8">
            <Bot size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400 mb-2">暂无分析记录</p>
            <button onClick={() => navigate(ROUTES.AI_ANALYSIS)} className="text-xs text-accent hover:underline">开始智能分析</button>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => navigate(ROUTES.AI_ANALYSIS)}
                className="p-4 rounded-lg border-l-[3px] border-l-accent bg-accent-50/50 cursor-pointer hover:bg-accent-50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare size={13} className="text-accent shrink-0" />
                  <span className="font-medium text-[var(--color-text-strong)] text-sm truncate">{s.title}</span>
                  <span className="text-[10px] text-gray-400 ml-auto shrink-0">{new Date(s.updatedAt).toLocaleDateString('zh-CN')}</span>
                </div>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed line-clamp-2">{s.lastAssistantMsg || s.lastUserMsg}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
