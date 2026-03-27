// 月度计划查询 Tool

import type { RegisteredTool } from '../types'
import { supabase } from '@/lib/supabase'

export const queryMonthlyPlanTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'query_monthly_plan',
      description: '查询 25 学年突围月度计划数据（edu_biz_monthly_plan 表）。适用于计划 vs 实际对比分析，支持按节点、指标、月份查询。month 只能使用系统运行时上下文提供的合法月份值。',
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
            description: '月份。只能使用系统运行时上下文提供的合法 month 精确值。',
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
      const { data: monthData } = await supabase
        .from('edu_biz_monthly_plan')
        .select('month')
        .limit(100)

      const availableMonths = Array.from(
        new Set((monthData || []).map(row => row.month).filter((value): value is string => Boolean(value)))
      ).sort((a, b) => b.localeCompare(a))

      return JSON.stringify({
        message: '未找到匹配的月度计划数据',
        query_echo: {
          node_name: nodeName || null,
          metric_category: metricCategory || null,
          month: month || null,
        },
        available_months: availableMonths,
        guidance: '月度计划数据仅包含 revenue 和 pretax_profit 两个指标，可结合 query_with_hierarchy 做计划 vs 实际对比。',
      })
    }

    return JSON.stringify({
      summary: {
        returned_count: data.length,
        limit,
        truncated: data.length >= limit,
        month: month || '全部',
      },
      scope: {
        node_name: nodeName || null,
      },
      rows: data.map(row => ({
        node_name: row.node_name,
        metric: row.metric_category,
        metric_label: row.metric_category_cn,
        month: row.month,
        plan_value: row.plan_value,
      })),
      guidance: data.length >= limit
        ? '结果可能已截断，请缩小节点或月份范围。'
        : '计划值单位为万元，可结合 query_with_hierarchy 查询同期实际值进行对比。',
    }, null, 2)
  },
}
