// Mobile Bottom Sheet for Agent Selection
// Touch-friendly agent picker for mobile devices

import { useEffect, useCallback, useState } from 'react'
import { X, Check } from 'lucide-react'

import type { AgentDefinition } from '../../lib/agent/types'
import { AgentIcon } from './AgentIcon'

interface AgentBottomSheetProps {
  isOpen: boolean
  agents: AgentDefinition[]
  activeAgentId: string
  onClose: () => void
  onSelect: (agentId: string) => void
}

export function AgentBottomSheet({
  isOpen,
  agents,
  activeAgentId,
  onClose,
  onSelect,
}: AgentBottomSheetProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [translateY, setTranslateY] = useState(0)

  // Handle swipe to close
  const handleTouchStart = useCallback(() => {
    setIsDragging(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return
    const deltaY = e.touches[0].clientY
    if (deltaY > 0) {
      setTranslateY(deltaY)
    }
  }, [isDragging])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    if (translateY > 150) {
      onClose()
    }
    setTranslateY(0)
  }, [translateY, onClose])

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const enabledAgents = agents.filter(a => a.enabled !== false)

  return (
    <>
      {/* Backdrop */}
      <div
        className="agent-sheet-backdrop"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="agent-sheet"
        style={{ transform: `translateY(${translateY}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        <div className="agent-sheet-handle" />

        {/* Header */}
        <div className="agent-sheet-header">
          <h3 className="agent-sheet-title">选择助手</h3>
          <button
            type="button"
            className="agent-sheet-close"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Agent List */}
        <div className="agent-sheet-list">
          {enabledAgents.map(agent => (
            <button
              key={agent.id}
              type="button"
              className={[
                'agent-sheet-item',
                agent.id === activeAgentId ? 'agent-sheet-item-active' : '',
              ].join(' ')}
              onClick={() => {
                onSelect(agent.id)
                onClose()
              }}
            >
              <div className={['agent-sheet-item-icon', agent.icon.type === 'image' ? 'agent-icon-circle' : ''].join(' ')}>
                <AgentIcon icon={agent.icon} size={20} fit="container" />
              </div>
              <div className="agent-sheet-item-info">
                <span className="agent-sheet-item-name">{agent.name}</span>
                <span className="agent-sheet-item-desc">{agent.description}</span>
              </div>
              {agent.id === activeAgentId && (
                <div className="agent-sheet-item-check">
                  <Check size={18} />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Safe area padding */}
        <div className="agent-sheet-safe" />
      </div>
    </>
  )
}

/**
 * Floating Agent Toggle Button for Mobile
 * Shows current agent and opens bottom sheet
 */
export function MobileAgentToggle({
  agent,
  onClick,
}: {
  agent: AgentDefinition
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="mobile-agent-toggle"
      onClick={onClick}
    >
      <span className={['mobile-agent-toggle-icon', agent.icon.type === 'image' ? 'agent-icon-circle' : ''].join(' ')}>
        <AgentIcon icon={agent.icon} size={16} fit="container" />
      </span>
      <span className="mobile-agent-toggle-name">{agent.name}</span>
      <span className="mobile-agent-toggle-arrow">▼</span>
    </button>
  )
}
