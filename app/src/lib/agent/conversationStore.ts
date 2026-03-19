import type { Conversation } from './types'

const STORAGE_KEY = 'agent_conversations'
const MAX_CONVERSATIONS = 50

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Conversation[]
  } catch {
    return []
  }
}

export function saveConversations(conversations: Conversation[]): void {
  const trimmed = conversations.slice(0, MAX_CONVERSATIONS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
}

export function createConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: '新对话',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function deleteConversation(conversations: Conversation[], id: string): Conversation[] {
  return conversations.filter((conversation) => conversation.id !== id)
}
