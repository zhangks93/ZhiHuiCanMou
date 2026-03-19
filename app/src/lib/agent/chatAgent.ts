// Chat Agent - Core LLM interaction with tool-calling support

import type { LLMConfig } from '@/lib/llmConfig'
import type { ChatMessage, ToolCallRecord, ToolDefinition, RegisteredTool, ChatStreamChunk } from './types'
import { appFetch } from '@/lib/httpClient'

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

    // First LLM call (depth=0)
    yield* this.callAndProcess(apiMessages, toolDefs, 0)
  }

  private async *callAndProcess(
    apiMessages: Array<Record<string, unknown>>,
    toolDefs: ToolDefinition[],
    depth: number,
  ): AsyncGenerator<ChatStreamChunk> {
    // ReAct safety: prevent runaway tool call loops
    if (depth >= 8) {
      yield { type: 'text', content: '\n\n> ⚠️ 已达到最大工具调用轮次（8轮），请尝试缩小查询范围或分步提问。' }
      return
    }
    if (this.config.provider === 'claude') {
      yield* this.callClaude(apiMessages, toolDefs, depth)
    } else {
      yield* this.callOpenAI(apiMessages, toolDefs, depth)
    }
  }

  // --- OpenAI-compatible streaming (works with DeepSeek, etc.) ---

  private async *callOpenAI(
    apiMessages: Array<Record<string, unknown>>,
    toolDefs: ToolDefinition[],
    depth: number,
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
              yield* this.processToolCalls(pendingToolCalls, apiMessages, toolDefs, depth)
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
      yield* this.processToolCalls(pendingToolCalls, apiMessages, toolDefs, depth)
    }
  }

  private async *processToolCalls(
    pendingToolCalls: Map<number, { id: string; name: string; arguments: string }>,
    apiMessages: Array<Record<string, unknown>>,
    toolDefs: ToolDefinition[],
    depth: number,
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

    for (const tc of pendingToolCalls.values()) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(tc.arguments)
      } catch {
        // ignore parse errors
      }

      const toolCallRecord: ToolCallRecord = {
        id: tc.id,
        name: tc.name,
        arguments: args,
        status: 'calling',
      }

      yield { type: 'tool_call', toolCall: toolCallRecord }

      // Execute the tool
      const tool = this.tools.get(tc.name)
      if (!tool) {
        toolCallRecord.status = 'error'
        toolCallRecord.error = `未知工具: ${tc.name}`
        yield { type: 'tool_result', toolCall: toolCallRecord }

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

        updatedMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        })
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        toolCallRecord.status = 'error'
        toolCallRecord.error = errMsg
        yield { type: 'tool_result', toolCall: toolCallRecord }

        updatedMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: `Error: ${errMsg}`,
        })
      }
    }

    // Continue the conversation with tool results (ReAct: next Thought after Observation)
    yield* this.callAndProcess(updatedMessages, toolDefs, depth + 1)
  }

  // --- Claude API streaming ---

  private async *callClaude(
    apiMessages: Array<Record<string, unknown>>,
    toolDefs: ToolDefinition[],
    depth: number,
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
    let hasToolUse = false

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
              let args: Record<string, unknown> = {}
              try {
                args = JSON.parse(currentToolUse.input || '{}')
              } catch {
                // ignore
              }

              const toolCallRecord: ToolCallRecord = {
                id: currentToolUse.id,
                name: currentToolUse.name,
                arguments: args,
                status: 'calling',
              }
              yield { type: 'tool_call', toolCall: toolCallRecord }

              const tool = this.tools.get(currentToolUse.name)
              if (!tool) {
                toolCallRecord.status = 'error'
                toolCallRecord.error = `未知工具: ${currentToolUse.name}`
                yield { type: 'tool_result', toolCall: toolCallRecord }
                toolResults.push({ id: currentToolUse.id, name: currentToolUse.name, input: args, result: `Error: unknown tool` })
              } else {
                try {
                  const result = await tool.execute(args)
                  toolCallRecord.status = 'success'
                  toolCallRecord.result = result
                  yield { type: 'tool_result', toolCall: toolCallRecord }
                  toolResults.push({ id: currentToolUse.id, name: currentToolUse.name, input: args, result })
                } catch (err) {
                  const errMsg = err instanceof Error ? err.message : String(err)
                  toolCallRecord.status = 'error'
                  toolCallRecord.error = errMsg
                  yield { type: 'tool_result', toolCall: toolCallRecord }
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

      const allMessages: Array<Record<string, unknown>> = []
      if (systemMsg) allMessages.push(systemMsg)
      allMessages.push(...followUpMessages)

      // ReAct: next Thought after Observation
      yield* this.callAndProcess(allMessages, toolDefs, depth + 1)
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
