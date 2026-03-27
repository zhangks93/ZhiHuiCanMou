import { AgentChatPage } from '@/components/AgentChat/AgentChatPage'
import { financialAnalysisAgent } from '@/lib/agent'

export function AiAnalysis() {
  return (
    <AgentChatPage
      agents={[financialAnalysisAgent]}
      defaultAgentId={financialAnalysisAgent.id}
    />
  )
}
