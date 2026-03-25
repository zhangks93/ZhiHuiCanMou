// Agent Card Component - Individual agent contact card
// WeChat/Telegram style contact list item

import type { AgentDefinition } from '../../lib/agent/types'

interface AgentCardProps {
  agent: AgentDefinition
  isActive: boolean
  onClick: () => void
  /** Last message preview for this agent */
  lastMessage?: string
  /** Unread message count */
  unreadCount?: number
}

export function AgentCard({
  agent,
  isActive,
  onClick,
  lastMessage,
  unreadCount,
}: AgentCardProps) {
  const renderIcon = () => {
    if (agent.icon.type === 'emoji') {
      return (
        <div className="agent-card-icon emoji-icon">
          {agent.icon.value}
        </div>
      )
    }
    // Future: lucide icon support
    return (
      <div className="agent-card-icon">
        <span className="text-lg">{agent.icon.value}</span>
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      className={[
        'agent-card',
        isActive ? 'agent-card--active' : '',
      ].join(' ')}
      style={{ '--agent-color': agent.color } as React.CSSProperties}
    >
      {/* Agent Avatar */}
      <div className="agent-card-avatar">
        {renderIcon()}
        {agent.enabled !== false && (
          <div className="agent-card-status" />
        )}
      </div>

      {/* Agent Info */}
      <div className="agent-card-info">
        <div className="agent-card-header">
          <span className="agent-card-name">{agent.name}</span>
          {unreadCount && unreadCount > 0 ? (
            <span className="agent-card-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          ) : null}
        </div>
        {lastMessage ? (
          <p className="agent-card-preview">{lastMessage}</p>
        ) : (
          <p className="agent-card-desc">{agent.description}</p>
        )}
      </div>

      {/* Active indicator */}
      {isActive && (
        <div className="agent-card-active-bar" />
      )}
    </button>
  )
}
