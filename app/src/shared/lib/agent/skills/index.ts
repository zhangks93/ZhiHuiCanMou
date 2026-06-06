// Skills barrel export
// Each skill is a folder with skill.json + prompt.md + assets/
// Add new skills here: import config + prompt + assets, call loadSkill()

import { loadSkill } from './loader'
import type { SkillConfig } from './loader'

// --- financial-analysis ---
import financialAnalysisConfig from './financial-analysis/skill.json'
import financialAnalysisPrompt from './financial-analysis/prompt.md?raw'
import financialAnalysisAvatar from './financial-analysis/assets/avatar.png'
import analysisMethodReference from './financial-analysis/references/analysis-method.md?raw'
import chartGuidanceReference from './financial-analysis/references/chart-guidance.md?raw'
import workflowReference from './financial-analysis/references/workflow.md?raw'
import metricsReference from './financial-analysis/references/metrics.md?raw'

// --- feishu-assistant ---
import feishuAssistantConfig from './feishu-assistant/skill.json'
import feishuAssistantPrompt from './feishu-assistant/prompt.md?raw'

export const financialAnalysisAgent = loadSkill(
  financialAnalysisConfig as SkillConfig,
  financialAnalysisPrompt,
  {
    'references/analysis-method.md': analysisMethodReference,
    'references/chart-guidance.md': chartGuidanceReference,
    'references/workflow.md': workflowReference,
    'references/metrics.md': metricsReference,
  },
  {
    imageAssets: {
      'avatar.png': financialAnalysisAvatar,
    },
  }
)

export const feishuAssistantAgent = loadSkill(
  feishuAssistantConfig as SkillConfig,
  feishuAssistantPrompt
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
export const allSkills = [financialAnalysisAgent, feishuAssistantAgent]
