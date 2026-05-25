// Chat Agent - Core LLM interaction with tool-calling support

import type { LLMConfig } from '@/shared/lib/llmConfig'

import type { ChatMessage, ChatStreamChunk, RegisteredTool, ToolDefinition } from './types'
import { buildApiMessages, type OpenAICompatibleCapabilities } from './runtime/apiMessages'
import {
  MAX_TOOL_CALL_DEPTH,
  processOpenAIToolCalls,
  type ToolExecutionState,
} from './runtime/toolExecution'
import { type PendingOpenAIToolCall, streamClaudeChatRound, streamOpenAIChatRound } from './runtime/streaming'

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

    const apiMessages = buildApiMessages(this.config, messages, systemPrompt)
    const toolDefs = this.getToolDefinitions()
    const toolExecutionState: ToolExecutionState = {
      cache: new Map(),
      repeatedCachedCoreCallCounts: new Map(),
    }

    yield* this.callAndProcess(apiMessages, toolDefs, 0, toolExecutionState)
  }

  private async *callAndProcess(
    apiMessages: Array<Record<string, unknown>>,
    toolDefs: ToolDefinition[],
    depth: number,
    toolExecutionState: ToolExecutionState,
  ): AsyncGenerator<ChatStreamChunk> {
    if (depth >= MAX_TOOL_CALL_DEPTH) {
      yield { type: 'text', content: `\n\n> ⚠️ 已达到最大工具调用轮次（${MAX_TOOL_CALL_DEPTH}轮），请基于现有结果给出结论，或缩小查询范围后重试。` }
      yield* this.finalizeWithoutTools(
        apiMessages,
        depth,
        toolExecutionState,
        `已达到最大工具调用轮次（${MAX_TOOL_CALL_DEPTH}轮）`,
      )
      return
    }
    if (this.config.provider === 'claude') {
      yield* streamClaudeChatRound({
        config: this.config,
        apiMessages,
        toolDefs,
        depth,
        toolExecutionState,
        tools: this.tools,
        signal: this.abortController?.signal,
        callAndProcess: (msgs, defs, d, state) =>
          this.callAndProcess(msgs, defs, d, state),
        finalizeWithoutTools: (msgs, d, state, reason) =>
          this.finalizeWithoutTools(msgs, d, state, reason),
      })
    } else {
      yield* streamOpenAIChatRound({
        config: this.config,
        apiMessages,
        toolDefs,
        signal: this.abortController?.signal,
        onToolCallsReady: opts =>
          this.runOpenAIToolCalls(opts, apiMessages, toolDefs, depth, toolExecutionState),
      })
    }
  }

  private async *runOpenAIToolCalls(
    opts: {
      pendingToolCalls: Map<number, PendingOpenAIToolCall>
      assistantThinking: string
      capabilities: OpenAICompatibleCapabilities
    },
    apiMessagesForRound: Array<Record<string, unknown>>,
    toolDefsForRound: ToolDefinition[],
    depth: number,
    toolExecutionState: ToolExecutionState,
  ): AsyncGenerator<ChatStreamChunk> {
    yield* processOpenAIToolCalls({
      tools: this.tools,
      pendingToolCalls: opts.pendingToolCalls,
      apiMessages: apiMessagesForRound,
      toolDefs: toolDefsForRound,
      depth,
      toolExecutionState,
      assistantThinking: opts.assistantThinking,
      capabilities: opts.capabilities,
      finalizeWithoutTools: (m, nextDepth, reason) =>
        this.finalizeWithoutTools(m, nextDepth, toolExecutionState, reason),
      callAndProcess: (m, defs, nextDepth) =>
        this.callAndProcess(m, defs, nextDepth, toolExecutionState),
    })
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
      yield* streamClaudeChatRound({
        config: this.config,
        apiMessages: finalMessages,
        toolDefs: [],
        depth,
        toolExecutionState,
        tools: this.tools,
        signal: this.abortController?.signal,
        callAndProcess: (msgs, defs, d, state) =>
          this.callAndProcess(msgs, defs, d, state),
        finalizeWithoutTools: (msgs, d, state, msg) =>
          this.finalizeWithoutTools(msgs, d, state, msg),
      })
    } else {
      yield* streamOpenAIChatRound({
        config: this.config,
        apiMessages: finalMessages,
        toolDefs: [],
        signal: this.abortController?.signal,
        onToolCallsReady: opts =>
          this.runOpenAIToolCalls(opts, finalMessages, [], depth, toolExecutionState),
      })
    }
  }
}
