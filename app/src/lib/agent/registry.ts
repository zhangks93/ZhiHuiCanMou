// Agent Registry - Central registry for all available agents

import type { AgentDefinition, AgentRegistry } from './types'
import { financialAnalysisAgent } from './agents'

/**
 * Registry of all available agents.
 * Add new agents here to make them available in the system.
 */
export const agentRegistry: AgentRegistry = {
  agents: {
    [financialAnalysisAgent.id]: financialAnalysisAgent,
    // Future agents will be added here:
    // [hrAgent.id]: hrAgent,
    // [operationsAgent.id]: operationsAgent,
  },
  defaultAgentId: financialAnalysisAgent.id,
}

/**
 * Get an agent by ID
 */
export function getAgent(agentId: string): AgentDefinition | undefined {
  return agentRegistry.agents[agentId]
}

/**
 * Get all enabled agents
 */
export function getEnabledAgents(): AgentDefinition[] {
  return Object.values(agentRegistry.agents).filter(
    (agent): agent is AgentDefinition => agent !== undefined && agent.enabled !== false
  )
}

/**
 * Check if an agent exists
 */
export function hasAgent(agentId: string): boolean {
  return agentId in agentRegistry.agents && agentRegistry.agents[agentId]?.enabled !== false
}

/**
 * Get the default agent
 */
export function getDefaultAgent(): AgentDefinition {
  const defaultAgent = agentRegistry.agents[agentRegistry.defaultAgentId]
  if (!defaultAgent) {
    throw new Error('Default agent not found in registry')
  }
  return defaultAgent
}

/**
 * Get total count of enabled agents
 */
export function getAgentCount(): number {
  return getEnabledAgents().length
}
