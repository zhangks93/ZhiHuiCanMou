// Chat Interface Component

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Trash2 } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import type { AgentService } from '@/services/agentService'
import type { LLMConfig } from '@/lib/llmConfig'
import type { Message } from '@/services/agent/types'

interface ChatInterfaceProps {
  agent: AgentService | null
  config: LLMConfig
}

export function ChatInterface({ agent, config }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load conversation history on mount
  useEffect(() => {
    if (agent) {
      const history = agent.getConversationHistory()
      setMessages(history)
    }
  }, [agent])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = async () => {
    if (!input.trim() || !agent || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)
    setStreamingContent('')

    try {
      let fullResponse = ''

      // Stream response from agent
      for await (const chunk of agent.sendMessage(userMessage)) {
        fullResponse += chunk
        setStreamingContent(fullResponse)
      }

      // Refresh messages from agent memory
      const updatedHistory = agent.getConversationHistory()
      setMessages(updatedHistory)
      setStreamingContent('')

    } catch (error) {
      console.error('Failed to send message:', error)
      const errorMsg = error instanceof Error ? error.message : '发送消息失败'
      setStreamingContent(`\n\n❌ 错误: ${errorMsg}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = () => {
    if (confirm('确定要清除所有对话记录吗？')) {
      agent?.clearConversation()
      setMessages([])
      setStreamingContent('')
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] bg-white rounded-xl border border-gray-200 shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h3 className="font-medium text-gray-800">智能对话</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            当前模型: {config.provider === 'openai' ? 'OpenAI' : 'Claude'} - {config.model}
          </p>
        </div>
        <button
          onClick={handleClear}
          disabled={messages.length === 0 && !streamingContent}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="清除对话"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && !streamingContent && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <p className="text-sm mb-2">👋 你好！我是智能分析助手</p>
              <p className="text-xs">你可以问我关于经营数据的问题，或者进行一般性对话</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming message */}
        {streamingContent && (
          <div className="flex gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-600">
              <Loader2 size={18} className="animate-spin" />
            </div>
            <div className="max-w-[75%] rounded-lg px-4 py-3 bg-gray-100 text-gray-900">
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap">{streamingContent}</div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isLoading ? '正在处理...' : '输入你的问题... (Shift+Enter 换行)'}
            disabled={isLoading}
            rows={1}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
            style={{ minHeight: '42px', maxHeight: '120px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`
            }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>发送中</span>
              </>
            ) : (
              <>
                <Send size={18} />
                <span>发送</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-2 text-xs text-gray-500">
          💡 提示：可以询问经营数据、请求分析报告、或进行一般性对话
        </div>
      </div>
    </div>
  )
}
