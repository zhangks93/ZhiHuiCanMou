// Conversation List Component - History sidebar for conversations
// WeChat-style conversation list with timestamps

import type { ReactNode } from 'react'
import { Plus, MessageSquare, Trash2 } from 'lucide-react'

import type { Conversation } from '@/shared/lib/agent/types'

interface ConversationListProps {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  className?: string
  title?: string
  headerActions?: ReactNode
}

function formatConversationTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  className = '',
  title = '历史对话',
  headerActions,
}: ConversationListProps) {
  return (
    <div className={['chat-conversation-list', className].join(' ')}>
      <div className="chat-conversation-header">
        <div className="chat-conversation-header-title">{title}</div>
        <div className="chat-conversation-header-actions">
          {headerActions}
        </div>
        <button
          type="button"
          className="chat-new-btn"
          onClick={onNew}
          title="新对话"
        >
          <Plus size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="chat-conversation-body">
        {conversations.length === 0 ? (
          <div className="chat-sidebar-empty">还没有历史对话</div>
        ) : (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={[
                'chat-conversation-item',
                conversation.id === activeId ? 'chat-conversation-item-active' : '',
              ].join(' ')}
              onClick={() => onSelect(conversation.id)}
            >
              <span className="chat-conversation-icon">
                <MessageSquare size={14} strokeWidth={1.7} />
              </span>
              <div className="chat-conversation-info">
                <span className="chat-conversation-title">{conversation.title}</span>
                <span className="chat-conversation-time">
                  {formatConversationTime(conversation.updatedAt)}
                </span>
              </div>
              <span className="chat-conversation-action">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-square hover:text-error"
                  title="删除对话"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete(conversation.id)
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
