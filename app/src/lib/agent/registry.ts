// Agent Registry - Central registry for all available agents
// Agents are loaded from the skills system (skills/ folder)

import type { AgentDefinition, AgentRegistry } from './types'
import { allSkills } from './skills'

/**
 * Registry of all available agents.
 * Skills are auto-registered from skills/index.ts.
 */
export const agentRegistry: AgentRegistry = {
  agents: Object.fromEntries(allSkills.map((skill) => [skill.id, skill])),
  defaultAgentId: allSkills[0]?.id ?? '',
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
