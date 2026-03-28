import {
  aggregateByNode,
  fetchAvailableMonths,
  fetchBizReport,
  fetchMonthlyPlan,
} from '@/services/bizDataService'

export interface BizDataFilters {
  reportType: 'fone' | 'tuwei'
  periodType: 'cumulative' | 'monthly'
  selectedMonth: string
}

export async function loadAvailableMonths(params: {
  reportType: 'fone' | 'tuwei'
  periodType: 'cumulative' | 'monthly'
}) {
  return fetchAvailableMonths(params.periodType, params.reportType)
}

export async function loadBizData(filters: BizDataFilters) {
  const reports = await fetchBizReport({
    period: filters.selectedMonth,
    periodType: filters.periodType,
    reportTypes: [filters.reportType],
  })

  const monthlyPlans = await fetchMonthlyPlan()
  const foneReports = filters.reportType === 'fone' ? reports : []
  const tuweiReports = filters.reportType === 'tuwei' ? reports : []

  return aggregateByNode(foneReports, tuweiReports, monthlyPlans)
}
