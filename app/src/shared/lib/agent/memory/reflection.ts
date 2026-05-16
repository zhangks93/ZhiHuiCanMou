import type { AgentDefinition, ChatMessage, Conversation } from '@/shared/lib/agent/types'
import { storeAssistantMemory } from './memoryStore'
import type { AssistantMemoryInput } from './types'

const EXPLICIT_MEMORY_PATTERNS: Array<{ pattern: RegExp; namespace: string; tags: string[] }> = [
  { pattern: /请记住(.+)/, namespace: 'working.user.preference', tags: ['explicit'] },
  { pattern: /帮我记住(.+)/, namespace: 'working.user.preference', tags: ['explicit'] },
  { pattern: /我希望你记住(.+)/, namespace: 'working.user.preference', tags: ['explicit'] },
  { pattern: /以后(.+)/, namespace: 'high.decision', tags: ['explicit', 'future'] },
  { pattern: /从现在起(.+)/, namespace: 'high.decision', tags: ['explicit', 'decision'] },
]

export function extractExplicitMemory(
  content: string,
): Pick<AssistantMemoryInput, 'namespace' | 'title' | 'content' | 'tags'> | null {
  const normalized = content.replace(/\s+/g, ' ').trim()
  if (!normalized) return null

  for (const { pattern, namespace, tags } of EXPLICIT_MEMORY_PATTERNS) {
    const match = normalized.match(pattern)
    const captured = match?.[1]?.trim()
    if (captured && captured.length >= 4) {
      return {
        namespace,
        title: captured.slice(0, 40),
        content: captured,
        tags,
      }
    }
  }

  return null
}

export async function runPostTurnMemoryReflection(params: {
  agent: AgentDefinition
  conversation: Conversation
  userMessage: ChatMessage
  assistantMessage: ChatMessage
}): Promise<void> {
  const { agent, conversation, userMessage } = params

  const explicitMemory = extractExplicitMemory(userMessage.content)
  if (!explicitMemory) return

  await storeAssistantMemory({
    namespace: explicitMemory.namespace,
    category: 'core',
    title: explicitMemory.title,
    content: explicitMemory.content,
    importance: 86,
    sourceAgentId: agent.id,
    sourceConversationId: conversation.id,
    sourceMessageId: userMessage.id,
    tags: explicitMemory.tags,
  })
}
