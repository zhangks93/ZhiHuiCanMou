import { getEnabledAgents } from '@/shared/lib/agent'
import { AgentChatPage } from '../components/AgentChatPage'

export function AgentChatFeaturePage() {
  const agents = getEnabledAgents()

  return (
    <AgentChatPage
      agents={agents}
      defaultAgentId={agents[0]?.id}
    />
  )
}
