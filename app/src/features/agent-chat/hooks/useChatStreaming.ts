import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AgentDefinition,
  ChatMessage,
  Conversation,
  FinancialAnalysisRuntimeDataContext,
} from '@/shared/lib/agent/types'
import type { ChatAgent } from '@/shared/lib/agent/chatAgent'
import { createConversation } from '@/shared/lib/agent/conversationStore'
import { compactConversation, getRecentMessagesForPrompt } from '@/shared/lib/agent/conversationMemory'
import {
  getFinancialAnalysisRuntimeDataContext,
} from '@/shared/lib/agent/skills/financial-analysis/runtimeContext'
import {
  updateFinancialAnalysisSessionContext,
} from '@/shared/lib/agent/skills/financial-analysis/sessionContext'
import { getErrorMessage } from '@/shared/lib/errorMessage'
import { runPostTurnMemoryReflection } from '@/shared/lib/agent/memory/reflection'

interface UseChatStreamingParams {
  activeAgent?: AgentDefinition
  activeConversationId: string | null
  conversations: Conversation[]
  messages: ChatMessage[]
  input: string
  setInput: (value: string) => void
  setMessages: (messages: ChatMessage[]) => void
  setActiveConversationId: (conversationId: string | null) => void
  setPersistenceError: (value: string | null) => void
  ensureAgentReady: () => Promise<Pick<ChatAgent, 'abort' | 'chat' | 'updateConfig'> | null>
  buildSystemPrompt: (params: {
    agent: AgentDefinition
    conversation?: Conversation
    runtimeDataContext?: FinancialAnalysisRuntimeDataContext
    latestUserQuery?: string
  }) => string | Promise<string>
  syncConversationPersistence: (
    nextConversations: Conversation[],
    changedConversation?: Conversation | null,
  ) => Promise<Conversation[]>
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

export function useChatStreaming(params: UseChatStreamingParams) {
  const {
    activeAgent,
    activeConversationId,
    conversations,
    messages,
    input,
    setInput,
    setMessages,
    setActiveConversationId,
    setPersistenceError,
    ensureAgentReady,
    buildSystemPrompt,
    syncConversationPersistence,
    textareaRef,
  } = params

  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMsg, setStreamingMsg] = useState<ChatMessage | null>(null)
  const streamFrameRef = useRef<number | null>(null)
  const activeSendRunRef = useRef(0)

  const flushStreamingMessage = useCallback((assistantMessage: ChatMessage) => {
    if (streamFrameRef.current !== null) {
      return
    }

    streamFrameRef.current = window.requestAnimationFrame(() => {
      streamFrameRef.current = null
      setStreamingMsg({ ...assistantMessage })
    })
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming || !activeAgent) return

    const sendRunId = activeSendRunRef.current + 1
    activeSendRunRef.current = sendRunId

    let conversationId = activeConversationId
    let nextConversations = conversations
    if (!conversationId) {
      const conversation = createConversation()
      nextConversations = [conversation, ...conversations]
      conversationId = conversation.id
      try {
        await syncConversationPersistence(nextConversations, conversation)
        setActiveConversationId(conversationId)
      } catch (error) {
        setPersistenceError(getErrorMessage(error, '创建对话失败'))
        return
      }
    }

    const currentConversation = nextConversations.find(conversation => conversation.id === conversationId)

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    setIsStreaming(true)
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      streaming: true,
      thinking: '',
      toolCalls: [],
    }
    setStreamingMsg({ ...assistantMessage })

    let runtimeDataContext: FinancialAnalysisRuntimeDataContext | undefined

    try {
      const [resolvedRuntimeDataContext, agentRuntime] = await Promise.all([
        activeAgent.id === 'financial-analysis'
          ? getFinancialAnalysisRuntimeDataContext()
          : Promise.resolve<FinancialAnalysisRuntimeDataContext | undefined>(undefined),
        ensureAgentReady(),
      ])
      runtimeDataContext = resolvedRuntimeDataContext

      if (activeSendRunRef.current !== sendRunId) {
        throw new DOMException('Send aborted', 'AbortError')
      }

      const systemPrompt = await buildSystemPrompt({
        agent: activeAgent,
        conversation: currentConversation,
        runtimeDataContext,
        latestUserQuery: text,
      })

      if (!agentRuntime) throw new Error('AI agent not initialized')
      const promptMessages = getRecentMessagesForPrompt(
        currentConversation?.id === conversationId
          ? [...(currentConversation?.messages || []), userMessage]
          : nextMessages,
      )
      const stream = agentRuntime.chat(promptMessages, systemPrompt)
      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'text':
            assistantMessage.content += chunk.content
            break
          case 'thinking':
            assistantMessage.thinking = `${assistantMessage.thinking || ''}${chunk.content}`
            break
          case 'tool_call':
            assistantMessage.toolCalls = [...(assistantMessage.toolCalls || []), chunk.toolCall]
            break
          case 'tool_result':
            assistantMessage.toolCalls = (assistantMessage.toolCalls || []).map(tc =>
              tc.id === chunk.toolCall.id ? chunk.toolCall : tc,
            )
            break
        }
        flushStreamingMessage(assistantMessage)
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        const errorMessage = getErrorMessage(error, '智能体对话失败，请稍后重试。')
        assistantMessage.content += assistantMessage.content
          ? `\n\n---\n**错误**：${errorMessage}`
          : `**错误**：${errorMessage}`
      }
    }

    if (activeSendRunRef.current !== sendRunId) {
      return
    }

    assistantMessage.streaming = false
    if (!assistantMessage.thinking) delete assistantMessage.thinking
    if (!assistantMessage.toolCalls?.length) delete assistantMessage.toolCalls

    if (streamFrameRef.current !== null) {
      window.cancelAnimationFrame(streamFrameRef.current)
      streamFrameRef.current = null
    }
    setStreamingMsg(null)
    setIsStreaming(false)

    const finalMessages = [...nextMessages, assistantMessage]
    setMessages(finalMessages)

    const updatedConversations = nextConversations.map(conversation => {
      if (conversation.id !== conversationId) return conversation
      const title = conversation.title === '新对话'
        ? text.replace(/\s+/g, ' ').trim().slice(0, 24) + (text.replace(/\s+/g, ' ').trim().length > 24 ? '...' : '')
        : conversation.title
      const financialAnalysisContext = activeAgent.id === 'financial-analysis'
        ? updateFinancialAnalysisSessionContext({
            previous: conversation.context?.financialAnalysis,
            userMessage,
            assistantMessage,
            runtimeDataContext,
          })
        : conversation.context?.financialAnalysis

      return compactConversation({
        ...conversation,
        title,
        messages: finalMessages,
        context: activeAgent.id === 'financial-analysis'
          ? {
              version: 1 as const,
              financialAnalysis: financialAnalysisContext,
            }
          : conversation.context,
        updatedAt: Date.now(),
      })
    })
    try {
      const updatedConversation = updatedConversations.find((conversation) => conversation.id === conversationId)
      await syncConversationPersistence(updatedConversations, updatedConversation)
      if (updatedConversation) {
        void runPostTurnMemoryReflection({
          agent: activeAgent,
          conversation: updatedConversation,
          userMessage,
          assistantMessage,
        }).catch(() => {})
      }
    } catch (error) {
      setPersistenceError(getErrorMessage(error, '保存对话失败'))
    }
  }, [
    activeAgent,
    activeConversationId,
    conversations,
    ensureAgentReady,
    flushStreamingMessage,
    input,
    isStreaming,
    messages,
    setActiveConversationId,
    setInput,
    setMessages,
    setPersistenceError,
    syncConversationPersistence,
    textareaRef,
    buildSystemPrompt,
  ])

  const handleAbort = useCallback((agentRef: React.RefObject<Pick<ChatAgent, 'abort'> | null>) => {
    activeSendRunRef.current += 1
    agentRef.current?.abort()
  }, [])

  useEffect(() => {
    return () => {
      if (streamFrameRef.current !== null) {
        window.cancelAnimationFrame(streamFrameRef.current)
      }
    }
  }, [])

  return {
    isStreaming,
    streamingMsg,
    handleSend,
    handleAbort,
  }
}
