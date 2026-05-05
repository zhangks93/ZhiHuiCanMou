import type {
  BusinessReportEvidenceItem,
  BusinessReportPack,
  BusinessReportSectionBrief,
} from '../tools/reportPackTypes'
import {
  validateBusinessReportOutput,
  type ReportQualityFinding,
  type ReportQualityResult,
} from '../tools/businessReportQuality'

export interface BusinessReportSectionInput {
  section: string
  required: boolean
  dataStatus: BusinessReportSectionBrief['data_status']
  primarySources: string[]
  requiredEvidenceIds: string[]
  writingGuidance: string[]
  evidence: BusinessReportEvidenceItem[]
  sourceData: Record<string, unknown>
  claimRules: BusinessReportPack['claim_rules']
  qualityRules: {
    forbiddenTerms: string[]
    requiredReportTypeLabels: string[]
    requiredPeriodScopeLabels: string[]
  }
  metadata: BusinessReportPack['metadata']
  scopeProfile: BusinessReportPack['scope_profile']
  writingBrief?: BusinessReportPack['writing_brief']
}

export interface BusinessReportSectionDraft {
  section: string
  markdown: string
  usedEvidenceIds: string[]
  limitations: string[]
  findings: string[]
  source: 'worker' | 'fallback'
}

export interface BusinessReportCompositionResult {
  markdown: string
  drafts: BusinessReportSectionDraft[]
  audit: ReportQualityResult
  repaired: boolean
  blockingFindings: ReportQualityFinding[]
}

const SECTION_ORDER = [
  '经营摘要与学年目标判断',
  '目标对标与实际完成',
  '组织结构、贡献与拖累',
  '成本费用与效率',
  '风险判断与后续动作',
  '数据限制与待补说明',
]

function pickSourceData(pack: BusinessReportPack, section: string): Record<string, unknown> {
  if (section === '经营摘要与学年目标判断') {
    return {
      school_year_goal_assessment_table: pack.school_year_goal_assessment_table,
      summary_cards: pack.summary_cards,
      target_vs_actual_table: pack.target_vs_actual_table,
    }
  }

  if (section === '目标对标与实际完成') {
    return {
      metric_comparison_wide_table: pack.metric_comparison_wide_table,
      target_vs_actual_table: pack.target_vs_actual_table,
      monthly_actual_table: pack.monthly_actual_table,
      variance_rankings: {
        revenue_gap_top: pack.variance_rankings.revenue_gap_top,
        profit_gap_top: pack.variance_rankings.profit_gap_top,
      },
    }
  }

  if (section === '组织结构、贡献与拖累') {
    return {
      direct_children_table: pack.direct_children_table,
      organization_two_level_table: pack.organization_two_level_table,
      key_descendant_table: pack.key_descendant_table,
      project_exception_table: pack.leaf_exception_table,
      unit_cards: pack.unit_cards,
      variance_rankings: {
        revenue_contribution_top: pack.variance_rankings.revenue_contribution_top,
        profit_contribution_top: pack.variance_rankings.profit_contribution_top,
        revenue_gap_top: pack.variance_rankings.revenue_gap_top,
        profit_gap_top: pack.variance_rankings.profit_gap_top,
      },
    }
  }

  if (section === '成本费用与效率') {
    return {
      cost_expense_summary: pack.cost_expense_summary,
      cost_expense_wide_table: pack.cost_expense_wide_table,
      cost_expense_table: pack.cost_expense_table,
      variance_rankings: {
        labor_cost_over_budget_top: pack.variance_rankings.labor_cost_over_budget_top,
        expense_over_budget_top: pack.variance_rankings.expense_over_budget_top,
        low_gross_margin_top: pack.variance_rankings.low_gross_margin_top,
      },
    }
  }

  if (section === '风险判断与后续动作') {
    return {
      warnings: pack.warnings,
      unit_cards: pack.unit_cards,
      variance_rankings: pack.variance_rankings,
      writing_brief_risk_action_points: pack.writing_brief?.risk_action_points,
    }
  }

  return {
    missing_data_notes: pack.missing_data_notes,
    data_completeness_matrix: pack.data_completeness_matrix,
    metric_coverage: pack.metric_coverage,
    coverage: pack.coverage,
  }
}

function getBriefForSection(pack: BusinessReportPack, section: string): BusinessReportSectionBrief {
  const found = pack.section_briefs?.find(brief => brief.section === section)
  if (found) return found

  return {
    section,
    required: section !== '数据限制与待补说明' || Boolean(pack.missing_data_notes?.length),
    data_status: 'partial',
    primary_sources: [],
    required_evidence_ids: [],
    writing_guidance: [],
  }
}

export function buildBusinessReportSectionInputs(pack: BusinessReportPack): BusinessReportSectionInput[] {
  const evidenceById = new Map((pack.evidence_ledger ?? []).map(item => [item.id, item]))

  return SECTION_ORDER
    .map(section => getBriefForSection(pack, section))
    .filter(brief => brief.required || brief.section === '数据限制与待补说明')
    .map(brief => {
      const requiredEvidence = brief.required_evidence_ids
        .map(id => evidenceById.get(id))
        .filter((item): item is BusinessReportEvidenceItem => Boolean(item))
      const sectionEvidence = (pack.evidence_ledger ?? [])
        .filter(item => item.section === brief.section && !brief.required_evidence_ids.includes(item.id))
        .slice(0, brief.section === '组织结构、贡献与拖累' ? 32 : brief.section === '成本费用与效率' ? 24 : 12)

      return {
        section: brief.section,
        required: brief.required,
        dataStatus: brief.data_status,
        primarySources: brief.primary_sources,
        requiredEvidenceIds: brief.required_evidence_ids,
        writingGuidance: brief.writing_guidance,
        evidence: [...requiredEvidence, ...sectionEvidence],
        sourceData: pickSourceData(pack, brief.section),
        claimRules: pack.claim_rules,
        qualityRules: {
          forbiddenTerms: pack.quality_contract?.forbidden_terms ?? [],
          requiredReportTypeLabels: pack.quality_contract?.required_chinese_report_type_labels ?? ['学年预算', '突围考核'],
          requiredPeriodScopeLabels: pack.quality_contract?.required_period_scope_labels ?? ['当月', '截至当月累计', '学年目标累计'],
        },
        metadata: pack.metadata,
        scopeProfile: pack.scope_profile,
        writingBrief: pack.writing_brief,
      }
    })
}

export function extractSectionDraft(raw: string, section: string, source: BusinessReportSectionDraft['source']): BusinessReportSectionDraft {
  const trimmed = raw.trim()
  let parsed: unknown
  const fencedJson = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```\s*$/i)
  const candidate = fencedJson?.[1]?.trim() || trimmed

  try {
    parsed = JSON.parse(candidate) as unknown
  } catch {
    parsed = null
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>
    return {
      section,
      markdown: typeof record.markdown === 'string' ? record.markdown.trim() : trimmed,
      usedEvidenceIds: Array.isArray(record.used_evidence_ids)
        ? record.used_evidence_ids.filter((item): item is string => typeof item === 'string')
        : [],
      limitations: Array.isArray(record.limitations)
        ? record.limitations.filter((item): item is string => typeof item === 'string')
        : [],
      findings: Array.isArray(record.findings)
        ? record.findings.filter((item): item is string => typeof item === 'string')
        : [],
      source,
    }
  }

  return {
    section,
    markdown: trimmed,
    usedEvidenceIds: [],
    limitations: [],
    findings: ['worker_output_not_json'],
    source,
  }
}

function sectionRank(section: string): number {
  const index = SECTION_ORDER.indexOf(section)
  return index === -1 ? SECTION_ORDER.length : index
}

function stripForbiddenAscii(markdown: string): string {
  return markdown
    .replace(/\bfone\b/gi, '学年预算')
    .replace(/\btuwei\b/gi, '突围考核')
    .replace(/\bgood\b/gi, '达标')
    .replace(/\bwatch\b/gi, '关注')
    .replace(/\brisk\b/gi, '风险')
    .replace(/\bmissing\b/gi, '缺数')
    .replace(/叶子节点/g, '明细项目')
    .replace(/\bnode\b/gi, '单位')
    .replace(/\bleaf\b/gi, '明细项目')
    .replace(/\borphan\b/gi, '未归类项目')
    .replace(/\bworker\b/gi, '分章写作')
    .replace(/\bJSON\b/g, '结构化内容')
    .replace(/\bjson\b/g, '结构化内容')
}

export function composeBusinessReportMarkdown(
  pack: BusinessReportPack,
  drafts: BusinessReportSectionDraft[]
): string {
  const orderedDrafts = [...drafts].sort((a, b) => sectionRank(a.section) - sectionRank(b.section))
  const body = orderedDrafts
    .map(draft => {
      const markdown = draft.markdown.trim()
      if (markdown.startsWith('#')) return markdown
      return `## ${draft.section}\n\n${markdown}`
    })
    .join('\n\n')

  return stripForbiddenAscii([
    `# ${pack.metadata.scope_name}经营分析报告`,
    '',
    `**汇报单位**：${pack.metadata.scope_name}`,
    `**统计周期**：当月 ${pack.metadata.month}；截至当月累计 ${pack.metadata.cumulative_to_month_period}；学年目标累计 ${pack.metadata.school_year_target_period}`,
    `**数据单位**：${pack.metadata.unit}`,
    `**数据来源**：系统经营数据和组织层级数据`,
    '',
    body,
  ].join('\n'))
}

export function composeAndAuditBusinessReport(
  pack: BusinessReportPack,
  drafts: BusinessReportSectionDraft[]
): BusinessReportCompositionResult {
  const markdown = composeBusinessReportMarkdown(pack, drafts)
  const audit = validateBusinessReportOutput(markdown, pack)
  const blockingFindings = audit.findings.filter(finding => finding.severity === 'error')

  return {
    markdown,
    drafts,
    audit,
    repaired: false,
    blockingFindings,
  }
}
