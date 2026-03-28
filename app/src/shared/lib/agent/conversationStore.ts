import type { Conversation } from './types'
import { createBrowserStore } from '@/shared/storage/createBrowserStore'

const LEGACY_STORAGE_KEY = 'agent_conversations'
const MAX_CONVERSATIONS = 50

function normalizeConversations(conversations: Conversation[]): Conversation[] {
  return conversations.map((conversation) => ({
    ...conversation,
    context: conversation.context?.version === 1 ? conversation.context : { version: 1 },
  }))
}

/**
 * Get storage key for a specific agent
 */
export function getStorageKey(agentId: string): string {
  return `agent_conversations_${agentId}`
}

function getConversationStore(agentId: string) {
  return createBrowserStore<Conversation[]>({
    key: getStorageKey(agentId),
    fallback: [],
    deserialize: (raw) => {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? normalizeConversations(parsed as Conversation[]) : null
    },
  })
}

/**
 * Load conversations for a specific agent
 */
export function loadConversations(agentId: string): Conversation[] {
  try {
    const stored = getConversationStore(agentId).get()
    if (stored.length > 0) return stored

    // Migration: Check for legacy conversations
    if (agentId === 'financial-analysis') {
      return migrateLegacyConversations()
    }
    return []
  } catch {
    return []
  }
}

/**
 * Save conversations for a specific agent
 */
export function saveConversations(conversations: Conversation[], agentId: string): void {
  const trimmed = normalizeConversations(conversations.slice(0, MAX_CONVERSATIONS))
  getConversationStore(agentId).set(trimmed)
}

/**
 * Create a new empty conversation
 */
export function createConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: '新对话',
    messages: [],
    context: {
      version: 1,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/**
 * Delete a conversation by ID
 */
export function deleteConversation(conversations: Conversation[], id: string): Conversation[] {
  return conversations.filter((conversation) => conversation.id !== id)
}

/**
 * Migrate legacy conversations to the new per-agent storage
 */
function migrateLegacyConversations(): Conversation[] {
  try {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!legacyRaw) return []

    const legacyConversations: Conversation[] = normalizeConversations(JSON.parse(legacyRaw) as Conversation[])
    if (!Array.isArray(legacyConversations) || legacyConversations.length === 0) {
      // Clear legacy and return empty
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      return []
    }

    // Migrate to financial-analysis agent storage
    getConversationStore('financial-analysis').set(legacyConversations)
    // Clear legacy storage
    localStorage.removeItem(LEGACY_STORAGE_KEY)

    console.log(`[Agent] Migrated ${legacyConversations.length} legacy conversations to financial-analysis`)
    return legacyConversations
  } catch {
    return []
  }
}

export function subscribeConversations(
  agentId: string,
  listener: (conversations: Conversation[]) => void,
): () => void {
  return getConversationStore(agentId).subscribe(listener)
}

/**
 * Legacy load function - redirects to financial-analysis agent
 * @deprecated Use loadConversations(agentId) instead
 */
export function loadConversationsLegacy(): Conversation[] {
  return loadConversations('financial-analysis')
}

/**
 * Legacy save function - redirects to financial-analysis agent
 * @deprecated Use saveConversations(conversations, agentId) instead
 */
export function saveConversationsLegacy(conversations: Conversation[]): void {
  saveConversations(conversations, 'financial-analysis')
}
