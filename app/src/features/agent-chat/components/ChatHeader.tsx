// Chat Header Component - Shows active agent info in the chat area
// DeepSeek/ChatGPT style header with agent avatar and info

import type { AgentDefinition } from '@/shared/lib/agent/types'
import { AgentIcon } from './AgentIcon'

interface ChatHeaderProps {
  agent: AgentDefinition
  onBack?: () => void
  className?: string
}

export function ChatHeader({ agent, onBack, className = '' }: ChatHeaderProps) {
  const renderIcon = () => (
    <div
      className={['chat-header-avatar-icon', agent.icon.type === 'image' ? 'agent-icon-circle' : ''].join(' ')}
      style={{ background: `color-mix(in srgb, ${agent.color} 15%, rgba(255,255,255,0.8))`, borderColor: `color-mix(in srgb, ${agent.color} 30%, transparent)` }}
    >
      <AgentIcon icon={agent.icon} size={18} fit="container" />
    </div>
  )

  return (
    <header className={['chat-header', className].join(' ')}>
      {onBack && (
        <button
          type="button"
          className="chat-header-back"
          onClick={onBack}
          aria-label="返回"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
      )}

      <div className="chat-header-agent">
        {renderIcon()}
        <div className="chat-header-info">
          <h2 className="chat-header-name">{agent.name}</h2>
          {agent.tagline && (
            <p className="chat-header-tagline">{agent.tagline}</p>
          )}
        </div>
      </div>

      <div className="chat-header-actions">
      </div>
    </header>
  )
}
