import { useState, useEffect, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react'
import {
  Plus,
  MessageSquare,
  Trash2,
  Send,
  Square,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
} from 'lucide-react'

import {
  ChatAgent,
  queryBizDataTool,
  queryWithHierarchyTool,
  queryMonthlyPlanTool,
  resolveOrgNodesTool,
  readFileTool,
  loadConversations,
  saveConversations,
  createConversation,
  deleteConversation,
} from '@/lib/agent'
import type { ChatMessage, Conversation } from '@/lib/agent'
import { loadLLMConfig } from '@/lib/llmConfig'
import SYSTEM_PROMPT from '@/lib/agent/skills/financial-analysis/prompt.md?raw'
import { ChatMessageItem } from '@/components/Chat/ChatMessageItem'

function generateTitle(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > 24 ? `${clean.slice(0, 24)}...` : clean
}

function formatConversationTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

const QUICK_PROMPTS = [
  '请基于当前可用数据，找出本月经营异常并按优先级排序。',
  '按部门对比收入、毛利和利润变化，并给出原因假设。',
  '生成一份适合管理层阅读的经营分析报告，突出风险和机会。',
  '从回款、合同和利润三个角度，给出下周最值得跟进的事项。',
]

function EmptyState({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <div className="chat-empty-state">
        <div className="chat-empty-icon">
          <Sparkles size={20} strokeWidth={1.7} />
        </div>
        <div className="space-y-2 text-center">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">智能分析助手</h2>
            <p className="mx-auto mt-1.5 max-w-xl text-xs leading-6 text-[var(--color-text-muted)]">
              查看经营异常、生成分析报告、对比部门表现
            </p>
          </div>
          <div className="chat-prompt-grid">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="chat-prompt-card"
                onClick={() => onPrompt(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfigPrompt() {
  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="chat-config-card">
        <Settings size={28} className="text-[var(--color-text-muted)]" />
        <div className="space-y-1.5 text-center">
          <h2 className="text-base font-semibold text-[var(--color-text-strong)]">请先配置 AI 模型</h2>
          <p className="text-xs leading-6 text-[var(--color-text-muted)]">
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

export function AiAnalysis() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMsg, setStreamingMsg] = useState<ChatMessage | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [historyCollapsed, setHistoryCollapsed] = useState(false)
  const [configOk, setConfigOk] = useState(false)

  const agentRef = useRef<ChatAgent | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)

  useEffect(() => {
    const config = loadLLMConfig()
    if (config) {
      setConfigOk(true)
      const agent = new ChatAgent(config)
      agent.registerTool(resolveOrgNodesTool)
      agent.registerTool(queryWithHierarchyTool)
      agent.registerTool(queryMonthlyPlanTool)
      agent.registerTool(queryBizDataTool)
      agent.registerTool(readFileTool)
      agentRef.current = agent
    }

    const saved = loadConversations('financial-analysis')
    setConversations(saved)
    if (saved.length > 0) {
      setActiveId(saved[0].id)
      setMessages(saved[0].messages)
    }

    if (window.innerWidth >= 1024) {
      setSidebarOpen(true)
    }
  }, [])

  useEffect(() => {
    const handler = () => {
      const config = loadLLMConfig()
      if (!config) return

      setConfigOk(true)
      if (agentRef.current) {
        agentRef.current.updateConfig(config)
        return
      }

      const agent = new ChatAgent(config)
      agent.registerTool(resolveOrgNodesTool)
      agent.registerTool(queryWithHierarchyTool)
      agent.registerTool(queryMonthlyPlanTool)
      agent.registerTool(queryBizDataTool)
      agent.registerTool(readFileTool)
      agentRef.current = agent
    }

    window.addEventListener('llm-config-updated', handler)
    return () => window.removeEventListener('llm-config-updated', handler)
  }, [])

  const persist = useCallback((nextConversations: Conversation[]) => {
    setConversations(nextConversations)
    saveConversations(nextConversations, 'financial-analysis')
  }, [])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' })
  }, [])

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom(messages.length > 0 ? 'smooth' : 'auto')
    }
  }, [messages, streamingMsg, scrollToBottom])

  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight
    shouldAutoScrollRef.current = distanceFromBottom < 120
  }, [])

  const handleNewConversation = useCallback(() => {
    const conversation = createConversation()
    const nextConversations = [conversation, ...conversations]
    persist(nextConversations)
    setActiveId(conversation.id)
    setMessages([])
    shouldAutoScrollRef.current = true
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
    textareaRef.current?.focus()
  }, [conversations, persist])

  const handleSelectConversation = useCallback((id: string) => {
    if (isStreaming) return
    const conversation = conversations.find((item) => item.id === id)
    if (!conversation) return

    setActiveId(id)
    setMessages(conversation.messages)
    shouldAutoScrollRef.current = true
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [conversations, isStreaming])

  const handleDeleteConversation = useCallback((id: string) => {
    if (isStreaming) return

    const nextConversations = deleteConversation(conversations, id)
    persist(nextConversations)

    if (activeId === id) {
      if (nextConversations.length > 0) {
        setActiveId(nextConversations[0].id)
        setMessages(nextConversations[0].messages)
      } else {
        setActiveId(null)
        setMessages([])
      }
    }
  }, [activeId, conversations, isStreaming, persist])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming || !agentRef.current) return

    let conversationId = activeId
    let nextConversations = conversations
    if (!conversationId) {
      const conversation = createConversation()
      nextConversations = [conversation, ...conversations]
      conversationId = conversation.id
      persist(nextConversations)
      setActiveId(conversationId)
    }

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
      const stream = agentRef.current.chat(nextMessages, SYSTEM_PROMPT)
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
            assistantMessage.toolCalls = (assistantMessage.toolCalls || []).map((toolCall) =>
              toolCall.id === chunk.toolCall.id ? chunk.toolCall : toolCall,
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

    const updatedConversations = nextConversations.map((conversation) => {
      if (conversation.id !== conversationId) return conversation

      const title = conversation.title === '新对话' ? generateTitle(text) : conversation.title
      return {
        ...conversation,
        title,
        messages: finalMessages,
        updatedAt: Date.now(),
      }
    })
    persist(updatedConversations)
  }, [activeId, conversations, input, isStreaming, messages, persist])

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
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024

  if (!configOk) {
    return (
      <div className="flex h-full">
        <ConfigPrompt />
      </div>
    )
  }

  return (
    <div className="chat-page-shell">
      <aside
        className={[
          'chat-sidebar',
          sidebarOpen ? 'chat-sidebar-open' : '',
          historyCollapsed ? 'chat-sidebar-collapsed' : '',
        ].join(' ')}
      >
        <div className="chat-sidebar-header">
          <button
            type="button"
            className="chat-new-btn"
            onClick={handleNewConversation}
            title="新对话"
          >
            <Plus size={16} strokeWidth={2} />
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square"
            onClick={() => {
              if (window.innerWidth >= 1024) {
                setHistoryCollapsed((value) => !value)
                return
              }

              setSidebarOpen(false)
            }}
            title={historyCollapsed ? '展开历史栏' : '收起历史栏'}
          >
            {isDesktop ? (
              historyCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />
            ) : (
              <PanelLeftClose size={14} />
            )}
          </button>
        </div>

        <div className="chat-sidebar-body">
          {conversations.length === 0 ? (
            <div className="chat-sidebar-empty">{historyCollapsed ? '暂无' : '还没有历史对话'}</div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={[
                  'chat-conversation-item',
                  conversation.id === activeId ? 'chat-conversation-item-active' : '',
                  historyCollapsed ? 'chat-conversation-item-collapsed' : '',
                ].join(' ')}
                onClick={() => handleSelectConversation(conversation.id)}
                title={historyCollapsed ? conversation.title : undefined}
              >
                <span className="chat-conversation-icon">
                  <MessageSquare size={14} strokeWidth={1.7} />
                </span>
                {!historyCollapsed && (
                  <div className="chat-conversation-info">
                    <span className="chat-conversation-title">{conversation.title}</span>
                    <span className="chat-conversation-time">{formatConversationTime(conversation.updatedAt)}</span>
                  </div>
                )}
                {!historyCollapsed && (
                  <span className="chat-conversation-action">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-square hover:text-error"
                      title="删除对话"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleDeleteConversation(conversation.id)
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      {sidebarOpen && <button type="button" className="chat-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <div className="chat-main-panel">
        <div
          ref={messagesContainerRef}
          className="chat-messages"
          onScroll={handleMessagesScroll}
        >
          <div className="chat-messages-inner">
            {displayMessages.length === 0 ? (
              <EmptyState onPrompt={handlePrompt} />
            ) : (
              displayMessages.map((message) => (
                <ChatMessageItem key={message.id} message={message} isStreaming={message.streaming} />
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
