// Skills barrel export
// Each skill is a folder with skill.json + prompt.md + assets/
// Add new skills here: import config + prompt + assets, call loadSkill()

import { loadSkill } from './loader'
import type { SkillConfig } from './loader'

// --- financial-analysis ---
import financialAnalysisConfig from './financial-analysis/skill.json'
import financialAnalysisPrompt from './financial-analysis/prompt.md?raw'
import bizAnalysisReport from './financial-analysis/assets/biz-analysis-report.md?raw'

export const financialAnalysisAgent = loadSkill(
  financialAnalysisConfig as SkillConfig,
  financialAnalysisPrompt,
  {
    'biz-analysis-report.md': bizAnalysisReport,
  }
)

// --- Add new skills below ---
// import newSkillConfig from './new-skill/skill.json'
// import newSkillPrompt from './new-skill/prompt.md?raw'
// import newSkillAsset from './new-skill/assets/some-asset.md?raw'
// export const newSkillAgent = loadSkill(
//   newSkillConfig as SkillConfig,
//   newSkillPrompt,
//   { 'some-asset.md': newSkillAsset }
// )

/** All loaded skills (for auto-registration) */
export const allSkills = [financialAnalysisAgent]
