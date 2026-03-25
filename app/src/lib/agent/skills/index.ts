// Skills barrel export
// Each skill is a folder with skill.json + prompt.md
// Add new skills here: import config + prompt, call loadSkill()

import { loadSkill } from './loader'
import type { SkillConfig } from './loader'

// --- financial-analysis ---
import financialAnalysisConfig from './financial-analysis/skill.json'
import financialAnalysisPrompt from './financial-analysis/prompt.md?raw'

export const financialAnalysisAgent = loadSkill(
  financialAnalysisConfig as SkillConfig,
  financialAnalysisPrompt
)

// --- Add new skills below ---
// import newSkillConfig from './new-skill/skill.json'
// import newSkillPrompt from './new-skill/prompt.md?raw'
// export const newSkillAgent = loadSkill(newSkillConfig as SkillConfig, newSkillPrompt)

/** All loaded skills (for auto-registration) */
export const allSkills = [financialAnalysisAgent]
