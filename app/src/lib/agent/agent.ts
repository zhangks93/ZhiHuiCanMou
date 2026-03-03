import type { LLMConfig } from '@/lib/llmConfig'
import type { AgentStep, AgentLLMMessage } from './types'
import { TOOL_DEFINITIONS } from './tools'
import { executeTool } from './tools'
import { AGENT_SYSTEM_PROMPT } from './prompt'
import { callLLM } from './llm'

const MAX_ITERATIONS = 8

export async function runAgent(
  question: string,
  config: LLMConfig,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  onStep: (step: AgentStep) => void,
  sessionId?: string,
): Promise<string> {
  // Only include web_search tool when API key is configured
  const tools = config.tavilyApiKey
    ? TOOL_DEFINITIONS
    : TOOL_DEFINITIONS.filter((t) => t.name !== 'web_search')

  // Build message history: previous Q&A pairs + current question
  const messages: AgentLLMMessage[] = []
  for (const h of history) {
    messages.push({ role: h.role, content: h.content })
  }
  messages.push({ role: 'user', content: question })

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await callLLM(config, AGENT_SYSTEM_PROMPT, messages, tools)

    // Emit thinking if there's text alongside tool calls
    if (response.text && response.toolCalls.length > 0) {
      onStep({ type: 'thinking', content: response.text })
    }

    // No tool calls → final answer
    if (response.toolCalls.length === 0) {
      const answer = response.text || '抱歉，我无法生成回答。'
      onStep({ type: 'answer', content: answer })
      return answer
    }

    // Record assistant message with tool calls
    messages.push({
      role: 'assistant',
      content: response.text || '',
      toolCalls: response.toolCalls,
      reasoningContent: response.reasoningContent,
    })

    // Execute each tool call
    for (const tc of response.toolCalls) {
      onStep({ type: 'tool_call', content: `调用 ${tc.name}`, toolName: tc.name, toolArgs: tc.args })

      const result = await executeTool(tc.name, tc.args, { tavilyApiKey: config.tavilyApiKey, sessionId })

      // Truncate large results to avoid blowing up context
      const truncated = result.length > 12000 ? result.slice(0, 12000) + '\n...(数据已截断，请使用 columns 参数指定需要的字段以减少数据量)' : result
      onStep({ type: 'tool_result', content: truncated, toolName: tc.name })

      messages.push({ role: 'tool', toolCallId: tc.id, name: tc.name, content: truncated })
    }
  }

  const fallback = '已达到最大分析轮次，以下是基于已获取数据的分析。请尝试更具体的问题。'
  onStep({ type: 'answer', content: fallback })
  return fallback
}
