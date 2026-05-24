import { useState, useEffect, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Send,
  Square,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

import type {
  AgentDefinition,
  Conversation,
  FinancialAnalysisRuntimeDataContext,
  FinancialAnalysisSessionContext,
} from '@/shared/lib/agent/types'
import { createConversation, deleteConversation } from '@/shared/lib/agent/conversationStore'
import { buildConversationMemoryBlock } from '@/shared/lib/agent/conversationMemory'
import { buildSettingsHref } from '@/app/config/constants'
import { loadLLMConfig } from '@/shared/lib/llmConfig'
import { isTauriRuntime } from '@/shared/lib/tauri'
import { getErrorMessage } from '@/shared/lib/errorMessage'
import type { ChatAgent } from '@/shared/lib/agent/chatAgent'
import { loadAgentRuntimeModules } from '@/shared/lib/agent/runtimeLoader'
import { useAgentConfig } from '@/features/agent-chat/hooks/useAgentConfig'
import { useConversationPersistence } from '@/features/agent-chat/hooks/useConversationPersistence'
import { useChatStreaming } from '@/features/agent-chat/hooks/useChatStreaming'
import {
  buildFinancialAnalysisRuntimeContextBlock,
  getFinancialAnalysisRuntimeDataContext,
} from '@/shared/lib/agent/skills/financial-analysis/runtimeContext'
import {
  buildFinancialAnalysisSessionContextBlock,
} from '@/shared/lib/agent/skills/financial-analysis/sessionContext'
import { buildLongTermMemoryBlock } from '@/shared/lib/agent/memory/memoryContext'
import { ChatHeader } from './ChatHeader'
import { ConversationList } from './ConversationList'
import { AgentIcon } from './AgentIcon'
import { ChatMessageItem } from './ChatMessageItem'

interface AgentChatPageProps {
  agents: AgentDefinition[]
  defaultAgentId?: string
  onBackToDirectory?: () => void
}

function getFinancialAnalysisContext(conversation?: Conversation): FinancialAnalysisSessionContext | undefined {
  return conversation?.context?.financialAnalysis
}

async function buildAgentSystemPrompt(params: {
  agent: AgentDefinition
  conversation?: Conversation
  runtimeDataContext?: FinancialAnalysisRuntimeDataContext
  latestUserQuery?: string
}): Promise<string> {
  const { agent, conversation, runtimeDataContext, latestUserQuery } = params
  const longTermMemoryBlock = await buildLongTermMemoryBlock({ latestUserQuery })

  if (agent.id !== 'financial-analysis') {
    return [
      agent.systemPrompt,
      longTermMemoryBlock,
    ].filter(Boolean).join('\n\n')
  }

  const sessionContext = getFinancialAnalysisContext(conversation)
  return [
    agent.systemPrompt,
    buildFinancialAnalysisRuntimeContextBlock(runtimeDataContext),
    buildFinancialAnalysisSessionContextBlock(sessionContext),
    longTermMemoryBlock,
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
        <Link to={buildSettingsHref('ai-model')} className="btn btn-primary btn-sm">
          前往设置
        </Link>
      </div>
    </div>
  )
}

function RuntimePrompt({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="chat-config-card">
        <Settings size={28} className="text-[var(--color-text-muted)]" />
        <div className="space-y-1.5 text-center">
          <h2 className="text-body font-semibold text-[var(--color-text-strong)]">当前环境不支持智能体历史持久化</h2>
          <p className="text-caption leading-6 text-[var(--color-text-muted)]">
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}

export function AgentChatPage({
  agents,
  defaultAgentId,
  onBackToDirectory,
}: AgentChatPageProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialPrompt = searchParams.get('prompt') ?? ''
  const activeAgentId = defaultAgentId || agents[0]?.id || 'financial-analysis'
  const [input, setInput] = useState(initialPrompt)
  const [historyCollapsed, setHistoryCollapsed] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)
  const agentRef = useRef<Pick<ChatAgent, 'abort' | 'chat' | 'updateConfig'> | null>(null)
  const { configOk } = useAgentConfig(agentRef)
  const {
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
  } = useConversationPersistence({ agentId: activeAgentId })

  const activeAgent = agents.find(a => a.id === activeAgentId) || agents[0]
  const tauriRuntime = isTauriRuntime()

  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    shouldAutoScrollRef.current = distanceFromBottom < 120
  }, [])

  const ensureAgentReady = useCallback(async () => {
    const config = loadLLMConfig()
    if (!config) return null

    const existingAgent = agentRef.current
    if (existingAgent) {
      existingAgent.updateConfig(config)
      return existingAgent
    }

    const { ChatAgent, tools } = await loadAgentRuntimeModules()

    const readyAgent = agentRef.current
    if (readyAgent) {
      readyAgent.updateConfig(config)
      return readyAgent
    }

    const agent = new ChatAgent(config)
    tools.forEach((tool) => agent.registerTool(tool))
    agentRef.current = agent
    return agent
  }, [])

  useEffect(() => {
    if (!configOk) return
    void ensureAgentReady().catch(() => {})
  }, [configOk, ensureAgentReady])

  useEffect(() => {
    if (activeAgent?.id !== 'financial-analysis') return
    void getFinancialAnalysisRuntimeDataContext().catch(() => {})
  }, [activeAgent?.id])

  useEffect(() => {
    const prompt = searchParams.get('prompt')
    if (!prompt) return

    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('prompt')
      return next
    }, { replace: true })
  }, [searchParams, setSearchParams])

  const { isStreaming, streamingMsg, handleSend, handleAbort } = useChatStreaming({
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
    buildSystemPrompt: buildAgentSystemPrompt,
    syncConversationPersistence,
    textareaRef,
  })

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      const behavior = messages.length > 0 ? 'smooth' : 'auto'
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' })
    }
  }, [messages, streamingMsg])

  const handleNewConversation = async () => {
    const conversation = createConversation()
    const nextConversations = [conversation, ...conversations]
    setActiveConversationId(conversation.id)
    setMessages([])
    shouldAutoScrollRef.current = true
    await syncConversationPersistence(nextConversations, conversation)
    textareaRef.current?.focus()
  }

  const handleSelectConversation = async (id: string) => {
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
      const activeConversation = updated.find((conversation) => conversation.id === activeConversationId)
      await syncConversationPersistence(updated, activeConversation)
    }

    const conversation = conversations.find(item => item.id === id)
    if (!conversation) return

    setActiveConversationId(id)
    setMessages(conversation.messages)
    shouldAutoScrollRef.current = true
  }

  const handleDeleteConversation = useCallback(async (id: string) => {
    if (isStreaming) return
    const nextConversations = deleteConversation(conversations, id)
    if (activeConversationId === id) {
      if (nextConversations.length > 0) {
        setActiveConversationId(nextConversations[0].id)
        setMessages(nextConversations[0].messages)
      } else {
        setActiveConversationId(null)
        setMessages([])
      }
    }
    await deleteConversationPersistence(id, nextConversations)
  }, [conversations, activeConversationId, isStreaming, deleteConversationPersistence, setActiveConversationId, setMessages])

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
  const showHistorySidebar = !historyCollapsed

  if (!configOk) {
    return (
      <div className="flex h-full">
        <ConfigPrompt />
      </div>
    )
  }

  if (!tauriRuntime) {
    return (
      <div className="flex h-full">
        <RuntimePrompt message="智能体对话历史已改为仅在本地客户端通过 SQLite 持久化，请在桌面端使用。" />
      </div>
    )
  }

  return (
    <div className="agent-chat-page">
      <aside
        className={[
          'agent-chat-sidebar',
          historyCollapsed ? 'agent-chat-sidebar-collapsed' : '',
        ].join(' ')}
      >
        {showHistorySidebar ? (
          <ConversationList
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={(id) => {
              void handleSelectConversation(id).catch((error) => {
                setPersistenceError(getErrorMessage(error, '切换历史对话失败'))
              })
            }}
            onNew={() => {
              void handleNewConversation().catch((error) => {
                setPersistenceError(getErrorMessage(error, '新建历史对话失败'))
              })
            }}
            onDelete={(id) => {
              void handleDeleteConversation(id).catch((error) => {
                setPersistenceError(getErrorMessage(error, '删除历史对话失败'))
              })
            }}
            className="agent-conversation-list"
            headerActions={
              <button
                type="button"
                className="chat-sidebar-toggle"
                onClick={() => {
                  setHistoryCollapsed(true)
                }}
                title="收起历史对话"
                aria-label="收起历史对话"
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

      <div className="agent-chat-main">
        {activeAgent && (
          <ChatHeader
            agent={activeAgent}
            onBack={onBackToDirectory}
          />
        )}

        <div
          ref={messagesContainerRef}
          className="chat-messages"
          onScroll={handleMessagesScroll}
        >
          <div className="chat-messages-inner">
            {persistenceError ? (
              <div className="flex min-h-full items-center justify-center px-4 py-12">
                <div className="chat-config-card">
                  <Settings size={24} className="text-[var(--color-text-muted)]" />
                  <div className="space-y-1.5 text-center">
                    <h2 className="text-body font-semibold text-[var(--color-text-strong)]">对话存储异常</h2>
                    <p className="text-caption leading-6 text-[var(--color-text-muted)]">{persistenceError}</p>
                  </div>
                </div>
              </div>
            ) : isHydrating ? (
              <div className="flex min-h-full items-center justify-center px-4 py-12 text-caption text-[var(--color-text-muted)]">
                正在加载历史对话...
              </div>
            ) : displayMessages.length === 0 && activeAgent ? (
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
              disabled={isStreaming || isHydrating}
            />
            <div className="chat-composer-footer">
              {isStreaming ? (
                <button
                  type="button"
                  className="btn btn-error btn-xs btn-square"
                  onClick={() => handleAbort(agentRef)}
                  title="停止生成"
                >
                  <Square size={13} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-xs btn-square"
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || isHydrating || Boolean(persistenceError)}
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
