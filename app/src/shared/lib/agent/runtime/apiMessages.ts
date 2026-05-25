import type { LLMConfig } from '@/shared/lib/llmConfig'

import type { ChatMessage } from '../types'

export interface OpenAICompatibleCapabilities {
  reasoningReplay: boolean
  reasoningField: 'reasoning_content' | 'reasoning'
}

export function getOpenAICompatibleCapabilities(config: LLMConfig): OpenAICompatibleCapabilities {
  const normalizedProvider = config.provider.toLowerCase()
  const normalizedModel = config.model.toLowerCase()

  const reasonerModelPatterns = [
    /reasoner/,
    /\br1\b/,
    /reasoning/,
    /thinking/,
  ]
  const isReasoningModel = reasonerModelPatterns.some(pattern => pattern.test(normalizedModel))

  if (normalizedProvider === 'deepseek') {
    return {
      reasoningReplay: isReasoningModel || normalizedModel.startsWith('deepseek-v'),
      reasoningField: 'reasoning_content',
    }
  }

  if (normalizedProvider === 'openrouter') {
    const routesToDeepSeek = normalizedModel.startsWith('deepseek/')
      || normalizedModel.includes('/deepseek-')
      || normalizedModel.includes('deepseek-r1')

    return {
      reasoningReplay: routesToDeepSeek,
      reasoningField: routesToDeepSeek ? 'reasoning_content' : 'reasoning',
    }
  }

  return {
    reasoningReplay: false,
    reasoningField: 'reasoning',
  }
}

export function buildAssistantApiMessage(
  message: Pick<ChatMessage, 'content' | 'thinking'>,
  capabilities: OpenAICompatibleCapabilities,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const assistantMessage: Record<string, unknown> = {
    role: 'assistant',
    content: message.content,
    ...extra,
  }

  if (capabilities.reasoningReplay && message.thinking?.trim()) {
    assistantMessage[capabilities.reasoningField] = message.thinking
  }

  return assistantMessage
}

export function buildApiMessages(
  config: LLMConfig,
  messages: ChatMessage[],
  systemPrompt?: string,
): Array<Record<string, unknown>> {
  const apiMessages: Array<Record<string, unknown>> = []
  const capabilities = getOpenAICompatibleCapabilities(config)

  if (systemPrompt) {
    apiMessages.push({ role: 'system', content: systemPrompt })
  }

  for (const msg of messages) {
    if (msg.role === 'system') continue
    if (msg.role === 'assistant') {
      apiMessages.push(buildAssistantApiMessage(msg, capabilities))
      continue
    }
    apiMessages.push({ role: msg.role, content: msg.content })
  }

  return apiMessages
}
