import type { LLMConfig } from '@/lib/llmConfig'
import type { AgentStep, AgentLLMMessage, ToolCall } from './types'
import { TOOL_DEFINITIONS } from './tools'
import { executeTool } from './tools'
import { AGENT_SYSTEM_PROMPT } from './prompt'
import { callLLM } from './llm'
import { trimHistory } from './memory'

const MAX_ITERATIONS = 8
// How many user↔assistant turns to keep in the rolling context window
const MAX_HISTORY_TURNS = 6
// Max characters per tool result before truncation
const TOOL_RESULT_LIMIT = 12000
// Guardrail: avoid too many tool calls in one iteration
const MAX_TOOL_CALLS_PER_ITERATION = 6

function stableStringify(value: unknown): string {
  if (value == null) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

export async function runAgent(
  question: string,
  config: LLMConfig,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  onStep: (step: AgentStep) => void,
  sessionId?: string,
  signal?: AbortSignal,
): Promise<string> {
  // Only include web_search tool when API key is configured
  const tools = config.tavilyApiKey
    ? TOOL_DEFINITIONS
    : TOOL_DEFINITIONS.filter((t) => t.name !== 'web_search')

  // Trim history to avoid blowing up the context window
  const trimmedHistory = trimHistory(history, MAX_HISTORY_TURNS)

  // Build message history: previous Q&A pairs + current question
  const messages: AgentLLMMessage[] = []
  for (const h of trimmedHistory) {
    messages.push({ role: h.role, content: h.content })
  }
  messages.push({ role: 'user', content: question })

  // Track call signatures to detect and break loops
  const callSignatures = new Set<string>()

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    // On the last iteration: strip tools to force a final synthesised answer
    const iterTools = i === MAX_ITERATIONS - 1 ? [] : tools

    let streamedText = ''
    let streamedReasoning = ''

    const response = await callLLM(config, AGENT_SYSTEM_PROMPT, messages, iterTools, {
      signal,
      streaming: true,
      callbacks: {
        onText: (delta) => {
          // Only stream deltas when no tool calls are expected yet
          // (we'll know after the full response; handle via clear_stream if needed)
          streamedText += delta
          onStep({ type: 'answer_delta', content: delta })
        },
        onReasoning: (delta) => {
          streamedReasoning += delta
          onStep({ type: 'reasoning', content: delta })
        },
      },
    })

    // If the model streamed text but then also emitted tool calls, the streamed
    // text was "thinking aloud" — signal the UI to clear the streamed answer.
    if (streamedText && response.toolCalls.length > 0) {
      onStep({ type: 'clear_stream', content: '' })
      onStep({ type: 'thinking', content: streamedText })
    }

    // No tool calls → final answer (already streamed)
    if (response.toolCalls.length === 0) {
      const answer = response.text || '抱歉，我无法生成回答。'
      onStep({ type: 'answer', content: answer })
      return answer
    }

    // Dedup + guardrail: filter duplicate calls and cap per-iteration volume
    const newToolCalls: ToolCall[] = []
    if (response.toolCalls.length > MAX_TOOL_CALLS_PER_ITERATION) {
      onStep({
        type: 'thinking',
        content: `本轮工具调用请求过多（${response.toolCalls.length} 个），仅执行前 ${MAX_TOOL_CALLS_PER_ITERATION} 个，剩余调用将以提示结果返回。`,
      })
    }

    for (let idx = 0; idx < response.toolCalls.length; idx++) {
      const tc = response.toolCalls[idx]

      if (idx >= MAX_TOOL_CALLS_PER_ITERATION) {
        messages.push({
          role: 'tool',
          toolCallId: tc.id,
          name: tc.name,
          content: JSON.stringify({ warning: '本轮工具调用数量超限，已跳过该调用，请基于已返回数据继续分析。' }),
        })
        continue
      }

      const sig = `${tc.name}:${stableStringify(tc.args)}`
      if (callSignatures.has(sig)) {
        // Duplicate call detected — add a synthetic result to keep the message
        // chain valid and hint the model to move on
        onStep({ type: 'thinking', content: `⚠️ 检测到重复调用 ${tc.name}，跳过以避免无限循环。` })
        messages.push({
          role: 'tool',
          toolCallId: tc.id,
          name: tc.name,
          content: JSON.stringify({ warning: '此工具已被调用过相同参数，结果不变，请基于已有数据给出结论。' }),
        })
      } else {
        callSignatures.add(sig)
        newToolCalls.push(tc)
      }
    }

    // Record assistant message with all tool calls (including dupes, for API correctness)
    messages.push({
      role: 'assistant',
      content: response.text || '',
      toolCalls: response.toolCalls,
      reasoningContent: response.reasoningContent,
    })

    if (!newToolCalls.length) continue

    // Execute non-duplicate tool calls in parallel
    const toolCallStepIds = newToolCalls.map((tc) => {
      onStep({ type: 'tool_call', content: `调用 ${tc.name}`, toolName: tc.name, toolArgs: tc.args, toolCallId: tc.id })
      return tc
    })

    const results = await Promise.all(
      toolCallStepIds.map(async (tc) => {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
        const raw = await executeTool(tc.name, tc.args, { tavilyApiKey: config.tavilyApiKey, sessionId })
        const truncated = raw.length > TOOL_RESULT_LIMIT
          ? raw.slice(0, TOOL_RESULT_LIMIT) + '\n...(数据已截断，请使用 columns 参数指定需要的字段以减少数据量)'
          : raw
        return { tc, result: truncated }
      }),
    )

    for (const { tc, result } of results) {
      onStep({ type: 'tool_result', content: result, toolName: tc.name, toolCallId: tc.id })
      messages.push({ role: 'tool', toolCallId: tc.id, name: tc.name, content: result })
    }
  }

  // MAX_ITERATIONS reached — the last iteration already stripped tools so the
  // model should have returned a final answer above. This is the last fallback.
  const fallback = '已完成数据收集，但超出分析轮次上限。请尝试更具体的问题以获取精准答案。'
  onStep({ type: 'answer', content: fallback })
  return fallback
}
