// 带组织层级的经营数据查询 Tool

import type { RegisteredTool } from '../types'
import { supabase } from '@/lib/supabase'

export const queryWithHierarchyTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'query_with_hierarchy',
      description: '查询教育后勤经营数据，并附带组织层级信息（level_0/level_1/level_2/level_3）。优先用于经营分析主查询，可按 node_name 或 level_0/level_1/level_2 过滤。period 仅支持传入系统提供的合法 period 精确值。',
      parameters: {
        type: 'object',
        properties: {
          node_name: {
            type: 'string',
            description: '组织节点名称，模糊匹配。如“餐饮”会匹配所有含“餐饮”的节点。留空则查询所有节点。',
          },
          metric_category: {
            type: 'string',
            description: '指标类别',
            enum: [
              'revenue', 'gross_profit', 'gross_margin', 'pretax_profit', 'pretax_margin',
              'catering_expense', 'material_cost', 'other_expense', 'external_expense',
              'labor_cost', 'salary', 'social_insurance', 'housing_fund', 'labor_service_fee',
              'other_labor_cost', 'vehicle_expense', 'energy_expense', 'travel_expense',
              'entertainment_expense', 'external_revenue', 'headcount', 'per_capita_revenue',
              'labor_cost_rate', 'revenue_creation', 'profit_creation',
            ],
          },
          report_type: {
            type: 'string',
            description: '报表类型：fone=年初预算, tuwei=突围考核',
            enum: ['fone', 'tuwei'],
          },
          period_type: {
            type: 'string',
            description: '期间类型：cumulative=累计, monthly=当月',
            enum: ['cumulative', 'monthly'],
          },
          level_0: {
            type: 'string',
            description: '按集团级过滤，如“智汇后勤集团”。通常留空。',
          },
          level_1: {
            type: 'string',
            description: '按一级组织过滤，如“餐饮中心”“物业中心”等。',
          },
          level_2: {
            type: 'string',
            description: '按二级组织过滤，如“广州餐饮”“深圳物业”等。',
          },
          period: {
            type: 'string',
            description: '期间值。只能使用系统运行时上下文提供的合法 period 精确值。',
          },
          limit: {
            type: 'number',
            description: '返回记录数上限，默认 200，最大 500',
          },
        },
        required: [],
      },
    },
  },

  execute: async (args: Record<string, unknown>): Promise<string> => {
    const nodeName = args.node_name as string | undefined
    const metricCategory = args.metric_category as string | undefined
    const reportType = (args.report_type as string) || 'fone'
    const periodType = (args.period_type as string) || 'cumulative'
    const level0Filter = args.level_0 as string | undefined
    const level1Filter = args.level_1 as string | undefined
    const level2Filter = args.level_2 as string | undefined
    const periodFilter = args.period as string | undefined
    const limit = Math.min(Number(args.limit) || 200, 500)

    let preFilteredNodes: string[] | undefined
    if (level0Filter || level1Filter || level2Filter) {
      let hierQuery = supabase
        .from('edu_org_hierarchy')
        .select('node_name')

      if (level0Filter) hierQuery = hierQuery.ilike('level_0', `%${level0Filter}%`)
      if (level1Filter) hierQuery = hierQuery.ilike('level_1', `%${level1Filter}%`)
      if (level2Filter) hierQuery = hierQuery.ilike('level_2', `%${level2Filter}%`)

      const { data: hierNodes, error: hierErr } = await hierQuery
      if (hierErr) throw new Error(`组织层级查询失败: ${hierErr.message}`)
      if (!hierNodes || hierNodes.length === 0) {
        return JSON.stringify({
          message: '按组织层级过滤后无匹配节点',
          filters: { level_0: level0Filter, level_1: level1Filter, level_2: level2Filter },
        })
      }
      preFilteredNodes = hierNodes.map(node => node.node_name)
    }

    let query = supabase
      .from('edu_biz_report')
      .select('node_name, metric_category, metric_category_cn, actual_value, budget_value, completion_rate, diff_value, yoy_value, period, report_type, period_type, sort_order')
      .eq('report_type', reportType)
      .eq('period_type', periodType)
      .order('sort_order', { ascending: true })
      .limit(limit)

    if (preFilteredNodes) {
      query = query.in('node_name', preFilteredNodes)
    } else if (nodeName) {
      query = query.ilike('node_name', `%${nodeName}%`)
    }
    if (metricCategory) {
      query = query.eq('metric_category', metricCategory)
    }
    if (periodFilter) {
      query = query.eq('period', periodFilter)
    }

    const { data: bizData, error: bizError } = await query

    if (bizError) {
      throw new Error(`经营数据查询失败: ${bizError.message}`)
    }

    if (!bizData || bizData.length === 0) {
      return JSON.stringify({
        message: '未找到匹配的经营数据',
        query_echo: {
          node_name: nodeName || null,
          metric_category: metricCategory || null,
          report_type: reportType,
          period_type: periodType,
          period: periodFilter || null,
          level_0: level0Filter || null,
          level_1: level1Filter || null,
          level_2: level2Filter || null,
        },
      })
    }

    const nodeNames = [...new Set(bizData.map(row => row.node_name))]
    const { data: hierData, error: hierError } = await supabase
      .from('edu_org_hierarchy')
      .select('node_name, level_0, level_1, level_2, level_3, label')
      .in('node_name', nodeNames)

    if (hierError) {
      throw new Error(`组织层级查询失败: ${hierError.message}`)
    }

    const hierMap = new Map<string, {
      level_0: string | null
      level_1: string | null
      level_2: string | null
      level_3: string | null
      label: string | null
    }>()

    for (const row of hierData || []) {
      hierMap.set(row.node_name, {
        level_0: row.level_0,
        level_1: row.level_1,
        level_2: row.level_2,
        level_3: row.level_3,
        label: row.label,
      })
    }

    return JSON.stringify({
      summary: {
        returned_count: bizData.length,
        limit,
        truncated: bizData.length >= limit,
        report_type: reportType,
        period_type: periodType,
        period: periodFilter || '全部',
      },
      scope: {
        node_name: nodeName || null,
        level_0: level0Filter || null,
        level_1: level1Filter || null,
        level_2: level2Filter || null,
      },
      rows: bizData.map(row => {
        const hierarchy = hierMap.get(row.node_name)
        return {
          node_name: row.node_name,
          level_0: hierarchy?.level_0 || null,
          level_1: hierarchy?.level_1 || null,
          level_2: hierarchy?.level_2 || null,
          level_3: hierarchy?.level_3 || null,
          label: hierarchy?.label || null,
          metric: row.metric_category,
          metric_label: row.metric_category_cn,
          actual: row.actual_value,
          budget: row.budget_value,
          completion_rate: row.completion_rate,
          diff: row.diff_value,
          yoy: row.yoy_value,
          period: row.period,
        }
      }),
      guidance: bizData.length >= limit
        ? '结果可能已截断，请缩小组织、指标或期间范围后重试。'
        : '如需横向对比，请基于 rows 中的 level_1 或 level_2 继续汇总分析。',
    }, null, 2)
  },
}
