import type { LLMConfig } from '@/shared/lib/llmConfig'
import { appFetch } from '@/shared/lib/httpClient'

import type { ChatStreamChunk, RegisteredTool, ToolDefinition } from '../types'
import { getOpenAICompatibleCapabilities, type OpenAICompatibleCapabilities } from './apiMessages'
import {
  type ClaudeToolStreamContext,
  executeClaudeToolUseOnStop,
  type ToolExecutionState,
} from './toolExecution'

export type PendingOpenAIToolCall = { id: string; name: string; arguments: string }

export async function* streamOpenAIChatRound(params: {
  config: LLMConfig
  apiMessages: Array<Record<string, unknown>>
  toolDefs: ToolDefinition[]
  signal: AbortSignal | undefined
  onToolCallsReady: (opts: {
    pendingToolCalls: Map<number, PendingOpenAIToolCall>
    assistantThinking: string
    capabilities: OpenAICompatibleCapabilities
  }) => AsyncGenerator<ChatStreamChunk>
}): AsyncGenerator<ChatStreamChunk> {
  const { config, apiMessages, toolDefs, signal, onToolCallsReady } = params

  const capabilities = getOpenAICompatibleCapabilities(config)
  const body: Record<string, unknown> = {
    model: config.model,
    messages: apiMessages,
    stream: true,
  }
  if (toolDefs.length > 0) {
    body.tools = toolDefs
    body.tool_choice = 'auto'
  }

  const response = await appFetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
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
  let assistantThinking = ''
  const pendingToolCalls: Map<number, PendingOpenAIToolCall> = new Map()

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

          if (delta?.reasoning_content) {
            assistantThinking += delta.reasoning_content
            yield { type: 'thinking', content: delta.reasoning_content }
          } else if (delta?.reasoning) {
            assistantThinking += delta.reasoning
            yield { type: 'thinking', content: delta.reasoning }
          }

          if (delta?.content) {
            yield { type: 'text', content: delta.content }
          }

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

          if (json.choices?.[0]?.finish_reason === 'tool_calls') {
            yield* onToolCallsReady({
              pendingToolCalls,
              assistantThinking,
              capabilities,
            })
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

  if (pendingToolCalls.size > 0) {
    yield* onToolCallsReady({
      pendingToolCalls,
      assistantThinking,
      capabilities,
    })
  }
}

export async function* streamClaudeChatRound(params: {
  config: LLMConfig
  apiMessages: Array<Record<string, unknown>>
  toolDefs: ToolDefinition[]
  depth: number
  toolExecutionState: ToolExecutionState
  tools: Map<string, RegisteredTool>
  signal: AbortSignal | undefined
  callAndProcess: (
    apiMessages: Array<Record<string, unknown>>,
    toolDefs: ToolDefinition[],
    depth: number,
    toolExecutionState: ToolExecutionState,
  ) => AsyncGenerator<ChatStreamChunk>
  finalizeWithoutTools: (
    apiMessages: Array<Record<string, unknown>>,
    depth: number,
    toolExecutionState: ToolExecutionState,
    reason: string,
  ) => AsyncGenerator<ChatStreamChunk>
}): AsyncGenerator<ChatStreamChunk> {
  const {
    config,
    apiMessages,
    toolDefs,
    depth,
    toolExecutionState,
    tools,
    signal,
    callAndProcess,
    finalizeWithoutTools,
  } = params

  const systemMsg = apiMessages.find(m => m.role === 'system')
  const nonSystemMessages = apiMessages.filter(m => m.role !== 'system')

  const claudeTools = toolDefs.map(td => ({
    name: td.function.name,
    description: td.function.description,
    input_schema: td.function.parameters,
  }))

  const supportsThinking = /claude-(3\.7|4|opus|sonnet-4|haiku-4)/.test(config.model)

  const body: Record<string, unknown> = {
    model: config.model,
    messages: nonSystemMessages,
    max_tokens: supportsThinking ? 16000 : 4096,
    stream: true,
  }
  if (supportsThinking) {
    body.thinking = { type: 'enabled', budget_tokens: 10000 }
  }
  if (systemMsg) body.system = systemMsg.content
  if (claudeTools.length > 0) body.tools = claudeTools

  const response = await appFetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal,
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
  const toolResults: ClaudeToolStreamContext['toolResults'] = []
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
          } else if (json.type === 'content_block_delta') {
            if (json.delta?.type === 'thinking_delta') {
              yield { type: 'thinking', content: json.delta.thinking }
            } else if (json.delta?.type === 'text_delta') {
              yield { type: 'text', content: json.delta.text }
            } else if (json.delta?.type === 'input_json_delta' && currentToolUse) {
              currentToolUse.input += json.delta.partial_json
            }
          } else if (json.type === 'content_block_stop' && currentToolUse) {
            const ctx: ClaudeToolStreamContext = {
              tools,
              toolExecutionState,
              cacheReuseReminders,
              toolResults,
              shouldForceAnswerWithoutTools: false,
            }
            yield* executeClaudeToolUseOnStop(currentToolUse, ctx)
            shouldForceAnswerWithoutTools = shouldForceAnswerWithoutTools || ctx.shouldForceAnswerWithoutTools
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
      yield* finalizeWithoutTools(
        allMessages,
        depth + 1,
        toolExecutionState,
        '已触发重复工具调用保护',
      )
      return
    }

    yield* callAndProcess(allMessages, toolDefs, depth + 1, toolExecutionState)
  }
}
