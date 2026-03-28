import { useEffect, useState, type RefObject } from 'react'
import { loadLLMConfig, subscribeLLMConfig, type LLMConfig } from '@/shared/lib/llmConfig'

interface ChatAgentRuntime {
  updateConfig: (config: LLMConfig) => void
}

export function useAgentConfig(agentRef: RefObject<ChatAgentRuntime | null>) {
  const [configOk, setConfigOk] = useState(() => Boolean(loadLLMConfig()))

  useEffect(() => {
    return subscribeLLMConfig((config) => {
      setConfigOk(Boolean(config))
      if (config && agentRef.current) {
        agentRef.current.updateConfig(config)
      }
    })
  }, [agentRef])

  return {
    configOk,
  }
}
