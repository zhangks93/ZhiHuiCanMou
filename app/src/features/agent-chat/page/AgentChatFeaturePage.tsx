import { getEnabledAgents } from '@/lib/agent'
import { AgentChatPage } from '@/components/AgentChat/AgentChatPage'

export function AgentChatFeaturePage() {
  const agents = getEnabledAgents()

  return (
    <AgentChatPage
      agents={agents}
      defaultAgentId={agents[0]?.id}
    />
  )
}
