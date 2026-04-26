// Skills barrel export
// Each skill is a folder with skill.json + prompt.md + assets/
// Add new skills here: import config + prompt + assets, call loadSkill()

import { loadSkill } from './loader'
import type { SkillConfig } from './loader'

// --- financial-analysis ---
import financialAnalysisConfig from './financial-analysis/skill.json'
import financialAnalysisPrompt from './financial-analysis/prompt.md?raw'
import financialAnalysisAvatar from './financial-analysis/assets/avatar.png'
import bizAnalysisReport from './financial-analysis/assets/biz-analysis-report.md?raw'
import reportGenerationReference from './financial-analysis/references/report-generation.md?raw'
import actualMarchReportStyle from './financial-analysis/references/actual-march-report-style.md?raw'
import reportQualityRubric from './financial-analysis/references/report-quality-rubric.md?raw'
import dataRequirements from './financial-analysis/references/data-requirements.md?raw'
import analysisMethodReference from './financial-analysis/references/analysis-method.md?raw'
import chartGuidanceReference from './financial-analysis/references/chart-guidance.md?raw'
import workflowReference from './financial-analysis/references/workflow.md?raw'
import metricsReference from './financial-analysis/references/metrics.md?raw'

export const financialAnalysisAgent = loadSkill(
  financialAnalysisConfig as SkillConfig,
  financialAnalysisPrompt,
  {
    'biz-analysis-report.md': bizAnalysisReport,
    'references/report-generation.md': reportGenerationReference,
    'references/actual-march-report-style.md': actualMarchReportStyle,
    'references/report-quality-rubric.md': reportQualityRubric,
    'references/data-requirements.md': dataRequirements,
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
