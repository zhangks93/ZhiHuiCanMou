import { getErrorMessage } from '@/shared/lib/errorMessage'

import type { ChatStreamChunk, RegisteredTool, ToolCallRecord, ToolDefinition } from '../types'
import { buildAssistantApiMessage, type OpenAICompatibleCapabilities } from './apiMessages'

export interface ToolExecutionCacheEntry {
  status: 'success' | 'error'
  content: string
}

export interface ToolExecutionState {
  cache: Map<string, ToolExecutionCacheEntry>
  repeatedCachedCoreCallCounts: Map<string, number>
}

export const MAX_TOOL_CALL_DEPTH = 12
export const MAX_CACHED_CORE_CALL_REUSE = 4

const MAX_TOOL_RESULT_CHAR_BUDGET = 12000
const MAX_BUSINESS_REPORT_PACK_CHAR_BUDGET = 1000000
const MAX_READ_FILE_CHAR_BUDGET = 8000
const MAX_QUERY_ROWS_PREVIEW = 24
const MAX_QUERY_TREE_NODES_PREVIEW = 18
const MAX_METRICS_PER_NODE_PREVIEW = 14

const DUPLICATE_TOOL_CALL_WARNING
  = `\n\n> ⚠️ 检测到模型连续多次重复请求同一工具的同一组核心参数，且结果已在缓存中，已停止自动重试。报告核对场景可复用缓存结果，但不应无限重复调用同一查询。请直接基于现有数据完成分析，不要继续重复相同请求。`

const HIERARCHY_CORE_METRICS = [
  'revenue',
  'gross_profit',
  'gross_margin',
  'pretax_profit',
  'pretax_margin',
  'labor_cost',
  'salary',
  'social_insurance',
  'housing_fund',
  'labor_service_fee',
  'other_labor_cost',
  'catering_expense',
  'material_cost',
  'other_expense',
  'external_expense',
  'vehicle_expense',
  'energy_expense',
  'travel_expense',
  'entertainment_expense',
  'headcount',
  'per_capita_revenue',
  'labor_cost_rate',
  'revenue_creation',
  'profit_creation',
] as const

const HIERARCHY_CORE_METRIC_PRIORITY = new Map<string, number>(
  HIERARCHY_CORE_METRICS.map((metric, index) => [metric, index]),
)

function normalizeCoreValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return [...value]
      .map(item => normalizeCoreValue(item))
      .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)))
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => [key, normalizeCoreValue(val)])
    return Object.fromEntries(entries)
  }

  return value
}

function pickCoreArgs(name: string, args: Record<string, unknown>): Record<string, unknown> {
  const toolSpecificKeys: Record<string, string[]> = {
    resolve_org_nodes: ['keyword', 'level'],
    query_with_hierarchy: ['node_name', 'report_type', 'period_type', 'period', 'metric_categories', 'sheet_codes'],
    query_business_report_pack: ['node_name', 'month', 'previous_month', 'cumulative_period', 'report_types', 'max_units'],
    compose_business_report: ['node_name', 'month', 'previous_month', 'cumulative_period', 'report_types', 'max_units'],
    query_biz_data: ['node_name', 'metric_category', 'metric_categories', 'report_type', 'period_type', 'period', 'sheet_codes'],
    audit_business_report: ['markdown'],
    read_file: ['path'],
  }

  const keys = toolSpecificKeys[name]
  if (!keys) {
    return args
  }

  const pickedEntries = keys
    .filter(key => key in args && args[key] !== undefined)
    .map(key => [key, normalizeCoreValue(args[key])])

  return Object.fromEntries(pickedEntries)
}

export interface ParsedToolArguments {
  args: Record<string, unknown>
  parseFailed: boolean
  raw: string
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(',')}}`
}

export function parseToolArguments(rawArguments: string | undefined): ParsedToolArguments {
  const raw = typeof rawArguments === 'string' ? rawArguments : ''
  if (!raw.trim()) {
    return { args: {}, parseFailed: false, raw: '' }
  }

  try {
    return {
      args: JSON.parse(raw) as Record<string, unknown>,
      parseFailed: false,
      raw,
    }
  } catch {
    return {
      args: {},
      parseFailed: true,
      raw,
    }
  }
}

export function buildToolCallSignature(name: string, parsed: ParsedToolArguments): string {
  if (parsed.parseFailed) {
    return `${name}:__raw__:${parsed.raw.trim()}`
  }
  return `${name}:${stableStringify(parsed.args)}`
}

export function buildToolCallCoreSignature(name: string, parsed: ParsedToolArguments): string {
  if (parsed.parseFailed) {
    return `${name}:__core_raw__:${parsed.raw.trim()}`
  }
  return `${name}:${stableStringify(pickCoreArgs(name, parsed.args))}`
}

export function buildCachedReuseReminder(name: string, parsed: ParsedToolArguments, repeatCount: number): string {
  const coreArgs = parsed.parseFailed
    ? parsed.raw.trim() || '{}'
    : stableStringify(pickCoreArgs(name, parsed.args))

  const truncatedArgs = coreArgs.length > 240 ? `${coreArgs.slice(0, 240)}...` : coreArgs
  const severity = repeatCount >= MAX_CACHED_CORE_CALL_REUSE
    ? '禁止再次调用这组完全相同的参数。'
    : '请直接复用已有结果继续。'

  return `- ${name} ${truncatedArgs}：该结果已在本轮中返回并从缓存复用 ${repeatCount} 次，${severity}`
}

function truncateText(content: string, maxChars: number, reason: string): string {
  if (content.length <= maxChars) return content

  const headChars = Math.max(0, Math.floor(maxChars * 0.7))
  const tailChars = Math.max(0, maxChars - headChars)
  const head = content.slice(0, headChars).trimEnd()
  const tail = content.slice(-tailChars).trimStart()

  return [
    head,
    '',
    `[tool_result_truncated: ${reason}; original_chars=${content.length}; kept_chars=${head.length + tail.length}]`,
    '',
    tail,
  ].join('\n')
}

function compactQueryRowsResult(content: string): string {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>
    if (!Array.isArray(parsed.rows) || parsed.rows.length <= MAX_QUERY_ROWS_PREVIEW) {
      return content.length <= MAX_TOOL_RESULT_CHAR_BUDGET
        ? content
        : truncateText(content, MAX_TOOL_RESULT_CHAR_BUDGET, 'query result exceeded model context budget')
    }

    return JSON.stringify({
      ...parsed,
      rows: parsed.rows.slice(0, MAX_QUERY_ROWS_PREVIEW),
      rows_truncated: true,
      original_row_count: parsed.rows.length,
      tool_result_compacted: true,
    }, null, 2)
  } catch {
    return truncateText(content, MAX_TOOL_RESULT_CHAR_BUDGET, 'query result exceeded model context budget')
  }
}

function compactHierarchyMetrics(metrics: unknown[]): {
  metrics: unknown[]
  metricsTruncated: boolean
  nonCoreMetricsTruncated: boolean
} {
  if (metrics.length <= MAX_METRICS_PER_NODE_PREVIEW) {
    return {
      metrics,
      metricsTruncated: false,
      nonCoreMetricsTruncated: false,
    }
  }

  const sortedMetrics = [...metrics].sort((a, b) => {
    const metricA = a && typeof a === 'object' ? (a as Record<string, unknown>).metric : undefined
    const metricB = b && typeof b === 'object' ? (b as Record<string, unknown>).metric : undefined
    const priorityA = typeof metricA === 'string' ? HIERARCHY_CORE_METRIC_PRIORITY.get(metricA) : undefined
    const priorityB = typeof metricB === 'string' ? HIERARCHY_CORE_METRIC_PRIORITY.get(metricB) : undefined

    if (priorityA !== undefined && priorityB !== undefined) return priorityA - priorityB
    if (priorityA !== undefined) return -1
    if (priorityB !== undefined) return 1

    return stableStringify(a).localeCompare(stableStringify(b))
  })

  const keptMetrics = sortedMetrics.slice(0, MAX_METRICS_PER_NODE_PREVIEW)
  const truncatedMetrics = sortedMetrics.slice(MAX_METRICS_PER_NODE_PREVIEW)
  const nonCoreMetricsTruncated = truncatedMetrics.every(metric => {
    const metricKey = metric && typeof metric === 'object'
      ? (metric as Record<string, unknown>).metric
      : undefined
    return typeof metricKey !== 'string' || !HIERARCHY_CORE_METRIC_PRIORITY.has(metricKey)
  })

  return {
    metrics: keptMetrics,
    metricsTruncated: !nonCoreMetricsTruncated,
    nonCoreMetricsTruncated,
  }
}

function compactHierarchyNode(node: unknown, remaining: { value: number }): unknown {
  if (!node || typeof node !== 'object') return node
  if (remaining.value <= 0) return null
  remaining.value -= 1

  const nodeRecord = node as Record<string, unknown>
  const rawMetrics = Array.isArray(nodeRecord.metrics) ? nodeRecord.metrics : []
  const rawChildren = Array.isArray(nodeRecord.children) ? nodeRecord.children : []
  const children: unknown[] = []
  const compactedMetrics = compactHierarchyMetrics(rawMetrics)

  for (const child of rawChildren) {
    if (remaining.value <= 0) break
    const compacted = compactHierarchyNode(child, remaining)
    if (compacted !== null) children.push(compacted)
  }

  return {
    ...nodeRecord,
    metrics: compactedMetrics.metrics,
    metrics_truncated: compactedMetrics.metricsTruncated ? true : nodeRecord.metrics_truncated,
    non_core_metrics_truncated: compactedMetrics.nonCoreMetricsTruncated ? true : undefined,
    children,
    children_truncated: rawChildren.length > children.length || nodeRecord.children_truncated === true,
  }
}

function compactHierarchyResult(content: string): string {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>
    const remaining = { value: MAX_QUERY_TREE_NODES_PREVIEW }

    if (Array.isArray(parsed.tree)) {
      const tree = parsed.tree
        .map(node => compactHierarchyNode(node, remaining))
        .filter((node): node is Record<string, unknown> => node !== null && typeof node === 'object')

      return JSON.stringify({
        ...parsed,
        tree,
        tree_truncated: tree.length < parsed.tree.length || remaining.value === 0,
        tool_result_compacted: true,
      }, null, 2)
    }

    if (parsed.tree && typeof parsed.tree === 'object') {
      const tree = compactHierarchyNode(parsed.tree, remaining)
      return JSON.stringify({
        ...parsed,
        tree,
        tree_truncated: remaining.value === 0,
        tool_result_compacted: true,
      }, null, 2)
    }

    return content.length <= MAX_TOOL_RESULT_CHAR_BUDGET
      ? content
      : truncateText(content, MAX_TOOL_RESULT_CHAR_BUDGET, 'hierarchy result exceeded model context budget')
  } catch {
    return truncateText(content, MAX_TOOL_RESULT_CHAR_BUDGET, 'hierarchy result exceeded model context budget')
  }
}

function compactBusinessReportPackResult(content: string): string {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>
    const minified = JSON.stringify(parsed)
    return minified.length <= MAX_BUSINESS_REPORT_PACK_CHAR_BUDGET
      ? minified
      : truncateText(minified, MAX_BUSINESS_REPORT_PACK_CHAR_BUDGET, 'business report pack exceeded enlarged model context budget')
  } catch {
    return truncateText(content, MAX_BUSINESS_REPORT_PACK_CHAR_BUDGET, 'business report pack exceeded enlarged model context budget')
  }
}

export function prepareToolResultForModel(name: string, content: string): string {
  if (!content) return content

  if (name === 'read_file') {
    return truncateText(content, MAX_READ_FILE_CHAR_BUDGET, 'reference/template content exceeded model context budget')
  }

  if (name === 'query_with_hierarchy') {
    return compactHierarchyResult(content)
  }

  if (name === 'query_business_report_pack' || name === 'compose_business_report') {
    return compactBusinessReportPackResult(content)
  }

  if (name === 'query_biz_data' || name === 'resolve_org_nodes' || name === 'audit_business_report') {
    return compactQueryRowsResult(content)
  }

  return content.length <= MAX_TOOL_RESULT_CHAR_BUDGET
    ? content
    : truncateText(content, MAX_TOOL_RESULT_CHAR_BUDGET, 'tool result exceeded model context budget')
}

export interface ProcessOpenAIToolCallsParams {
  tools: Map<string, RegisteredTool>
  pendingToolCalls: Map<number, { id: string; name: string; arguments: string }>
  apiMessages: Array<Record<string, unknown>>
  toolDefs: ToolDefinition[]
  depth: number
  toolExecutionState: ToolExecutionState
  assistantThinking: string
  capabilities: OpenAICompatibleCapabilities
  finalizeWithoutTools: (
    apiMessages: Array<Record<string, unknown>>,
    depth: number,
    reason: string,
  ) => AsyncGenerator<ChatStreamChunk>
  callAndProcess: (
    apiMessages: Array<Record<string, unknown>>,
    toolDefs: ToolDefinition[],
    depth: number,
  ) => AsyncGenerator<ChatStreamChunk>
}

export async function* processOpenAIToolCalls(
  params: ProcessOpenAIToolCallsParams,
): AsyncGenerator<ChatStreamChunk> {
  const {
    tools,
    pendingToolCalls,
    apiMessages,
    toolDefs,
    depth,
    toolExecutionState,
    assistantThinking,
    capabilities,
    finalizeWithoutTools,
    callAndProcess,
  } = params

  const assistantToolCalls = Array.from(pendingToolCalls.values()).map(tc => ({
    id: tc.id,
    type: 'function' as const,
    function: { name: tc.name, arguments: tc.arguments },
  }))

  const updatedMessages = [
    ...apiMessages,
    buildAssistantApiMessage(
      { content: '', thinking: assistantThinking },
      capabilities,
      { tool_calls: assistantToolCalls },
    ),
  ]
  const cacheReuseReminders: string[] = []
  let shouldForceAnswerWithoutTools = false

  const parsedToolCalls = Array.from(pendingToolCalls.values()).map(tc => ({
    ...tc,
    parsed: parseToolArguments(tc.arguments),
  }))

  for (const tc of parsedToolCalls) {
    const args = tc.parsed.args

    const toolCallRecord: ToolCallRecord = {
      id: tc.id,
      name: tc.name,
      arguments: args,
      status: 'calling',
    }

    yield { type: 'tool_call', toolCall: toolCallRecord }

    const toolCallSignature = buildToolCallSignature(tc.name, tc.parsed)
    const toolCallCoreSignature = buildToolCallCoreSignature(tc.name, tc.parsed)
    const cachedResult = toolExecutionState.cache.get(toolCallSignature)
    if (cachedResult) {
      const nextRepeatCount = (toolExecutionState.repeatedCachedCoreCallCounts.get(toolCallCoreSignature) || 0) + 1
      toolExecutionState.repeatedCachedCoreCallCounts.set(toolCallCoreSignature, nextRepeatCount)
      cacheReuseReminders.push(buildCachedReuseReminder(tc.name, tc.parsed, nextRepeatCount))

      if (nextRepeatCount >= MAX_CACHED_CORE_CALL_REUSE) {
        shouldForceAnswerWithoutTools = true
        yield {
          type: 'text',
          content: DUPLICATE_TOOL_CALL_WARNING,
        }
      }

      toolCallRecord.status = cachedResult.status
      if (cachedResult.status === 'success') {
        const preparedResult = prepareToolResultForModel(tc.name, cachedResult.content)
        toolCallRecord.result = preparedResult
        updatedMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: preparedResult,
        })
      } else {
        toolCallRecord.error = cachedResult.content
        updatedMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: `Error: ${cachedResult.content}`,
        })
      }
      yield { type: 'tool_result', toolCall: toolCallRecord }
      continue
    }

    const tool = tools.get(tc.name)
    if (!tool) {
      toolCallRecord.status = 'error'
      toolCallRecord.error = `未知工具: ${tc.name}`
      yield { type: 'tool_result', toolCall: toolCallRecord }
      toolExecutionState.cache.set(toolCallSignature, {
        status: 'error',
        content: toolCallRecord.error,
      })

      updatedMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: `Error: unknown tool "${tc.name}"`,
      })
      continue
    }

    try {
      const result = await tool.execute(args)
      const preparedResult = prepareToolResultForModel(tc.name, result)
      toolCallRecord.status = 'success'
      toolCallRecord.result = preparedResult
      yield { type: 'tool_result', toolCall: toolCallRecord }
      toolExecutionState.repeatedCachedCoreCallCounts.delete(toolCallCoreSignature)
      toolExecutionState.cache.set(toolCallSignature, {
        status: 'success',
        content: result,
      })

      updatedMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: preparedResult,
      })
    } catch (err) {
      const errMsg = getErrorMessage(err, '工具执行失败')
      toolCallRecord.status = 'error'
      toolCallRecord.error = errMsg
      yield { type: 'tool_result', toolCall: toolCallRecord }
      toolExecutionState.repeatedCachedCoreCallCounts.delete(toolCallCoreSignature)
      toolExecutionState.cache.set(toolCallSignature, {
        status: 'error',
        content: errMsg,
      })

      updatedMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: `Error: ${errMsg}`,
      })
    }
  }

  if (cacheReuseReminders.length > 0) {
    updatedMessages.push({
      role: 'user',
      content: `系统提醒：以下工具结果已经在本轮返回，请不要再次调用完全相同的工具和参数，直接基于已有结果继续分析或写作。\n${cacheReuseReminders.join('\n')}`,
    })
  }

  if (shouldForceAnswerWithoutTools) {
    yield* finalizeWithoutTools(
      updatedMessages,
      depth + 1,
      '已触发重复工具调用保护',
    )
    return
  }

  yield* callAndProcess(updatedMessages, toolDefs, depth + 1)
}

export interface ClaudeToolStreamContext {
  tools: Map<string, RegisteredTool>
  toolExecutionState: ToolExecutionState
  cacheReuseReminders: string[]
  toolResults: Array<{ id: string; name: string; input: Record<string, unknown>; result: string }>
  shouldForceAnswerWithoutTools: boolean
}

/** Execute a single completed Claude tool_use block (cache, dedupe, executor). */
export async function* executeClaudeToolUseOnStop(
  currentToolUse: { id: string; name: string; input: string },
  ctx: ClaudeToolStreamContext,
): AsyncGenerator<ChatStreamChunk> {
  const parsed = parseToolArguments(currentToolUse.input)
  const args = parsed.args

  const toolCallRecord: ToolCallRecord = {
    id: currentToolUse.id,
    name: currentToolUse.name,
    arguments: args,
    status: 'calling',
  }
  yield { type: 'tool_call', toolCall: toolCallRecord }

  const toolCallSignature = buildToolCallSignature(currentToolUse.name, parsed)
  const toolCallCoreSignature = buildToolCallCoreSignature(currentToolUse.name, parsed)

  const cachedResult = ctx.toolExecutionState.cache.get(toolCallSignature)
  if (cachedResult) {
    const nextRepeatCount = (ctx.toolExecutionState.repeatedCachedCoreCallCounts.get(toolCallCoreSignature) || 0) + 1
    ctx.toolExecutionState.repeatedCachedCoreCallCounts.set(toolCallCoreSignature, nextRepeatCount)
    ctx.cacheReuseReminders.push(buildCachedReuseReminder(currentToolUse.name, parsed, nextRepeatCount))

    if (nextRepeatCount >= MAX_CACHED_CORE_CALL_REUSE) {
      ctx.shouldForceAnswerWithoutTools = true
      yield {
        type: 'text',
        content: DUPLICATE_TOOL_CALL_WARNING,
      }
    }

    if (cachedResult.status === 'success') {
      const preparedResult = prepareToolResultForModel(currentToolUse.name, cachedResult.content)
      toolCallRecord.status = 'success'
      toolCallRecord.result = preparedResult
      ctx.toolResults.push({
        id: currentToolUse.id,
        name: currentToolUse.name,
        input: args,
        result: preparedResult,
      })
    } else {
      toolCallRecord.status = 'error'
      toolCallRecord.error = cachedResult.content
      ctx.toolResults.push({ id: currentToolUse.id, name: currentToolUse.name, input: args, result: `Error: ${cachedResult.content}` })
    }
    yield { type: 'tool_result', toolCall: toolCallRecord }
    return
  }

  const tool = ctx.tools.get(currentToolUse.name)
  if (!tool) {
    toolCallRecord.status = 'error'
    toolCallRecord.error = `未知工具: ${currentToolUse.name}`
    yield { type: 'tool_result', toolCall: toolCallRecord }
    ctx.toolExecutionState.cache.set(toolCallSignature, {
      status: 'error',
      content: toolCallRecord.error,
    })
    ctx.toolResults.push({ id: currentToolUse.id, name: currentToolUse.name, input: args, result: 'Error: unknown tool' })
  } else {
    try {
      const result = await tool.execute(args)
      const preparedResult = prepareToolResultForModel(currentToolUse.name, result)
      toolCallRecord.status = 'success'
      toolCallRecord.result = preparedResult
      yield { type: 'tool_result', toolCall: toolCallRecord }
      ctx.toolExecutionState.repeatedCachedCoreCallCounts.delete(toolCallCoreSignature)
      ctx.toolExecutionState.cache.set(toolCallSignature, {
        status: 'success',
        content: result,
      })
      ctx.toolResults.push({
        id: currentToolUse.id,
        name: currentToolUse.name,
        input: args,
        result: preparedResult,
      })
    } catch (err) {
      const errMsg = getErrorMessage(err, '工具执行失败')
      toolCallRecord.status = 'error'
      toolCallRecord.error = errMsg
      yield { type: 'tool_result', toolCall: toolCallRecord }
      ctx.toolExecutionState.repeatedCachedCoreCallCounts.delete(toolCallCoreSignature)
      ctx.toolExecutionState.cache.set(toolCallSignature, {
        status: 'error',
        content: errMsg,
      })
      ctx.toolResults.push({ id: currentToolUse.id, name: currentToolUse.name, input: args, result: `Error: ${errMsg}` })
    }
  }
}
