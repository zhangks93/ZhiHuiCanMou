// LLM Service Extensions for Streaming

import type { LLMConfig } from '@/lib/llmConfig'
import { appFetch } from '@/lib/httpClient'

export interface StreamChunk {
  content: string
  done: boolean
}

/**
 * Call LLM with streaming support
 */
export async function* streamLLMResponse(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: Array<{ role: string; content: string }>
): AsyncGenerator<StreamChunk> {
  if (config.provider === 'openai') {
    yield* streamOpenAI(config, systemPrompt, userMessage, conversationHistory)
  } else if (config.provider === 'claude') {
    yield* streamClaude(config, systemPrompt, userMessage, conversationHistory)
  } else {
    throw new Error(`Unsupported provider: ${config.provider}`)
  }
}

async function* streamOpenAI(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: Array<{ role: string; content: string }>
): AsyncGenerator<StreamChunk> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...(conversationHistory || []),
    { role: 'user', content: userMessage },
  ]

  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Response body is not readable')
  }

  const decoder = new TextDecoder()
  let buffer = ''

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

        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6))
            const content = json.choices?.[0]?.delta?.content
            if (content) {
              yield { content, done: false }
            }
          } catch (e) {
            console.error('Failed to parse SSE line:', trimmed, e)
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  yield { content: '', done: true }
}

async function* streamClaude(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: Array<{ role: string; content: string }>
): AsyncGenerator<StreamChunk> {
  const messages = [
    ...(conversationHistory || []),
    { role: 'user', content: userMessage },
  ]

  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      system: systemPrompt,
      messages,
      max_tokens: 4096,
      stream: true,
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status} ${response.statusText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Response body is not readable')
  }

  const decoder = new TextDecoder()
  let buffer = ''

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

          if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
            yield { content: json.delta.text, done: false }
          }
        } catch (e) {
          console.error('Failed to parse SSE line:', trimmed, e)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  yield { content: '', done: true }
}

/**
 * Call LLM without streaming (for skill detection)
 */
export async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
  options?: { responseFormat?: 'json' }
): Promise<string> {
  if (config.provider === 'openai') {
    return callOpenAI(config, systemPrompt, userMessage, options)
  } else if (config.provider === 'claude') {
    return callClaude(config, systemPrompt, userMessage)
  } else {
    throw new Error(`Unsupported provider: ${config.provider}`)
  }
}

async function callOpenAI(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
  options?: { responseFormat?: 'json' }
): Promise<string> {
  const response = await appFetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      ...(options?.responseFormat === 'json' && { response_format: { type: 'json_object' } }),
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const json = await response.json()
  return json.choices[0].message.content
}

async function callClaude(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const response = await appFetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`)
  }

  const json = await response.json()
  return json.content[0].text
}
