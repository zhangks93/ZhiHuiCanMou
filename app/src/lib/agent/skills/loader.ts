// Skill Loader — converts skill.json + prompt.md into AgentDefinition

import type { AgentDefinition, AgentIcon } from '../types'
import { resolveTools } from '../tools'

/** Shape of a skill.json file */
export interface SkillConfig {
  id: string
  name: string
  description: string
  tagline?: string
  icon: AgentIcon
  /** Tool names (resolved via toolRegistry) */
  tools: string[]
  quickPrompts: string[]
  color: string
  enabled?: boolean
}

/**
 * Build an AgentDefinition from a skill config and its prompt text.
 * This is the bridge between the declarative skill format and the
 * runtime agent system.
 */
export function loadSkill(config: SkillConfig, systemPrompt: string): AgentDefinition {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    tagline: config.tagline,
    icon: config.icon,
    systemPrompt,
    tools: resolveTools(config.tools),
    quickPrompts: config.quickPrompts,
    color: config.color,
    enabled: config.enabled ?? true,
  }
}
