// 带组织层级的经营数据树查询 Tool
// Reuses the same aggregation and hierarchy-building path as the business tab table view.

import type { RegisteredTool, ToolDefinition } from '../types'
import type { EduBizReport, MetricCategory } from '@/features/biz-data/types'
import type { NestedBizDataNode } from '@/features/biz-data/services/bizDataService'
import {
  aggregateByNode,
  buildNestedHierarchy,
  buildOrgPath,
  buildOrgScopeKey,
  buildNestedSubtree,
  buildNestedSubtreeByScopeKey,
  fetchBizReport,
  fetchMonthlyPlan,
  findHierarchyNodeByScopeKey,
  findHierarchyNodeMatches,
  getNodeKind,
} from '@/features/biz-data/services/bizDataService'

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

const METRIC_SET = new Set<string>(METRIC_CATEGORY_ENUM)

type QueryWithHierarchyArgs = {
  node_name: string
  org_scope_key?: string
  report_type: 'fone' | 'tuwei'
  period_type: 'cumulative' | 'monthly'
  period: string
  metric_categories?: MetricCategory[]
  sheet_codes?: string[]
  max_depth?: number
}

type MetricSnapshot = {
  metric: MetricCategory
  metric_label: string
  actual: number | null
  target_value: number | null
  completion_rate: number | null
  diff: number | null
  yoy: number | null
  monthly_plan?: Record<string, number>
}

type SerializedTreeNode = {
  node_name: string
  org_scope_key: string
  org_path: string[]
  node_kind: NestedBizDataNode['node_kind']
  sort_order: number
  org_hierarchy: NestedBizDataNode['orgHierarchy']
  metrics: MetricSnapshot[]
  children: SerializedTreeNode[]
  children_truncated?: boolean
}

function validateArgs(args: Record<string, unknown>):
  | { ok: true; values: QueryWithHierarchyArgs }
  | { ok: false; message: string } {
  const node_name = args.node_name
  const org_scope_key = args.org_scope_key
  const report_type = args.report_type
  const period_type = args.period_type
  const period = args.period
  const metric_categories = args.metric_categories
  const sheet_codes = args.sheet_codes
  const max_depth = args.max_depth

  if (typeof node_name !== 'string') {
    return { ok: false, message: 'node_name 必须为字符串，传空字符串可返回整棵树' }
  }

  if (org_scope_key !== undefined && (typeof org_scope_key !== 'string' || !org_scope_key.trim())) {
    return { ok: false, message: 'org_scope_key 如传入，必须为非空字符串' }
  }

  if (report_type !== 'fone' && report_type !== 'tuwei') {
    return { ok: false, message: 'report_type 必须为 fone 或 tuwei' }
  }

  if (period_type !== 'cumulative' && period_type !== 'monthly') {
    return { ok: false, message: 'period_type 必须为 cumulative 或 monthly' }
  }

  if (typeof period !== 'string' || period.trim() === '') {
    return { ok: false, message: 'period 必须为非空字符串，且与 Runtime Data Context 中的合法 period 一致' }
  }

  if (metric_categories !== undefined) {
    if (!Array.isArray(metric_categories) || metric_categories.length === 0) {
      return { ok: false, message: 'metric_categories 如传入，必须为非空数组' }
    }

    for (const metric of metric_categories) {
      if (typeof metric !== 'string' || !METRIC_SET.has(metric)) {
        return { ok: false, message: `metric_categories 含非法指标: ${String(metric)}` }
      }
    }
  }

  if (sheet_codes !== undefined) {
    if (!Array.isArray(sheet_codes) || sheet_codes.some(code => typeof code !== 'string' || code.trim() === '')) {
      return { ok: false, message: 'sheet_codes 如传入，必须为非空字符串数组' }
    }
  }

  if (max_depth !== undefined) {
    if (typeof max_depth !== 'number' || !Number.isInteger(max_depth) || max_depth < 1 || max_depth > 6) {
      return { ok: false, message: 'max_depth 如传入，必须是 1-6 的整数' }
    }
  }

  return {
    ok: true,
    values: {
      node_name,
      org_scope_key: org_scope_key?.trim(),
      report_type,
      period_type,
      period: period.trim(),
      metric_categories: metric_categories as MetricCategory[] | undefined,
      sheet_codes: sheet_codes as string[] | undefined,
      max_depth: max_depth as number | undefined,
    },
  }
}

function shouldKeepMetric(
  category: string,
  selectedMetrics?: MetricCategory[]
): category is MetricCategory {
  if (!METRIC_SET.has(category)) return false
  if (!selectedMetrics || selectedMetrics.length === 0) return true
  return selectedMetrics.includes(category as MetricCategory)
}

function buildMetricLabelMap(reports: EduBizReport[]) {
  const labelMap = new Map<MetricCategory, string>()

  reports.forEach(report => {
    if (!labelMap.has(report.metric_category)) {
      labelMap.set(report.metric_category, report.metric_category_cn)
    }
  })

  return labelMap
}

function serializeMetrics(
  metrics: NestedBizDataNode['metrics'],
  reportType: QueryWithHierarchyArgs['report_type'],
  labelMap: Map<MetricCategory, string>,
  selectedMetrics?: MetricCategory[]
): MetricSnapshot[] {
  return Object.entries(metrics)
    .filter(([category, value]) => !!value && shouldKeepMetric(category, selectedMetrics))
    .map(([category, value]) => {
      const metric = value!
      const target_value = reportType === 'fone' ? metric.budget_fone : metric.budget_tuwei
      const completion_rate = reportType === 'fone' ? metric.completion_fone : metric.completion_tuwei
      const diff = reportType === 'fone' ? metric.diff_fone : metric.diff_tuwei

      return {
        metric: category as MetricCategory,
        metric_label: labelMap.get(category as MetricCategory) ?? category,
        actual: metric.actual,
        target_value,
        completion_rate,
        diff,
        yoy: metric.yoy,
        monthly_plan: metric.monthly_plan,
      }
    })
    .sort((a, b) => a.metric.localeCompare(b.metric))
}

function serializeTreeNode(
  node: NestedBizDataNode,
  reportType: QueryWithHierarchyArgs['report_type'],
  labelMap: Map<MetricCategory, string>,
  selectedMetrics?: MetricCategory[],
  remainingDepth = Number.POSITIVE_INFINITY
): SerializedTreeNode {
  const canExpandChildren = remainingDepth > 1
  const children = canExpandChildren
    ? node.children.map(child => serializeTreeNode(child, reportType, labelMap, selectedMetrics, remainingDepth - 1))
    : []

  return {
    node_name: node.node_name,
    org_scope_key: node.org_scope_key,
    org_path: node.org_path,
    node_kind: node.node_kind,
    sort_order: node.sort_order,
    org_hierarchy: node.orgHierarchy,
    metrics: serializeMetrics(node.metrics, reportType, labelMap, selectedMetrics),
    children,
    children_truncated: node.children.length > 0 && !canExpandChildren ? true : undefined,
  }
}

function countTreeNodes(node: NestedBizDataNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countTreeNodes(child), 0)
}

function countTreeLeaves(node: NestedBizDataNode): number {
  if (node.children.length === 0) return 1
  return node.children.reduce((sum, child) => sum + countTreeLeaves(child), 0)
}

export const queryWithHierarchyTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'query_with_hierarchy',
      description:
        '完全按经营 tab 页表格的数据口径查询经营数据。输入 report_type、period_type、period，以及 node_name 或 org_scope_key，返回与经营表格同源聚合后的完整树状数据。org_scope_key 可精确定位同名组织；node_name 传具体组织节点名称时若有歧义会返回候选；传空字符串时返回整棵树。',
      parameters: {
        type: 'object',
        properties: {
          node_name: {
            type: 'string',
            description: '组织节点名称。支持精确匹配和模糊匹配；传空字符串 "" 表示返回整棵组织指标树。若已通过 resolve_org_nodes 得到 org_scope_key，应同时传 org_scope_key。',
          },
          org_scope_key: {
            type: 'string',
            description: '可选。组织稳定路径键，例如“智汇后勤集团 / 广州区域 / 餐饮中心 / 某项目”。用于精确定位同名组织，优先级高于 node_name。',
          },
          report_type: {
            type: 'string',
            description: '报表类型：fone=年初预算, tuwei=突围考核',
            enum: ['fone', 'tuwei'],
          },
          period_type: {
            type: 'string',
            description: '期间类型：cumulative=累计, monthly=单月',
            enum: ['cumulative', 'monthly'],
          },
          period: {
            type: 'string',
            description: '期间值。只能使用系统运行时上下文提供的合法 period 精确值。',
          },
          metric_categories: {
            type: 'array',
            description: '可选。只返回指定指标；不传则按经营表格口径返回当前范围内全部指标。',
            items: {
              type: 'string',
              enum: [...METRIC_CATEGORY_ENUM],
            },
          },
          sheet_codes: {
            type: 'array',
            description: '可选。按报表 sheet 代码过滤，例如 ["1.1","2.1"]。',
            items: {
              type: 'string',
            },
          },
          max_depth: {
            type: 'number',
            description: '可选。限制返回树的最大层级深度，1=仅根节点，2=根+下一级。默认会自动控制：整棵树查询默认 2 层，具体节点子树默认 4 层。',
          },
        },
        required: ['node_name', 'report_type', 'period_type', 'period'],
      } as ToolDefinition['function']['parameters'],
    },
  },

  execute: async (args: Record<string, unknown>): Promise<string> => {
    const validated = validateArgs(args)
    if (!validated.ok) {
      return JSON.stringify({ error: validated.message }, null, 2)
    }

    const {
      node_name,
      org_scope_key,
      report_type,
      period_type,
      period,
      metric_categories,
      sheet_codes,
      max_depth,
    } = validated.values

    const effectiveMaxDepth = max_depth ?? (node_name.trim() === '' && !org_scope_key ? 2 : 4)

    const reports = await fetchBizReport({
      period,
      periodType: period_type,
      reportTypes: [report_type],
      sheetCodes: sheet_codes,
    })

    if (reports.length === 0) {
      return JSON.stringify({
        message: '未找到匹配的经营数据',
        query_echo: {
          node_name,
          org_scope_key: org_scope_key ?? null,
          report_type,
          period_type,
          period,
          metric_categories: metric_categories ?? null,
          sheet_codes: sheet_codes ?? null,
        },
      })
    }

    const monthlyPlans = await fetchMonthlyPlan()
    const foneReports = report_type === 'fone' ? reports : []
    const tuweiReports = report_type === 'tuwei' ? reports : []
    const aggregatedNodes = aggregateByNode(foneReports, tuweiReports, monthlyPlans)
    const labelMap = buildMetricLabelMap(reports)

    if (node_name.trim() === '' && !org_scope_key) {
      const fullTree = buildNestedHierarchy(aggregatedNodes)

      return JSON.stringify({
        summary: {
          report_type,
          period_type,
          period,
          query_mode: 'full_tree',
          returned_max_depth: effectiveMaxDepth,
          matched_node_count: fullTree.length,
          total_tree_nodes: fullTree.reduce((sum, root) => sum + countTreeNodes(root), 0),
          total_leaf_nodes: fullTree.reduce((sum, root) => sum + countTreeLeaves(root), 0),
        },
        query: {
          node_name: '',
          org_scope_key: null,
          metric_categories: metric_categories ?? null,
          sheet_codes: sheet_codes ?? null,
          max_depth: effectiveMaxDepth,
        },
        guidance: '同比字段 yoy 已直接返回同期值；如需同比增减额，请直接用 actual - yoy 计算，不要再把月份回退一年重复查询。若需要更深层节点，请在下一次查询中指定 node_name 或提高 max_depth。',
        tree: fullTree.map(root => serializeTreeNode(root, report_type, labelMap, metric_categories, effectiveMaxDepth)),
      })
    }

    const scopedNode = org_scope_key ? findHierarchyNodeByScopeKey(aggregatedNodes, org_scope_key) : null
    const matches = scopedNode
      ? [{ node: scopedNode, matchType: 'org_scope_key' as const }]
      : findHierarchyNodeMatches(aggregatedNodes, node_name)

    if (matches.length === 0) {
      return JSON.stringify({
        message: '未找到匹配的组织节点',
        query_echo: {
          node_name,
          org_scope_key: org_scope_key ?? null,
          report_type,
          period_type,
          period,
        },
      })
    }

    if (matches.length > 1) {
      return JSON.stringify({
        message: '匹配到多个组织节点，请提供更精确的 node_name',
        query_echo: {
          node_name,
          org_scope_key: org_scope_key ?? null,
          report_type,
          period_type,
          period,
        },
        candidates: matches.slice(0, 20).map(match => ({
          node_name: match.node.node_name,
          org_scope_key: buildOrgScopeKey(match.node),
          org_path: buildOrgPath(match.node),
          node_kind: getNodeKind(match.node),
          match_type: match.matchType,
          org_hierarchy: match.node.orgHierarchy,
        })),
        guidance: '请先从候选中明确节点，避免在歧义范围上反复查询同一批数据。',
      })
    }

    const matched = matches[0]
    const subtree = org_scope_key
      ? buildNestedSubtreeByScopeKey(aggregatedNodes, org_scope_key)
      : buildNestedSubtree(aggregatedNodes, matched.node.node_name)

    if (!subtree) {
      return JSON.stringify({
        message: '组织节点已匹配，但构建树状数据失败',
        query_echo: {
          node_name,
          org_scope_key: org_scope_key ?? null,
          matched_node_name: matched.node.node_name,
          report_type,
          period_type,
          period,
        },
      })
    }

    return JSON.stringify({
      summary: {
        report_type,
        period_type,
        period,
        query_mode: 'subtree',
        returned_max_depth: effectiveMaxDepth,
        matched_node_name: matched.node.node_name,
        matched_org_scope_key: buildOrgScopeKey(matched.node),
        matched_org_path: buildOrgPath(matched.node),
        matched_node_kind: getNodeKind(matched.node),
        match_type: matched.matchType,
        total_tree_nodes: countTreeNodes(subtree),
        total_leaf_nodes: countTreeLeaves(subtree),
      },
      query: {
        node_name,
        org_scope_key: org_scope_key ?? null,
        metric_categories: metric_categories ?? null,
        sheet_codes: sheet_codes ?? null,
        max_depth: effectiveMaxDepth,
      },
      guidance: '同比字段 yoy 已直接返回同期值；如需同比增减额，请直接用 actual - yoy 计算，不要再把月份回退一年重复查询。若当前层级不够，请提高 max_depth 或改查更具体的下级 node_name。',
      tree: serializeTreeNode(subtree, report_type, labelMap, metric_categories, effectiveMaxDepth),
    })
  },
}
