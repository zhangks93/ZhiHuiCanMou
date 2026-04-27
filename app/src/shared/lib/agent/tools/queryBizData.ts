// Supabase 经营数据查询 Tool
// Aligned with features/biz-data/services/bizDataService.ts query patterns

import type { RegisteredTool } from '../types'
import { supabase } from '@/shared/lib/supabase'

const PAGE_SIZE = 1000

interface BizDataQueryRow {
  node_name: string
  metric_category: string
  metric_category_cn: string
  actual_value: number | null
  budget_value: number | null
  completion_rate: number | null
  diff_value: number | null
  yoy_value: number | null
  period: string
  report_type: string
  period_type: string
  sheet_code: string
}

export const queryBizDataTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'query_biz_data',
      description: '查询教育后勤经营数据基础明细，不附带组织层级。适合简单场景；如需层级分析，优先使用 query_with_hierarchy。period 仅支持传入系统提供的合法 period 精确值；累计 period 通常采用右开区间格式，如截至 202602 会存为 <202603。',
      parameters: {
        type: 'object',
        properties: {
          node_name: {
            type: 'string',
            description: '组织节点名称，如"东部区域""智汇后勤集团"等。留空则查询所有节点。',
          },
          metric_category: {
            type: 'string',
            description: '指标类别（单个）',
            enum: [
              'revenue', 'gross_profit', 'gross_margin', 'pretax_profit', 'pretax_margin',
              'catering_expense', 'material_cost', 'other_expense', 'external_expense',
              'labor_cost', 'salary', 'social_insurance', 'housing_fund', 'labor_service_fee',
              'other_labor_cost', 'vehicle_expense', 'energy_expense', 'travel_expense',
              'entertainment_expense', 'external_revenue', 'headcount', 'per_capita_revenue',
              'labor_cost_rate', 'revenue_creation', 'profit_creation',
            ],
          },
          metric_categories: {
            type: 'array',
            description: '指标类别列表（多个），与 metric_category 二选一。支持一次查询多个指标。',
            items: { type: 'string' },
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
            description: '期间值。只能使用系统运行时上下文提供的合法 period 精确值；累计口径通常为右开区间，如截至202602对应 <202603。',
          },
          sheet_codes: {
            type: 'array',
            description: '报表 sheet 代码过滤。主报表: 1.x/2.x；成本分析: 3.x=tuwei, 4.x=fone。留空则查询所有。',
            items: { type: 'string' },
          },
          limit: {
            type: 'number',
            description: '返回记录数上限，默认 500，最大 2000。设为 0 则分页获取全部数据。',
          },
        },
        required: [],
      },
    },
  },

  execute: async (args: Record<string, unknown>): Promise<string> => {
    const nodeName = args.node_name as string | undefined
    const metricCategory = args.metric_category as string | undefined
    const metricCategories = args.metric_categories as string[] | undefined
    const reportType = (args.report_type as string) || 'fone'
    const periodType = (args.period_type as string) || 'cumulative'
    const periodFilter = args.period as string | undefined
    const sheetCodes = args.sheet_codes as string[] | undefined
    const rawLimit = Number(args.limit)
    const fetchAll = rawLimit === 0
    const limit = fetchAll ? Infinity : Math.min(rawLimit || 500, 2000)

    // Resolve metric filter: metric_categories takes priority over metric_category
    const effectiveMetrics = metricCategories && metricCategories.length > 0
      ? metricCategories
      : metricCategory
        ? [metricCategory]
        : undefined

    if (fetchAll) {
      // Paginated fetch (same pattern as bizDataService.fetchBizReport)
      let allData: BizDataQueryRow[] = []
      let page = 0
      let hasMore = true

      while (hasMore) {
        let query = supabase
          .from('edu_biz_report')
          .select('node_name, metric_category, metric_category_cn, actual_value, budget_value, completion_rate, diff_value, yoy_value, period, report_type, period_type, sheet_code')
          .eq('report_type', reportType)
          .eq('period_type', periodType)
          .order('sort_order', { ascending: true })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

        if (nodeName) query = query.ilike('node_name', `%${nodeName}%`)
        if (effectiveMetrics && effectiveMetrics.length === 1) {
          query = query.eq('metric_category', effectiveMetrics[0])
        } else if (effectiveMetrics && effectiveMetrics.length > 1) {
          query = query.in('metric_category', effectiveMetrics)
        }
        if (periodFilter) query = query.eq('period', periodFilter)
        if (sheetCodes && sheetCodes.length > 0) query = query.in('sheet_code', sheetCodes)

        const { data: pageData, error } = await query
        if (error) throw new Error(`数据库查询失败: ${error.message}`)

        if (pageData && pageData.length > 0) {
          allData = allData.concat(pageData)
          hasMore = pageData.length === PAGE_SIZE
          page += 1
        } else {
          hasMore = false
        }
      }

      if (allData.length === 0) {
        return JSON.stringify({
          message: '未找到匹配的数据',
          query_echo: { node_name: nodeName || null, metric_category: effectiveMetrics || null, report_type: reportType, period_type: periodType, period: periodFilter || null, sheet_codes: sheetCodes || null },
        })
      }

      return JSON.stringify({
        summary: { returned_count: allData.length, fetch_mode: 'paginated_all', report_type: reportType, period_type: periodType, period: periodFilter || '全部' },
        scope: { node_name: nodeName || null },
        rows: allData.map(row => ({
          node_name: row.node_name,
          metric: row.metric_category,
          metric_label: row.metric_category_cn,
          actual: row.actual_value,
          budget: row.budget_value,
          completion_rate: row.completion_rate,
          diff: row.diff_value,
          yoy: row.yoy_value,
          period: row.period,
          sheet_code: row.sheet_code,
        })),
        guidance: '返回结果中的 yoy 已是同期值；如需同比增减额，请直接用 actual - yoy 计算，不要再回退一年单独查询去年同期。',
      })
    }

    // Standard limited query
    let query = supabase
      .from('edu_biz_report')
      .select('node_name, metric_category, metric_category_cn, actual_value, budget_value, completion_rate, diff_value, yoy_value, period, report_type, period_type, sheet_code')
      .eq('report_type', reportType)
      .eq('period_type', periodType)
      .order('sort_order', { ascending: true })
      .limit(limit)

    if (nodeName) query = query.ilike('node_name', `%${nodeName}%`)
    if (effectiveMetrics && effectiveMetrics.length === 1) {
      query = query.eq('metric_category', effectiveMetrics[0])
    } else if (effectiveMetrics && effectiveMetrics.length > 1) {
      query = query.in('metric_category', effectiveMetrics)
    }
    if (periodFilter) query = query.eq('period', periodFilter)
    if (sheetCodes && sheetCodes.length > 0) query = query.in('sheet_code', sheetCodes)

    const { data, error } = await query

    if (error) throw new Error(`数据库查询失败: ${error.message}`)

    if (!data || data.length === 0) {
      return JSON.stringify({
        message: '未找到匹配的数据',
        query_echo: { node_name: nodeName || null, metric_category: effectiveMetrics || null, report_type: reportType, period_type: periodType, period: periodFilter || null, sheet_codes: sheetCodes || null },
      })
    }

    return JSON.stringify({
      summary: { returned_count: data.length, limit, truncated: data.length >= limit, report_type: reportType, period_type: periodType, period: periodFilter || '全部' },
      scope: { node_name: nodeName || null },
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
        sheet_code: row.sheet_code,
      })),
      guidance: data.length >= limit
        ? '结果可能已截断，请缩小查询范围或设置 limit=0 分页获取全部。返回结果中的 yoy 已是同期值，不要再回退一年重复查询。'
        : '如需层级信息，请改用 query_with_hierarchy。返回结果中的 yoy 已是同期值，不要再回退一年重复查询。',
    })
  },
}
