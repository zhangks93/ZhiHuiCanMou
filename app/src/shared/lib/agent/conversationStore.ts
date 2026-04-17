import { invokeTauri, isTauriRuntime } from '@/shared/lib/tauri'
import { externalizeConversationArtifacts } from './artifactStore'
import type { ArtifactPayloadRecord, Conversation } from './types'

const MAX_CONVERSATIONS = 50

interface ConversationWire {
  id: string
  title: string
  messages: Conversation['messages']
  memory?: Conversation['memory']
  context?: Conversation['context']
  createdAt: number
  updatedAt: number
}

function toConversationWire(conversation: Conversation): ConversationWire {
  return {
    id: conversation.id,
    title: conversation.title,
    messages: conversation.messages,
    memory: conversation.memory,
    context: conversation.context,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  }
}

function normalizeConversations(conversations: Conversation[]): Conversation[] {
  return conversations.map((conversation) => ({
    ...conversation,
    memory: conversation.memory?.version === 1
      ? {
          ...conversation.memory,
          artifacts: Array.isArray(conversation.memory.artifacts) ? conversation.memory.artifacts : [],
        }
      : { version: 1, artifacts: [] },
    context: conversation.context?.version === 1 ? conversation.context : { version: 1 },
  }))
}

function normalizePayloadRecords(payloadRecords: ArtifactPayloadRecord[]): ArtifactPayloadRecord[] {
  return payloadRecords.map((record) => ({
    id: record.id,
    artifactId: record.artifactId,
    conversationId: record.conversationId,
    payload: record.payload,
    toolName: record.toolName,
    createdAt: record.createdAt,
  }))
}

export async function loadConversations(agentId: string): Promise<Conversation[]> {
  if (!isTauriRuntime()) {
    return []
  }

  const conversations = await invokeTauri<ConversationWire[]>('agent_chat_list_conversations', { agentId })
  return normalizeConversations(Array.isArray(conversations) ? conversations as Conversation[] : [])
}

export async function saveConversations(conversations: Conversation[], agentId: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error('智能体对话持久化仅支持本地客户端，请在桌面端使用。')
  }

  const trimmed = normalizeConversations(conversations.slice(0, MAX_CONVERSATIONS))
  const { sanitizedConversations, payloadRecords } = externalizeConversationArtifacts(trimmed)

  await invokeTauri('agent_chat_save_conversations', {
    agentId,
    conversations: sanitizedConversations.map(toConversationWire),
    payloadRecords: normalizePayloadRecords(payloadRecords),
  })
}

export async function upsertConversation(conversation: Conversation, agentId: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error('智能体对话持久化仅支持本地客户端，请在桌面端使用。')
  }

  const normalizedConversation = normalizeConversations([conversation])[0]
  const { sanitizedConversations, payloadRecords } = externalizeConversationArtifacts([normalizedConversation])

  await invokeTauri('agent_chat_upsert_conversation', {
    agentId,
    conversation: toConversationWire(sanitizedConversations[0]),
    payloadRecords: normalizePayloadRecords(payloadRecords),
  })
}

export async function prunePersistedConversations(agentId: string, keepConversationIds: string[]): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error('智能体对话持久化仅支持本地客户端，请在桌面端使用。')
  }

  await invokeTauri('agent_chat_prune_conversations', {
    agentId,
    keepConversationIds,
  })
}

export async function deletePersistedConversation(agentId: string, conversationId: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error('智能体对话持久化仅支持本地客户端，请在桌面端使用。')
  }

  await invokeTauri('agent_chat_delete_conversation', {
    agentId,
    conversationId,
  })
}

export function createConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: '新对话',
    messages: [],
    memory: {
      version: 1,
      artifacts: [],
    },
    context: {
      version: 1,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function deleteConversation(conversations: Conversation[], id: string): Conversation[] {
  return conversations.filter((conversation) => conversation.id !== id)
}

export async function loadConversationsLegacy(): Promise<Conversation[]> {
  return loadConversations('financial-analysis')
}

export async function saveConversationsLegacy(conversations: Conversation[]): Promise<void> {
  await saveConversations(conversations, 'financial-analysis')
}
