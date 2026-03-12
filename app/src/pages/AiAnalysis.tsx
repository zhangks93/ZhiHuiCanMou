// Updated AiAnalysis Page with Configuration Integration

import { useState, useEffect } from 'react'
import { PageTitle } from '@/components/ui/PageTitle'
import { loadLLMConfig } from '@/lib/llmConfig'
import { AgentService } from '@/services/agentService'
import { ConfigurationPrompt } from '@/components/Agent/ConfigurationPrompt'
import { ChatInterface } from '@/components/Agent/ChatInterface'

export function AiAnalysis() {
  const [config, setConfig] = useState(() => loadLLMConfig())
  const [agent, setAgent] = useState<AgentService | null>(null)

  // Initialize agent when config is available
  useEffect(() => {
    if (config) {
      console.log('[AiAnalysis] Initializing agent with config:', config.provider)
      const agentInstance = new AgentService(config)
      setAgent(agentInstance)
    } else {
      setAgent(null)
    }
  }, [config])

  // Listen for configuration updates from Settings page
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'llm_config') {
        console.log('[AiAnalysis] Configuration updated, reloading...')
        const newConfig = loadLLMConfig()
        setConfig(newConfig)
      }
    }

    // Listen for storage events (cross-tab)
    window.addEventListener('storage', handleStorageChange)

    // Also listen for custom event (same-tab)
    const handleConfigUpdate = () => {
      console.log('[AiAnalysis] Configuration updated (same tab), reloading...')
      const newConfig = loadLLMConfig()
      setConfig(newConfig)
    }

    window.addEventListener('llm-config-updated', handleConfigUpdate)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('llm-config-updated', handleConfigUpdate)
    }
  }, [])

  // Update agent config when it changes
  useEffect(() => {
    if (agent && config) {
      agent.updateConfig(config)
    }
  }, [agent, config])

  return (
    <>
      <PageTitle breadcrumb="工具与分析 / 智能分析" title="智能分析" />

      {!config ? (
        <ConfigurationPrompt />
      ) : (
        <ChatInterface agent={agent} config={config} />
      )}
    </>
  )
}
