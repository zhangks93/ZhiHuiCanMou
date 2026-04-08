// Chat Agent - Core LLM interaction with tool-calling support

import type { LLMConfig } from '@/shared/lib/llmConfig'
import type { ChatMessage, ToolCallRecord, ToolDefinition, RegisteredTool, ChatStreamChunk } from './types'
import { appFetch } from '@/shared/lib/httpClient'

interface ToolExecutionCacheEntry {
  status: 'success' | 'error'
  content: string
}

interface ToolExecutionState {
  cache: Map<string, ToolExecutionCacheEntry>
  repeatedCachedCoreCallCounts: Map<string, number>
}

const MAX_TOOL_CALL_DEPTH = 12
const MAX_CACHED_CORE_CALL_REUSE = 4
const MAX_TOOL_RESULT_CHAR_BUDGET = 12000
const MAX_READ_FILE_CHAR_BUDGET = 8000
const MAX_QUERY_ROWS_PREVIEW = 24
const MAX_QUERY_TREE_NODES_PREVIEW = 18
const MAX_METRICS_PER_NODE_PREVIEW = 8

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
    query_biz_data: ['node_name', 'metric_category', 'metric_categories', 'report_type', 'period_type', 'period', 'sheet_codes'],
    query_monthly_plan: ['node_name', 'metric_category', 'month', 'months'],
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

interface ParsedToolArguments {
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

function parseToolArguments(rawArguments: string | undefined): ParsedToolArguments {
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

function buildToolCallSignature(name: string, parsed: ParsedToolArguments): string {
  if (parsed.parseFailed) {
    return `${name}:__raw__:${parsed.raw.trim()}`
  }
  return `${name}:${stableStringify(parsed.args)}`
}

function buildToolCallCoreSignature(name: string, parsed: ParsedToolArguments): string {
  if (parsed.parseFailed) {
    return `${name}:__core_raw__:${parsed.raw.trim()}`
  }
  return `${name}:${stableStringify(pickCoreArgs(name, parsed.args))}`
}

function buildCachedReuseReminder(name: string, parsed: ParsedToolArguments, repeatCount: number): string {
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

function compactHierarchyNode(node: unknown, remaining: { value: number }): unknown {
  if (!node || typeof node !== 'object') return node
  if (remaining.value <= 0) return null
  remaining.value -= 1

  const nodeRecord = node as Record<string, unknown>
  const rawMetrics = Array.isArray(nodeRecord.metrics) ? nodeRecord.metrics : []
  const rawChildren = Array.isArray(nodeRecord.children) ? nodeRecord.children : []
  const children: unknown[] = []

  for (const child of rawChildren) {
    if (remaining.value <= 0) break
    const compacted = compactHierarchyNode(child, remaining)
    if (compacted !== null) children.push(compacted)
  }

  return {
    ...nodeRecord,
    metrics: rawMetrics.slice(0, MAX_METRICS_PER_NODE_PREVIEW),
    metrics_truncated: rawMetrics.length > MAX_METRICS_PER_NODE_PREVIEW ? true : nodeRecord.metrics_truncated,
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

function prepareToolResultForModel(name: string, content: string): string {
  if (!content) return content

  if (name === 'read_file') {
    return truncateText(content, MAX_READ_FILE_CHAR_BUDGET, 'reference/template content exceeded model context budget')
  }

  if (name === 'query_with_hierarchy') {
    return compactHierarchyResult(content)
  }

  if (name === 'query_biz_data' || name === 'query_monthly_plan' || name === 'resolve_org_nodes') {
    return compactQueryRowsResult(content)
  }

  return content.length <= MAX_TOOL_RESULT_CHAR_BUDGET
    ? content
    : truncateText(content, MAX_TOOL_RESULT_CHAR_BUDGET, 'tool result exceeded model context budget')
}

export class ChatAgent {
  private config: LLMConfig
  private tools: Map<string, RegisteredTool> = new Map()
  private abortController: AbortController | null = null

  constructor(config: LLMConfig) {
    this.config = config
  }

  updateConfig(config: LLMConfig) {
    this.config = config
  }

  registerTool(tool: RegisteredTool) {
    this.tools.set(tool.definition.function.name, tool)
  }

  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition)
  }

  abort() {
    this.abortController?.abort()
    this.abortController = null
  }

  /**
   * Send messages to LLM and stream the response.
   * Handles tool calls automatically: when the LLM requests a tool call,
   * we execute it and feed the result back, then continue streaming.
   * Uses ReAct pattern: each round the model reasons, acts, observes, then reasons again.
   */
  async *chat(
    messages: ChatMessage[],
    systemPrompt?: string,
  ): AsyncGenerator<ChatStreamChunk> {
    this.abortController = new AbortController()

    const apiMessages = this.buildApiMessages(messages, systemPrompt)
    const toolDefs = this.getToolDefinitions()
    const toolExecutionState: ToolExecutionState = {
      cache: new Map(),
      repeatedCachedCoreCallCounts: new Map(),
    }

    // First LLM call (depth=0)
    yield* this.callAndProcess(apiMessages, toolDefs, 0, toolExecutionState)
  }

  private async *callAndProcess(
    apiMessages: Array<Record<string, unknown>>,
    toolDefs: ToolDefinition[],
    depth: number,
    toolExecutionState: ToolExecutionState,
  ): AsyncGenerator<ChatStreamChunk> {
    // ReAct safety: prevent runaway tool call loops
    if (depth >= MAX_TOOL_CALL_DEPTH) {
      yield { type: 'text', content: `\n\n> ⚠️ 已达到最大工具调用轮次（${MAX_TOOL_CALL_DEPTH}轮），请基于现有结果给出结论，或缩小查询范围后重试。` }
      yield* this.finalizeWithoutTools(
        apiMessages,
        depth,
        toolExecutionState,
        `已达到最大工具调用轮次（${MAX_TOOL_CALL_DEPTH}轮）`
      )
      return
    }
    if (this.config.provider === 'claude') {
      yield* this.callClaude(apiMessages, toolDefs, depth, toolExecutionState)
    } else {
      yield* this.callOpenAI(apiMessages, toolDefs, depth, toolExecutionState)
    }
  }

  private async *finalizeWithoutTools(
    apiMessages: Array<Record<string, unknown>>,
    depth: number,
    toolExecutionState: ToolExecutionState,
    reason: string,
  ): AsyncGenerator<ChatStreamChunk> {
    const finalMessages = [
      ...apiMessages,
      {
        role: 'user',
        content:
          `系统要求：${reason}。现在禁止继续调用任何工具。请严格基于已经拿到的数据直接输出最终答复；若证据不足，请明确说明不足，不要再尝试查询。`,
      },
    ]

    if (this.config.provider === 'claude') {
      yield* this.callClaude(finalMessages, [], depth, toolExecutionState)
    } else {
      yield* this.callOpenAI(finalMessages, [], depth, toolExecutionState)
    }
  }

  // --- OpenAI-compatible streaming (works with DeepSeek, etc.) ---

  private async *callOpenAI(
    apiMessages: Array<Record<string, unknown>>,
    toolDefs: ToolDefinition[],
    depth: number,
    toolExecutionState: ToolExecutionState,
  ): AsyncGenerator<ChatStreamChunk> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: apiMessages,
      stream: true,
    }
    if (toolDefs.length > 0) {
      body.tools = toolDefs
      body.tool_choice = 'auto'
    }

    const response = await appFetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: this.abortController?.signal,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      if (response.status === 401 || response.status === 403) {
        throw new Error('API Key 无效，请在设置页面检查配置')
      }
      throw new Error(`API 错误 (${response.status}): ${errText.slice(0, 200)}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Response body is not readable')

    const decoder = new TextDecoder()
    let buffer = ''
    // Accumulate tool calls from streaming deltas
    const pendingToolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          try {
            const json = JSON.parse(trimmed.slice(6))
            const delta = json.choices?.[0]?.delta

            // Thinking/reasoning content (DeepSeek, etc.)
            if (delta?.reasoning_content) {
              yield { type: 'thinking', content: delta.reasoning_content }
            } else if (delta?.reasoning) {
              yield { type: 'thinking', content: delta.reasoning }
            }

            // Text content
            if (delta?.content) {
              yield { type: 'text', content: delta.content }
            }

            // Tool call deltas
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0
                if (!pendingToolCalls.has(idx)) {
                  pendingToolCalls.set(idx, { id: tc.id || '', name: '', arguments: '' })
                }
                const pending = pendingToolCalls.get(idx)!
                if (tc.id) pending.id = tc.id
                if (tc.function?.name) pending.name += tc.function.name
                if (tc.function?.arguments) pending.arguments += tc.function.arguments
              }
            }

            // Check finish reason
            if (json.choices?.[0]?.finish_reason === 'tool_calls') {
              // Process accumulated tool calls
              yield* this.processToolCalls(pendingToolCalls, apiMessages, toolDefs, depth, toolExecutionState)
              return
            }
          } catch {
            // skip unparseable lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    // After stream ends, check if we have pending tool calls (some APIs send finish_reason on last chunk)
    if (pendingToolCalls.size > 0) {
      yield* this.processToolCalls(pendingToolCalls, apiMessages, toolDefs, depth, toolExecutionState)
    }
  }

  private async *processToolCalls(
    pendingToolCalls: Map<number, { id: string; name: string; arguments: string }>,
    apiMessages: Array<Record<string, unknown>>,
    toolDefs: ToolDefinition[],
    depth: number,
    toolExecutionState: ToolExecutionState,
  ): AsyncGenerator<ChatStreamChunk> {
    // Build assistant message with tool_calls for the API
    const assistantToolCalls = Array.from(pendingToolCalls.values()).map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: { name: tc.name, arguments: tc.arguments },
    }))

    const updatedMessages = [
      ...apiMessages,
      { role: 'assistant', tool_calls: assistantToolCalls },
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
            content:
              `\n\n> ⚠️ 检测到模型连续多次重复请求同一工具的同一组核心参数，且结果已在缓存中，已停止自动重试。报告核对场景可复用缓存结果，但不应无限重复调用同一查询。请直接基于现有数据完成分析，不要继续重复相同请求。`,
          }
        }

        toolCallRecord.status = cachedResult.status
        if (cachedResult.status === 'success') {
          toolCallRecord.result = cachedResult.content
          updatedMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: prepareToolResultForModel(tc.name, cachedResult.content),
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

      // Execute the tool
      const tool = this.tools.get(tc.name)
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
        toolCallRecord.status = 'success'
        toolCallRecord.result = result
        yield { type: 'tool_result', toolCall: toolCallRecord }
        toolExecutionState.repeatedCachedCoreCallCounts.delete(toolCallCoreSignature)
        toolExecutionState.cache.set(toolCallSignature, {
          status: 'success',
          content: result,
        })

        updatedMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: prepareToolResultForModel(tc.name, result),
        })
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
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
      yield* this.finalizeWithoutTools(
        updatedMessages,
        depth + 1,
        toolExecutionState,
        '已触发重复工具调用保护'
      )
      return
    }

    // Continue the conversation with tool results (ReAct: next Thought after Observation)
    yield* this.callAndProcess(updatedMessages, toolDefs, depth + 1, toolExecutionState)
  }

  // --- Claude API streaming ---

  private async *callClaude(
    apiMessages: Array<Record<string, unknown>>,
    toolDefs: ToolDefinition[],
    depth: number,
    toolExecutionState: ToolExecutionState,
  ): AsyncGenerator<ChatStreamChunk> {
    // Extract system prompt from messages
    const systemMsg = apiMessages.find(m => m.role === 'system')
    const nonSystemMessages = apiMessages.filter(m => m.role !== 'system')

    // Convert tool definitions to Claude format
    const claudeTools = toolDefs.map(td => ({
      name: td.function.name,
      description: td.function.description,
      input_schema: td.function.parameters,
    }))

    // Check if model supports extended thinking (claude-3.7+, claude-4+)
    const supportsThinking = /claude-(3\.7|4|opus|sonnet-4|haiku-4)/.test(this.config.model)

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: nonSystemMessages,
      max_tokens: supportsThinking ? 16000 : 4096,
      stream: true,
    }
    if (supportsThinking) {
      body.thinking = { type: 'enabled', budget_tokens: 10000 }
    }
    if (systemMsg) body.system = systemMsg.content
    if (claudeTools.length > 0) body.tools = claudeTools

    const response = await appFetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: this.abortController?.signal,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      if (response.status === 401 || response.status === 403) {
        throw new Error('API Key 无效，请在设置页面检查配置')
      }
      throw new Error(`Claude API 错误 (${response.status}): ${errText.slice(0, 200)}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Response body is not readable')

    const decoder = new TextDecoder()
    let buffer = ''
    let currentToolUse: { id: string; name: string; input: string } | null = null
    const toolResults: Array<{ id: string; name: string; input: Record<string, unknown>; result: string }> = []
    const cacheReuseReminders: string[] = []
    let hasToolUse = false
    let shouldForceAnswerWithoutTools = false

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          try {
            const json = JSON.parse(trimmed.slice(6))

            if (json.type === 'content_block_start') {
              if (json.content_block?.type === 'tool_use') {
                hasToolUse = true
                currentToolUse = {
                  id: json.content_block.id,
                  name: json.content_block.name,
                  input: '',
                }
              }
              // thinking block start — no action needed, deltas follow
            } else if (json.type === 'content_block_delta') {
              if (json.delta?.type === 'thinking_delta') {
                yield { type: 'thinking', content: json.delta.thinking }
              } else if (json.delta?.type === 'text_delta') {
                yield { type: 'text', content: json.delta.text }
              } else if (json.delta?.type === 'input_json_delta' && currentToolUse) {
                currentToolUse.input += json.delta.partial_json
              }
            } else if (json.type === 'content_block_stop' && currentToolUse) {
              // Tool call complete, execute it
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

              const cachedResult = toolExecutionState.cache.get(toolCallSignature)
              if (cachedResult) {
                const nextRepeatCount = (toolExecutionState.repeatedCachedCoreCallCounts.get(toolCallCoreSignature) || 0) + 1
                toolExecutionState.repeatedCachedCoreCallCounts.set(toolCallCoreSignature, nextRepeatCount)
                cacheReuseReminders.push(buildCachedReuseReminder(currentToolUse.name, parsed, nextRepeatCount))

                if (nextRepeatCount >= MAX_CACHED_CORE_CALL_REUSE) {
                  shouldForceAnswerWithoutTools = true
                  yield {
                    type: 'text',
                    content:
                      `\n\n> ⚠️ 检测到模型连续多次重复请求同一工具的同一组核心参数，且结果已在缓存中，已停止自动重试。报告核对场景可复用缓存结果，但不应无限重复调用同一查询。请直接基于现有数据完成分析，不要继续重复相同请求。`,
                  }
                }

                if (cachedResult.status === 'success') {
                  toolCallRecord.status = 'success'
                  toolCallRecord.result = cachedResult.content
                  toolResults.push({
                    id: currentToolUse.id,
                    name: currentToolUse.name,
                    input: args,
                    result: prepareToolResultForModel(currentToolUse.name, cachedResult.content),
                  })
                } else {
                  toolCallRecord.status = 'error'
                  toolCallRecord.error = cachedResult.content
                  toolResults.push({ id: currentToolUse.id, name: currentToolUse.name, input: args, result: `Error: ${cachedResult.content}` })
                }
                yield { type: 'tool_result', toolCall: toolCallRecord }
                currentToolUse = null
                continue
              }

              const tool = this.tools.get(currentToolUse.name)
              if (!tool) {
                toolCallRecord.status = 'error'
                toolCallRecord.error = `未知工具: ${currentToolUse.name}`
                yield { type: 'tool_result', toolCall: toolCallRecord }
                toolExecutionState.cache.set(toolCallSignature, {
                  status: 'error',
                  content: toolCallRecord.error,
                })
                toolResults.push({ id: currentToolUse.id, name: currentToolUse.name, input: args, result: 'Error: unknown tool' })
              } else {
                try {
                  const result = await tool.execute(args)
                  toolCallRecord.status = 'success'
                  toolCallRecord.result = result
                  yield { type: 'tool_result', toolCall: toolCallRecord }
                  toolExecutionState.repeatedCachedCoreCallCounts.delete(toolCallCoreSignature)
                  toolExecutionState.cache.set(toolCallSignature, {
                    status: 'success',
                    content: result,
                  })
                  toolResults.push({
                    id: currentToolUse.id,
                    name: currentToolUse.name,
                    input: args,
                    result: prepareToolResultForModel(currentToolUse.name, result),
                  })
                } catch (err) {
                  const errMsg = err instanceof Error ? err.message : String(err)
                  toolCallRecord.status = 'error'
                  toolCallRecord.error = errMsg
                  yield { type: 'tool_result', toolCall: toolCallRecord }
                  toolExecutionState.repeatedCachedCoreCallCounts.delete(toolCallCoreSignature)
                  toolExecutionState.cache.set(toolCallSignature, {
                    status: 'error',
                    content: errMsg,
                  })
                  toolResults.push({ id: currentToolUse.id, name: currentToolUse.name, input: args, result: `Error: ${errMsg}` })
                }
              }
              currentToolUse = null
            }
          } catch {
            // skip
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    // If there were tool uses, feed results back to Claude
    if (hasToolUse && toolResults.length > 0) {
      const followUpMessages = [
        ...nonSystemMessages,
        {
          role: 'assistant',
          content: toolResults.map(tr => ({
            type: 'tool_use',
            id: tr.id,
            name: tr.name,
            input: tr.input,
          })),
        },
        {
          role: 'user',
          content: toolResults.map(tr => ({
            type: 'tool_result',
            tool_use_id: tr.id,
            content: tr.result,
          })),
        },
      ]

      if (cacheReuseReminders.length > 0) {
        followUpMessages.push({
          role: 'user',
          content: `系统提醒：以下工具结果已经在本轮返回，请不要再次调用完全相同的工具和参数，直接基于已有结果继续分析或写作。\n${cacheReuseReminders.join('\n')}`,
        })
      }

      const allMessages: Array<Record<string, unknown>> = []
      if (systemMsg) allMessages.push(systemMsg)
      allMessages.push(...followUpMessages)

      if (shouldForceAnswerWithoutTools) {
        yield* this.finalizeWithoutTools(
          allMessages,
          depth + 1,
          toolExecutionState,
          '已触发重复工具调用保护'
        )
        return
      }

      // ReAct: next Thought after Observation
      yield* this.callAndProcess(allMessages, toolDefs, depth + 1, toolExecutionState)
    }
  }

  // --- Helpers ---

  private buildApiMessages(
    messages: ChatMessage[],
    systemPrompt?: string,
  ): Array<Record<string, unknown>> {
    const apiMessages: Array<Record<string, unknown>> = []

    if (systemPrompt) {
      apiMessages.push({ role: 'system', content: systemPrompt })
    }

    for (const msg of messages) {
      if (msg.role === 'system') continue
      apiMessages.push({ role: msg.role, content: msg.content })
    }

    return apiMessages
  }
}
