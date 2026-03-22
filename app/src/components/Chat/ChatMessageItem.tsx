import { Bot, User } from 'lucide-react'

import type { ChatMessage } from '@/lib/agent'
import { ChatMarkdown } from './ChatMarkdown'
import { ChatProcessPanel } from './ChatProcessPanel'

export function ChatMessageItem({
  message,
  isStreaming,
}: {
  message: ChatMessage
  isStreaming?: boolean
}) {
  const isUser = message.role === 'user'

  return (
    <article className={`chat-message-row ${isUser ? 'chat-message-row-user' : ''}`}>
      <div className={`chat-avatar ${isUser ? 'chat-avatar-user' : 'chat-avatar-assistant'}`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div className={`chat-message-shell ${isUser ? 'chat-message-shell-user' : 'chat-message-shell-assistant'}`}>
        <div className={`chat-message-card ${isUser ? 'chat-message-card-user' : 'chat-message-card-assistant'}`}>
          {!isUser && (
            <ChatProcessPanel thinking={message.thinking} toolCalls={message.toolCalls} />
          )}
          {message.content ? (
            <ChatMarkdown content={message.content} />
          ) : isStreaming && !message.thinking && !message.toolCalls?.length ? (
            <span className="chat-streaming-placeholder" />
          ) : null}
          {isStreaming && message.content && <span className="chat-streaming-cursor" />}
        </div>
      </div>
    </article>
  )
}
