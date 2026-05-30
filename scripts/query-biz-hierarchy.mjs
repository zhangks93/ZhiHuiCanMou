#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = resolve(__dirname, '..')
const appRequire = createRequire(resolve(repoRoot, 'app/package.json'))
const { createClient } = appRequire('@supabase/supabase-js')

const PAGE_SIZE = 1000
const DEFAULT_ROOT_LABEL = '智汇后勤集团'

const METRIC_LABELS = {
  revenue: '营业收入',
  gross_profit: '毛利额',
  gross_margin: '毛利率',
  pretax_profit: '税前利润',
  pretax_margin: '税前利润率',
  catering_expense: '餐饮支出',
  material_cost: '物资销售成本',
  other_expense: '其他支出',
  external_expense: '营业外支出',
  labor_cost: '人力成本',
  salary: '工资',
  social_insurance: '社保',
  housing_fund: '公积金',
  labor_service_fee: '劳务费',
  other_labor_cost: '其他人力成本',
  vehicle_expense: '车辆费用',
  energy_expense: '能耗费',
  travel_expense: '差旅费',
  entertainment_expense: '业务招待费',
  external_revenue: '营业外收入',
  headcount: '职工人数',
  per_capita_revenue: '人均营收',
  labor_cost_rate: '人力成本率',
  revenue_creation: '一元创收',
  profit_creation: '一元创利',
}

const METRIC_ORDER = [
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
]

const NODE_KIND_LABELS = {
  total: '集团合计',
  level1: '一级组织',
  level2: '二级组织',
  leaf: '明细组织',
  orphan: '未归类组织',
}

const RATIO_METRICS = new Set([
  'gross_margin',
  'pretax_margin',
  'labor_cost_rate',
  'per_capita_revenue',
  'revenue_creation',
  'profit_creation',
])

const BIZ_REPORT_SELECT = [
  'id',
  'sheet_code',
  'report_type',
  'period_type',
  'period',
  'period_yoy',
  'node_name',
  'sort_order',
  'metric_category',
  'metric_category_cn',
  'actual_value',
  'budget_value',
  'completion_rate',
  'diff_value',
  'yoy_value',
  'created_at',
].join(', ')

const EMPTY_HIERARCHY = {
  center_region: null,
  business_segment: null,
  report_level1: null,
  report_level2: null,
  is_aggregated: false,
  aggregation_level: null,
}

const DERIVED_METRIC_DEPENDENCIES = {
  gross_margin: { numerator: 'gross_profit', denominator: 'revenue' },
  pretax_margin: { numerator: 'pretax_profit', denominator: 'revenue' },
  labor_cost_rate: { numerator: 'labor_cost', denominator: 'revenue' },
  per_capita_revenue: { numerator: 'revenue', denominator: 'headcount' },
  revenue_creation: { numerator: 'revenue', denominator: 'labor_cost' },
  profit_creation: { numerator: 'pretax_profit', denominator: 'labor_cost' },
}

const SYNTHETIC_SORT_ORDER = {
  total: 0,
  level1: 100,
  level2: 200,
}

function loadEnvFiles() {
  const protectedEnvKeys = new Set(Object.keys(process.env))
  const envFiles = [
    resolve(repoRoot, '.env'),
    resolve(repoRoot, '.env.local'),
    resolve(repoRoot, 'app/.env'),
    resolve(repoRoot, 'app/.env.local'),
  ]

  for (const envFile of envFiles) {
    if (!existsSync(envFile)) continue

    const content = readFileSync(envFile, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!match) continue

      const [, key, rawValue] = match
      if (protectedEnvKeys.has(key)) continue

      const value = rawValue
        .trim()
        .replace(/^(['"])(.*)\1$/, '$2')
      process.env[key] = value
    }
  }
}

function getSupabaseConfig(options = {}) {
  loadEnvFiles()

  const url =
    options.supabaseUrl ??
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL
  const anonKey =
    options.supabaseAnonKey ??
    options.supabaseKey ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('缺少 Supabase 配置：请设置 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY，或传入 supabaseUrl/supabaseAnonKey。')
  }

  return { url, anonKey }
}

function createSupabase(options = {}) {
  if (options.supabaseClient) return options.supabaseClient
  const { url, anonKey } = getSupabaseConfig(options)
  return createClient(url, anonKey)
}

async function fetchPaged(queryFactory) {
  const rows = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const query = queryFactory()
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    const { data, error } = await query
    if (error) throw error

    const pageRows = data ?? []
    rows.push(...pageRows)
    hasMore = pageRows.length === PAGE_SIZE
    page += 1
  }

  return rows
}

async function fetchBizReport(supabase, options = {}) {
  const {
    period,
    periodType = 'cumulative',
    reportTypes = ['fone', 'tuwei'],
    sheetCodes = [],
  } = options

  const reportRows = await fetchPaged(() => {
    let query = supabase
      .from('edu_biz_report')
      .select(BIZ_REPORT_SELECT)
      .eq('period_type', periodType)
      .order('sort_order')

    if (period) query = query.eq('period', period)
    if (reportTypes.length > 0) query = query.in('report_type', reportTypes)
    if (sheetCodes.length > 0) query = query.in('sheet_code', sheetCodes)

    return query
  })

  const { data: hierarchyRows, error: hierarchyError } = await supabase
    .from('edu_org_hierarchy')
    .select('node_name, level_0, level_1, level_2')
    .range(0, 999)

  if (hierarchyError) throw hierarchyError

  const hierarchyMap = new Map((hierarchyRows ?? []).map(row => [row.node_name, row]))
  return reportRows.map(row => ({
    ...row,
    org_hierarchy: hierarchyMap.get(row.node_name) ?? null,
  }))
}

async function fetchMonthlyPlan(supabase) {
  return fetchPaged(() => supabase
    .from('edu_biz_monthly_plan')
    .select('*')
    .order('sort_order'))
}

async function fetchAvailablePeriods(supabase, options = {}) {
  const { periodType = 'cumulative', reportTypes = ['fone', 'tuwei'] } = options
  const rows = await fetchPaged(() => {
    let query = supabase
      .from('edu_biz_report')
      .select('period, report_type, period_type')
      .eq('period_type', periodType)

    if (reportTypes.length > 0) query = query.in('report_type', reportTypes)
    return query
  })

  return [...new Set(rows.map(row => row.period).filter(Boolean))]
    .sort((left, right) => right.localeCompare(left))
}

function createEmptyMetric() {
  return {
    actual: null,
    actual_fone: null,
    actual_tuwei: null,
    budget_fone: null,
    budget_tuwei: null,
    completion_fone: null,
    completion_tuwei: null,
    diff_fone: null,
    diff_tuwei: null,
    yoy: null,
    yoy_fone: null,
    yoy_tuwei: null,
  }
}

function createEmptyNode(row) {
  return {
    node_name: row.node_name,
    sort_order: row.sort_order,
    hierarchy: { ...EMPTY_HIERARCHY },
    orgHierarchy: {
      level_0: row.org_hierarchy?.level_0 ?? null,
      level_1: row.org_hierarchy?.level_1 ?? null,
      level_2: row.org_hierarchy?.level_2 ?? null,
    },
    metrics: {},
  }
}

function cloneMetric(metric) {
  return {
    ...metric,
    monthly_plan: metric.monthly_plan ? { ...metric.monthly_plan } : undefined,
  }
}

function cloneNode(node) {
  return {
    ...node,
    hierarchy: { ...node.hierarchy },
    orgHierarchy: { ...node.orgHierarchy },
    metrics: Object.fromEntries(
      Object.entries(node.metrics).map(([key, value]) => [key, value ? cloneMetric(value) : value])
    ),
  }
}

function getMetric(node, category) {
  if (!node.metrics[category]) node.metrics[category] = createEmptyMetric()
  return node.metrics[category]
}

function sumNumbers(values) {
  let sum = 0
  let hasValue = false

  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      sum += value
      hasValue = true
    }
  }

  return hasValue ? sum : null
}

function divideOrNull(numerator, denominator) {
  if (numerator == null || denominator == null || denominator === 0) return null
  return numerator / denominator
}

export function safeCompletionRate(actual, budget) {
  if (actual == null || budget == null || budget === 0) return null
  return actual / budget
}

export function safeDiff(actual, budget) {
  if (actual == null || budget == null) return null
  return actual - budget
}

function inferNodeKind(node) {
  const { level_0, level_1, level_2 } = node.orgHierarchy
  const { node_name } = node

  if (!level_0 && !level_1 && !level_2) return 'orphan'
  if (level_0 && node_name === level_0 && !level_1 && !level_2) return 'total'
  if (level_1 && node_name === level_1 && !level_2) return 'level1'
  if (level_2 && node_name === level_2) return 'level2'
  return 'leaf'
}

function normalizeText(value) {
  return String(value ?? '').trim().toLocaleLowerCase()
}

function normalizeOrgScopePart(value) {
  return String(value ?? '').trim()
}

export function buildOrgPath(node) {
  const { level_0, level_1, level_2 } = node.orgHierarchy
  const parts = [level_0, level_1, level_2, node.node_name]
    .map(normalizeOrgScopePart)
    .filter(part => part.length > 0)

  return parts.filter((part, index) => index === 0 || part !== parts[index - 1])
}

export function buildOrgScopeKey(node) {
  return buildOrgPath(node).join(' / ')
}

function isLeafSourceNode(node) {
  const kind = inferNodeKind(node)
  return kind === 'leaf' || kind === 'orphan'
}

function buildSyntheticNode(nodeName, sortOrder, orgHierarchy, level, children) {
  return {
    node_name: nodeName,
    sort_order: sortOrder + SYNTHETIC_SORT_ORDER[level],
    hierarchy: {
      ...EMPTY_HIERARCHY,
      is_aggregated: true,
      aggregation_level: level,
    },
    orgHierarchy,
    metrics: aggregateMetrics(children),
  }
}

function aggregateMetrics(children) {
  const aggregated = {}
  const categories = new Set()

  for (const child of children) {
    for (const key of Object.keys(child.metrics)) categories.add(key)
  }

  const baseCategories = [...categories].filter(category => !DERIVED_METRIC_DEPENDENCIES[category])
  const derivedCategories = [...categories].filter(category => !!DERIVED_METRIC_DEPENDENCIES[category])

  for (const category of baseCategories) {
    const values = children
      .map(child => child.metrics[category])
      .filter(Boolean)

    if (values.length === 0) continue

    const monthlyPlanMonths = new Set()
    for (const metric of values) {
      for (const month of Object.keys(metric.monthly_plan ?? {})) monthlyPlanMonths.add(month)
    }

    const monthly_plan = monthlyPlanMonths.size > 0
      ? Object.fromEntries([...monthlyPlanMonths].map(month => [
          month,
          sumNumbers(values.map(metric => metric.monthly_plan?.[month])) ?? 0,
        ]))
      : undefined

    const actual_fone = sumNumbers(values.map(metric => metric.actual_fone ?? metric.actual))
    const actual_tuwei = sumNumbers(values.map(metric => metric.actual_tuwei ?? metric.actual))
    const actual = actual_fone ?? actual_tuwei
    const budget_fone = sumNumbers(values.map(metric => metric.budget_fone))
    const budget_tuwei = sumNumbers(values.map(metric => metric.budget_tuwei))
    const yoy_fone = sumNumbers(values.map(metric => metric.yoy_fone ?? metric.yoy))
    const yoy_tuwei = sumNumbers(values.map(metric => metric.yoy_tuwei ?? metric.yoy))
    const yoy = yoy_fone ?? yoy_tuwei

    aggregated[category] = {
      actual,
      actual_fone,
      actual_tuwei,
      budget_fone,
      budget_tuwei,
      completion_fone: safeCompletionRate(actual_fone, budget_fone),
      completion_tuwei: safeCompletionRate(actual_tuwei, budget_tuwei),
      diff_fone: safeDiff(actual_fone, budget_fone),
      diff_tuwei: safeDiff(actual_tuwei, budget_tuwei),
      yoy,
      yoy_fone,
      yoy_tuwei,
      monthly_plan,
    }
  }

  for (const category of derivedCategories) {
    const dependency = DERIVED_METRIC_DEPENDENCIES[category]
    const numerator = aggregated[dependency.numerator]
    const denominator = aggregated[dependency.denominator]
    if (!numerator || !denominator) continue

    const actual_fone = divideOrNull(numerator.actual_fone ?? numerator.actual, denominator.actual_fone ?? denominator.actual)
    const actual_tuwei = divideOrNull(numerator.actual_tuwei ?? numerator.actual, denominator.actual_tuwei ?? denominator.actual)
    const actual = actual_fone ?? actual_tuwei
    const budget_fone = divideOrNull(numerator.budget_fone, denominator.budget_fone)
    const budget_tuwei = divideOrNull(numerator.budget_tuwei, denominator.budget_tuwei)
    const yoy_fone = divideOrNull(numerator.yoy_fone ?? numerator.yoy, denominator.yoy_fone ?? denominator.yoy)
    const yoy_tuwei = divideOrNull(numerator.yoy_tuwei ?? numerator.yoy, denominator.yoy_tuwei ?? denominator.yoy)
    const yoy = yoy_fone ?? yoy_tuwei

    aggregated[category] = {
      actual,
      actual_fone,
      actual_tuwei,
      budget_fone,
      budget_tuwei,
      completion_fone: safeCompletionRate(actual_fone, budget_fone),
      completion_tuwei: safeCompletionRate(actual_tuwei, budget_tuwei),
      diff_fone: safeDiff(actual_fone, budget_fone),
      diff_tuwei: safeDiff(actual_tuwei, budget_tuwei),
      yoy,
      yoy_fone,
      yoy_tuwei,
    }
  }

  return aggregated
}

export function aggregateByNode(foneReports, tuweiReports, monthlyPlans = []) {
  const nodeMap = new Map()

  const ensureNode = (row) => {
    if (!nodeMap.has(row.node_name)) nodeMap.set(row.node_name, createEmptyNode(row))

    const node = nodeMap.get(row.node_name)
    if (!node.orgHierarchy.level_0 && row.org_hierarchy?.level_0) node.orgHierarchy.level_0 = row.org_hierarchy.level_0
    if (!node.orgHierarchy.level_1 && row.org_hierarchy?.level_1) node.orgHierarchy.level_1 = row.org_hierarchy.level_1
    if (!node.orgHierarchy.level_2 && row.org_hierarchy?.level_2) node.orgHierarchy.level_2 = row.org_hierarchy.level_2

    return node
  }

  for (const row of foneReports) {
    const metric = getMetric(ensureNode(row), row.metric_category)
    metric.actual = row.actual_value
    metric.actual_fone = row.actual_value
    metric.budget_fone = row.budget_value
    metric.completion_fone = row.completion_rate
    metric.diff_fone = row.diff_value
    metric.yoy = row.yoy_value
    metric.yoy_fone = row.yoy_value
  }

  for (const row of tuweiReports) {
    const metric = getMetric(ensureNode(row), row.metric_category)
    if (metric.actual == null) metric.actual = row.actual_value
    metric.actual_tuwei = row.actual_value
    metric.budget_tuwei = row.budget_value
    metric.completion_tuwei = row.completion_rate
    metric.diff_tuwei = row.diff_value
    if (metric.yoy == null) metric.yoy = row.yoy_value
    metric.yoy_tuwei = row.yoy_value
  }

  for (const plan of monthlyPlans) {
    const node = nodeMap.get(plan.node_name)
    if (!node) continue

    const metric = getMetric(node, plan.metric_category)
    if (!metric.monthly_plan) metric.monthly_plan = {}
    metric.monthly_plan[plan.month] = plan.plan_value ?? 0
  }

  return [...nodeMap.values()].sort((a, b) => a.sort_order - b.sort_order)
}

function buildLeafNodes(nodes) {
  return nodes
    .filter(isLeafSourceNode)
    .map(cloneNode)
    .sort((a, b) => a.sort_order - b.sort_order)
}

export function buildTreeWithAggregation(nodes) {
  const leafNodes = buildLeafNodes(nodes)
  if (leafNodes.length === 0) return []

  const level2Map = new Map()
  const level1ChildrenMap = new Map()

  const directLevel1Leaves = leafNodes.filter(node => node.orgHierarchy.level_1 && !node.orgHierarchy.level_2)
  for (const node of directLevel1Leaves) {
    const level1 = node.orgHierarchy.level_1
    if (!level1ChildrenMap.has(level1)) level1ChildrenMap.set(level1, [])
    level1ChildrenMap.get(level1).push(node)
  }

  const level2Groups = new Map()
  for (const node of leafNodes.filter(item => item.orgHierarchy.level_1 && item.orgHierarchy.level_2)) {
    const key = `${node.orgHierarchy.level_1}|||${node.orgHierarchy.level_2}`
    if (!level2Groups.has(key)) level2Groups.set(key, [])
    level2Groups.get(key).push(node)
  }

  for (const [key, children] of level2Groups) {
    const [level_1, level_2] = key.split('|||')
    const sample = children[0]
    const syntheticNode = buildSyntheticNode(
      level_2,
      Math.min(...children.map(item => item.sort_order)),
      {
        level_0: sample.orgHierarchy.level_0,
        level_1,
        level_2,
      },
      'level2',
      children
    )

    level2Map.set(key, syntheticNode)

    if (!level1ChildrenMap.has(level_1)) level1ChildrenMap.set(level_1, [])
    level1ChildrenMap.get(level_1).push(syntheticNode)
  }

  const level1Nodes = []
  for (const [level_1, children] of level1ChildrenMap) {
    const sample = children[0]
    level1Nodes.push(
      buildSyntheticNode(
        level_1,
        Math.min(...children.map(item => item.sort_order)),
        {
          level_0: sample.orgHierarchy.level_0,
          level_1,
          level_2: null,
        },
        'level1',
        children
      )
    )
  }

  level1Nodes.sort((a, b) => a.sort_order - b.sort_order)
  const level2Nodes = [...level2Map.values()].sort((a, b) => a.sort_order - b.sort_order)

  const rootLabel =
    level1Nodes.find(node => node.orgHierarchy.level_0)?.orgHierarchy.level_0 ??
    leafNodes.find(node => node.orgHierarchy.level_0)?.orgHierarchy.level_0 ??
    DEFAULT_ROOT_LABEL

  const totalNode = buildSyntheticNode(
    rootLabel,
    0,
    {
      level_0: rootLabel,
      level_1: null,
      level_2: null,
    },
    'total',
    level1Nodes.length > 0 ? level1Nodes : leafNodes
  )

  return [totalNode, ...level1Nodes, ...level2Nodes, ...leafNodes]
}

export function getChildren(parentNode, allNodes) {
  const kind = inferNodeKind(parentNode)

  if (kind === 'total') {
    return allNodes
      .filter(node => inferNodeKind(node) === 'level1')
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  if (kind === 'level1') {
    const level1 = parentNode.orgHierarchy.level_1
    return allNodes
      .filter(node => {
        const childKind = inferNodeKind(node)
        if (!level1 || node.orgHierarchy.level_1 !== level1) return false
        if (childKind === 'level2') return true
        return childKind === 'leaf' && !node.orgHierarchy.level_2
      })
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  if (kind === 'level2') {
    const { level_1, level_2 } = parentNode.orgHierarchy
    return allNodes
      .filter(node => inferNodeKind(node) === 'leaf' && node.orgHierarchy.level_1 === level_1 && node.orgHierarchy.level_2 === level_2)
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  return []
}

function buildNestedNode(node, allNodes) {
  const children = getChildren(node, allNodes)

  return {
    node_name: node.node_name,
    org_scope_key: buildOrgScopeKey(node),
    org_path: buildOrgPath(node),
    sort_order: node.sort_order,
    node_kind: inferNodeKind(node),
    hierarchy: { ...node.hierarchy },
    orgHierarchy: { ...node.orgHierarchy },
    metrics: Object.fromEntries(
      Object.entries(node.metrics).map(([key, value]) => [key, value ? cloneMetric(value) : value])
    ),
    children: children.map(child => buildNestedNode(child, allNodes)),
  }
}

export function buildNestedHierarchy(nodes) {
  const allNodes = buildTreeWithAggregation(nodes)
  const roots = allNodes.filter(node => {
    const kind = inferNodeKind(node)
    return kind === 'total' || kind === 'orphan'
  })

  return roots
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(root => buildNestedNode(root, allNodes))
}

function findNestedSubtree(tree, predicate) {
  for (const node of tree) {
    if (predicate(node)) return node
    const childMatch = findNestedSubtree(node.children ?? [], predicate)
    if (childMatch) return childMatch
  }

  return null
}

function filterTree(tree, options = {}) {
  if (options.orgScopeKey) {
    return findNestedSubtree(tree, node => normalizeText(node.org_scope_key) === normalizeText(options.orgScopeKey))
  }

  if (options.nodeName) {
    return findNestedSubtree(tree, node => normalizeText(node.node_name) === normalizeText(options.nodeName))
  }

  return tree
}

function pickMetricValue(metric, field, reportType) {
  if (!metric) return null
  if (field === 'actual') return metric[`actual_${reportType}`] ?? metric.actual ?? null
  if (field === 'budget') return metric[`budget_${reportType}`] ?? null
  if (field === 'completion') return metric[`completion_${reportType}`] ?? null
  if (field === 'yoy') return metric[`yoy_${reportType}`] ?? metric.yoy ?? null
  return null
}

function roundNumber(value, digits) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function compactMetricValue(metricKey, field, metric, reportType) {
  const value = pickMetricValue(metric, field, reportType)
  if (value == null) return value
  if (field === 'completion') return roundNumber(value, 4)
  if (RATIO_METRICS.has(metricKey)) return roundNumber(value, 4)
  return roundNumber(value, 2)
}

function compactMetrics(metrics, reportType) {
  const entries = []
  const orderedMetricKeys = [
    ...METRIC_ORDER.filter(metric => metrics[metric]),
    ...Object.keys(metrics).filter(metric => !METRIC_ORDER.includes(metric)),
  ]

  for (const metricKey of orderedMetricKeys) {
    const metric = metrics[metricKey]
    if (!metric) continue

    const compactMetric = Object.fromEntries([
      ['实际', compactMetricValue(metricKey, 'actual', metric, reportType)],
      ['预算', compactMetricValue(metricKey, 'budget', metric, reportType)],
      ['完成率', compactMetricValue(metricKey, 'completion', metric, reportType)],
      ['同期', compactMetricValue(metricKey, 'yoy', metric, reportType)],
    ].filter(([, value]) => value !== null && value !== undefined))

    if (Object.keys(compactMetric).length === 0) continue

    entries.push([METRIC_LABELS[metricKey] ?? metricKey, compactMetric])
  }

  return Object.fromEntries(entries)
}

function compactNode(node, reportType) {
  const children = (node.children ?? []).map(child => compactNode(child, reportType))
  const result = {
    '组织': node.node_name,
    '组织路径': node.org_path,
    '层级': NODE_KIND_LABELS[node.node_kind] ?? node.node_kind,
    '指标': compactMetrics(node.metrics ?? {}, reportType),
  }

  if (children.length > 0) result['下级'] = children
  return result
}

function compactFlatNode(node, reportType) {
  return {
    '组织': node.node_name,
    '组织路径': buildOrgPath(node),
    '层级': NODE_KIND_LABELS[inferNodeKind(node)] ?? inferNodeKind(node),
    '指标': compactMetrics(node.metrics ?? {}, reportType),
  }
}

function compactTree(tree, reportType) {
  if (Array.isArray(tree)) return tree.map(node => compactNode(node, reportType))
  if (tree && typeof tree === 'object') return compactNode(tree, reportType)
  return tree
}

function normalizePeriodInput(period, periodType) {
  if (typeof period !== 'string' || period.trim() === '') return period

  const trimmed = period.trim()
  if (trimmed.startsWith('<')) return trimmed.replace(/\s+/g, '')

  const compactMatch = /^(\d{4})[-/.年]?(\d{1,2})月?$/.exec(trimmed)
  if (!compactMatch) return trimmed

  const year = Number(compactMatch[1])
  const month = Number(compactMatch[2])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return trimmed
  }

  const monthlyPeriod = `${year}${String(month).padStart(2, '0')}`
  if (periodType !== 'cumulative') return monthlyPeriod

  const next = new Date(year, month, 1)
  return `<${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}`
}

export async function queryBizHierarchy(options = {}) {
  const supabase = createSupabase(options)
  const reportTypes = options.reportTypes ?? options.reportType ?? ['fone', 'tuwei']
  const normalizedReportTypes = Array.isArray(reportTypes) ? reportTypes : [reportTypes]
  const periodType = options.periodType ?? 'cumulative'
  const normalizedPeriod = normalizePeriodInput(options.period, periodType)
  const outputReportType = options.outputReportType ?? normalizedReportTypes[0] ?? 'tuwei'

  const reports = await fetchBizReport(supabase, {
    period: normalizedPeriod,
    periodType,
    reportTypes: normalizedReportTypes,
    sheetCodes: options.sheetCodes ?? [],
  })
  const monthlyPlans = options.includeMonthlyPlan === false ? [] : await fetchMonthlyPlan(supabase)
  const nodes = aggregateByNode(
    reports.filter(row => row.report_type === 'fone'),
    reports.filter(row => row.report_type === 'tuwei'),
    monthlyPlans
  )
  const tree = buildNestedHierarchy(nodes)
  const scopedTree = filterTree(tree, options)
  const availablePeriods = reports.length === 0 || options.includeAvailablePeriods
    ? await fetchAvailablePeriods(supabase, { periodType, reportTypes: normalizedReportTypes })
    : undefined
  const rawResult = {
    metadata: {
      period: normalizedPeriod ?? null,
      input_period: options.period ?? null,
      period_type: periodType,
      report_types: normalizedReportTypes,
      output_report_type: outputReportType,
      sheet_codes: options.sheetCodes ?? [],
      include_monthly_plan: options.includeMonthlyPlan !== false,
      node_name: options.nodeName ?? null,
      org_scope_key: options.orgScopeKey ?? null,
      row_count: reports.length,
      node_count: nodes.length,
      generated_at: new Date().toISOString(),
      available_periods: availablePeriods,
      warning: reports.length === 0
        ? '未查询到经营数据。请检查 period 是否为数据库中的精确值；累计口径通常使用右开区间，如 2026-04 会转换为 <202605。'
        : undefined,
    },
    tree: scopedTree,
    flat_nodes: options.includeFlatNodes ? buildTreeWithAggregation(nodes) : undefined,
  }

  if (options.raw) return rawResult

  return {
    '元数据': {
      '输入期间': options.period ?? null,
      '实际查询期间': normalizedPeriod ?? null,
      '期间类型': periodType === 'cumulative' ? '累计' : '月度',
      '报表口径': outputReportType === 'fone' ? '学年预算' : '突围考核',
      '原始记录数': reports.length,
      '组织节点数': nodes.length,
      ...(availablePeriods ? { '可用期间': availablePeriods } : {}),
      ...(reports.length === 0
        ? { '提示': '未查询到经营数据。累计口径通常使用右开区间，如 2026-04 会转换为 <202605。' }
        : {}),
    },
    '数据': compactTree(scopedTree, outputReportType),
    ...(options.includeFlatNodes ? { '平铺节点': buildTreeWithAggregation(nodes).map(node => compactFlatNode(node, outputReportType)) } : {}),
  }
}

function parseList(value) {
  return String(value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function printHelp() {
  console.log(`Usage:
  node scripts/query-biz-hierarchy.mjs --period=2026-04 --period-type=cumulative --report-type=tuwei --pretty

Options:
  --period=<YYYY-MM>                 查询期间，不传则读取匹配口径下全部期间
  --period-type=<cumulative|monthly> 默认 cumulative
  --report-type=<fone|tuwei|...>     支持逗号分隔，默认 fone,tuwei
  --sheet-code=<1.1,2.1,...>         可选，按 sheet_code 过滤
  --node-name=<name>                 可选，只输出匹配节点子树
  --org-scope-key=<path>             可选，按 org_scope_key 精确输出子树
  --no-monthly-plan                  不合并 edu_biz_monthly_plan
  --include-flat                     同时输出 flat_nodes
  --raw                              输出未精简的原始结构
  --pretty                           格式化 JSON
  --output=<path>                    写入文件；不传则输出到 stdout
  --list-periods                     仅列出当前 period-type/report-type 下可用 period
`)
}

function parseArgs(argv) {
  const options = {}

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }
    if (arg === '--pretty') {
      options.pretty = true
      continue
    }
    if (arg === '--include-flat') {
      options.includeFlatNodes = true
      continue
    }
    if (arg === '--raw') {
      options.raw = true
      continue
    }
    if (arg === '--list-periods') {
      options.listPeriods = true
      options.includeAvailablePeriods = true
      continue
    }
    if (arg === '--no-monthly-plan') {
      options.includeMonthlyPlan = false
      continue
    }

    const [rawKey, ...rawValueParts] = arg.split('=')
    const value = rawValueParts.join('=')
    if (!rawKey.startsWith('--') || value === '') continue

    const key = rawKey.slice(2)
    if (key === 'period') options.period = value
    if (key === 'period-type') options.periodType = value
    if (key === 'report-type') options.reportTypes = parseList(value)
    if (key === 'sheet-code') options.sheetCodes = parseList(value)
    if (key === 'node-name') options.nodeName = value
    if (key === 'org-scope-key') options.orgScopeKey = value
    if (key === 'output') options.output = resolve(process.cwd(), value)
  }

  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  if (options.listPeriods) {
    const supabase = createSupabase(options)
    const reportTypes = options.reportTypes ?? options.reportType ?? ['fone', 'tuwei']
    const normalizedReportTypes = Array.isArray(reportTypes) ? reportTypes : [reportTypes]
    const periodType = options.periodType ?? 'cumulative'
    const availablePeriods = await fetchAvailablePeriods(supabase, { periodType, reportTypes: normalizedReportTypes })
    console.log(JSON.stringify({ period_type: periodType, report_types: normalizedReportTypes, periods: availablePeriods }, null, options.pretty ? 2 : 0))
    return
  }

  const result = await queryBizHierarchy(options)
  const json = JSON.stringify(result, null, options.pretty ? 2 : 0)

  if (options.output) {
    writeFileSync(options.output, `${json}\n`, 'utf8')
    return
  }

  console.log(json)
}

if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  main().catch(error => {
    console.error(error?.stack ?? error?.message ?? String(error))
    process.exit(1)
  })
}
