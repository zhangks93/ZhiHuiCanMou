import { appFetch } from '@/lib/httpClient'
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
      out.push({ role: 'assistant', content: content.length ? content : [{ type: 'text', text: '' }] })
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
    let args: Record<string, unknown> = {}
    try { args = JSON.parse(fn.arguments) } catch { args = {} }
    return { id: tc.id as string, name: fn.name, args }
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

// --- Streaming support ---

export interface StreamCallbacks {
  onText?: (delta: string) => void
  onReasoning?: (delta: string) => void
  onToolCall?: (tc: ToolCall) => void
}

async function streamOpenAI(
  res: Response,
  callbacks: StreamCallbacks,
): Promise<LLMResponse> {
  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body for streaming')

  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let fullReasoning = ''
  const toolCallsMap: Map<number, { id: string; name: string; argsRaw: string }> = new Map()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      let parsed: Record<string, unknown>
      try { parsed = JSON.parse(data) } catch { continue }

      const delta = ((parsed.choices as Record<string, unknown>[])?.[0]?.delta ?? {}) as Record<string, unknown>

      // reasoning_content (DeepSeek)
      if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
        fullReasoning += delta.reasoning_content
        callbacks.onReasoning?.(delta.reasoning_content)
      }

      // text content
      if (typeof delta.content === 'string' && delta.content) {
        fullText += delta.content
        callbacks.onText?.(delta.content)
      }

      // tool_calls streaming
      const rawTCs = delta.tool_calls as Array<Record<string, unknown>> | undefined
      if (rawTCs) {
        for (const tc of rawTCs) {
          const idx = tc.index as number
          if (!toolCallsMap.has(idx)) {
            toolCallsMap.set(idx, { id: tc.id as string ?? '', name: '', argsRaw: '' })
          }
          const entry = toolCallsMap.get(idx)!
          if (tc.id) entry.id = tc.id as string
          const fn = tc.function as { name?: string; arguments?: string } | undefined
          if (fn?.name) entry.name += fn.name
          if (fn?.arguments) entry.argsRaw += fn.arguments
        }
      }
    }
  }

  // Parse accumulated tool calls
  const toolCalls: ToolCall[] = []
  for (const [, entry] of [...toolCallsMap.entries()].sort(([a], [b]) => a - b)) {
    let args: Record<string, unknown> = {}
    try { args = JSON.parse(entry.argsRaw) } catch { args = {} }
    const tc: ToolCall = { id: entry.id, name: entry.name, args }
    toolCalls.push(tc)
    callbacks.onToolCall?.(tc)
  }

  return {
    text: fullText || null,
    toolCalls,
    reasoningContent: fullReasoning || null,
  }
}

async function streamClaude(
  res: Response,
  callbacks: StreamCallbacks,
): Promise<LLMResponse> {
  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body for streaming')

  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  const toolCallsMap: Map<string, { id: string; name: string; argsRaw: string }> = new Map()
  let currentToolId: string | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      let parsed: Record<string, unknown>
      try { parsed = JSON.parse(data) } catch { continue }

      const type = parsed.type as string
      if (type === 'content_block_start') {
        const block = parsed.content_block as Record<string, unknown>
        if (block?.type === 'tool_use') {
          currentToolId = block.id as string
          toolCallsMap.set(currentToolId, { id: currentToolId, name: block.name as string, argsRaw: '' })
        }
      } else if (type === 'content_block_delta') {
        const delta = parsed.delta as Record<string, unknown>
        if (delta?.type === 'text_delta') {
          const text = delta.text as string
          fullText += text
          callbacks.onText?.(text)
        } else if (delta?.type === 'input_json_delta' && currentToolId) {
          const entry = toolCallsMap.get(currentToolId)
          if (entry) entry.argsRaw += delta.partial_json as string
        }
      } else if (type === 'content_block_stop') {
        currentToolId = null
      }
    }
  }

  const toolCalls: ToolCall[] = []
  for (const entry of toolCallsMap.values()) {
    let args: Record<string, unknown> = {}
    try { args = JSON.parse(entry.argsRaw) } catch { args = {} }
    const tc: ToolCall = { id: entry.id, name: entry.name, args }
    toolCalls.push(tc)
    callbacks.onToolCall?.(tc)
  }

  return {
    text: fullText || null,
    toolCalls,
  }
}

export async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  messages: AgentLLMMessage[],
  tools: ToolDefinition[],
  opts?: { signal?: AbortSignal; streaming?: boolean; callbacks?: StreamCallbacks },
): Promise<LLMResponse> {
  const { signal, streaming = false, callbacks = {} } = opts ?? {}

  if (config.provider === 'claude') {
    const res = await appFetch(config.apiUrl, {
      method: 'POST',
      signal,
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
        stream: streaming,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Claude API ${res.status}: ${errText || res.statusText}`)
    }
    if (streaming) return streamClaude(res, callbacks)
    return parseClaudeResponse(await res.json())
  }

  // OpenAI-compatible
  const res = await appFetch(config.apiUrl, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: toOpenAIMessages(systemPrompt, messages),
      tools: toOpenAITools(tools),
      max_tokens: 4096,
      stream: streaming,
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenAI API ${res.status}: ${errText || res.statusText}`)
  }
  if (streaming) return streamOpenAI(res, callbacks)
  return parseOpenAIResponse(await res.json())
}

/** Lightweight non-streaming call for side tasks (e.g. title generation) */
export async function callLLMSimple(
  config: LLMConfig,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await callLLM(
    config,
    'You are a helpful assistant. Be concise.',
    [{ role: 'user', content: prompt }],
    [],
    { signal },
  )
  return response.text ?? ''
}
