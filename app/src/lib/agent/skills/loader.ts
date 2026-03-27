// Skill Loader — converts skill.json + prompt.md + assets into AgentDefinition

import type { AgentDefinition, AgentIcon } from '../types'
import { resolveTools } from '../tools'
import { registerAssets } from './assetRegistry'

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
 * Build an AgentDefinition from a skill config, prompt text, and optional assets.
 * Assets are registered in the global asset registry for read_file access.
 */
interface SkillLoadOptions {
  imageAssets?: Record<string, string>
}

export function loadSkill(
  config: SkillConfig,
  systemPrompt: string,
  assets?: Record<string, string>,
  options?: SkillLoadOptions
): AgentDefinition {
  // Register assets if provided
  if (assets && Object.keys(assets).length > 0) {
    registerAssets(config.id, assets)
  }

  const icon = config.icon.type === 'image'
    ? {
        ...config.icon,
        value: options?.imageAssets?.[config.icon.value] ?? config.icon.value,
      }
    : config.icon

  return {
    id: config.id,
    name: config.name,
    description: config.description,
    tagline: config.tagline,
    icon,
    systemPrompt,
    tools: resolveTools(config.tools),
    quickPrompts: config.quickPrompts,
    color: config.color,
    enabled: config.enabled ?? true,
  }
}
