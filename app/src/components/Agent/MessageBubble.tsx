// Message Bubble Component

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { User, Bot } from 'lucide-react'
import type { Message } from '@/services/agent/types'
import { AnalysisResultCard } from './AnalysisResultCard'

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
      }`}>
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>

      {/* Message Content */}
      <div className={`max-w-[75%] rounded-lg px-4 py-3 ${
        isUser
          ? 'bg-primary text-white'
          : 'bg-gray-100 text-gray-900'
      }`}>
        {isUser ? (
          // User message - plain text
          <div className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
        ) : (
          // Assistant message - markdown
          <div className={`prose prose-sm max-w-none ${
            isUser ? 'prose-invert' : ''
          }`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '')
                  const inline = !match
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={oneDark as any}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  )
                },
                // Style adjustments for markdown elements
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="mb-2 last:mb-0 ml-4">{children}</ul>,
                ol: ({ children }) => <ol className="mb-2 last:mb-0 ml-4">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Tool Calls Indicator */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-300/30">
            {message.toolCalls.map((tool, idx) => (
              <div key={idx} className="mb-3 last:mb-0">
                <div className="text-xs opacity-75 flex items-center gap-2 mb-2">
                  <span>🔧 {tool.skillName}</span>
                  {tool.status === 'pending' && <span className="animate-pulse">⏳</span>}
                  {tool.status === 'success' && <span>✓</span>}
                  {tool.status === 'error' && <span>✗</span>}
                </div>
                {/* Show analysis result if available */}
                {tool.status === 'success' && tool.result && (
                  <AnalysisResultCard result={tool.result} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className={`text-xs mt-2 ${
          isUser ? 'text-white/70' : 'text-gray-500'
        }`}>
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  )
}
