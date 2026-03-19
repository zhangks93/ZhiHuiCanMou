// Supabase 经营数据查询 Tool

import type { RegisteredTool } from '../types'
import { supabase } from '@/lib/supabase'

export const queryBizDataTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'query_biz_data',
      description: '查询教育后勤经营数据。可按组织节点、指标类别、报表类型、期间等维度查询 edu_biz_report 表中的经营数据。返回实际值、预算值、完成率、差异、同比等信息。',
      parameters: {
        type: 'object',
        properties: {
          node_name: {
            type: 'string',
            description: '组织节点名称，如"餐饮中心"、"物业中心"、"教育后勤集团"等。留空则查询所有节点。',
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
            description: '月度范围筛选。如 "202601"（1月当月）、"202602"（2月当月）、"<202603"（截至2月累计）。留空则不按期间筛选。',
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
        filters: { node_name: nodeName, metric_category: metricCategory, report_type: reportType, period_type: periodType },
      })
    }

    // Format for LLM readability
    const summary = {
      total_records: data.length,
      filters: { node_name: nodeName || '全部', metric_category: metricCategory || '全部', report_type: reportType, period_type: periodType },
      data: data.map(row => ({
        节点: row.node_name,
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
