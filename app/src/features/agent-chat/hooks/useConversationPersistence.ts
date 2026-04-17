import { useCallback, useEffect, useState } from 'react'
import type { ChatMessage, Conversation } from '@/shared/lib/agent/types'
import {
  loadConversations,
  upsertConversation,
  prunePersistedConversations,
  deletePersistedConversation,
} from '@/shared/lib/agent/conversationStore'

const DEFAULT_PERSIST_LIMIT = 50

interface UseConversationPersistenceOptions {
  agentId: string
  persistLimit?: number
}

export function useConversationPersistence(options: UseConversationPersistenceOptions) {
  const { agentId, persistLimit = DEFAULT_PERSIST_LIMIT } = options
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isHydrating, setIsHydrating] = useState(true)
  const [persistenceError, setPersistenceError] = useState<string | null>(null)

  const applyConversationList = useCallback((nextConversations: Conversation[]) => {
    const trimmed = nextConversations.slice(0, persistLimit)
    setConversations(trimmed)
    return trimmed
  }, [persistLimit])

  const syncConversationPersistence = useCallback(async (
    nextConversations: Conversation[],
    changedConversation?: Conversation | null,
  ) => {
    const trimmed = applyConversationList(nextConversations)
    setPersistenceError(null)

    if (changedConversation) {
      const persistedConversation =
        trimmed.find((conversation) => conversation.id === changedConversation.id) ?? changedConversation
      await upsertConversation(persistedConversation, agentId)
    }

    await prunePersistedConversations(
      agentId,
      trimmed.map((conversation) => conversation.id),
    )

    return trimmed
  }, [agentId, applyConversationList])

  const deleteConversationPersistence = useCallback(async (id: string, nextConversations: Conversation[]) => {
    const trimmed = applyConversationList(nextConversations)
    setPersistenceError(null)
    await deletePersistedConversation(agentId, id)
    await prunePersistedConversations(
      agentId,
      trimmed.map((conversation) => conversation.id),
    )
    return trimmed
  }, [agentId, applyConversationList])

  useEffect(() => {
    let cancelled = false

    const hydrateConversations = async () => {
      setIsHydrating(true)
      setPersistenceError(null)
      setConversations([])
      setActiveConversationId(null)
      setMessages([])

      try {
        const saved = await loadConversations(agentId)
        if (cancelled) return

        applyConversationList(saved)
        if (saved.length > 0) {
          setActiveConversationId(saved[0].id)
          setMessages(saved[0].messages)
        }
      } catch (error) {
        if (cancelled) return
        setPersistenceError((error as Error).message || '加载历史对话失败')
      } finally {
        if (cancelled) return
        setIsHydrating(false)
      }
    }

    void hydrateConversations()

    return () => {
      cancelled = true
    }
  }, [agentId, applyConversationList])

  return {
    conversations,
    activeConversationId,
    messages,
    isHydrating,
    persistenceError,
    setActiveConversationId,
    setMessages,
    setPersistenceError,
    syncConversationPersistence,
    deleteConversationPersistence,
  }
}
