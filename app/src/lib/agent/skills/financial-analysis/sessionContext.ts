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
        confidence: matchCount === 1 ? 'high' : 'medium',
      }
    }

    if (toolCall.name === 'query_with_hierarchy' || toolCall.name === 'query_biz_data') {
      const nodeNames = normalizeStringArray(
        [typeof toolCall.arguments.node_name === 'string' ? toolCall.arguments.node_name : ''].filter(Boolean)
      )

      return {
        mode: typeof toolCall.arguments.level_2 === 'string'
          ? 'level_2'
          : typeof toolCall.arguments.level_1 === 'string'
            ? 'level_1'
            : nodeNames?.length
              ? 'node_name'
              : undefined,
        nodeNames,
        level_0: typeof toolCall.arguments.level_0 === 'string' ? toolCall.arguments.level_0 : undefined,
        level_1: typeof toolCall.arguments.level_1 === 'string' ? toolCall.arguments.level_1 : undefined,
        level_2: typeof toolCall.arguments.level_2 === 'string' ? toolCall.arguments.level_2 : undefined,
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
    if (typeof toolCall.arguments.metric_category === 'string') {
      primary.add(toolCall.arguments.metric_category)
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
  const chartGuidanceLoaded = readFilePaths.includes('/assets/financial-analysis/references/chart-guidance.md')

  if (!templatePath && !chartGuidanceLoaded && !previous) return undefined

  return {
    templateLoaded: previous?.templateLoaded || Boolean(templatePath),
    templatePath: templatePath || previous?.templatePath,
    chartGuidanceLoaded: previous?.chartGuidanceLoaded || chartGuidanceLoaded,
    chartOutputMode:
      previous?.chartOutputMode || templatePath || previous?.templatePath || chartGuidanceLoaded
        ? 'fenced_html_code_block'
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
  if (sessionContext.reportMode?.chartOutputMode) {
    lines.push(`- chart_output_mode: ${sessionContext.reportMode.chartOutputMode}`)
  }
  if (typeof sessionContext.reportMode?.chartGuidanceLoaded === 'boolean') {
    lines.push(`- chart_guidance_loaded: ${sessionContext.reportMode.chartGuidanceLoaded ? 'yes' : 'no'}`)
  }
  lines.push('- note: reuse this context unless the user explicitly changes scope, time, report type, or goal; when scope is already high-confidence and unchanged, do not call resolve_org_nodes again; resolve again only if the user changes the target or the scope is ambiguous.')

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
