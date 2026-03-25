// AgentChat Page - Unified AI Chat Page
// Integrates the AgentChatPage component with the agent registry

import { getEnabledAgents } from '@/lib/agent'
import { AgentChatPage } from '@/components/AgentChat/AgentChatPage'

/**
 * Unified Agent Chat page that uses all enabled agents from the registry.
 * This is the main entry point for the AI chat feature.
 */
export function AgentChat() {
  const agents = getEnabledAgents()

  return (
    <AgentChatPage
      agents={agents}
      defaultAgentId={agents[0]?.id}
    />
  )
}
