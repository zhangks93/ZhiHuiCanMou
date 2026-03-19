// 月度计划查询 Tool

import type { RegisteredTool } from '../types'
import { supabase } from '@/lib/supabase'

export const queryMonthlyPlanTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'query_monthly_plan',
      description: '查询25学年突围月度计划数据（edu_biz_monthly_plan 表）。可按节点、指标、月份查询计划值。建议与 query_with_hierarchy 联用，对比计划与实际完成情况。月份格式为 202601-202606（1月至6月）或 total（全年合计）。',
      parameters: {
        type: 'object',
        properties: {
          node_name: {
            type: 'string',
            description: '组织节点名称，模糊匹配。留空则查询所有节点。',
          },
          metric_category: {
            type: 'string',
            description: '指标类别，月度计划主要包含 revenue（营收）和 pretax_profit（税前利润）',
            enum: ['revenue', 'pretax_profit'],
          },
          month: {
            type: 'string',
            description: '月份，格式 202601-202606（1月至6月），或 total（全年合计）。留空则返回所有月份。',
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
    const month = args.month as string | undefined
    const limit = Math.min(Number(args.limit) || 200, 500)

    let query = supabase
      .from('edu_biz_monthly_plan')
      .select('node_name, metric_category, metric_category_cn, month, plan_value, sort_order')
      .order('sort_order', { ascending: true })
      .order('month', { ascending: true })
      .limit(limit)

    if (nodeName) {
      query = query.ilike('node_name', `%${nodeName}%`)
    }
    if (metricCategory) {
      query = query.eq('metric_category', metricCategory)
    }
    if (month) {
      query = query.eq('month', month)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`月度计划查询失败: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return JSON.stringify({
        message: '未找到匹配的月度计划数据',
        filters: { node_name: nodeName, metric_category: metricCategory, month },
        tip: '月度计划数据仅含 revenue（营收）和 pretax_profit（税前利润）两个指标，月份范围 202601-202606 及 total。',
      })
    }

    const summary = {
      total_records: data.length,
      filters: {
        node_name: nodeName || '全部',
        metric_category: metricCategory || '全部',
        month: month || '全部月份',
      },
      tip: '计划值单位为万元。可用 query_with_hierarchy 查询同期实际值进行计划 vs 实际对比。',
      data: data.map(row => ({
        节点: row.node_name,
        指标: row.metric_category_cn,
        月份: row.month,
        计划值: row.plan_value,
      })),
    }

    return JSON.stringify(summary, null, 2)
  },
}
