// Skill Registry

import type { Skill } from './types'

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map()

  register(skill: Skill) {
    if (this.skills.has(skill.name)) {
      console.warn(`Skill ${skill.name} is already registered. Overwriting.`)
    }
    this.skills.set(skill.name, skill)
    console.log(`[SkillRegistry] Registered skill: ${skill.name}`)
  }

  unregister(skillName: string) {
    this.skills.delete(skillName)
    console.log(`[SkillRegistry] Unregistered skill: ${skillName}`)
  }

  get(skillName: string): Skill | undefined {
    return this.skills.get(skillName)
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values())
  }

  has(skillName: string): boolean {
    return this.skills.has(skillName)
  }

  // Build skill descriptions for LLM prompt
  buildSkillDescriptions(): string {
    const skills = this.getAll()
    if (skills.length === 0) {
      return 'No skills available.'
    }

    return skills
      .map(skill => {
        const params = skill.parameters
          .map(p => `  - ${p.name} (${p.type}${p.required ? ', required' : ', optional'}): ${p.description}`)
          .join('\n')

        return `### ${skill.name}\n${skill.description}\n\nParameters:\n${params || '  None'}`
      })
      .join('\n\n')
  }

  // Build skill list for LLM (compact format)
  buildSkillList(): string {
    return this.getAll()
      .map(skill => `- ${skill.name}: ${skill.description}`)
      .join('\n')
  }
}
