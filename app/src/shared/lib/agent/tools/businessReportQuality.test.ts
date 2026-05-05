import { describe, expect, it } from 'vitest'
import type { BusinessReportPack } from './reportPackTypes'
import {
  buildBusinessReportEvidenceLedger,
  buildBusinessReportQualityContract,
  validateBusinessReportOutput,
  validateBusinessReportPack,
} from './businessReportQuality'

function basePack(overrides: Partial<BusinessReportPack> = {}): BusinessReportPack {
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
      node_kind: 'level_1',
      level_1: '后勤管理中心',
      level_2: null,
      direct_child_count: 1,
      descendant_count: 1,
      leaf_count: 1,
      recommended_report_focus: ['下属单元差异'],
    },
    writing_brief: {
      focus: ['利润修复'],
      school_year_goal_points: ['营业收入学年目标进度正常。'],
      executive_summary_points: ['税前利润仍需关注。'],
      target_gap_points: ['收入完成率高于利润完成率。'],
      structure_points: ['下属单元存在分化。'],
      cost_expense_points: ['人力成本需关注。'],
      risk_action_points: ['跟踪利润缺口。'],
    },
    coverage: {
      core_biz_data: 'available',
      monthly_plan: 'available',
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
      node_kind: 'level_1',
      level_1: '后勤管理中心',
      level_2: null,
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
      actual: 800,
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
      depth_from_scope: 1,
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
    cost_expense_wide_table: [{
      period_scope: 'monthly',
      node_name: '后勤管理中心',
      node_kind: 'level_1',
      level_1: '后勤管理中心',
      level_2: null,
      metric: 'labor_cost',
      metric_label: '人力成本',
      actual: 40,
      yoy: 38,
      mom: 2,
      school_year_budget_target: 35,
      school_year_budget_completion_rate: 1.14,
      school_year_budget_diff: 5,
      school_year_budget_status: 'watch',
      breakthrough_assessment_target: 34,
      breakthrough_assessment_completion_rate: 1.18,
      breakthrough_assessment_diff: 6,
      breakthrough_assessment_status: 'watch',
    }],
    data_completeness_matrix: [],
    metric_coverage: {
      expected_auto_metrics: ['revenue'],
      available_auto_metrics: ['revenue'],
      missing_auto_metrics: [],
      note: 'ok',
    },
    missing_data_notes: [{
      section: '应收账款回款情况',
      reason: '系统未接入专项数据源',
      fields: ['应收', '回款'],
      handling: 'closing_note',
    }],
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
    warnings: [{
      severity: 'yellow',
      section: '当月核心指标',
      message: '学年预算营业收入当月完成状态为 watch。',
      evidence: { metric: 'revenue' },
    }],
  }

  return { ...pack, ...overrides }
}

describe('business report quality', () => {
  it('builds evidence ledger from report pack facts and gaps', () => {
    const ledger = buildBusinessReportEvidenceLedger(basePack())
    expect(ledger.some(item => item.source === 'metric_comparison_wide_table')).toBe(true)
    expect(ledger.some(item => item.confidence === 'manual_required')).toBe(true)
  })

  it('passes a complete report pack', () => {
    const result = validateBusinessReportPack(basePack())
    expect(result.passed).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(80)
  })

  it('fails report pack when core data is missing', () => {
    const result = validateBusinessReportPack(basePack({
      coverage: {
        ...basePack().coverage,
        core_biz_data: 'missing',
      },
    }))
    expect(result.passed).toBe(false)
    expect(result.findings.some(item => item.code === 'core_data_missing')).toBe(true)
  })

  it('flags forbidden internal terms in markdown output', () => {
    const pack = basePack()
    pack.quality_contract = buildBusinessReportQualityContract(pack)
    const result = validateBusinessReportOutput('## 经营摘要与学年目标判断\nfone 口径表现较好。', pack)
    expect(result.passed).toBe(false)
    expect(result.findings.some(item => item.code === 'forbidden_term_present')).toBe(true)
  })

  it('requires manual data to be placed in limitations section', () => {
    const pack = basePack()
    pack.quality_contract = buildBusinessReportQualityContract(pack)
    const result = validateBusinessReportOutput([
      '## 经营摘要与学年目标判断',
      '应收账款回款情况显示回款良好。',
      '## 目标对标与实际完成',
      '## 组织结构、贡献与拖累',
      '## 成本费用与效率',
      '## 风险判断与后续动作',
    ].join('\n'), pack)

    expect(result.passed).toBe(false)
    expect(result.findings.some(item => item.code === 'manual_data_not_in_limitations')).toBe(true)
  })
})
