import type { LLMConfig } from '@/lib/llmConfig'
import type { ToolDefinition, ToolCall, LLMResponse, AgentLLMMessage } from './types'

// Convert internal messages to OpenAI format
function toOpenAIMessages(system: string, messages: AgentLLMMessage[]) {
  const out: Record<string, unknown>[] = [{ role: 'system', content: system }]
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content })
    } else if (m.role === 'assistant') {
      const msg: Record<string, unknown> = { role: 'assistant', content: m.content || '' }
      // DeepSeek reasoner models require reasoning_content in assistant messages
      if (m.reasoningContent != null) {
        msg.reasoning_content = m.reasoningContent
      }
      if (m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        }))
      }
      out.push(msg)
    } else if (m.role === 'tool') {
      out.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content })
    }
  }
  return out
}

// Convert internal messages to Claude format
function toClaudeMessages(messages: AgentLLMMessage[]) {
  const out: Record<string, unknown>[] = []
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content })
    } else if (m.role === 'assistant') {
      const content: Record<string, unknown>[] = []
      if (m.content) content.push({ type: 'text', text: m.content })
      if (m.toolCalls?.length) {
        for (const tc of m.toolCalls) {
          content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args })
        }
      }
      out.push({ role: 'assistant', content })
    } else if (m.role === 'tool') {
      // Claude needs tool_result inside a user message
      const last = out[out.length - 1] as { role: string; content: unknown[] } | undefined
      const block = { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }
      if (last?.role === 'user' && Array.isArray(last.content)) {
        last.content.push(block)
      } else {
        out.push({ role: 'user', content: [block] })
      }
    }
  }
  return out
}

function toOpenAITools(tools: ToolDefinition[]) {
  return tools.map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }))
}

function toClaudeTools(tools: ToolDefinition[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }))
}

function parseOpenAIResponse(json: Record<string, unknown>): LLMResponse {
  const choice = (json.choices as Record<string, unknown>[])?.[0]
  const msg = choice?.message as Record<string, unknown> | undefined
  const text = (msg?.content as string) || null
  const reasoningContent = (msg?.reasoning_content as string) || null
  const rawCalls = msg?.tool_calls as Record<string, unknown>[] | undefined
  const toolCalls: ToolCall[] = (rawCalls ?? []).map((tc) => {
    const fn = tc.function as { name: string; arguments: string }
    return { id: tc.id as string, name: fn.name, args: JSON.parse(fn.arguments) }
  })
  return { text, toolCalls, reasoningContent }
}

function parseClaudeResponse(json: Record<string, unknown>): LLMResponse {
  const blocks = json.content as Record<string, unknown>[]
  let text = ''
  const toolCalls: ToolCall[] = []
  for (const b of blocks) {
    if (b.type === 'text') text += b.text as string
    if (b.type === 'tool_use') {
      toolCalls.push({
        id: b.id as string,
        name: b.name as string,
        args: b.input as Record<string, unknown>,
      })
    }
  }
  return { text: text || null, toolCalls }
}

export async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  messages: AgentLLMMessage[],
  tools: ToolDefinition[],
): Promise<LLMResponse> {
  if (config.provider === 'claude') {
    const res = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        system: systemPrompt,
        messages: toClaudeMessages(messages),
        tools: toClaudeTools(tools),
        max_tokens: 4096,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Claude API ${res.status}: ${errText || res.statusText}`)
    }
    return parseClaudeResponse(await res.json())
  }

  // OpenAI-compatible
  const res = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: toOpenAIMessages(systemPrompt, messages),
      tools: toOpenAITools(tools),
      max_tokens: 4096,
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenAI API ${res.status}: ${errText || res.statusText}`)
  }
  return parseOpenAIResponse(await res.json())
}
