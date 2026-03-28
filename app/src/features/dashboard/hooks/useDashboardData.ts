import { useEffect, useState } from 'react'
import { fetchDashboardSnapshot } from '../api/dashboardRepository'

export interface OverallStats {
  headcount: number
  revenueRate: number
  profitRate: number
  yoyRevenue: number
  createdAt: string | null
}

export interface ScheduleRow {
  id: string
  title: string
  period: string
  type: string | null
  description: string | null
  location: string | null
  created_at: string | null
}

export interface CenterWarning {
  name: string
  value: number
  status: 'ok' | 'warn' | 'error'
}

export interface OpportunitySummary {
  latestSnapshotDate: string | null
  activeCount: number
  revenueAmount: number
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

export function useDashboardData() {
  const [stats, setStats] = useState<OverallStats | null>(null)
  const [todaySchedules, setTodaySchedules] = useState<ScheduleRow[]>([])
  const [warnings, setWarnings] = useState<CenterWarning[]>([])
  const [opportunitySummary, setOpportunitySummary] = useState<OpportunitySummary>({
    latestSnapshotDate: null,
    activeCount: 0,
    revenueAmount: 0,
    lastUpdated: null,
  })

  useEffect(() => {
    async function loadDashboard() {
      try {
        const { bizRes, scheduleRes, warningRes, opportunityRes, membersRes } = await fetchDashboardSnapshot(fmtToday())

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
            .map((row) => {
              const value = asRate(Number(row.revenue_completion_rate))
              return {
                name: row.node_name as string,
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
            stage_code: string | null
            first_year_revenue: number | null
            updated_at: string | null
          }>

          const latestSnapshotDate = rows[0]?.snapshot_date ?? null
          const latestRows = latestSnapshotDate ? rows.filter((row) => row.snapshot_date === latestSnapshotDate) : []
          const activeCount = latestRows.filter((row) =>
            ['lead', 'opportunity', 'internal_approval', 'customer_approval'].includes(row.stage_code ?? ''),
          ).length
          const revenueAmount = latestRows.reduce((sum, row) => sum + (Number(row.first_year_revenue) || 0), 0)
          const lastUpdated =
            latestRows
              .map((row) => row.updated_at)
              .filter(Boolean)
              .sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0] ?? null

          setOpportunitySummary({
            latestSnapshotDate,
            activeCount,
            revenueAmount,
            lastUpdated: lastUpdated ?? latestSnapshotDate,
          })
        }
      } catch (error) {
        console.error('Failed to load dashboard:', error)
      }
    }

    void loadDashboard()
  }, [])

  return {
    stats,
    todaySchedules,
    warnings,
    opportunitySummary,
  }
}
