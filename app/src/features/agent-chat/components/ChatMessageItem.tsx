import { lazy, Suspense } from 'react'
import { User } from 'lucide-react'

import type { AgentIcon as AgentIconConfig, ChatMessage } from '@/shared/lib/agent/types'
import { AgentIcon } from './AgentIcon'

const ChatMarkdown = lazy(() => import('./ChatMarkdown').then((module) => ({ default: module.ChatMarkdown })))
const ChatProcessPanel = lazy(() => import('./ChatProcessPanel').then((module) => ({ default: module.ChatProcessPanel })))

const RICH_TEXT_PATTERN = /```|`[^`\n]+`|\[[^\]]+\]\([^)]+\)|(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s)|(^|\n)\|.+\|/m
const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i

function shouldRenderMarkdown(content: string, enableHtmlPreview: boolean) {
  if (!content.trim()) {
    return false
  }

  if (RICH_TEXT_PATTERN.test(content)) {
    return true
  }

  return enableHtmlPreview && HTML_TAG_PATTERN.test(content)
}

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
  const hasProcessDetails = Boolean(message.thinking?.trim() || message.toolCalls?.length)
  const shouldUseMarkdown = !isUser && message.content
    ? shouldRenderMarkdown(message.content, enableHtmlPreview)
    : false

  return (
    <article className={`chat-message-row ${isUser ? 'chat-message-row-user' : ''}`}>
      <div
        className={[
          'chat-avatar',
          isUser ? 'chat-avatar-user' : 'chat-avatar-assistant',
          !isUser && assistantIcon?.type === 'image' ? 'agent-icon-circle' : '',
        ].join(' ')}
      >
        {isUser ? <User size={16} /> : <AgentIcon icon={assistantIcon} size={16} fit="container" />}
      </div>
      <div className={`chat-message-shell ${isUser ? 'chat-message-shell-user' : 'chat-message-shell-assistant'}`}>
        <div className={`chat-message-card ${isUser ? 'chat-message-card-user' : 'chat-message-card-assistant'}`}>
          {hasProcessDetails && (
            <Suspense fallback={null}>
              <ChatProcessPanel thinking={message.thinking} toolCalls={message.toolCalls} />
            </Suspense>
          )}
          {message.content ? (
            isUser || !shouldUseMarkdown ? (
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
            ) : (
              <Suspense fallback={<div className="whitespace-pre-wrap break-words">{message.content}</div>}>
                <ChatMarkdown content={message.content} enableHtmlPreview={enableHtmlPreview} />
              </Suspense>
            )
          ) : isStreaming && !message.thinking && !message.toolCalls?.length ? (
            <span className="chat-streaming-placeholder" />
          ) : null}
          {isStreaming && message.content && <span className="chat-streaming-cursor" />}
        </div>
      </div>
    </article>
  )
}
