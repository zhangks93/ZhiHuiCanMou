import type { ReportType } from '../reportPackTypes'
import { REPORT_TYPE_VALUES } from './packConstants'

export type QueryBusinessReportPackArgs = {
  node_name?: string
  org_scope_key?: string
  month: string
  previous_month?: string
  cumulative_period?: string
  school_year_target_period?: string
  report_types?: ReportType[]
  max_units?: number
}

export function validateArgs(args: Record<string, unknown>):
  | { ok: true; values: QueryBusinessReportPackArgs }
  | { ok: false; message: string } {
  const month = args.month
  const cumulativePeriod = args.cumulative_period
  const schoolYearTargetPeriod = args.school_year_target_period
  const previousMonth = args.previous_month
  const nodeName = args.node_name
  const orgScopeKey = args.org_scope_key
  const reportTypes = args.report_types
  const maxUnits = args.max_units

  if (nodeName !== undefined && typeof nodeName !== 'string') {
    return { ok: false, message: 'node_name 如传入，必须为字符串；传空字符串表示集团整体' }
  }

  if (orgScopeKey !== undefined && (typeof orgScopeKey !== 'string' || !orgScopeKey.trim())) {
    return { ok: false, message: 'org_scope_key 如传入，必须为非空字符串' }
  }

  if (typeof month !== 'string' || !month.trim()) {
    return { ok: false, message: 'month 必须为非空字符串，且必须使用 Runtime Data Context 中合法 monthly period' }
  }

  if (previousMonth !== undefined && (typeof previousMonth !== 'string' || !previousMonth.trim())) {
    return { ok: false, message: 'previous_month 如传入，必须为非空字符串' }
  }

  if (cumulativePeriod !== undefined && (typeof cumulativePeriod !== 'string' || !cumulativePeriod.trim())) {
    return { ok: false, message: 'cumulative_period 如传入，必须为非空字符串，且必须使用 Runtime Data Context 中合法 cumulative period' }
  }

  if (schoolYearTargetPeriod !== undefined && (typeof schoolYearTargetPeriod !== 'string' || !schoolYearTargetPeriod.trim())) {
    return { ok: false, message: 'school_year_target_period 如传入，必须为非空字符串，且必须使用 Runtime Data Context 中合法 cumulative period' }
  }

  if (reportTypes !== undefined) {
    if (!Array.isArray(reportTypes) || reportTypes.length === 0) {
      return { ok: false, message: 'report_types 如传入，必须为非空数组' }
    }
    for (const reportType of reportTypes) {
      if (typeof reportType !== 'string' || !REPORT_TYPE_VALUES.has(reportType)) {
        return { ok: false, message: `report_types 含非法口径: ${String(reportType)}` }
      }
    }
  }

  if (maxUnits !== undefined && (typeof maxUnits !== 'number' || !Number.isInteger(maxUnits) || maxUnits < 1 || maxUnits > 200)) {
    return { ok: false, message: 'max_units 如传入，必须是 1-200 的整数' }
  }

  return {
    ok: true,
    values: {
      node_name: nodeName?.trim() ?? '',
      org_scope_key: orgScopeKey?.trim(),
      month: month.trim(),
      previous_month: previousMonth?.trim(),
      cumulative_period: cumulativePeriod?.trim(),
      school_year_target_period: schoolYearTargetPeriod?.trim(),
      report_types: reportTypes as ReportType[] | undefined,
      max_units: maxUnits as number | undefined,
    },
  }
}
