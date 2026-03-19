// 带组织层级的经营数据查询 Tool

import type { RegisteredTool } from '../types'
import { supabase } from '@/lib/supabase'

export const queryWithHierarchyTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'query_with_hierarchy',
      description: '查询教育后勤经营数据，并附带组织层级信息（level_0/level_1/level_2/level_3）。可按组织层级聚合查询（如某中心下所有节点），支持按 level_0、level_1、level_2 过滤。比 query_biz_data 更强大，推荐优先使用。',
      parameters: {
        type: 'object',
        properties: {
          node_name: {
            type: 'string',
            description: '组织节点名称，模糊匹配。如"餐饮"会匹配所有含"餐饮"的节点。留空则查询所有节点。',
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
            description: '按集团级过滤，如"智汇后勤集团"。通常留空，集团级代表全集团汇总。',
          },
          level_1: {
            type: 'string',
            description: '按一级组织过滤，如"餐饮中心"、"物业中心"等。',
          },
          level_2: {
            type: 'string',
            description: '按二级组织过滤，如"广州餐饮"、"深圳物业"等。',
          },
          period: {
            type: 'string',
            description: '月度范围筛选。monthly期间填具体月份如 "202601"（1月）、"202602"（2月）；cumulative期间填如 "<202603"（截至2月累计）或 "202601-202602-"。留空则返回最新期间数据。',
          },
          limit: {
            type: 'number',
            description: '返回记录数上限，默认200，最大500',
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

    // Step 1: If level filters specified, pre-fetch matching node names first
    // This avoids the pagination-before-filter bug (old approach applied limit before level filter)
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
      preFilteredNodes = hierNodes.map(h => h.node_name)
    }

    // Step 2: Query edu_biz_report
    let query = supabase
      .from('edu_biz_report')
      .select('node_name, metric_category, metric_category_cn, actual_value, budget_value, completion_rate, diff_value, yoy_value, period, sort_order')
      .eq('report_type', reportType)
      .eq('period_type', periodType)
      .order('sort_order', { ascending: true })
      .limit(limit)

    if (preFilteredNodes) {
      // Use pre-filtered node names from hierarchy (avoids limit-before-filter issue)
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
        filters: { node_name: nodeName, metric_category: metricCategory, report_type: reportType, period_type: periodType },
      })
    }

    // Step 3: Fetch hierarchy for all returned node names
    const nodeNames = [...new Set(bizData.map(r => r.node_name))]
    const { data: hierData, error: hierError } = await supabase
      .from('edu_org_hierarchy')
      .select('node_name, level_0, level_1, level_2, level_3, label')
      .in('node_name', nodeNames)

    if (hierError) {
      throw new Error(`组织层级查询失败: ${hierError.message}`)
    }

    // Step 4: Build hierarchy map and merge
    const hierMap = new Map<string, { level_0: string; level_1: string; level_2: string; level_3: string; label: string }>()
    for (const h of hierData || []) {
      hierMap.set(h.node_name, {
        level_0: h.level_0,
        level_1: h.level_1,
        level_2: h.level_2,
        level_3: h.level_3,
        label: h.label,
      })
    }

    const merged = bizData.map(row => ({
      ...row,
      ...(hierMap.get(row.node_name) || { level_0: null, level_1: null, level_2: null, level_3: null, label: null }),
    }))

    const summary = {
      total_records: merged.length,
      filters: {
        node_name: nodeName || '全部',
        metric_category: metricCategory || '全部',
        report_type: reportType,
        period_type: periodType,
        level_0: level0Filter || '全部',
        level_1: level1Filter || '全部',
        level_2: level2Filter || '全部',
      },
      data: merged.map(row => ({
        节点: row.node_name,
        集团: row.level_0,
        一级组织: row.level_1,
        二级组织: row.level_2,
        三级组织: row.level_3,
        标签: row.label,
        指标: row.metric_category_cn,
        实际值: row.actual_value,
        预算值: row.budget_value,
        完成率: row.completion_rate != null ? `${(row.completion_rate * 100).toFixed(1)}%` : null,
        差异: row.diff_value,
        同比: row.yoy_value != null ? `${(row.yoy_value * 100).toFixed(1)}%` : null,
        期间: row.period,
      })),
    }

    return JSON.stringify(summary, null, 2)
  },
}
