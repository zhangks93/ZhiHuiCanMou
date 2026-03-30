import { ROUTES } from '@/app/config/constants'
import { getEnabledAgents } from '@/shared/lib/agent'
import { TabbedPageShell } from '@/shared/ui/TabbedPageShell'
import { AgentChatPage } from '../components/AgentChatPage'

export function AgentChatFeaturePage() {
  const agents = getEnabledAgents()
  const tabItems = [
    {
      key: 'ai',
      label: 'AI 分析',
      to: ROUTES.AI_ANALYSIS,
      active: true,
    },
  ]

  return (
    <TabbedPageShell tabs={tabItems} contentClassName="min-h-0">
      <AgentChatPage
        agents={agents}
        defaultAgentId={agents[0]?.id}
      />
    </TabbedPageShell>
  )
}
