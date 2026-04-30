import type {
  ChatMessage,
  FinancialAnalysisRuntimeDataContext,
  FinancialAnalysisSessionContext,
  ToolCallRecord,
} from '../../types'

type FinancialAnalysisGoal = NonNullable<FinancialAnalysisSessionContext['intent']>['goal']

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const normalized = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return normalized.length > 0 ? normalized : undefined
}

function detectIntentGoal(text: string): FinancialAnalysisGoal | undefined {
  if (!text) return undefined
  if (/(报告|汇报|完整报告|月报|markdown\s*报告)/.test(text)) return 'report'
  if (/(异常|风险|预警)/.test(text)) return 'exception_scan'
  if (/(对比|比较|拆开看|横向)/.test(text)) return 'comparison'
  if (/(趋势|变化|走势)/.test(text)) return 'trend'
  if (/(计划|突围计划|计划值)/.test(text)) return 'plan_vs_actual'
  if (/(多少|几点|多少万|多少元|是多少|给我查|帮我查|查询|看下|看一下|看一眼).*(收入|毛利|毛利率|税前利润|税前利润率|人效|人数|人均营收|人力成本|费用|达成率|完成率)/.test(text)) {
    return 'data_lookup'
  }
  if (/[?？]|多少|是什么|怎么看|如何|为啥|为什么/.test(text)) return 'qa'
  return undefined
}

function deriveScopeFromToolCalls(toolCalls: ToolCallRecord[]): FinancialAnalysisSessionContext['scope'] | undefined {
  for (let index = toolCalls.length - 1; index >= 0; index -= 1) {
    const toolCall = toolCalls[index]
    if (toolCall.status !== 'success') continue

    if (toolCall.name === 'resolve_org_nodes') {
      const result = safeJsonParse(toolCall.result)
      const topMatches = Array.isArray(result?.top_matches) ? result.top_matches : []
      const groupedSummary = Array.isArray(result?.grouped_summary) ? result.grouped_summary : []
      const canonicalScope = result?.canonical_scope as Record<string, unknown> | undefined
      const firstMatch = topMatches[0] as Record<string, unknown> | undefined
      const matchCount = typeof result?.match_count === 'number' ? result.match_count : topMatches.length
      const suggestedMode = result?.suggested_filter_mode
      const confidence = result?.confidence === 'high' || result?.confidence === 'medium' || result?.confidence === 'low'
        ? result.confidence
        : matchCount === 1
          ? 'high'
          : canonicalScope?.level_1 || canonicalScope?.level_2
            ? 'medium'
            : 'low'

      return {
        mode: suggestedMode === 'node_name' || suggestedMode === 'level_1' || suggestedMode === 'level_2'
          ? suggestedMode
          : undefined,
        nodeNames: matchCount === 1 && typeof firstMatch?.node_name === 'string'
          ? [firstMatch.node_name]
          : undefined,
        level_0: typeof canonicalScope?.level_0 === 'string' ? canonicalScope.level_0 : undefined,
        level_1: typeof canonicalScope?.level_1 === 'string'
          ? canonicalScope.level_1
          : typeof (groupedSummary[0] as Record<string, unknown> | undefined)?.level_1 === 'string'
            ? String((groupedSummary[0] as Record<string, unknown>).level_1)
            : undefined,
        level_2: typeof canonicalScope?.level_2 === 'string' ? canonicalScope.level_2 : undefined,
        confidence,
      }
    }

    if (toolCall.name === 'query_with_hierarchy' || toolCall.name === 'query_biz_data' || toolCall.name === 'query_business_report_pack') {
      const result = safeJsonParse(toolCall.result)
      if (
        Array.isArray(result?.candidates) ||
        String(result?.message ?? '').includes('匹配到多个') ||
        String(result?.message ?? '').includes('未找到')
      ) {
        continue
      }

      const nodeNameArg = typeof toolCall.arguments.node_name === 'string'
        ? toolCall.arguments.node_name.trim()
        : ''
      const nodeNames = normalizeStringArray(nodeNameArg ? [nodeNameArg] : [])
      const previousScope = index > 0 ? deriveScopeFromToolCalls(toolCalls.slice(0, index)) : undefined

      return {
        mode: nodeNames?.length
          ? 'node_name'
          : 'all',
        nodeNames,
        level_0: previousScope?.level_0,
        level_1: previousScope?.level_1,
        level_2: previousScope?.level_2,
        confidence: 'high',
      }
    }
  }

  return undefined
}

function deriveTimeFromToolCalls(toolCalls: ToolCallRecord[]): FinancialAnalysisSessionContext['time'] | undefined {
  for (let index = toolCalls.length - 1; index >= 0; index -= 1) {
    const toolCall = toolCalls[index]
    if (toolCall.status !== 'success') continue

    if (toolCall.name === 'query_monthly_plan') {
      return {
        periodType: 'monthly',
        period: typeof toolCall.arguments.month === 'string' ? toolCall.arguments.month : undefined,
        confidence: 'high',
      }
    }

    if (toolCall.name === 'query_business_report_pack') {
      return {
        periodType: 'monthly',
        period: typeof toolCall.arguments.month === 'string' ? toolCall.arguments.month : undefined,
        comparePeriod: typeof toolCall.arguments.previous_month === 'string' ? toolCall.arguments.previous_month : undefined,
        confidence: 'high',
      }
    }

    if (toolCall.name === 'query_with_hierarchy' || toolCall.name === 'query_biz_data') {
      return {
        periodType: toolCall.arguments.period_type === 'monthly' || toolCall.arguments.period_type === 'cumulative'
          ? toolCall.arguments.period_type
          : undefined,
        period: typeof toolCall.arguments.period === 'string' ? toolCall.arguments.period : undefined,
        confidence: 'high',
      }
    }
  }

  return undefined
}

function deriveMetricsFromToolCalls(toolCalls: ToolCallRecord[]): FinancialAnalysisSessionContext['metrics'] | undefined {
  const primary = new Set<string>()

  for (const toolCall of toolCalls) {
    if (toolCall.status !== 'success') continue
    const mc = toolCall.arguments.metric_categories ?? toolCall.arguments.metric_category
    if (Array.isArray(mc)) {
      for (const m of mc) {
        if (typeof m === 'string') primary.add(m)
      }
    } else if (typeof mc === 'string') {
      primary.add(mc)
    }
  }

  return primary.size > 0 ? { primary: [...primary] } : undefined
}

function deriveReportTypeFromToolCalls(toolCalls: ToolCallRecord[]): FinancialAnalysisSessionContext['reportType'] | undefined {
  for (let index = toolCalls.length - 1; index >= 0; index -= 1) {
    const toolCall = toolCalls[index]
    if (toolCall.status !== 'success') continue
    if (toolCall.arguments.report_type === 'fone' || toolCall.arguments.report_type === 'tuwei') {
      return toolCall.arguments.report_type
    }
  }
  return undefined
}

function deriveReportMode(
  toolCalls: ToolCallRecord[],
  previous?: FinancialAnalysisSessionContext['reportMode']
): FinancialAnalysisSessionContext['reportMode'] | undefined {
  const readFilePaths = toolCalls
    .filter(
      toolCall =>
        toolCall.status === 'success' &&
        toolCall.name === 'read_file' &&
        typeof toolCall.arguments.path === 'string'
    )
    .map(toolCall => String(toolCall.arguments.path))

  if (readFilePaths.length === 0) return previous

  const templatePath = readFilePaths.find(
    path =>
      path === '/assets/financial-analysis/biz-analysis-report.md' ||
      path === '/templates/biz-analysis-report.md'
  )
  const workflowLoaded = readFilePaths.includes('/assets/financial-analysis/references/workflow.md')
  const metricsLoaded = readFilePaths.includes('/assets/financial-analysis/references/metrics.md')
  const reportGenerationLoaded = readFilePaths.includes('/assets/financial-analysis/references/report-generation.md')
  const actualMarchReportStyleLoaded = readFilePaths.includes('/assets/financial-analysis/references/actual-march-report-style.md')
  const reportQualityRubricLoaded = readFilePaths.includes('/assets/financial-analysis/references/report-quality-rubric.md')
  const dataRequirementsLoaded = readFilePaths.includes('/assets/financial-analysis/references/data-requirements.md')
  const analysisMethodLoaded = readFilePaths.includes('/assets/financial-analysis/references/analysis-method.md')
  const chartGuidanceLoaded = readFilePaths.includes('/assets/financial-analysis/references/chart-guidance.md')

  if (
    !templatePath &&
    !workflowLoaded &&
    !metricsLoaded &&
    !reportGenerationLoaded &&
    !actualMarchReportStyleLoaded &&
    !reportQualityRubricLoaded &&
    !dataRequirementsLoaded &&
    !analysisMethodLoaded &&
    !chartGuidanceLoaded &&
    !previous
  ) return undefined

  const loadedPaths = Array.from(
    new Set([
      ...(previous?.loadedPaths || []),
      ...readFilePaths,
    ])
  ).sort()

  return {
    templateLoaded: previous?.templateLoaded || Boolean(templatePath),
    templatePath: templatePath || previous?.templatePath,
    workflowLoaded: previous?.workflowLoaded || workflowLoaded,
    metricsLoaded: previous?.metricsLoaded || metricsLoaded,
    reportGenerationLoaded: previous?.reportGenerationLoaded || reportGenerationLoaded,
    actualMarchReportStyleLoaded: previous?.actualMarchReportStyleLoaded || actualMarchReportStyleLoaded,
    reportQualityRubricLoaded: previous?.reportQualityRubricLoaded || reportQualityRubricLoaded,
    dataRequirementsLoaded: previous?.dataRequirementsLoaded || dataRequirementsLoaded,
    analysisMethodLoaded: previous?.analysisMethodLoaded || analysisMethodLoaded,
    chartGuidanceLoaded: previous?.chartGuidanceLoaded || chartGuidanceLoaded,
    loadedPaths,
    chartOutputMode:
      previous?.chartOutputMode || chartGuidanceLoaded
        ? 'structured_chart_spec_json'
        : undefined,
  }
}

function safeJsonParse(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return null
  }
}

export function buildFinancialAnalysisSessionContextBlock(
  sessionContext?: FinancialAnalysisSessionContext
): string {
  if (!sessionContext) return ''

  const lines: string[] = ['## Current Session Context']

  const scopeParts = [
    sessionContext.scope?.mode ? `mode=${sessionContext.scope.mode}` : null,
    sessionContext.scope?.level_0 ? `level_0=${sessionContext.scope.level_0}` : null,
    sessionContext.scope?.level_1 ? `level_1=${sessionContext.scope.level_1}` : null,
    sessionContext.scope?.level_2 ? `level_2=${sessionContext.scope.level_2}` : null,
    sessionContext.scope?.nodeNames?.length ? `nodes=${sessionContext.scope.nodeNames.join(', ')}` : null,
  ].filter(Boolean)

  if (scopeParts.length > 0) {
    lines.push(`- scope: ${scopeParts.join('; ')}`)
  }
  if (sessionContext.time?.periodType || sessionContext.time?.period) {
    lines.push(`- time: ${sessionContext.time?.periodType || 'unknown'} ${sessionContext.time?.period || ''}`.trim())
  }
  if (sessionContext.reportType) {
    lines.push(`- report_type: ${sessionContext.reportType}`)
  }
  if (sessionContext.intent?.goal) {
    lines.push(`- goal: ${sessionContext.intent.goal}`)
  }
  if (sessionContext.metrics?.primary?.length) {
    lines.push(`- primary_metrics: ${sessionContext.metrics.primary.join(', ')}`)
  }
  if (sessionContext.reportMode?.templateLoaded && sessionContext.reportMode.templatePath) {
    lines.push(`- report_template_loaded: ${sessionContext.reportMode.templatePath}`)
  }
  if (typeof sessionContext.reportMode?.workflowLoaded === 'boolean') {
    lines.push(`- workflow_reference_loaded: ${sessionContext.reportMode.workflowLoaded ? 'yes' : 'no'}`)
  }
  if (typeof sessionContext.reportMode?.metricsLoaded === 'boolean') {
    lines.push(`- metrics_reference_loaded: ${sessionContext.reportMode.metricsLoaded ? 'yes' : 'no'}`)
  }
  if (typeof sessionContext.reportMode?.reportGenerationLoaded === 'boolean') {
    lines.push(`- report_generation_reference_loaded: ${sessionContext.reportMode.reportGenerationLoaded ? 'yes' : 'no'}`)
  }
  if (typeof sessionContext.reportMode?.actualMarchReportStyleLoaded === 'boolean') {
    lines.push(`- actual_report_style_loaded: ${sessionContext.reportMode.actualMarchReportStyleLoaded ? 'yes' : 'no'}`)
  }
  if (typeof sessionContext.reportMode?.reportQualityRubricLoaded === 'boolean') {
    lines.push(`- report_quality_rubric_loaded: ${sessionContext.reportMode.reportQualityRubricLoaded ? 'yes' : 'no'}`)
  }
  if (typeof sessionContext.reportMode?.dataRequirementsLoaded === 'boolean') {
    lines.push(`- data_requirements_loaded: ${sessionContext.reportMode.dataRequirementsLoaded ? 'yes' : 'no'}`)
  }
  if (typeof sessionContext.reportMode?.analysisMethodLoaded === 'boolean') {
    lines.push(`- analysis_method_reference_loaded: ${sessionContext.reportMode.analysisMethodLoaded ? 'yes' : 'no'}`)
  }
  if (sessionContext.reportMode?.chartOutputMode) {
    lines.push(`- chart_output_mode: ${sessionContext.reportMode.chartOutputMode}`)
  }
  if (typeof sessionContext.reportMode?.chartGuidanceLoaded === 'boolean') {
    lines.push(`- chart_guidance_loaded: ${sessionContext.reportMode.chartGuidanceLoaded ? 'yes' : 'no'}`)
  }
  if (sessionContext.reportMode?.loadedPaths?.length) {
    lines.push(`- loaded_reference_paths: ${sessionContext.reportMode.loadedPaths.join(', ')}`)
  }
  lines.push('- note: reuse this context unless the user explicitly changes scope, time, report type, or goal; when scope is already high-confidence and unchanged, do not call resolve_org_nodes again; resolve again only if the user changes the target or the scope is ambiguous.')
  lines.push('- note: if a reference/template path is already marked as loaded in this session, do not call read_file for the same path again in the same task just to reconfirm rules; reuse the existing content and continue querying, analyzing, or writing.')

  return lines.join('\n')
}

export function updateFinancialAnalysisSessionContext(params: {
  previous?: FinancialAnalysisSessionContext
  userMessage: ChatMessage
  assistantMessage: ChatMessage
  runtimeDataContext?: FinancialAnalysisRuntimeDataContext
}): FinancialAnalysisSessionContext {
  const { previous, userMessage, assistantMessage, runtimeDataContext } = params
  const toolCalls = assistantMessage.toolCalls || []

  const nextContext: FinancialAnalysisSessionContext = {
    ...previous,
    scope: deriveScopeFromToolCalls(toolCalls) || previous?.scope,
    time: deriveTimeFromToolCalls(toolCalls) || previous?.time,
    reportType: deriveReportTypeFromToolCalls(toolCalls) || previous?.reportType,
    intent: {
      goal: detectIntentGoal(userMessage.content) || previous?.intent?.goal,
    },
    metrics: deriveMetricsFromToolCalls(toolCalls) || previous?.metrics,
    reportMode: deriveReportMode(toolCalls, previous?.reportMode),
    dataContext: runtimeDataContext || previous?.dataContext,
    lastResolvedAt: Date.now(),
  }

  return nextContext
}
