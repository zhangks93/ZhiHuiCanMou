import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')
const indexPath = path.join(repoRoot, 'src/shared/lib/agent/tools/businessReportPack/index.ts')
const lines = fs.readFileSync(indexPath, 'utf8').split(/\r?\n/)

const aggBody = [
  ...lines.slice(72, 814),
  ...lines.slice(999, 1074),
  ...lines.slice(1075, 1123),
].join('\n')

const aggHeader = `import type { EduBizReport, EnrichedBizDataNode, MetricCategory } from '@/features/biz-data/types'
import {
  buildOrgPath,
  buildOrgScopeKey,
  getChildren,
  getNodeKind,
} from '@/features/biz-data/services/bizDataService'
import {
  contributionShare,
  DEFAULT_REPORT_METRICS,
  assessGoalProbability,
  formatPctForJudgement,
  LOWER_IS_BETTER_METRICS,
  schoolYearProgressRate,
  statusByCompletion,
} from '../reportCalculations'
import type {
  BusinessRole,
  BusinessReportWarning,
  CompositionRow,
  CostExpenseRow,
  MetricComparisonWideRow,
  MetricCoverage,
  OrganizationCoverageRow,
  OrganizationMetricRow,
  PeriodScope,
  RankingRow,
  ReportMetricValue,
  ReportType,
  SchoolYearGoalAssessmentRow,
  ScopeProfile,
  SummaryCard,
  TargetVsActualRow,
  UnitCard,
} from '../reportPackTypes'
import {
  ALL_REPORT_METRICS,
  CORE_TARGET_METRICS,
  COST_EXPENSE_DETAIL_METRICS,
  COST_EXPENSE_METRICS,
  FALLBACK_METRIC_LABELS,
  SUMMARY_METRICS,
  SUPPORT_UNIT_NAME_HINTS,
} from './packConstants'
import {
  collectSubtreeWithDepth,
  findNodeByName,
  flattenSubtree,
} from './fetchData'

export function formatBriefNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '无数据'
  return value.toFixed(2)
}

export function formatBriefPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '无数据'
  return (value * 100).toFixed(1) + '%'
}

`

const aggregatePath = path.join(repoRoot, 'src/shared/lib/agent/tools/businessReportPack/aggregateMetrics.ts')
fs.writeFileSync(aggregatePath, `${aggHeader}${aggBody}\n`)

const compBody = [
  ...lines.slice(815, 909),
  ...lines.slice(919, 988),
  ...lines.slice(1123, 1247),
].join('\n')

const compHeader = `import type {
  BusinessReportPack,
  BusinessReportWarning,
  BusinessReportWritingBrief,
  CompositionRow,
  CostExpenseRow,
  DataCompletenessMatrixRow,
  MissingDataNote,
  MetricCoverage,
  TargetVsActualRow,
  UnitCard,
  BusinessRole,
} from '../reportPackTypes'
import { COST_EXPENSE_METRICS } from './packConstants'
import {
  formatBriefNumber,
  formatBriefPct,
  periodScopeLabel,
  reportStatusLabel,
  reportTypeLabel,
  warningSeverityLabel,
} from './aggregateMetrics'

`

const composePath = path.join(repoRoot, 'src/shared/lib/agent/tools/businessReportPack/composeSections.ts')
fs.writeFileSync(composePath, `${compHeader}${compBody}\n`)

console.log('split-report-pack: wrote aggregateMetrics.ts and composeSections.ts')
