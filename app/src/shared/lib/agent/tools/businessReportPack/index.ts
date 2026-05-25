import type { RegisteredTool, ToolDefinition } from '../../types'
import { buildOrgPath, buildOrgScopeKey } from '@/features/biz-data/services/bizDataService'
import {
  inferCumulativeToMonthPeriod,
  inferPreviousMonth,
  inferSchoolYearTargetPeriod,
} from '../reportCalculations'
import {
  buildBusinessReportClaimRules,
  buildBusinessReportEvidenceLedger,
  buildBusinessReportQualityContract,
  buildBusinessReportRenderHints,
  buildBusinessReportSectionBriefs,
  validateBusinessReportPack,
} from '../businessReportQuality'
import type { BusinessReportPack, ReportType } from '../reportPackTypes'
import { validateArgs } from './validatePack'
import { SUMMARY_METRICS } from './packConstants'
import {
  aggregateReportNodes,
  buildMetricLabelMap,
  fetchReportPeriodSlices,
  resolveRootNode,
} from './fetchData'
import {
  buildAllMetricRows,
  buildCompositionRows,
  buildCostExpenseRows,
  buildCostExpenseWideTable,
  buildKeyDescendantRows,
  buildLeafExceptionRows,
  buildMetricComparisonWideTable,
  buildMetricCoverage,
  buildOrganizationTwoLevelTable,
  buildRankings,
  buildSchoolYearGoalAssessmentTable,
  buildScopeProfile,
  buildSummaryCards,
  buildTargetVsActualRow,
  buildTargetVsActualTable,
  buildUnitCards,
  getReportTypeFields,
  inferBusinessRole,
} from './aggregateMetrics'
import {
  buildCoverage,
  buildDataCompletenessMatrix,
  buildManualFillSections,
  buildMissingDataNotes,
  buildWarnings,
  buildWritingBrief,
} from './composeSections'

export const queryBusinessReportPackTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'query_business_report_pack',
      description:
        '生成完整月度经营分析报告所需的数据包。一次性返回学年预算与突围考核、当月/上月/截至当月累计/学年目标累计、宽表、全量指标明细、提问组织下至少两层组织数据、组织构成、差异排行、风险预警和人工补充章节占位。适用于经营分析报告、月报、汇报材料。',
      parameters: {
        type: 'object',
        properties: {
          node_name: {
            type: 'string',
            description: '组织节点名称。传空字符串表示集团整体/整棵树。若已通过 resolve_org_nodes 得到 org_scope_key，应同时传 org_scope_key。',
          },
          org_scope_key: {
            type: 'string',
            description: '可选。组织稳定路径键，用于精确定位同名组织，优先级高于 node_name。',
          },
          month: {
            type: 'string',
            description: '目标月份，必须使用 Runtime Data Context 中合法 monthly period，例如 202603。',
          },
          previous_month: {
            type: 'string',
            description: '上月月份。可不传，工具会从 month 推断，例如 202603 -> 202602。',
          },
          cumulative_period: {
            type: 'string',
            description: '可选。兼容旧参数，表示截至当月累计期间；不传时按 month 自动推导，如 202603 -> <202604。',
          },
          school_year_target_period: {
            type: 'string',
            description: '可选。学年目标累计期间；不传时按教育学年自动推导，如 202603 -> <202607。',
          },
          report_types: {
            type: 'array',
            description: '报表口径，默认同时返回学年预算与突围考核。内部枚举：fone=学年预算，tuwei=突围考核。',
            items: { type: 'string', enum: ['fone', 'tuwei'] },
          },
          max_units: {
            type: 'number',
            description: '最多返回多少个重点单位卡片，默认 120。',
          },
        },
        required: ['month'],
      } as ToolDefinition['function']['parameters'],
    },
  },

  execute: async (args: Record<string, unknown>): Promise<string> => {
    const validated = validateArgs(args)
    if (!validated.ok) return JSON.stringify({ error: validated.message }, null, 2)

    const nodeName = validated.values.node_name ?? ''
    const orgScopeKey = validated.values.org_scope_key
    const month = validated.values.month
    const previousMonth = validated.values.previous_month || inferPreviousMonth(month)
    const cumulativeToMonthPeriod = validated.values.cumulative_period || inferCumulativeToMonthPeriod(month)
    const schoolYearTargetPeriod = validated.values.school_year_target_period || inferSchoolYearTargetPeriod(month)
    const reportTypes: ReportType[] = validated.values.report_types?.length ? validated.values.report_types : ['fone', 'tuwei']
    const maxUnits = validated.values.max_units ?? 120

    const { monthReports, previousReports, cumulativeToMonthReports, schoolYearTargetReports } = await fetchReportPeriodSlices({
      month,
      previousMonth,
      cumulativeToMonthPeriod,
      schoolYearTargetPeriod,
      reportTypes,
    })

    const labelMap = buildMetricLabelMap([...monthReports, ...previousReports, ...cumulativeToMonthReports, ...schoolYearTargetReports])
    const monthNodes = aggregateReportNodes(monthReports)
    const previousNodes = aggregateReportNodes(previousReports)
    const cumulativeToMonthNodes = aggregateReportNodes(cumulativeToMonthReports)
    const schoolYearTargetNodes = aggregateReportNodes(schoolYearTargetReports)

    const cumulativeToMonthResolved = resolveRootNode(cumulativeToMonthNodes, nodeName, orgScopeKey)
    if (!cumulativeToMonthResolved.ok) {
      return JSON.stringify({
        message: cumulativeToMonthResolved.message,
        query_echo: {
          node_name: nodeName,
          org_scope_key: orgScopeKey ?? null,
          month,
          previous_month: previousMonth,
          cumulative_to_month_period: cumulativeToMonthPeriod,
          school_year_target_period: schoolYearTargetPeriod,
          report_types: reportTypes,
        },
        candidates: cumulativeToMonthResolved.candidates,
      }, null, 2)
    }

    const resolvedNodeName = cumulativeToMonthResolved.root?.node_name ?? nodeName
    const resolvedOrgScopeKey = cumulativeToMonthResolved.root ? buildOrgScopeKey(cumulativeToMonthResolved.root) : orgScopeKey
    const monthResolved = resolveRootNode(monthNodes, resolvedNodeName, resolvedOrgScopeKey)
    const previousResolved = resolveRootNode(previousNodes, resolvedNodeName, resolvedOrgScopeKey)
    const schoolYearTargetResolved = resolveRootNode(schoolYearTargetNodes, resolvedNodeName, resolvedOrgScopeKey)
    const monthRoot = monthResolved.ok ? monthResolved.root : null
    const previousRoot = previousResolved.ok ? previousResolved.root : null
    const cumulativeToMonthRoot = cumulativeToMonthResolved.root
    const schoolYearTargetRoot = schoolYearTargetResolved.ok ? schoolYearTargetResolved.root : null

    if (!monthRoot && !cumulativeToMonthRoot && !schoolYearTargetRoot) {
      return JSON.stringify({
        message: '未找到可用于生成报告的经营数据',
        query_echo: {
          node_name: nodeName,
          org_scope_key: orgScopeKey ?? null,
          month,
          previous_month: previousMonth,
          cumulative_to_month_period: cumulativeToMonthPeriod,
          school_year_target_period: schoolYearTargetPeriod,
          report_types: reportTypes,
        },
      }, null, 2)
    }

    const preferredReportType: ReportType = reportTypes.includes('tuwei') ? 'tuwei' : reportTypes[0]
    const summaryCards = buildSummaryCards({ monthRoot, previousRoot, cumulativeToMonthRoot, schoolYearTargetRoot, reportTypes, labelMap })
    const targetVsActualTable = buildTargetVsActualTable(monthRoot, cumulativeToMonthRoot, schoolYearTargetRoot, reportTypes)
    const metricComparisonWideTable = buildMetricComparisonWideTable({
      monthRoot,
      previousRoot,
      cumulativeToMonthRoot,
      schoolYearTargetRoot,
      metrics: SUMMARY_METRICS,
      labelMap,
    })
    const schoolYearGoalAssessmentTable = buildSchoolYearGoalAssessmentTable({
      schoolYearTargetRoot,
      month,
      labelMap,
    })
    const directChildrenTable = buildCompositionRows(cumulativeToMonthRoot, cumulativeToMonthResolved.allNodes, preferredReportType)
    const organizationTwoLevelTable = buildOrganizationTwoLevelTable(cumulativeToMonthRoot, cumulativeToMonthResolved.allNodes)
    const keyDescendantTable = buildKeyDescendantRows(cumulativeToMonthRoot, cumulativeToMonthResolved.allNodes, preferredReportType)
    const leafExceptionTable = buildLeafExceptionRows(cumulativeToMonthRoot, cumulativeToMonthResolved.allNodes, preferredReportType)
    const costExpenseSummary = [
      ...buildCostExpenseRows({
        root: monthRoot,
        allNodes: monthResolved.ok ? monthResolved.allNodes : [],
        reportTypes,
        periodScope: 'monthly',
        labelMap,
      }),
      ...buildCostExpenseRows({
        root: cumulativeToMonthRoot,
        allNodes: cumulativeToMonthResolved.allNodes,
        reportTypes,
        periodScope: 'cumulative_to_month',
        labelMap,
      }),
      ...buildCostExpenseRows({
        root: schoolYearTargetRoot,
        allNodes: schoolYearTargetResolved.ok ? schoolYearTargetResolved.allNodes : [],
        reportTypes,
        periodScope: 'school_year_target',
        labelMap,
      }),
    ].filter(row => row.node_name === (cumulativeToMonthRoot?.node_name ?? schoolYearTargetRoot?.node_name ?? monthRoot?.node_name))
    const costExpenseTable = [
      ...buildCostExpenseRows({
        root: monthRoot,
        allNodes: monthResolved.ok ? monthResolved.allNodes : [],
        reportTypes,
        periodScope: 'monthly',
        labelMap,
      }),
      ...buildCostExpenseRows({
        root: cumulativeToMonthRoot,
        allNodes: cumulativeToMonthResolved.allNodes,
        reportTypes,
        periodScope: 'cumulative_to_month',
        labelMap,
      }),
      ...buildCostExpenseRows({
        root: schoolYearTargetRoot,
        allNodes: schoolYearTargetResolved.ok ? schoolYearTargetResolved.allNodes : [],
        reportTypes,
        periodScope: 'school_year_target',
        labelMap,
      }),
    ]
    const costExpenseWideTable = buildCostExpenseWideTable({ costExpenseRows: costExpenseTable })
    const allMetricTable = [
      ...buildAllMetricRows({
        root: monthRoot,
        allNodes: monthResolved.ok ? monthResolved.allNodes : [],
        reportTypes,
        periodScope: 'monthly',
        labelMap,
      }),
      ...buildAllMetricRows({
        root: cumulativeToMonthRoot,
        allNodes: cumulativeToMonthResolved.allNodes,
        reportTypes,
        periodScope: 'cumulative_to_month',
        labelMap,
      }),
      ...buildAllMetricRows({
        root: schoolYearTargetRoot,
        allNodes: schoolYearTargetResolved.ok ? schoolYearTargetResolved.allNodes : [],
        reportTypes,
        periodScope: 'school_year_target',
        labelMap,
      }),
    ]
    const unitCards = buildUnitCards({
      monthRoot,
      previousRoot,
      cumulativeRoot: cumulativeToMonthRoot,
      monthNodes: monthResolved.ok ? monthResolved.allNodes : [],
      cumulativeNodes: cumulativeToMonthResolved.allNodes,
      reportType: preferredReportType,
      maxUnits,
    })
    const coverage = buildCoverage({
      monthReports,
      previousReports,
      cumulativeToMonthReports,
      schoolYearTargetReports,
    })
    const metricCoverage = buildMetricCoverage([...monthReports, ...previousReports, ...cumulativeToMonthReports, ...schoolYearTargetReports])
    const dataCompletenessMatrix = buildDataCompletenessMatrix({
      targetVsActualTable,
      compositionTable: directChildrenTable,
      unitCards,
      costExpenseTable,
      coverage,
      metricCoverage,
    })
    const scopeProfile = buildScopeProfile(cumulativeToMonthRoot ?? schoolYearTargetRoot ?? monthRoot, cumulativeToMonthResolved.allNodes)
    const scopeBusinessRole = (cumulativeToMonthRoot ?? schoolYearTargetRoot ?? monthRoot)
      ? inferBusinessRole((cumulativeToMonthRoot ?? schoolYearTargetRoot ?? monthRoot)!)
      : undefined
    const warnings = buildWarnings({ unitCards, summaryCards, costExpenseRows: costExpenseTable, scopeBusinessRole })
    const varianceRankings = buildRankings(cumulativeToMonthRoot, cumulativeToMonthResolved.allNodes, preferredReportType, labelMap)
    const writingBrief = buildWritingBrief({
      scopeProfile,
      summaryCards,
      targetVsActualTable,
      schoolYearGoalAssessmentTable,
      directChildrenTable,
      unitCards,
      costExpenseSummary,
      varianceRankings,
      warnings,
    })
    const basePackForQuality: BusinessReportPack = {
      metadata: {
        scope_name: cumulativeToMonthRoot?.node_name ?? schoolYearTargetRoot?.node_name ?? monthRoot?.node_name ?? (nodeName || '智汇后勤集团'),
        org_scope_key: (cumulativeToMonthRoot ?? schoolYearTargetRoot ?? monthRoot) ? buildOrgScopeKey((cumulativeToMonthRoot ?? schoolYearTargetRoot ?? monthRoot)!) : resolvedOrgScopeKey ?? null,
        org_path: (cumulativeToMonthRoot ?? schoolYearTargetRoot ?? monthRoot) ? buildOrgPath((cumulativeToMonthRoot ?? schoolYearTargetRoot ?? monthRoot)!) : [],
        month,
        previous_month: previousMonth,
        cumulative_period: cumulativeToMonthPeriod,
        cumulative_to_month_period: cumulativeToMonthPeriod,
        school_year_target_period: schoolYearTargetPeriod,
        generated_at: new Date().toISOString(),
        unit: '万元',
        row_counts: {
          organization_two_level_table: organizationTwoLevelTable.length,
          all_metric_table: allMetricTable.length,
          cost_expense_table: costExpenseTable.length,
          unit_cards: unitCards.length,
          warnings: warnings.length,
        },
      },
      scope_profile: scopeProfile,
      writing_brief: writingBrief,
      coverage,
      summary_cards: summaryCards,
      target_vs_actual_table: targetVsActualTable,
      metric_comparison_wide_table: metricComparisonWideTable,
      school_year_goal_assessment_table: schoolYearGoalAssessmentTable,
      composition_table: directChildrenTable,
      direct_children_table: directChildrenTable,
      organization_two_level_table: organizationTwoLevelTable,
      all_metric_table: allMetricTable,
      key_descendant_table: keyDescendantTable,
      leaf_exception_table: leafExceptionTable,
      unit_cards: unitCards,
      monthly_actual_table: reportTypes.map(reportType => buildTargetVsActualRow(monthRoot, reportType, 'monthly')),
      cost_expense_summary: costExpenseSummary,
      cost_expense_table: costExpenseTable,
      cost_expense_wide_table: costExpenseWideTable,
      data_completeness_matrix: dataCompletenessMatrix,
      metric_coverage: metricCoverage,
      missing_data_notes: buildMissingDataNotes(coverage),
      variance_rankings: varianceRankings,
      manual_fill_sections: buildManualFillSections(),
      warnings,
    }
    const evidenceLedger = buildBusinessReportEvidenceLedger(basePackForQuality)
    const qualityContract = buildBusinessReportQualityContract(basePackForQuality)
    const sectionBriefs = buildBusinessReportSectionBriefs(basePackForQuality, evidenceLedger)
    const packQuality = validateBusinessReportPack(basePackForQuality)

    const pack: BusinessReportPack = {
      ...basePackForQuality,
      evidence_ledger: evidenceLedger,
      section_briefs: sectionBriefs,
      quality_contract: qualityContract,
      claim_rules: buildBusinessReportClaimRules(),
      render_hints: buildBusinessReportRenderHints(),
      warnings: [
        ...warnings,
        ...packQuality.findings.map(finding => ({
          severity: finding.severity === 'error' ? 'red' as const : finding.severity === 'warning' ? 'yellow' as const : 'info' as const,
          section: '报告生成质量契约',
          message: finding.message,
          evidence: {
            code: finding.code,
            quality_score: packQuality.score,
            ...finding.evidence,
          },
        })),
      ],
    }

    return JSON.stringify(pack, null, 2)
  },
}

export const __queryBusinessReportPackTestUtils = {
  getReportTypeFields,
  buildMetricComparisonWideTable,
  buildSchoolYearGoalAssessmentTable,
  inferBusinessRole,
}
