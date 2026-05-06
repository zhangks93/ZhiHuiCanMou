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
      school_year_budget_actual: 100,
      breakthrough_assessment_actual: 100,
      yoy: 90,
      school_year_budget_yoy: 90,
      breakthrough_assessment_yoy: 90,
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
      business_role: '经营型',
      analysis_treatment: '按收入兑现、利润转化和目标完成情况分析。',
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
      school_year_budget_actual: 40,
      breakthrough_assessment_actual: 40,
      yoy: 38,
      school_year_budget_yoy: 38,
      breakthrough_assessment_yoy: 38,
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
      message: '学年预算营业收入当月完成状态为关注。',
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

  it('blocks internal table names and warns on leaked status terms', () => {
    const pack = basePack()
    pack.quality_contract = buildBusinessReportQualityContract(pack)
    const result = validateBusinessReportOutput([
      '## 经营摘要与学年目标判断',
      '数据来自 edu_biz_report，状态 good。',
      '## 目标对标与实际完成',
      '## 组织结构、贡献与拖累',
      '一号食堂收入五十万元。',
      '## 成本费用与效率',
      '## 风险判断与后续动作',
      '## 数据限制与待补说明',
    ].join('\n'), pack)

    expect(result.passed).toBe(false)
    expect(result.findings.some(item => item.code === 'forbidden_term_present')).toBe(true)
    expect(result.findings.some(item => item.code === 'internal_status_term_present' && item.severity === 'warning')).toBe(true)
  })

  it('allows ordinary latin letters and business abbreviations', () => {
    const pack = basePack()
    pack.quality_contract = buildBusinessReportQualityContract(pack)
    const result = validateBusinessReportOutput([
      '## 经营摘要与学年目标判断',
      '本月 BP 复盘显示收入仍需关注，ROI 还需要结合投入结构解释，学年预算和突围考核均需持续跟进。',
      '## 目标对标与实际完成',
      '当月收入完成较好，截至当月累计利润仍有缺口，学年目标累计存在压力。',
      '## 组织结构、贡献与拖累',
      '一号食堂收入五十万元。',
      '## 成本费用与效率',
      '人力成本需关注。',
      '## 风险判断与后续动作',
      '后续动作聚焦利润缺口。',
      '## 数据限制与待补说明',
      '应收账款回款情况需人工补充。',
    ].join('\n'), pack)

    expect(result.passed).toBe(true)
    expect(result.findings.some(item => item.code === 'latin_letters_present')).toBe(false)
    expect(result.findings.some(item => item.code === 'forbidden_term_present')).toBe(false)
  })

  it('warns on non-business technical terms in final markdown', () => {
    const pack = basePack()
    pack.quality_contract = buildBusinessReportQualityContract(pack)
    const result = validateBusinessReportOutput([
      '## 经营摘要与学年目标判断',
      '学年预算和突围考核均需持续跟进。',
      '## 目标对标与实际完成',
      '当月收入完成较好，截至当月累计利润仍有缺口，学年目标累计存在压力。',
      '## 组织结构、贡献与拖累',
      '叶子节点一号食堂收入五十万元。',
      '## 成本费用与效率',
      '人力成本需关注。',
      '## 风险判断与后续动作',
      '后续动作聚焦利润缺口。',
      '## 数据限制与待补说明',
      '应收账款回款情况需人工补充。',
    ].join('\n'), pack)

    expect(result.findings.some(item => item.code === 'non_business_term_present' && item.severity === 'warning')).toBe(true)
  })

  it('allows business terms for detailed units and projects', () => {
    const pack = basePack()
    pack.quality_contract = buildBusinessReportQualityContract(pack)
    const result = validateBusinessReportOutput([
      '## 经营摘要与学年目标判断',
      '学年预算和突围考核均需持续跟进。',
      '## 目标对标与实际完成',
      '当月收入完成较好，截至当月累计利润仍有缺口，学年目标累计存在压力。',
      '## 组织结构、贡献与拖累',
      '明细项目一号食堂收入五十万元，第二层单位需要继续关注。',
      '## 成本费用与效率',
      '人力成本需关注。',
      '## 风险判断与后续动作',
      '后续动作聚焦利润缺口。',
      '## 数据限制与待补说明',
      '应收账款回款情况需人工补充。',
    ].join('\n'), pack)

    expect(result.passed).toBe(true)
    expect(result.findings.some(item => item.code === 'non_business_term_present')).toBe(false)
  })

  it('allows urls and fenced code blocks without latin-letter warnings', () => {
    const pack = basePack()
    pack.quality_contract = buildBusinessReportQualityContract(pack)
    const result = validateBusinessReportOutput([
      '## 经营摘要与学年目标判断',
      '学年预算和突围考核均需持续跟进。',
      '参考链接：https://example.com/report',
      '```',
      'abc',
      '```',
      '## 目标对标与实际完成',
      '当月收入完成较好，截至当月累计利润仍有缺口，学年目标累计存在压力。',
      '## 组织结构、贡献与拖累',
      '一号食堂收入五十万元。',
      '## 成本费用与效率',
      '人力成本需关注。',
      '## 风险判断与后续动作',
      '后续动作聚焦利润缺口。',
      '## 数据限制与待补说明',
      '应收账款回款情况需人工补充。',
    ].join('\n'), pack)

    expect(result.passed).toBe(true)
    expect(result.findings.some(item => item.code === 'latin_letters_present')).toBe(false)
  })

  it('requires second-level organization description when available', () => {
    const base = basePack()
    const pack = basePack({
      organization_two_level_table: [
        ...base.organization_two_level_table,
        {
          node_name: '二号食堂',
          node_kind: 'leaf',
          level_1: '后勤管理中心',
          level_2: '餐饮中心',
          business_role: '经营型',
          analysis_treatment: '按收入兑现、利润转化和目标完成情况分析。',
          depth_from_scope: 2,
          child_count: 0,
          revenue_actual: 30,
          pretax_profit_actual: -2,
          labor_cost_actual: 12,
          gross_margin_actual: 0.2,
        },
      ],
    })
    pack.quality_contract = buildBusinessReportQualityContract(pack)

    const result = validateBusinessReportOutput([
      '## 经营摘要与学年目标判断',
      '学年预算和突围考核均需关注。',
      '## 目标对标与实际完成',
      '## 组织结构、贡献与拖累',
      '组织层级存在分化，但这里只写一级。',
      '## 成本费用与效率',
      '## 风险判断与后续动作',
      '## 数据限制与待补说明',
    ].join('\n'), pack)

    expect(result.passed).toBe(false)
    expect(result.findings.some(item => item.code === 'second_level_org_not_described')).toBe(true)
  })

  it('warns when deeper organization data is not described', () => {
    const base = basePack()
    const pack = basePack({
      organization_two_level_table: [
        ...base.organization_two_level_table,
        {
          node_name: '三层明细食堂',
          node_kind: 'leaf',
          level_1: '后勤管理中心',
          level_2: '餐饮中心',
          business_role: '经营型',
          analysis_treatment: '按收入兑现、利润转化和目标完成情况分析。',
          depth_from_scope: 3,
          child_count: 0,
          revenue_actual: 20,
          pretax_profit_actual: 1,
          labor_cost_actual: 8,
          gross_margin_actual: 0.22,
        },
      ],
    })
    pack.quality_contract = buildBusinessReportQualityContract(pack)

    const result = validateBusinessReportOutput([
      '## 经营摘要与学年目标判断',
      '学年预算和突围考核均需关注。',
      '## 目标对标与实际完成',
      '当月、截至当月累计和学年目标累计均已说明。',
      '## 组织结构、贡献与拖累',
      '一号食堂收入五十万元。',
      '## 成本费用与效率',
      '人力成本需关注。',
      '## 风险判断与后续动作',
      '后续动作聚焦利润缺口。',
      '## 数据限制与待补说明',
      '应收账款回款情况需人工补充。',
    ].join('\n'), pack)

    expect(result.findings.some(item => item.code === 'deep_org_not_described' && item.severity === 'warning')).toBe(true)
  })

  it('blocks overflagging support units due only to no revenue or negative profit', () => {
    const pack = basePack({
      organization_two_level_table: [{
        node_name: '战略支持中心',
        node_kind: 'level_1',
        level_1: '战略支持中心',
        level_2: null,
        business_role: '职能支持型',
        analysis_treatment: '按成本效率、费用执行和服务支撑分析，不因无营收或利润为负直接判定经营问题。',
        depth_from_scope: 1,
        child_count: 0,
        revenue_actual: null,
        pretax_profit_actual: -30,
        labor_cost_actual: 30,
        gross_margin_actual: null,
      }],
    })
    pack.quality_contract = buildBusinessReportQualityContract(pack)

    const result = validateBusinessReportOutput([
      '## 经营摘要与学年目标判断',
      '学年预算和突围考核均需关注。',
      '## 目标对标与实际完成',
      '当月、截至当月累计和学年目标累计均已说明。',
      '## 组织结构、贡献与拖累',
      '战略支持中心无营收且利润为负，是明显经营问题。',
      '## 成本费用与效率',
      '人力成本需关注。',
      '## 风险判断与后续动作',
      '后续动作聚焦利润缺口。',
      '## 数据限制与待补说明',
      '应收账款回款情况需人工补充。',
    ].join('\n'), pack)

    expect(result.passed).toBe(false)
    expect(result.findings.some(item => item.code === 'support_unit_overflagged')).toBe(true)
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
