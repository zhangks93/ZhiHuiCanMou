import { describe, expect, it } from 'vitest'
import type { BusinessReportPack } from '../tools/reportPackTypes'
import {
  buildBusinessReportEvidenceLedger,
  buildBusinessReportQualityContract,
  buildBusinessReportSectionBriefs,
  buildBusinessReportClaimRules,
} from '../tools/businessReportQuality'
import {
  buildBusinessReportSectionInputs,
  composeBusinessReportMarkdown,
  extractSectionDraft,
} from './sectionComposer'

function packFixture(): BusinessReportPack {
  const pack: BusinessReportPack = {
    metadata: {
      scope_name: '后勤管理中心',
      org_scope_key: '智汇后勤集团 / 后勤管理中心',
      org_path: ['智汇后勤集团', '后勤管理中心'],
      month: '202603',
      previous_month: '202602',
      cumulative_period: '<202604',
      cumulative_to_month_period: '<202604',
      school_year_target_period: '<202607',
      generated_at: '2026-05-05T00:00:00.000Z',
      unit: '万元',
      row_counts: {
        organization_two_level_table: 1,
        all_metric_table: 1,
        cost_expense_table: 1,
        unit_cards: 0,
        warnings: 1,
      },
    },
    scope_profile: {
      scope_name: '后勤管理中心',
      node_kind: 'level1',
      level_1: '后勤管理中心',
      level_2: null,
      direct_child_count: 1,
      descendant_count: 2,
      leaf_count: 1,
      recommended_report_focus: ['下属单元差异'],
    },
    writing_brief: {
      focus: ['利润修复'],
      school_year_goal_points: ['营业收入学年目标存在压力。'],
      executive_summary_points: ['税前利润需关注。'],
      target_gap_points: ['收入完成率高于利润完成率。'],
      structure_points: ['下属单元分化。'],
      cost_expense_points: ['人力成本需关注。'],
      risk_action_points: ['跟踪利润缺口。'],
    },
    coverage: {
      core_biz_data: 'available',
      receivables: 'manual_required',
      cash_plan: 'manual_required',
      core_expenses: 'manual_required',
      gaps: [],
    },
    summary_cards: [],
    target_vs_actual_table: [],
    metric_comparison_wide_table: [{
      period_scope: 'monthly',
      node_name: '后勤管理中心',
      metric: 'revenue',
      metric_label: '营业收入',
      actual: 100,
      yoy: 90,
      mom: 10,
      school_year_budget_target: 95,
      school_year_budget_completion_rate: 1.05,
      school_year_budget_diff: 5,
      school_year_budget_status: 'good',
      breakthrough_assessment_target: 110,
      breakthrough_assessment_completion_rate: 0.91,
      breakthrough_assessment_diff: -10,
      breakthrough_assessment_status: 'watch',
    }],
    school_year_goal_assessment_table: [{
      period_scope: 'school_year_target',
      node_name: '后勤管理中心',
      metric: 'revenue',
      metric_label: '营业收入',
      actual: null,
      school_year_budget_actual: 800,
      breakthrough_assessment_actual: 760,
      school_year_progress_rate: 0.75,
      school_year_budget_target: 1000,
      school_year_budget_completion_rate: 0.8,
      school_year_budget_diff: -200,
      school_year_budget_progress_gap: 0.05,
      school_year_budget_probability: '中等',
      school_year_budget_risk: '中',
      breakthrough_assessment_target: 1100,
      breakthrough_assessment_completion_rate: 0.73,
      breakthrough_assessment_diff: -300,
      breakthrough_assessment_progress_gap: -0.02,
      breakthrough_assessment_probability: '较低',
      breakthrough_assessment_risk: '高',
      judgement: '营业收入学年目标存在压力。',
    }],
    composition_table: [],
    direct_children_table: [],
    organization_two_level_table: [{
      node_name: '一号食堂',
      node_kind: 'leaf',
      level_1: '后勤管理中心',
      level_2: '餐饮中心',
      depth_from_scope: 2,
      child_count: 0,
      revenue_actual: 50,
      pretax_profit_actual: 5,
      labor_cost_actual: 20,
      gross_margin_actual: 0.3,
    }],
    all_metric_table: [],
    key_descendant_table: [],
    leaf_exception_table: [],
    unit_cards: [],
    monthly_actual_table: [],
    cost_expense_summary: [],
    cost_expense_table: [],
    cost_expense_wide_table: [],
    data_completeness_matrix: [],
    metric_coverage: {
      expected_auto_metrics: ['revenue'],
      available_auto_metrics: ['revenue'],
      missing_auto_metrics: [],
      note: '核心自动指标本次报告包均有返回记录。',
    },
    missing_data_notes: [],
    variance_rankings: {
      revenue_gap_top: [],
      profit_gap_top: [],
      revenue_contribution_top: [],
      profit_contribution_top: [],
      labor_cost_over_budget_top: [],
      expense_over_budget_top: [],
      low_gross_margin_top: [],
    },
    manual_fill_sections: {
      receivables: { status: 'manual_required', heading: '应收账款回款情况', reason: '缺失', instructions: [], table_markdown: '' },
      cash_plan: { status: 'manual_required', heading: '资金计划执行情况', reason: '缺失', instructions: [], table_markdown: '' },
      core_expenses: { status: 'manual_required', heading: '当月核心费用支出情况', reason: '缺失', instructions: [], table_markdown: '' },
    },
    warnings: [],
  }
  const ledger = buildBusinessReportEvidenceLedger(pack)
  pack.evidence_ledger = ledger
  pack.section_briefs = buildBusinessReportSectionBriefs(pack, ledger)
  pack.quality_contract = buildBusinessReportQualityContract(pack)
  pack.claim_rules = buildBusinessReportClaimRules()
  return pack
}

describe('sectionComposer', () => {
  it('builds section-scoped inputs from section briefs and evidence ledger', () => {
    const inputs = buildBusinessReportSectionInputs(packFixture())
    const summary = inputs.find(input => input.section === '经营摘要与学年目标判断')
    const org = inputs.find(input => input.section === '组织结构、贡献与拖累')

    expect(summary?.evidence.some(item => item.source === 'school_year_goal_assessment_table')).toBe(true)
    expect(org?.sourceData).toHaveProperty('organization_two_level_table')
    expect(inputs.every(input => input.metadata.scope_name === '后勤管理中心')).toBe(true)
  })

  it('extracts strict json worker output', () => {
    const draft = extractSectionDraft(
      JSON.stringify({
        markdown: '## 经营摘要与学年目标判断\n\n收入承压。',
        used_evidence_ids: ['school-year-goal-1'],
        limitations: [],
        findings: [],
      }),
      '经营摘要与学年目标判断',
      'worker'
    )

    expect(draft.markdown).toContain('收入承压')
    expect(draft.usedEvidenceIds).toEqual(['school-year-goal-1'])
  })

  it('composes drafts in required report order', () => {
    const markdown = composeBusinessReportMarkdown(packFixture(), [
      { section: '成本费用与效率', markdown: '## 成本费用与效率\n\n费用。', usedEvidenceIds: [], limitations: [], findings: [], source: 'worker' },
      { section: '经营摘要与学年目标判断', markdown: '## 经营摘要与学年目标判断\n\n摘要。', usedEvidenceIds: [], limitations: [], findings: [], source: 'worker' },
    ])

    expect(markdown.indexOf('经营摘要与学年目标判断')).toBeLessThan(markdown.indexOf('成本费用与效率'))
  })
})
