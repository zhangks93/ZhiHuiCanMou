// Supabase 经营数据查询 Tool

import type { RegisteredTool } from '../types'
import { supabase } from '@/shared/lib/supabase'

export const queryBizDataTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'query_biz_data',
      description: '查询教育后勤经营数据基础明细，不附带组织层级。适合简单场景；如需层级分析，优先使用 query_with_hierarchy。period 仅支持传入系统提供的合法 period 精确值。',
      parameters: {
        type: 'object',
        properties: {
          node_name: {
            type: 'string',
            description: '组织节点名称，如“餐饮中心”“物业中心”“教育后勤集团”等。留空则查询所有节点。',
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
    const periodFilter = args.period as string | undefined
    const limit = Math.min(Number(args.limit) || 200, 500)

    let query = supabase
      .from('edu_biz_report')
      .select('node_name, metric_category, metric_category_cn, actual_value, budget_value, completion_rate, diff_value, yoy_value, period, report_type, period_type, sheet_code')
      .eq('report_type', reportType)
      .eq('period_type', periodType)
      .order('sort_order', { ascending: true })
      .limit(limit)

    if (nodeName) {
      query = query.ilike('node_name', `%${nodeName}%`)
    }
    if (metricCategory) {
      query = query.eq('metric_category', metricCategory)
    }
    if (periodFilter) {
      query = query.eq('period', periodFilter)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`数据库查询失败: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return JSON.stringify({
        message: '未找到匹配的数据',
        query_echo: {
          node_name: nodeName || null,
          metric_category: metricCategory || null,
          report_type: reportType,
          period_type: periodType,
          period: periodFilter || null,
        },
      })
    }

    return JSON.stringify({
      summary: {
        returned_count: data.length,
        limit,
        truncated: data.length >= limit,
        report_type: reportType,
        period_type: periodType,
        period: periodFilter || '全部',
      },
      scope: {
        node_name: nodeName || null,
      },
      rows: data.map(row => ({
        node_name: row.node_name,
        metric: row.metric_category,
        metric_label: row.metric_category_cn,
        actual: row.actual_value,
        budget: row.budget_value,
        completion_rate: row.completion_rate,
        diff: row.diff_value,
        yoy: row.yoy_value,
        period: row.period,
      })),
      guidance: data.length >= limit
        ? '结果可能已截断，请缩小查询范围。'
        : '如需层级信息，请改用 query_with_hierarchy。',
    }, null, 2)
  },
}
