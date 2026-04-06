// 带组织层级的经营数据查询 Tool
// Aligned with features/biz-data/services/bizDataService.ts query patterns
// Paginated fetch for full result sets (no row cap)

import type { RegisteredTool, ToolDefinition } from '../types'
import { supabase } from '@/shared/lib/supabase'

const PAGE_SIZE = 1000

const METRIC_CATEGORY_ENUM = [
  'revenue',
  'gross_profit',
  'gross_margin',
  'pretax_profit',
  'pretax_margin',
  'catering_expense',
  'material_cost',
  'other_expense',
  'external_expense',
  'labor_cost',
  'salary',
  'social_insurance',
  'housing_fund',
  'labor_service_fee',
  'other_labor_cost',
  'vehicle_expense',
  'energy_expense',
  'travel_expense',
  'entertainment_expense',
  'external_revenue',
  'headcount',
  'per_capita_revenue',
  'labor_cost_rate',
  'revenue_creation',
  'profit_creation',
] as const

type MetricCategory = (typeof METRIC_CATEGORY_ENUM)[number]

const METRIC_SET = new Set<string>(METRIC_CATEGORY_ENUM)

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function paginatedFetchReport(options: {
  reportType: string
  periodType: string
  period: string
  metricCategories: string[]
  nodeNames?: string[]
  nodeNamePattern?: string
}) {
  const { reportType, periodType, period, metricCategories, nodeNames, nodeNamePattern } = options
  const allData: any[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from('edu_biz_report')
      .select(
        'node_name, metric_category, metric_category_cn, actual_value, budget_value, completion_rate, diff_value, yoy_value, period_yoy, period, report_type, period_type, sort_order, sheet_code',
      )
      .eq('report_type', reportType)
      .eq('period_type', periodType)
      .eq('period', period)
      .order('sort_order', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (nodeNames && nodeNames.length > 0) {
      query = query.in('node_name', nodeNames)
    } else if (nodeNamePattern) {
      query = query.ilike('node_name', `%${nodeNamePattern}%`)
    }

    if (metricCategories.length === 1) {
      query = query.eq('metric_category', metricCategories[0])
    } else {
      query = query.in('metric_category', metricCategories)
    }

    const { data: pageData, error } = await query
    if (error) throw new Error(`经营数据查询失败: ${error.message}`)

    if (pageData && pageData.length > 0) {
      allData.push(...pageData)
      hasMore = pageData.length === PAGE_SIZE
      page += 1
    } else {
      hasMore = false
    }
  }

  return allData
}

function validateArgs(args: Record<string, unknown>): { ok: true; values: {
  node_name: string
  metric_category: string[]
  report_type: string
  period_type: string
  level_0: string
  level_1: string
  level_2: string
  period: string
} } | { ok: false; message: string } {
  const requiredKeys = ['node_name', 'metric_category', 'report_type', 'period_type', 'level_0', 'level_1', 'level_2', 'period'] as const
  for (const k of requiredKeys) {
    if (args[k] === undefined || args[k] === null) {
      return { ok: false, message: `缺少必填参数: ${k}` }
    }
  }

  const metric_category = args.metric_category
  if (!Array.isArray(metric_category) || metric_category.length === 0) {
    return { ok: false, message: 'metric_category 必须为非空数组，元素为指标英文标识' }
  }
  for (const m of metric_category) {
    if (typeof m !== 'string' || !METRIC_SET.has(m as MetricCategory)) {
      return { ok: false, message: `metric_category 含非法指标: ${String(m)}，须为工具枚举中的英文标识` }
    }
  }

  const report_type = args.report_type
  if (report_type !== 'fone' && report_type !== 'tuwei') {
    return { ok: false, message: 'report_type 必须为 fone 或 tuwei' }
  }

  const period_type = args.period_type
  if (period_type !== 'cumulative' && period_type !== 'monthly') {
    return { ok: false, message: 'period_type 必须为 cumulative 或 monthly' }
  }

  const node_name = args.node_name
  const level_0 = args.level_0
  const level_1 = args.level_1
  const level_2 = args.level_2
  const period = args.period
  if (typeof node_name !== 'string') return { ok: false, message: 'node_name 必须为字符串（可为空字符串表示不按名称过滤）' }
  if (typeof level_0 !== 'string') return { ok: false, message: 'level_0 必须为字符串' }
  if (typeof level_1 !== 'string') return { ok: false, message: 'level_1 必须为字符串' }
  if (typeof level_2 !== 'string') return { ok: false, message: 'level_2 必须为字符串' }
  if (typeof period !== 'string' || period.trim() === '') {
    return { ok: false, message: 'period 必须为非空字符串，且与 Runtime Data Context 中的合法 period 一致' }
  }

  return {
    ok: true,
    values: {
      node_name: node_name,
      metric_category: metric_category as string[],
      report_type,
      period_type,
      level_0: level_0,
      level_1: level_1,
      level_2: level_2,
      period: period.trim(),
    },
  }
}

export const queryWithHierarchyTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'query_with_hierarchy',
      description:
        '查询教育后勤经营数据，并附带组织层级信息（level_0/level_1/level_2）。优先用于经营分析主查询。所有参数必填：node_name 可为空字符串表示不按节点名过滤；level_0/level_1/level_2 可为空字符串表示该层不过滤。metric_category 为指标英文标识数组（至少一个），可一次查询多个指标。period 仅支持传入系统提供的合法 period 精确值；累计 period 通常采用右开区间格式，如截至 202602 会存为 <202603。返回全量匹配行（分页拉取、无行数上限），每行含同比（同期期间、同期值、增减额、增长率）。',
      parameters: {
        type: 'object',
        properties: {
          node_name: {
            type: 'string',
            description:
              '组织节点名称，模糊匹配；传空字符串 "" 表示不按 node_name 过滤（仅受 level_* 与其它条件约束）。',
          },
          metric_category: {
            type: 'array',
            description: '指标类别（一个或多个英文标识），至少 1 个。例如 ["revenue","pretax_profit"]。',
            minItems: 1,
            items: {
              type: 'string',
              enum: [...METRIC_CATEGORY_ENUM],
            },
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
            description: '按集团级过滤，如「智汇后勤集团」。空字符串 "" 表示该层不过滤。',
          },
          level_1: {
            type: 'string',
            description: '按一级组织过滤，如「餐饮中心」。空字符串 "" 表示该层不过滤。',
          },
          level_2: {
            type: 'string',
            description: '按二级组织过滤，如「广州餐饮」。空字符串 "" 表示该层不过滤。',
          },
          period: {
            type: 'string',
            description: '期间值。只能使用系统运行时上下文提供的合法 period 精确值；累计口径通常为右开区间，如截至202602对应 <202603。',
          },
        },
        required: ['node_name', 'metric_category', 'report_type', 'period_type', 'level_0', 'level_1', 'level_2', 'period'],
      } as ToolDefinition['function']['parameters'],
    },
  },

  execute: async (args: Record<string, unknown>): Promise<string> => {
    const validated = validateArgs(args)
    if (!validated.ok) {
      return JSON.stringify({ error: validated.message }, null, 2)
    }

    const {
      node_name: nodeName,
      metric_category: metricCategories,
      report_type: reportType,
      period_type: periodType,
      level_0: level0Filter,
      level_1: level1Filter,
      level_2: level2Filter,
      period: periodFilter,
    } = validated.values

    const level0Active = level0Filter.trim().length > 0
    const level1Active = level1Filter.trim().length > 0
    const level2Active = level2Filter.trim().length > 0

    let preFilteredNodes: string[] | undefined
    if (level0Active || level1Active || level2Active) {
      let hierQuery = supabase.from('edu_org_hierarchy').select('node_name')

      if (level0Active) hierQuery = hierQuery.ilike('level_0', `%${level0Filter.trim()}%`)
      if (level1Active) hierQuery = hierQuery.ilike('level_1', `%${level1Filter.trim()}%`)
      if (level2Active) hierQuery = hierQuery.ilike('level_2', `%${level2Filter.trim()}%`)

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

    const nodeNamePattern = nodeName.trim().length > 0 ? nodeName.trim() : undefined

    const bizData = await paginatedFetchReport({
      reportType,
      periodType,
      period: periodFilter,
      metricCategories,
      nodeNames: preFilteredNodes,
      nodeNamePattern: !preFilteredNodes ? nodeNamePattern : undefined,
    })

    if (bizData.length === 0) {
      return JSON.stringify({
        message: '未找到匹配的经营数据',
        query_echo: {
          node_name: nodeName,
          metric_category: metricCategories,
          report_type: reportType,
          period_type: periodType,
          period: periodFilter,
          level_0: level0Filter,
          level_1: level1Filter,
          level_2: level2Filter,
        },
      })
    }

    const nodeNames = [...new Set(bizData.map((row: any) => row.node_name))]
    const { data: hierData, error: hierError } = await supabase
      .from('edu_org_hierarchy')
      .select('node_name, level_0, level_1, level_2')
      .in('node_name', nodeNames)

    if (hierError) {
      throw new Error(`组织层级查询失败: ${hierError.message}`)
    }

    const hierMap = new Map<string, { level_0: string | null; level_1: string | null; level_2: string | null }>()
    for (const row of hierData || []) {
      hierMap.set(row.node_name, { level_0: row.level_0, level_1: row.level_1, level_2: row.level_2 })
    }

    return JSON.stringify({
      summary: {
        returned_count: bizData.length,
        distinct_nodes: nodeNames.length,
        fetch_mode: 'paginated_all',
        report_type: reportType,
        period_type: periodType,
        period: periodFilter,
      },
      scope: {
        node_name: nodeName,
        level_0: level0Filter,
        level_1: level1Filter,
        level_2: level2Filter,
      },
      rows: bizData.map((row: any) => {
        const hierarchy = hierMap.get(row.node_name)
        const actual = numOrNull(row.actual_value)
        const compareValue = numOrNull(row.yoy_value)
        let change_amount: number | null = null
        let change_rate_pct: number | null = null
        if (actual != null && compareValue != null) {
          change_amount = actual - compareValue
          if (compareValue !== 0) {
            change_rate_pct = (change_amount / Math.abs(compareValue)) * 100
          }
        }
        return {
          node_name: row.node_name,
          level_0: hierarchy?.level_0 || null,
          level_1: hierarchy?.level_1 || null,
          level_2: hierarchy?.level_2 || null,
          metric: row.metric_category,
          metric_label: row.metric_category_cn,
          actual: row.actual_value,
          budget: row.budget_value,
          completion_rate: row.completion_rate,
          diff: row.diff_value,
          period: row.period,
          sheet_code: row.sheet_code,
          year_over_year: {
            compare_period: row.period_yoy ?? null,
            compare_value: row.yoy_value,
            change_amount,
            change_rate_pct,
          },
        }
      }),
      guidance: '如需横向对比，请基于 rows 中的 level_1 或 level_2 继续汇总分析。',
    }, null, 2)
  },
}
