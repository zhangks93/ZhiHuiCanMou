import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquarePlus, Search } from 'lucide-react'

import { buildAgentChatHref } from '@/app/config/constants'
import type { AgentDefinition } from '@/shared/lib/agent/types'
import { AgentIcon } from '../components/AgentIcon'

interface AgentDirectoryPageProps {
  agents: AgentDefinition[]
}

function AgentDirectoryCard({ agent }: { agent: AgentDefinition }) {
  const summary = agent.tagline || agent.description

  return (
    <article
      className="agent-directory-card"
      style={{ '--agent-color': agent.color } as CSSProperties}
    >
      <div className="agent-directory-card__avatar">
        <div
          className={[
            'agent-directory-card__icon',
            agent.icon.type === 'image' ? 'agent-icon-circle' : '',
          ].join(' ')}
        >
          <AgentIcon icon={agent.icon} size={34} fit="container" />
        </div>
      </div>

      <div className="agent-directory-card__content">
        <h2 className="agent-directory-card__name">{agent.name}</h2>
        <p className="agent-directory-card__desc">{summary}</p>
      </div>

      <div className="agent-directory-card__footer">
        <Link
          to={buildAgentChatHref(agent.id)}
          className="agent-directory-card__action"
        >
          <MessageSquarePlus size={16} strokeWidth={1.9} />
          进入对话
        </Link>
      </div>
    </article>
  )
}

export function AgentDirectoryPage({ agents }: AgentDirectoryPageProps) {
  const [keyword, setKeyword] = useState('')

  const filteredAgents = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    if (!normalized) return agents

    return agents.filter((agent) => (
      `${agent.name} ${agent.description} ${agent.tagline ?? ''}`.toLowerCase().includes(normalized)
    ))
  }, [agents, keyword])

  return (
    <section className="agent-directory-page">
      <div className="agent-directory-hero">

        <div className="agent-directory-toolbar">
          <label className="agent-directory-search">
            <Search size={16} strokeWidth={1.8} />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索..."
              aria-label="搜索"
            />
          </label>
        </div>
      </div>

      {filteredAgents.length > 0 ? (
        <div className="agent-directory-grid">
          {filteredAgents.map((agent) => (
            <AgentDirectoryCard key={agent.id} agent={agent} />
          ))}
        </div>
      ) : (
        <div className="agent-directory-empty">
          未找到匹配的助手，请尝试其他关键词。
        </div>
      )}
    </section>
  )
}
