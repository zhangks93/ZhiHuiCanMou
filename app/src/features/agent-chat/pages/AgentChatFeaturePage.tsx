import { Navigate, useNavigate, useParams } from 'react-router-dom'

import { ROUTES } from '@/app/config/constants'
import { getEnabledAgents } from '@/shared/lib/agent'
import { AgentChatPage } from '../components/AgentChatPage'
import { AgentDirectoryPage } from './AgentDirectoryPage'

export function AgentChatFeaturePage() {
  const { agentId } = useParams<{ agentId?: string }>()
  const navigate = useNavigate()
  const agents = getEnabledAgents()

  if (!agentId) {
    return <AgentDirectoryPage agents={agents} />
  }

  const activeAgent = agents.find((agent) => agent.id === agentId)

  if (!activeAgent) {
    return <Navigate to={ROUTES.AI_ANALYSIS} replace />
  }

  return (
    <AgentChatPage
      key={activeAgent.id}
      agents={[activeAgent]}
      defaultAgentId={activeAgent.id}
      onBackToDirectory={() => navigate(ROUTES.AI_ANALYSIS)}
    />
  )
}
