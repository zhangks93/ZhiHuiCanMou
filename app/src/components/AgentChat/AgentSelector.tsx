// Agent Selector Component - Agent contact list
// WeChat/Telegram style sidebar showing available agents

import { useState } from 'react'
import type { AgentDefinition } from '../../lib/agent/types'
import { AgentCard } from './AgentCard'
import { AgentIcon } from './AgentIcon'

interface AgentSelectorProps {
  agents: AgentDefinition[]
  activeAgentId: string
  onSelectAgent: (agentId: string) => void
  /** Conversation previews per agent */
  conversationPreviews?: Record<string, { lastMessage?: string; unreadCount?: number }>
  /** Show section headers */
  showHeaders?: boolean
  /** Collapsible on mobile */
  collapsible?: boolean
  /** Additional class name */
  className?: string
}

export function AgentSelector({
  agents,
  activeAgentId,
  onSelectAgent,
  conversationPreviews = {},
  showHeaders = true,
  collapsible = false,
  className = '',
}: AgentSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(!collapsible)

  const enabledAgents = agents.filter(a => a.enabled !== false)
  const disabledAgents = agents.filter(a => a.enabled === false)

  if (collapsible && !isExpanded) {
    return (
      <button
        className={['agent-selector-toggle', className].join(' ')}
        onClick={() => setIsExpanded(true)}
        aria-label="展开助手列表"
      >
        <span
          className={[
            'agent-selector-toggle-icon',
            enabledAgents.find(a => a.id === activeAgentId)?.icon.type === 'image' ? 'agent-icon-circle' : '',
          ].join(' ')}
        >
          <AgentIcon icon={enabledAgents.find(a => a.id === activeAgentId)?.icon} size={18} fit="container" />
        </span>
        <span className="agent-selector-toggle-hint">▼</span>
      </button>
    )
  }

  return (
    <div className={['agent-selector', className].join(' ')}>
      {/* Header */}
      <div className="agent-selector-header">
        <h3 className="agent-selector-title">助手</h3>
        {collapsible && (
          <button
            className="agent-selector-collapse"
            onClick={() => setIsExpanded(false)}
            aria-label="收起"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Agent List */}
      <div className="agent-selector-list">
        {enabledAgents.length > 0 && (
          <>
            {showHeaders && (
              <div className="agent-selector-section-label">可用助手</div>
            )}
            {enabledAgents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isActive={agent.id === activeAgentId}
                onClick={() => onSelectAgent(agent.id)}
                lastMessage={conversationPreviews[agent.id]?.lastMessage}
                unreadCount={conversationPreviews[agent.id]?.unreadCount}
              />
            ))}
          </>
        )}

        {disabledAgents.length > 0 && (
          <>
            {showHeaders && (
              <div className="agent-selector-section-label" style={{ marginTop: '12px' }}>
                即将上线
              </div>
            )}
            {disabledAgents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isActive={false}
                onClick={() => {}}
              />
            ))}
          </>
        )}
      </div>

      {/* Footer hint */}
      {enabledAgents.length === 0 && (
        <div className="agent-selector-empty">
          暂无可用助手
        </div>
      )}
    </div>
  )
}
