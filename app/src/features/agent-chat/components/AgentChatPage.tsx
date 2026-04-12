// AgentChatPage - Unified agent chat page
// Combines agent selector, conversation list, and chat interface

import { useState, useEffect, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react'
import {
  Send,
  Square,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

import type {
  AgentDefinition,
  ChatMessage,
  Conversation,
  FinancialAnalysisRuntimeDataContext,
  FinancialAnalysisSessionContext,
} from '@/shared/lib/agent/types'
import { loadConversations, saveConversations, createConversation, deleteConversation } from '@/shared/lib/agent/conversationStore'
import { buildConversationMemoryBlock, compactConversation, getRecentMessagesForPrompt } from '@/shared/lib/agent/conversationMemory'
import { loadLLMConfig } from '@/shared/lib/llmConfig'
import { useAgentConfig } from '@/features/agent-chat/hooks/useAgentConfig'
import {
  buildFinancialAnalysisRuntimeContextBlock,
  getFinancialAnalysisRuntimeDataContext,
} from '@/shared/lib/agent/skills/financial-analysis/runtimeContext'
import {
  buildFinancialAnalysisSessionContextBlock,
  updateFinancialAnalysisSessionContext,
} from '@/shared/lib/agent/skills/financial-analysis/sessionContext'
import { ChatHeader } from './ChatHeader'
import { ConversationList } from './ConversationList'
import { AgentIcon } from './AgentIcon'
import { ChatMessageItem } from './ChatMessageItem'

interface AgentChatPageProps {
  agents: AgentDefinition[]
  defaultAgentId?: string
  onBackToDirectory?: () => void
}

function generateTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > 24 ? `${clean.slice(0, 24)}...` : clean
}

function getFinancialAnalysisContext(conversation?: Conversation): FinancialAnalysisSessionContext | undefined {
  return conversation?.context?.financialAnalysis
}

function buildAgentSystemPrompt(params: {
  agent: AgentDefinition
  conversation?: Conversation
  runtimeDataContext?: FinancialAnalysisRuntimeDataContext
  latestUserQuery?: string
}): string {
  const { agent, conversation, runtimeDataContext, latestUserQuery } = params

  if (agent.id !== 'financial-analysis') {
    return agent.systemPrompt
  }

  const sessionContext = getFinancialAnalysisContext(conversation)
  return [
    agent.systemPrompt,
    buildFinancialAnalysisRuntimeContextBlock(runtimeDataContext),
    buildFinancialAnalysisSessionContextBlock(sessionContext),
    buildConversationMemoryBlock(conversation?.memory, latestUserQuery),
    '## Chart Output Contract\n- In report mode, output charts only as structured chart spec JSON.\n- Do not emit ECharts HTML, raw HTML, or chart placeholder suggestions.\n- If data is insufficient or inconsistent, skip the unsupported chart rather than fabricating it.',
  ].filter(Boolean).join('\n\n')
}

/**
 * Empty state with quick prompts for an agent
 */
function AgentEmptyState({
  agent,
  onPrompt,
}: {
  agent: AgentDefinition
  onPrompt: (prompt: string) => void
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <div className="chat-empty-state">
        <div
          className={['chat-empty-icon', agent.icon.type === 'image' ? 'agent-icon-circle' : ''].join(' ')}
          style={{
            background: `linear-gradient(135deg, ${agent.color}, ${agent.color}dd)`,
          }}
        >
          <AgentIcon icon={agent.icon} size={20} strokeWidth={1.7} fit="container" />
        </div>
        <div className="space-y-2 text-center">
          <div>
            <h2 className="text-title font-semibold text-[var(--color-text-strong)]">{agent.name}</h2>
            <p className="mx-auto mt-1.5 max-w-xl text-caption leading-6 text-[var(--color-text-muted)]">
              {agent.description}
            </p>
          </div>
          {agent.quickPrompts && agent.quickPrompts.length > 0 && (
            <div className="chat-prompt-grid">
              {agent.quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="chat-prompt-card"
                  onClick={() => onPrompt(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Configuration required prompt
 */
function ConfigPrompt() {
  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="chat-config-card">
        <Settings size={28} className="text-[var(--color-text-muted)]" />
        <div className="space-y-1.5 text-center">
          <h2 className="text-body font-semibold text-[var(--color-text-strong)]">请先配置 AI 模型</h2>
          <p className="text-caption leading-6 text-[var(--color-text-muted)]">
            前往设置页填写 API Key 和模型名称
          </p>
        </div>
        <a href="/settings" className="btn btn-primary btn-sm">
          前往设置
        </a>
      </div>
    </div>
  )
}

export function AgentChatPage({
  agents,
  defaultAgentId,
  onBackToDirectory,
}: AgentChatPageProps) {
  const activeAgentId = defaultAgentId || agents[0]?.id || 'financial-analysis'
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMsg, setStreamingMsg] = useState<ChatMessage | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [historyCollapsed, setHistoryCollapsed] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)
  const agentRef = useRef<InstanceType<typeof import('@/shared/lib/agent').ChatAgent> | null>(null)
  const { configOk } = useAgentConfig(agentRef)

  const activeAgent = agents.find(a => a.id === activeAgentId) || agents[0]

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleResize = () => {
      const desktop = window.innerWidth >= 1024
      setIsDesktop(desktop)
      if (desktop) {
        setSidebarOpen(true)
      } else {
        setHistoryCollapsed(false)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const saved = loadConversations(activeAgentId)
    setConversations(saved)
    if (saved.length > 0) {
      setActiveConversationId(saved[0].id)
      setMessages(saved[0].messages)
    } else {
      setActiveConversationId(null)
      setMessages([])
    }
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setSidebarOpen(true)
    }
  }, [activeAgentId])

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      const behavior = messages.length > 0 ? 'smooth' : 'auto'
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' })
    }
  }, [messages, streamingMsg])

  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    shouldAutoScrollRef.current = distanceFromBottom < 120
  }, [])

  const persist = useCallback((nextConversations: Conversation[]) => {
    setConversations(nextConversations)
    saveConversations(nextConversations, activeAgentId)
  }, [activeAgentId])

  const handleNewConversation = useCallback(() => {
    const conversation = createConversation()
    const nextConversations = [conversation, ...conversations]
    persist(nextConversations)
    setActiveConversationId(conversation.id)
    setMessages([])
    shouldAutoScrollRef.current = true
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    textareaRef.current?.focus()
  }, [conversations, persist])

  const handleSelectConversation = useCallback((id: string) => {
    if (isStreaming) return

    if (activeConversationId && messages.length > 0) {
      const updated = conversations.map(c => {
        if (c.id === activeConversationId) {
          return {
            ...c,
            messages,
            updatedAt: Date.now(),
          }
        }
        return c
      })
      persist(updated)
    }

    const conversation = conversations.find(item => item.id === id)
    if (!conversation) return

    setActiveConversationId(id)
    setMessages(conversation.messages)
    shouldAutoScrollRef.current = true
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [conversations, activeConversationId, messages, isStreaming, persist])

  const handleDeleteConversation = useCallback((id: string) => {
    if (isStreaming) return
    const nextConversations = deleteConversation(conversations, id)
    persist(nextConversations)
    if (activeConversationId === id) {
      if (nextConversations.length > 0) {
        setActiveConversationId(nextConversations[0].id)
        setMessages(nextConversations[0].messages)
      } else {
        setActiveConversationId(null)
        setMessages([])
      }
    }
  }, [conversations, activeConversationId, isStreaming, persist])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming || !activeAgent) return

    const { ChatAgent } = await import('@/shared/lib/agent')
    const { queryBizDataTool, queryWithHierarchyTool, queryMonthlyPlanTool, resolveOrgNodesTool, readFileTool } = await import('@/shared/lib/agent')

    let conversationId = activeConversationId
    let nextConversations = conversations
    if (!conversationId) {
      const conversation = createConversation()
      nextConversations = [conversation, ...conversations]
      conversationId = conversation.id
      persist(nextConversations)
      setActiveConversationId(conversationId)
    }

    const currentConversation = nextConversations.find(conversation => conversation.id === conversationId)
    const runtimeDataContext = activeAgent.id === 'financial-analysis'
      ? await getFinancialAnalysisRuntimeDataContext()
      : undefined
    const systemPrompt = buildAgentSystemPrompt({
      agent: activeAgent,
      conversation: currentConversation,
      runtimeDataContext,
      latestUserQuery: text,
    })

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    shouldAutoScrollRef.current = true

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    if (!agentRef.current) {
      const config = loadLLMConfig()
      if (config) {
        const agent = new ChatAgent(config)
        agent.registerTool(resolveOrgNodesTool)
        agent.registerTool(queryWithHierarchyTool)
        agent.registerTool(queryMonthlyPlanTool)
        agent.registerTool(queryBizDataTool)
        agent.registerTool(readFileTool)
        agentRef.current = agent
      }
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

    try {
      if (!agentRef.current) throw new Error('AI agent not initialized')
      const promptMessages = getRecentMessagesForPrompt(
        currentConversation?.id === conversationId
          ? [...(currentConversation?.messages || []), userMessage]
          : nextMessages
      )
      const stream = agentRef.current.chat(promptMessages, systemPrompt)
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
              tc.id === chunk.toolCall.id ? chunk.toolCall : tc
            )
            break
        }
        setStreamingMsg({ ...assistantMessage })
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        assistantMessage.content += assistantMessage.content
          ? `\n\n---\n**错误**：${(error as Error).message}`
          : `**错误**：${(error as Error).message}`
      }
    }

    assistantMessage.streaming = false
    if (!assistantMessage.thinking) delete assistantMessage.thinking
    if (!assistantMessage.toolCalls?.length) delete assistantMessage.toolCalls

    setStreamingMsg(null)
    setIsStreaming(false)

    const finalMessages = [...nextMessages, assistantMessage]
    setMessages(finalMessages)

    const updatedConversations = nextConversations.map(conversation => {
      if (conversation.id !== conversationId) return conversation
      const title = conversation.title === '新对话' ? generateTitle(text) : conversation.title
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
    persist(updatedConversations)
  }, [activeAgent, activeConversationId, conversations, input, isStreaming, messages, persist])

  const handleAbort = useCallback(() => {
    agentRef.current?.abort()
  }, [])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }, [handleSend])

  const handleInputChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value)
    const element = event.target
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`
  }, [])

  const handlePrompt = useCallback((prompt: string) => {
    setInput(prompt)
    shouldAutoScrollRef.current = true
    window.requestAnimationFrame(() => {
      const element = textareaRef.current
      if (!element) return
      element.focus()
      element.style.height = 'auto'
      element.style.height = `${Math.min(element.scrollHeight, 220)}px`
    })
  }, [])

  const displayMessages = streamingMsg ? [...messages, streamingMsg] : messages
  const showHistorySidebar = !isDesktop || !historyCollapsed

  if (!configOk) {
    return (
      <div className="flex h-full">
        <ConfigPrompt />
      </div>
    )
  }
  return (
    <div className="agent-chat-page">
      <aside
        className={[
          'agent-chat-sidebar',
          historyCollapsed && isDesktop ? 'agent-chat-sidebar-collapsed' : '',
          sidebarOpen ? 'agent-chat-sidebar-open' : '',
        ].join(' ')}
      >
        {showHistorySidebar ? (
          <ConversationList
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={handleSelectConversation}
            onNew={handleNewConversation}
            onDelete={handleDeleteConversation}
            className="agent-conversation-list"
            headerActions={
              <button
                type="button"
                className="chat-sidebar-toggle"
                onClick={() => {
                  if (isDesktop) {
                    setHistoryCollapsed(true)
                  } else {
                    setSidebarOpen(false)
                  }
                }}
                title={isDesktop ? '收起历史对话' : '关闭历史对话'}
                aria-label={isDesktop ? '收起历史对话' : '关闭历史对话'}
              >
                <PanelLeftClose size={15} strokeWidth={1.8} />
              </button>
            }
          />
        ) : (
          <div className="agent-chat-sidebar-rail">
            <button
              type="button"
              className="chat-sidebar-toggle chat-sidebar-toggle-rail"
              onClick={() => setHistoryCollapsed(false)}
              title="展开历史对话"
              aria-label="展开历史对话"
            >
              <PanelLeftOpen size={16} strokeWidth={1.8} />
            </button>
          </div>
        )}
      </aside>

      {!isDesktop && sidebarOpen && (
        <button type="button" className="chat-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="agent-chat-main">
        {activeAgent && (
          <ChatHeader
            agent={activeAgent}
            onBack={onBackToDirectory}
            mobileToggle={
              <button
                type="button"
                className="mobile-agent-toggle"
                onClick={() => setSidebarOpen(true)}
              >
                <span className="mobile-agent-toggle-icon">
                  <PanelLeftOpen size={16} strokeWidth={1.9} />
                </span>
                <span className="mobile-agent-toggle-name">对话记录</span>
                <span className="mobile-agent-toggle-arrow">▼</span>
              </button>
            }
          />
        )}

        <div
          ref={messagesContainerRef}
          className="chat-messages"
          onScroll={handleMessagesScroll}
        >
          <div className="chat-messages-inner">
            {displayMessages.length === 0 && activeAgent ? (
              <AgentEmptyState agent={activeAgent} onPrompt={handlePrompt} />
            ) : (
              displayMessages.map(message => (
                <ChatMessageItem
                  key={message.id}
                  message={message}
                  isStreaming={message.streaming}
                  enableHtmlPreview={false}
                  assistantIcon={activeAgent?.icon}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <footer className="chat-composer-wrap">
          <div className="chat-composer">
            <textarea
              ref={textareaRef}
              className="chat-composer-input"
              placeholder="输入问题，Enter 发送"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isStreaming}
            />
            <div className="chat-composer-footer">
              {isStreaming ? (
                <button
                  type="button"
                  className="btn btn-error btn-xs btn-square"
                  onClick={handleAbort}
                  title="停止生成"
                >
                  <Square size={13} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-xs btn-square"
                  onClick={() => void handleSend()}
                  disabled={!input.trim()}
                  title="发送"
                >
                  <Send size={13} />
                </button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
