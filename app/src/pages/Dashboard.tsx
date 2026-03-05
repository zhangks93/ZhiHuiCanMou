import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/config/constants'
import { supabase } from '@/lib/supabase'
import { loadSessionMessages, loadSessions } from '@/lib/agent/memory'
import {
  AlertTriangle,
  Bot,
  Calendar,
  MessageSquare,
} from 'lucide-react'

const PERIOD_LABEL: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
}

const TYPE_TAG: Record<string, { label: string; cls: string }> = {
  meeting: { label: '会议', cls: 'bg-error-100 text-error-700' },
  business: { label: '商务', cls: 'bg-accent-100 text-accent-700' },
  routine: { label: '例行', cls: 'bg-gray-100 text-gray-600' },
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

interface SessionSummary {
  id: string
  title: string
  updatedAt: number
  lastUserMsg: string
  lastAssistantMsg: string
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

function toPercent(v: number | null | undefined): number {
  if (v == null || Number.isNaN(v)) return 0
  return v > 1 ? v : v * 100
}

function asRate(v: number | null | undefined): number {
  return Math.round(toPercent(v) * 100) / 100
}

function formatDate(input: string | number | null | undefined): string {
  if (!input) return '暂无'
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return '暂无'
  return d.toLocaleDateString("zh-CN")
}

export function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<OverallStats | null>(null)
  const [todaySchedules, setTodaySchedules] = useState<ScheduleRow[]>([])
  const [warnings, setWarnings] = useState<CenterWarning[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
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
        const [
          bizRes,
          scheduleRes,
          warningRes,
          opportunityRes,
          membersRes,
        ] = await Promise.all([
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
            .is('biz_class', null),
          supabase
            .from('opportunity_ledger')
            .select('snapshot_date,status,estimated_amount,win_probability,updated_at')
            .order('snapshot_date', { ascending: false })
            .limit(500),
          supabase
            .from('feishu_members')
            .select('user_id'),
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
          // 如果没有经营数据，至少设置人数
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

          const activeCount = latestRows.filter((r) =>
            ['tracking', 'bidding', 'contracted', 'operating'].includes(r.status ?? ''),
          ).length

          const weightedAmount = latestRows.reduce((sum, r) => {
            const amount = Number(r.estimated_amount) || 0
            const probability = Number(r.win_probability) || 0
            return sum + amount * probability
          }, 0)

          const lastUpdated = latestRows
            .map((r) => r.updated_at)
            .filter(Boolean)
            .sort((a, b) => (new Date(b as string).getTime() - new Date(a as string).getTime()))[0] ?? null

          setOpportunitySummary({
            latestSnapshotDate,
            activeCount,
            weightedAmount,
            lastUpdated: lastUpdated ?? latestSnapshotDate,
          })
        }

        const sessionRows = loadSessions().slice(0, 5)
        const sessionSummaries: SessionSummary[] = sessionRows
          .map((s) => {
            const msgs = loadSessionMessages(s.id)
            const lastUser = [...msgs].reverse().find((m) => m.role === 'user')
            const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant' && m.content)
            return {
              id: s.id,
              title: s.title,
              updatedAt: s.updatedAt,
              lastUserMsg: lastUser?.content || '',
              lastAssistantMsg: lastAssistant?.content?.slice(0, 140) || '',
            }
          })
          .filter((s) => s.lastUserMsg)

        setSessions(sessionSummaries)
      } catch (error) {
        console.error('Failed to load dashboard:', error)
      }
    }

    loadDashboard()
  }, [])

  return (
    <>
      <div className="mb-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-strong)] tracking-tight" style={{ fontFamily: "Playfair Display, Noto Serif SC, serif" }}>
              运营驾驶舱
            </h1>
          </div>
          <div className="text-right">
            <div className="text-xs text-[var(--color-text-muted)]">
              {new Date().toLocaleString("zh-CN", { hour12: false, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div
          onClick={() => navigate(ROUTES.BIZ_DATA)}
          className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#0d9488] to-[#0f766e] p-4 text-white cursor-pointer transition-all duration-200 hover:shadow-lg"
          style={{ animation: 'slide-up 0.4s ease-out' }}
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl" />
          <div className="relative">
            <div className="text-[10px] font-semibold tracking-wider uppercase opacity-75 mb-1">营收</div>
            <div className="text-3xl font-bold mb-0.5" style={{ fontFamily: "Playfair Display, serif" }}>
              {stats ? `${stats.revenueRate.toFixed(1)}%` : '-'}
            </div>
            <div className="text-xs opacity-80">营收达成率</div>
          </div>
        </div>

        <div
          onClick={() => navigate(ROUTES.BIZ_DATA)}
          className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1a2744] to-[#0f1828] p-4 text-white cursor-pointer transition-all duration-200 hover:shadow-lg"
          style={{ animation: 'slide-up 0.4s ease-out 0.05s backwards' }}
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-accent/20 rounded-full blur-2xl" />
          <div className="relative">
            <div className="text-[10px] font-semibold tracking-wider uppercase opacity-75 mb-1">利润</div>
            <div className="text-3xl font-bold mb-0.5" style={{ fontFamily: "Playfair Display, serif" }}>
              {stats ? `${stats.profitRate.toFixed(1)}%` : '-'}
            </div>
            <div className="text-xs opacity-80">利润达成率</div>
          </div>
        </div>

        <div
          onClick={() => navigate(ROUTES.ORG_DATA)}
          className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-white p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-accent"
          style={{ animation: 'slide-up 0.4s ease-out 0.1s backwards' }}
        >
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--color-text-muted)] mb-1">人数</div>
          <div className="text-3xl font-bold text-[var(--color-text-strong)] mb-0.5" style={{ fontFamily: "Playfair Display, serif" }}>
            {stats ? stats.headcount.toLocaleString("zh-CN") : "-"}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">在岗人数</div>
        </div>

        <div
          onClick={() => navigate(ROUTES.OPPORTUNITY)}
          className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-white p-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-accent"
          style={{ animation: 'slide-up 0.4s ease-out 0.15s backwards' }}
        >
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--color-text-muted)] mb-1">商机</div>
          <div className="text-3xl font-bold text-[var(--color-text-strong)] mb-0.5" style={{ fontFamily: "Playfair Display, serif" }}>
            {opportunitySummary.activeCount}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">在途商机</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <section
          className="bg-white rounded-xl border border-[var(--color-border)] p-4 shadow-card"
          style={{ animation: 'slide-up 0.4s ease-out 0.25s backwards' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-accent" />
              <h3 className="text-sm font-bold text-[var(--color-text-strong)]">今日重点</h3>
            </div>
            <span className="text-xs text-[var(--color-text-muted)]">{todaySchedules.length} 条</span>
          </div>

          {todaySchedules.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">今日暂无日程安排</p>
          ) : (
            <div className="space-y-2">
              {todaySchedules.slice(0, 4).map((r) => {
                const tag = TYPE_TAG[r.type || ''] || TYPE_TAG.routine
                const isUrgent = r.type === 'urgent' || r.type === 'meeting'
                return (
                  <div
                    key={r.id}
                    onClick={() => navigate(ROUTES.SCHEDULE)}
                    className={`flex gap-2 p-2 rounded-lg cursor-pointer transition-all duration-200 border ${isUrgent ? 'border-error/20 bg-error-50/30' : 'border-accent/20 bg-accent-50/30'} hover:shadow-sm`}
                  >
                    <div className="text-[var(--color-text-muted)] font-medium text-xs whitespace-nowrap">
                      {PERIOD_LABEL[r.period] || r.period}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[var(--color-text-strong)] text-xs truncate">{r.title}</div>
                      <div className="text-xs text-[var(--color-text-muted)] truncate">
                        {[r.location, r.description].filter(Boolean).join(' · ') || '-'}
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${tag.cls} self-start`}>{tag.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section
          className="bg-white rounded-xl border border-[var(--color-border)] p-4 shadow-card"
          style={{ animation: 'slide-up 0.4s ease-out 0.3s backwards' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-warning" />
            <h4 className="text-sm font-bold text-[var(--color-text-strong)]">中心营收预警</h4>
          </div>
          {warnings.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">暂无预警数据</p>
          ) : (
            <div className="space-y-2">
              {warnings.slice(0, 4).map((w) => (
                <div key={w.name} className="bg-gray-50 rounded-lg p-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-[var(--color-text-strong)]">{w.name}</span>
                    <span className="text-sm font-bold text-[var(--color-text-strong)]">{w.value}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColorMap[w.status]}`}
                      style={{ width: `${Math.min(w.value, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section
        className="bg-white rounded-xl border border-[var(--color-border)] p-4"
        style={{ animation: 'slide-up 0.4s ease-out 0.35s backwards' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-accent" />
            <h3 className="text-sm font-bold text-[var(--color-text-strong)]">AI 最近洞察</h3>
          </div>
          <button
            onClick={() => navigate(ROUTES.AI_ANALYSIS)}
            className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors"
          >
            查看全部
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-8">
            <Bot size={24} className="mx-auto mb-2 text-gray-300" />
            <p className="text-xs text-gray-400 mb-2">暂无分析记录</p>
            <button
              onClick={() => navigate(ROUTES.AI_ANALYSIS)}
              className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover transition-colors"
            >
              开始分析
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sessions.slice(0, 6).map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(ROUTES.AI_ANALYSIS)}
                className="text-left p-3 rounded-lg border border-[var(--color-border)] hover:border-accent hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start gap-2 mb-2">
                  <MessageSquare size={14} className="text-accent shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[var(--color-text-strong)] text-xs truncate mb-0.5">
                      {s.title}
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">
                      {formatDate(s.updatedAt)}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed line-clamp-2">
                  {s.lastAssistantMsg || s.lastUserMsg}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
