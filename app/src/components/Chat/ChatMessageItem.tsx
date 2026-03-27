import { User } from 'lucide-react'

import type { AgentIcon as AgentIconConfig, ChatMessage } from '@/lib/agent'
import { AgentIcon } from '@/components/AgentChat/AgentIcon'
import { ChatMarkdown } from './ChatMarkdown'
import { ChatProcessPanel } from './ChatProcessPanel'

export function ChatMessageItem({
  message,
  isStreaming,
  enableHtmlPreview = false,
  assistantIcon,
}: {
  message: ChatMessage
  isStreaming?: boolean
  enableHtmlPreview?: boolean
  assistantIcon?: AgentIconConfig
}) {
  const isUser = message.role === 'user'

  return (
    <article className={`chat-message-row ${isUser ? 'chat-message-row-user' : ''}`}>
      <div className={`chat-avatar ${isUser ? 'chat-avatar-user' : 'chat-avatar-assistant'}`}>
        {isUser ? <User size={16} /> : <AgentIcon icon={assistantIcon} size={16} />}
      </div>
      <div className={`chat-message-shell ${isUser ? 'chat-message-shell-user' : 'chat-message-shell-assistant'}`}>
        <div className={`chat-message-card ${isUser ? 'chat-message-card-user' : 'chat-message-card-assistant'}`}>
          {!isUser && (
            <ChatProcessPanel thinking={message.thinking} toolCalls={message.toolCalls} />
          )}
          {message.content ? (
            <ChatMarkdown content={message.content} enableHtmlPreview={enableHtmlPreview} />
          ) : isStreaming && !message.thinking && !message.toolCalls?.length ? (
            <span className="chat-streaming-placeholder" />
          ) : null}
          {isStreaming && message.content && <span className="chat-streaming-cursor" />}
        </div>
      </div>
    </article>
  )
}
