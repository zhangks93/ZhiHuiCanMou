// 月度计划查询 Tool
// Aligned with features/biz-data/services/bizDataService.ts query patterns

import type { RegisteredTool } from '../types'
import { supabase } from '@/shared/lib/supabase'

const PAGE_SIZE = 1000

export const queryMonthlyPlanTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'query_monthly_plan',
      description: '查询 25 学年突围月度计划数据（edu_biz_monthly_plan 表）。适用于计划 vs 实际对比分析，支持按节点、指标、月份查询。数据采用分页方式获取完整结果，与经营数据看板查询逻辑一致。month 只能使用系统运行时上下文提供的合法月份值。',
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
            description: '月份。只能使用系统运行时上下文提供的合法 month 精确值。留空则查询所有月份。',
          },
          months: {
            type: 'array',
            description: '多个月份，与 month 二选一。支持一次查询多个月份。',
            items: { type: 'string' },
          },
          limit: {
            type: 'number',
            description: '返回记录数上限，默认分页获取全部。设为具体数字则限制返回行数（最大 2000）。',
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
    const months = args.months as string[] | undefined
    const rawLimit = args.limit as number | undefined
    const limit = rawLimit != null ? Math.min(rawLimit, 2000) : Infinity
    const fetchAll = limit === Infinity

    // Resolve month filter: months takes priority over month
    const effectiveMonths = months && months.length > 0
      ? months
      : month
        ? [month]
        : undefined

    // Paginated fetch (same pattern as bizDataService.fetchMonthlyPlan)
    let allData: any[] = []
    let page = 0
    let hasMore = true

    while (hasMore) {
      let query = supabase
        .from('edu_biz_monthly_plan')
        .select('node_name, metric_category, metric_category_cn, month, plan_value, sort_order')
        .order('sort_order', { ascending: true })
        .order('month', { ascending: true })

      if (fetchAll) {
        query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      } else {
        query = query.limit(limit - allData.length)
      }

      if (nodeName) query = query.ilike('node_name', `%${nodeName}%`)
      if (metricCategory) query = query.eq('metric_category', metricCategory)
      if (effectiveMonths && effectiveMonths.length === 1) {
        query = query.eq('month', effectiveMonths[0])
      } else if (effectiveMonths && effectiveMonths.length > 1) {
        query = query.in('month', effectiveMonths)
      }

      const { data: pageData, error } = await query
      if (error) throw new Error(`月度计划查询失败: ${error.message}`)

      if (pageData && pageData.length > 0) {
        allData = allData.concat(pageData)
        if (!fetchAll && allData.length >= limit) {
          hasMore = false
        } else {
          hasMore = fetchAll && pageData.length === PAGE_SIZE
        }
        page += 1
      } else {
        hasMore = false
      }
    }

    if (allData.length === 0) {
      const { data: monthData } = await supabase
        .from('edu_biz_monthly_plan')
        .select('month')
        .limit(100)

      const availableMonths = Array.from(
        new Set((monthData || []).map((row: any) => row.month).filter((value: any): value is string => Boolean(value)))
      ).sort((a: string, b: string) => b.localeCompare(a))

      return JSON.stringify({
        message: '未找到匹配的月度计划数据',
        query_echo: {
          node_name: nodeName || null,
          metric_category: metricCategory || null,
          month: effectiveMonths || null,
        },
        available_months: availableMonths,
        guidance: '月度计划数据仅包含 revenue 和 pretax_profit 两个指标，可结合 query_with_hierarchy 做计划 vs 实际对比。',
      })
    }

    return JSON.stringify({
      summary: {
        returned_count: allData.length,
        fetch_mode: fetchAll ? 'paginated_all' : 'limited',
        truncated: !fetchAll && allData.length >= limit,
        month: effectiveMonths || '全部',
      },
      scope: {
        node_name: nodeName || null,
      },
      rows: allData.map((row: any) => ({
        node_name: row.node_name,
        metric: row.metric_category,
        metric_label: row.metric_category_cn,
        month: row.month,
        plan_value: row.plan_value,
      })),
      guidance: !fetchAll && allData.length >= limit
        ? '结果可能已截断，请缩小节点或月份范围，或不传 limit 以分页获取全部。'
        : '计划值单位为万元，可结合 query_with_hierarchy 查询同期实际值进行对比。',
    }, null, 2)
  },
}
