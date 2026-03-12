import { supabase } from '@/lib/supabase'
import { appFetch } from '@/lib/httpClient'
import type { ToolDefinition, AgentMemory } from './types'
import { saveMemory, searchMemories } from './memory'

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'query_biz_data',
    description: '查询教育后勤经营数据（edu_biz_report: 11,477条）。**核心特性：默认自动返回完整层级聚合数据**，一次查询获取 level_1/level_2/level_3 聚合节点 + 叶子节点，支持多层级分析。包含25个指标类别（营收、利润、成本、人效等），153个业务节点。每个节点包含 org_hierarchy（level_1中心/level_2板块/level_3单元/label标签）和聚合标识（is_aggregated, aggregation_level）。支持按报表类型（fone年初预算/tuwei考核目标）、期间类型（cumulative累计/monthly单月）、指标类别筛选。**使用建议：不传筛选条件获取全景数据，传 metric_category 聚焦特定指标，根据 aggregation_level 筛选特定层级**。',
    parameters: {
      type: 'object',
      properties: {
        report_type: { type: 'string', description: '报表类型：fone=年初预算版, tuwei=考核版。不传则返回两个版本合并数据（actual_value, budget_fone, budget_tuwei, completion_fone, completion_tuwei）', enum: ['fone', 'tuwei'] },
        period_type: { type: 'string', description: '期间类型：cumulative=累计数据, monthly=单月数据。推荐使用 cumulative 进行整体分析', enum: ['cumulative', 'monthly'] },
        sheet_code: { type: 'string', description: 'Sheet编号：1.1/1.2/2.1/2.2/2.3（主报表16个指标）, 6.1/6.2/7.1/7.2（成本分析9个指标）' },
        period: { type: 'string', description: '数据期间，如 <202603（累计到3月）, 202602（2月单月）, 202601-202602-（1-2月累计）。不同 report_type 可能有不同格式' },
        node_name: { type: 'string', description: '节点名称模糊匹配。可传中心名称（如"后勤管理中心"）获取该中心及所有下级节点' },
        metric_category: { type: 'string', description: '指标类别（推荐传此参数聚焦分析）。主报表(16个): revenue（营收）, pretax_profit（税前利润）, gross_margin（毛利率）, labor_cost（人力成本）, labor_cost_rate（人力成本率）, headcount（在岗人数）, per_capita_revenue（人均营收）, catering_expense, material_cost, gross_profit, other_expense, external_revenue, external_expense, pretax_margin, revenue_creation, profit_creation。成本分析(9个): salary（工资）, social_insurance（社保）, housing_fund（公积金）, labor_service_fee（劳务费）, other_labor_cost, vehicle_expense（车辆费）, energy_expense（能耗费）, travel_expense（差旅费）, entertainment_expense（业务招待费）' },
        include_hierarchy: { type: 'string', description: '是否包含层级聚合数据，默认 "true"。开启后返回完整组织层级树（level_1/level_2/level_3聚合节点 + 叶子节点）。传 "false" 仅返回原始数据，不进行层级聚合' },
        limit: { type: 'number', description: '返回原始数据行数上限（不影响聚合节点数量）。默认不限制，会自动分页获取所有数据。仅在需要限制数据量时使用' },
      },
    },
  },
  {
    name: 'query_org_data',
    description: '查询组织通讯录数据。242个部门，891名成员，覆盖161个有成员的部门。可按部门名称、层级关系筛选，支持返回部门统计和成员样本。用于分析组织架构、人员分布、部门规模，以及与经营数据做关联分析（如人均营收、人均利润、人效对比）。',
    parameters: {
      type: 'object',
      properties: {
        department_name: { type: 'string', description: '部门名称，支持模糊匹配' },
        department_id: { type: 'string', description: '部门ID，精确匹配' },
        parent_id: { type: 'string', description: '上级部门ID，精确匹配' },
        include_children: { type: 'string', description: '是否包含子部门（传 "true" 开启），用于获取完整组织树' },
        include_members: { type: 'string', description: '是否返回部门成员样本（传 "true" 开启），包含姓名、工号、职位等' },
        member_sample_limit: { type: 'number', description: '成员样本上限，默认60，最大300' },
        sort_by: { type: 'string', description: '排序字段', enum: ['member_count', 'name', 'order_value'] },
        limit: { type: 'number', description: '返回部门数量上限，默认100，最大500' },
      },
    },
  },
  {
    name: 'analyze_biz_org_insights',
    description: '执行经营数据与组织数据的联合分析。自动把中心级经营数据与通讯录部门规模做匹配，计算人均营收/人均利润、营收缺口、成本压力等指标，并返回可直接引用的洞察数据。',
    parameters: {
      type: 'object',
      properties: {
        center: { type: 'string', description: '聚焦某个中心或区域（按 node_name 模糊匹配）' },
        focus: { type: 'string', description: '分析重点', enum: ['overview', 'revenue_gap', 'per_capita_profit', 'cost_pressure'] },
        top_n: { type: 'number', description: '返回重点条目数量，默认5，最大10' },
        min_member_count: { type: 'number', description: '最小组织人数门槛（仅保留匹配人数不低于该值的中心）' },
      },
    },
  },
  {
    name: 'query_opportunities',
    description: '查询商机项目台账（630条）。当前管道：20个跟踪中（总额20200万，平均中标率58%），9个运营中（总额16700万），3个已签约（总额6500万）。包含项目名称、预估金额、状态、中标概率、区域、投标日期、审批状态等。可分析商机管道健康度、转化漏斗、区域分布、金额分层等。',
    parameters: {
      type: 'object',
      properties: {
        snapshot_date: { type: 'string', description: '快照日期(YYYY-MM-DD)，不传则自动使用最新日期' },
        item_type: { type: 'string', description: '商机类型', enum: ['operation', 'expansion', 'tracking'] },
        status: { type: 'string', description: '商机状态。tracking=跟踪中(20个), bidding=投标中, contracted=已签约(3个), operating=运营中(9个), suspended=暂停, lost=丢失', enum: ['tracking', 'bidding', 'contracted', 'operating', 'suspended', 'lost'] },
        region: { type: 'string', description: '区域名称，支持模糊匹配' },
        min_amount: { type: 'number', description: '最小预估金额（万元）' },
        columns: { type: 'string', description: '需要返回的字段，逗号分隔。常用：project_name,estimated_amount,status,win_probability,region,bid_date,logistics_approved,group_approved' },
        limit: { type: 'number', description: '返回条数上限，默认100' },
      },
    },
  },
  {
    name: 'query_work_items',
    description: '查询工作汇报记录。包含工作内容、状态、优先级等。可用于了解团队工作进展和重点任务。支持指定返回字段。',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: '工作状态', enum: ['todo', 'in_progress', 'in_review', 'done'] },
        priority: { type: 'string', description: '优先级', enum: ['low', 'medium', 'high', 'urgent'] },
        module_id: { type: 'string', description: '所属模块ID' },
        columns: { type: 'string', description: '需要返回的字段，逗号分隔。不传则返回全部字段。' },
        limit: { type: 'number', description: '返回条数上限，默认50' },
      },
    },
  },
  {
    name: 'query_schedules',
    description: '查询日程安排和会议纪要（4条记录）。包含日程标题、日期、时段（上午/下午/晚上）、类型（会议/商务/日常/紧急）、地点、会议纪要等。可用于了解用户的日程安排、会议决议、工作重点、时间分配等。支持按日期范围、类型、是否有纪要筛选。',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: '起始日期，如 "2026-01-01"' },
        date_to: { type: 'string', description: '结束日期，如 "2026-03-31"' },
        type: { type: 'string', description: '日程类型。meeting=会议, business=商务, routine=日常, urgent=紧急', enum: ['meeting', 'business', 'routine', 'urgent'] },
        has_notes: { type: 'string', description: '是否有会议纪要，传 "true" 只返回有纪要的日程，用于查看会议决议和行动项' },
        columns: { type: 'string', description: '需要返回的字段，逗号分隔。常用：title,date,period,type,location,meeting_notes,start_time,end_time' },
        limit: { type: 'number', description: '返回条数上限，默认50' },
      },
    },
  },
  {
    name: 'query_attendance',
    description: '查询员工考勤数据（369条记录）。2026年1月数据：实际出勤9109天，请假224.5天，迟到856次。关联 feishu_members 和 feishu_departments 表，支持外键关联查询。包含应出勤天数、实出勤天数、请假天数、旷工天数、迟到早退次数等。可按部门、月份、出勤率区间分析考勤情况，识别考勤异常、出勤率低的部门/员工，评估团队工作状态。',
    parameters: {
      type: 'object',
      properties: {
        year_month: { type: 'number', description: '年月，如 202601 表示2026年1月。当前有202601月份数据' },
        department: { type: 'string', description: '部门名称，支持模糊匹配' },
        employee_name: { type: 'string', description: '员工姓名，支持模糊匹配' },
        min_attendance_rate: { type: 'number', description: '最低出勤率（0-100），筛选出勤率高于此值的记录' },
        max_attendance_rate: { type: 'number', description: '最高出勤率（0-100），筛选出勤率低于此值的记录。如设置80可找出勤率偏低的员工' },
        columns: { type: 'string', description: '需要返回的字段，逗号分隔。常用：member_id,department_id,year_month,expected_days,actual_days,leave_days,absent_days,late_times,early_leave_times,feishu_members(name,employee_no,job_title,department_id)' },
        limit: { type: 'number', description: '返回条数上限，默认100' },
      },
    },
  },
  {
    name: 'query_trips',
    description: '查询员工出差记录（44条）。涉及9名员工，13个客户。2026年1月33次出差（平均4.7天），2月7次（平均2.9天），3月4次（平均2.5天）。包含出差人员、员工ID、部门、客户、商机、出发/返回时间、出差天数、事由等。可分析出差频率、客户拜访情况、出差成本、商机跟进强度、人员工作负荷等。',
    parameters: {
      type: 'object',
      properties: {
        employee_name: { type: 'string', description: '员工姓名，支持模糊匹配' },
        employee_id: { type: 'string', description: '员工ID，支持模糊匹配' },
        department: { type: 'string', description: '部门名称，支持模糊匹配' },
        customer_name: { type: 'string', description: '客户名称，支持模糊匹配。当前涉及13个客户' },
        opportunity_name: { type: 'string', description: '商机名称，支持模糊匹配。可关联商机台账分析出差投入与转化效果' },
        start_date_from: { type: 'string', description: '出发日期起始，如 "2026-01-01"。数据范围：2026-01-04至2026-03-08' },
        start_date_to: { type: 'string', description: '出发日期结束，如 "2026-01-31"' },
        min_days: { type: 'number', description: '最少出差天数。如设置5可找长期出差记录' },
        columns: { type: 'string', description: '需要返回的字段，逗号分隔。常用：employee_name,employee_id,department,customer_name,opportunity_name,start_time,end_time,reason' },
        limit: { type: 'number', description: '返回条数上限，默认100' },
      },
    },
  },
  {
    name: 'save_memory',
    description: '保存重要的分析发现到长期记忆中，以便在未来的分析会话中参考。当你发现重要的业务洞察、异常情况、趋势或结论时，主动调用此工具保存。',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '记忆内容，如 "华南中心2025年营收完成率仅78%，低于预算"' },
        category: { type: 'string', description: '分类', enum: ['insight', 'conclusion', 'anomaly', 'trend'] },
        keywords: { type: 'string', description: '检索关键词，逗号分隔，如 "华南中心,营收,2025"' },
      },
      required: ['content', 'category', 'keywords'],
    },
  },
  {
    name: 'recall_memory',
    description: '检索历史分析记忆。在开始新的分析前调用，查看是否有相关的历史发现可以参考，避免重复分析并提供更连贯的洞察。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词，如 "华南中心 营收"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_search',
    description: '通过互联网搜索获取实时信息，包括行业政策法规、市场趋势、竞品动态、新闻资讯、技术方案、行业报告等。当问题涉及外部知识、时事信息、或需要补充内部数据库中没有的背景信息时使用。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词，使用精准的中文关键词效果更好' },
        count: { type: 'number', description: '返回结果数量，默认5，最大20' },
      },
      required: ['query'],
    },
  },
]

type Args = Record<string, unknown>

// Lightweight runtime coercion (no zod dependency)
function coerceNumber(v: unknown, defaultVal: number): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v)
    return isNaN(n) ? defaultVal : n
  }
  return defaultVal
}

function coerceString(v: unknown): string {
  return typeof v === 'string' ? v : String(v || '')
}

function coerceBoolean(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const val = v.trim().toLowerCase()
    return val === 'true' || val === '1' || val === 'yes'
  }
  if (typeof v === 'number') return v === 1
  return false
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}

function toNullableNumber(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function normalizeRate(v: unknown): number | null {
  const n = toNullableNumber(v)
  if (n == null) return null
  return n > 1 ? n / 100 : n
}

function round(n: number, digits = 4): number {
  const base = 10 ** digits
  return Math.round(n * base) / base
}

function safeDivide(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator <= 0) return null
  return numerator / denominator
}

function normalizeText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()（）\-_/]/g, '')
}

function isLikelyNameMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const na = normalizeText(a)
  const nb = normalizeText(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const shorter = na.length <= nb.length ? na : nb
  const longer = na.length <= nb.length ? nb : na
  if (shorter.length < 3) return false
  return longer.includes(shorter)
}

interface DepartmentRow {
  department_id: string
  name: string
  parent_id: string | null
  order_value: number | null
  member_count: number | null
  leader_user_id: string | null
}

interface MemberRow {
  open_id: string | null
  user_id: string | null
  name: string | null
  job_title: string | null
  department_id?: string | null
  department_ids?: string[] | string | null
}

async function queryBizData(args: Args): Promise<string> {
  const includeHierarchy = args.include_hierarchy !== 'false' // Default to true

  // Build base query with pagination to handle large datasets
  const PAGE_SIZE = 1000
  let allReportData: any[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from('edu_biz_report')
      .select('*')
      .order('sort_order')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    const reportType = coerceString(args.report_type)
    if (reportType) query = query.eq('report_type', reportType)

    const periodType = coerceString(args.period_type)
    if (periodType) query = query.eq('period_type', periodType)

    const sheetCode = coerceString(args.sheet_code)
    if (sheetCode) query = query.eq('sheet_code', sheetCode)

    const period = coerceString(args.period)
    if (period) query = query.eq('period', period)

    const nodeName = coerceString(args.node_name)
    if (nodeName) query = query.ilike('node_name', `%${nodeName}%`)

    const metricCategory = coerceString(args.metric_category)
    if (metricCategory) query = query.eq('metric_category', metricCategory)

    const { data: pageData, error: reportError } = await query

    if (reportError) return JSON.stringify({ error: reportError.message })

    if (pageData && pageData.length > 0) {
      allReportData = allReportData.concat(pageData)
      hasMore = pageData.length === PAGE_SIZE
      page++
    } else {
      hasMore = false
    }

    // Apply user limit if specified
    const userLimit = coerceNumber(args.limit, 0)
    if (userLimit > 0 && allReportData.length >= userLimit) {
      allReportData = allReportData.slice(0, userLimit)
      hasMore = false
    }
  }

  const reportData = allReportData

  if (!reportData?.length) return JSON.stringify({ message: '未查询到数据', data: [] })

  // If hierarchy not requested, return raw data
  if (!includeHierarchy) {
    return JSON.stringify({ total: reportData.length, data: reportData })
  }

  // Fetch hierarchy data
  const { data: hierarchyData, error: hierarchyError } = await supabase
    .from('edu_org_hierarchy')
    .select('*')
    .limit(1000)

  if (hierarchyError) {
    console.error('[queryBizData] Hierarchy error:', hierarchyError)
    return JSON.stringify({
      warning: '组织层级数据加载失败，仅返回原始数据',
      total: reportData.length,
      data: reportData
    })
  }

  // Create hierarchy map
  const hierarchyMap = new Map(
    (hierarchyData ?? []).map(h => [h.node_name, h])
  )

  // Enrich report data with hierarchy info
  const enrichedData = reportData.map(row => ({
    ...row,
    org_hierarchy: hierarchyMap.get(row.node_name) || null
  }))

  // Group by node_name and metric_category to aggregate fone/tuwei
  const nodeMetricMap = new Map<string, any>()

  for (const row of enrichedData) {
    const key = `${row.node_name}|${row.metric_category}`
    if (!nodeMetricMap.has(key)) {
      nodeMetricMap.set(key, {
        node_name: row.node_name,
        metric_category: row.metric_category,
        metric_category_cn: row.metric_category_cn,
        sheet_code: row.sheet_code,
        period_type: row.period_type,
        period: row.period,
        sort_order: row.sort_order,
        org_hierarchy: row.org_hierarchy,
        actual_value: null,
        budget_fone: null,
        budget_tuwei: null,
        completion_fone: null,
        completion_tuwei: null,
        diff_fone: null,
        diff_tuwei: null,
        yoy_value: null,
      })
    }

    const node = nodeMetricMap.get(key)!
    if (row.report_type === 'fone') {
      node.actual_value = row.actual_value
      node.budget_fone = row.budget_value
      node.completion_fone = row.completion_rate
      node.diff_fone = row.diff_value
      node.yoy_value = row.yoy_value
    } else if (row.report_type === 'tuwei') {
      if (node.actual_value === null) node.actual_value = row.actual_value
      node.budget_tuwei = row.budget_value
      node.completion_tuwei = row.completion_rate
      node.diff_tuwei = row.diff_value
      if (node.yoy_value === null) node.yoy_value = row.yoy_value
    }
  }

  const leafNodes = Array.from(nodeMetricMap.values())

  // Build hierarchy aggregation
  const allNodes = buildHierarchyAggregation(leafNodes)

  return JSON.stringify({
    summary: {
      total_nodes: allNodes.length,
      leaf_nodes: leafNodes.length,
      level_1_nodes: allNodes.filter(n => n.is_aggregated && n.aggregation_level === 'level_1').length,
      level_2_nodes: allNodes.filter(n => n.is_aggregated && n.aggregation_level === 'level_2').length,
      level_3_nodes: allNodes.filter(n => n.is_aggregated && n.aggregation_level === 'level_3').length,
    },
    data: allNodes,
  })
}

function buildHierarchyAggregation(leafNodes: any[]): any[] {
  const allNodes = [...leafNodes.map(n => ({ ...n, is_aggregated: false, aggregation_level: null }))]

  // Group by level_3
  const level3Groups = new Map<string, any[]>()
  leafNodes.forEach(node => {
    const { level_1, level_2, level_3 } = node.org_hierarchy || {}
    if (level_1 && level_2 && level_3 && node.node_name !== level_3) {
      const key = `${level_1}|${level_2}|${level_3}|${node.metric_category}`
      if (!level3Groups.has(key)) level3Groups.set(key, [])
      level3Groups.get(key)!.push(node)
    }
  })

  level3Groups.forEach((children, key) => {
    const [level_1, level_2, level_3, metric_category] = key.split('|')
    const representative = children[0]

    allNodes.push({
      node_name: level_3,
      metric_category,
      metric_category_cn: representative.metric_category_cn,
      sheet_code: representative.sheet_code,
      period_type: representative.period_type,
      period: representative.period,
      sort_order: Math.min(...children.map(c => c.sort_order)),
      org_hierarchy: { level_1, level_2, level_3, label: representative.org_hierarchy?.label },
      actual_value: children.reduce((sum, c) => sum + (c.actual_value ?? 0), 0),
      budget_fone: children.reduce((sum, c) => sum + (c.budget_fone ?? 0), 0),
      budget_tuwei: children.reduce((sum, c) => sum + (c.budget_tuwei ?? 0), 0),
      completion_fone: null,
      completion_tuwei: null,
      diff_fone: null,
      diff_tuwei: null,
      yoy_value: children.reduce((sum, c) => sum + (c.yoy_value ?? 0), 0),
      is_aggregated: true,
      aggregation_level: 'level_3',
    })
  })

  // Recalculate completion rates for level_3 nodes
  allNodes.filter(n => n.is_aggregated && n.aggregation_level === 'level_3').forEach(node => {
    if (node.budget_fone > 0) {
      node.completion_fone = node.actual_value / node.budget_fone
      node.diff_fone = node.actual_value - node.budget_fone
    }
    if (node.budget_tuwei > 0) {
      node.completion_tuwei = node.actual_value / node.budget_tuwei
      node.diff_tuwei = node.actual_value - node.budget_tuwei
    }
  })

  // Group by level_2
  const level2Groups = new Map<string, any[]>()

  // Collect leaf nodes directly under level_2
  leafNodes.forEach(node => {
    const { level_1, level_2, level_3 } = node.org_hierarchy || {}
    if (level_1 && level_2 && !level_3) {
      const key = `${level_1}|${level_2}|${node.metric_category}`
      if (!level2Groups.has(key)) level2Groups.set(key, [])
      level2Groups.get(key)!.push(node)
    }
  })

  // Add level_3 aggregated nodes
  allNodes.filter(n => n.is_aggregated && n.aggregation_level === 'level_3').forEach(node => {
    const { level_1, level_2 } = node.org_hierarchy || {}
    const key = `${level_1}|${level_2}|${node.metric_category}`
    if (!level2Groups.has(key)) level2Groups.set(key, [])
    level2Groups.get(key)!.push(node)
  })

  level2Groups.forEach((children, key) => {
    const [level_1, level_2, metric_category] = key.split('|')
    const representative = children[0]

    const aggregated = {
      node_name: level_2,
      metric_category,
      metric_category_cn: representative.metric_category_cn,
      sheet_code: representative.sheet_code,
      period_type: representative.period_type,
      period: representative.period,
      sort_order: Math.min(...children.map(c => c.sort_order)),
      org_hierarchy: { level_1, level_2, level_3: null, label: representative.org_hierarchy?.label },
      actual_value: children.reduce((sum, c) => sum + (c.actual_value ?? 0), 0),
      budget_fone: children.reduce((sum, c) => sum + (c.budget_fone ?? 0), 0),
      budget_tuwei: children.reduce((sum, c) => sum + (c.budget_tuwei ?? 0), 0),
      completion_fone: null as number | null,
      completion_tuwei: null as number | null,
      diff_fone: null as number | null,
      diff_tuwei: null as number | null,
      yoy_value: children.reduce((sum, c) => sum + (c.yoy_value ?? 0), 0),
      is_aggregated: true,
      aggregation_level: 'level_2',
    }

    if (aggregated.budget_fone > 0) {
      aggregated.completion_fone = aggregated.actual_value / aggregated.budget_fone
      aggregated.diff_fone = aggregated.actual_value - aggregated.budget_fone
    }
    if (aggregated.budget_tuwei > 0) {
      aggregated.completion_tuwei = aggregated.actual_value / aggregated.budget_tuwei
      aggregated.diff_tuwei = aggregated.actual_value - aggregated.budget_tuwei
    }

    allNodes.push(aggregated)
  })

  // Group by level_1
  const level1Groups = new Map<string, any[]>()

  // Collect leaf nodes directly under level_1
  leafNodes.forEach(node => {
    const { level_1, level_2 } = node.org_hierarchy || {}
    if (level_1 && !level_2) {
      const key = `${level_1}|${node.metric_category}`
      if (!level1Groups.has(key)) level1Groups.set(key, [])
      level1Groups.get(key)!.push(node)
    }
  })

  // Add level_2 aggregated nodes
  allNodes.filter(n => n.is_aggregated && n.aggregation_level === 'level_2').forEach(node => {
    const { level_1 } = node.org_hierarchy || {}
    const key = `${level_1}|${node.metric_category}`
    if (!level1Groups.has(key)) level1Groups.set(key, [])
    level1Groups.get(key)!.push(node)
  })

  level1Groups.forEach((children, key) => {
    const [level_1, metric_category] = key.split('|')
    const representative = children[0]

    const aggregated = {
      node_name: level_1,
      metric_category,
      metric_category_cn: representative.metric_category_cn,
      sheet_code: representative.sheet_code,
      period_type: representative.period_type,
      period: representative.period,
      sort_order: Math.min(...children.map(c => c.sort_order)),
      org_hierarchy: { level_1, level_2: null, level_3: null, label: representative.org_hierarchy?.label },
      actual_value: children.reduce((sum, c) => sum + (c.actual_value ?? 0), 0),
      budget_fone: children.reduce((sum, c) => sum + (c.budget_fone ?? 0), 0),
      budget_tuwei: children.reduce((sum, c) => sum + (c.budget_tuwei ?? 0), 0),
      completion_fone: null as number | null,
      completion_tuwei: null as number | null,
      diff_fone: null as number | null,
      diff_tuwei: null as number | null,
      yoy_value: children.reduce((sum, c) => sum + (c.yoy_value ?? 0), 0),
      is_aggregated: true,
      aggregation_level: 'level_1',
    }

    if (aggregated.budget_fone > 0) {
      aggregated.completion_fone = aggregated.actual_value / aggregated.budget_fone
      aggregated.diff_fone = aggregated.actual_value - aggregated.budget_fone
    }
    if (aggregated.budget_tuwei > 0) {
      aggregated.completion_tuwei = aggregated.actual_value / aggregated.budget_tuwei
      aggregated.diff_tuwei = aggregated.actual_value - aggregated.budget_tuwei
    }

    allNodes.push(aggregated)
  })

  return allNodes.sort((a, b) => a.sort_order - b.sort_order)
}

function collectDescendantDeptIds(seedIds: string[], allDepartments: DepartmentRow[]): Set<string> {
  const byParent = new Map<string, string[]>()
  for (const d of allDepartments) {
    if (!d.parent_id) continue
    if (!byParent.has(d.parent_id)) byParent.set(d.parent_id, [])
    byParent.get(d.parent_id)!.push(d.department_id)
  }
  const visited = new Set<string>()
  const queue = [...seedIds]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const children = byParent.get(id) ?? []
    for (const c of children) queue.push(c)
  }
  return visited
}

function extractMemberDeptIds(member: MemberRow): string[] {
  const raw = member.department_id ?? member.department_ids ?? null
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string' && !!v)
  if (typeof raw === 'string') return raw ? [raw] : []
  return []
}

function buildMemberSamples(members: MemberRow[], selectedDeptIds: Set<string>, sampleLimit: number) {
  const samplesByDept: Record<string, Array<Record<string, unknown>>> = {}
  for (const m of members) {
    const deptIds = extractMemberDeptIds(m)
    for (const dId of deptIds) {
      if (!selectedDeptIds.has(dId)) continue
      if (!samplesByDept[dId]) samplesByDept[dId] = []
      if (samplesByDept[dId].length >= sampleLimit) continue
      samplesByDept[dId].push({
        open_id: m.open_id,
        user_id: m.user_id,
        name: m.name,
        job_title: m.job_title,
      })
    }
  }
  return samplesByDept
}

function isMissingColumnError(msg: string, column: string): boolean {
  const text = msg.toLowerCase()
  return text.includes('column')
    && text.includes(column.toLowerCase())
    && text.includes('does not exist')
}

async function fetchMembersPortable(limit = 6000): Promise<{ data: MemberRow[]; error?: string }> {
  const primary = await supabase
    .from('feishu_members')
    .select('open_id,user_id,name,job_title,department_id')
    .limit(limit)
  if (!primary.error) {
    return { data: (primary.data ?? []) as MemberRow[] }
  }
  if (!isMissingColumnError(primary.error.message, 'department_id')) {
    return { data: [], error: primary.error.message }
  }

  const fallback = await supabase
    .from('feishu_members')
    .select('open_id,user_id,name,job_title,department_ids')
    .limit(limit)
  if (fallback.error) return { data: [], error: fallback.error.message }
  return { data: (fallback.data ?? []) as MemberRow[] }
}

async function queryOrgData(args: Args): Promise<string> {
  const includeChildren = coerceBoolean(args.include_children)
  const includeMembers = coerceBoolean(args.include_members)
  const memberSampleLimit = clamp(coerceNumber(args.member_sample_limit, 60), 10, 300)
  const limit = clamp(coerceNumber(args.limit, 100), 1, 500)
  const sortBy = coerceString(args.sort_by) || 'member_count'

  const { data: allDeptRows, error: deptError } = await supabase
    .from('feishu_departments')
    .select('department_id,name,parent_id,order_value,member_count,leader_user_id')
    .limit(3000)

  if (deptError) return JSON.stringify({ error: deptError.message })
  if (!allDeptRows?.length) return JSON.stringify({ message: '未查询到组织通讯录数据', data: [] })

  const allDepartments = allDeptRows as DepartmentRow[]
  const departmentName = coerceString(args.department_name).trim()
  const departmentId = coerceString(args.department_id).trim()
  const parentId = coerceString(args.parent_id).trim()

  let filtered = allDepartments
  if (departmentName) filtered = filtered.filter((d) => d.name?.includes(departmentName))
  if (departmentId) filtered = filtered.filter((d) => d.department_id === departmentId)
  if (parentId) filtered = filtered.filter((d) => d.parent_id === parentId)

  if (includeChildren && filtered.length > 0) {
    const baseIds = filtered.map((d) => d.department_id)
    const subtreeIds = collectDescendantDeptIds(baseIds, allDepartments)
    filtered = allDepartments.filter((d) => subtreeIds.has(d.department_id))
  }

  if (sortBy === 'name') filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  else if (sortBy === 'order_value') filtered = [...filtered].sort((a, b) => (a.order_value ?? 0) - (b.order_value ?? 0))
  else filtered = [...filtered].sort((a, b) => (b.member_count ?? 0) - (a.member_count ?? 0))

  const selected = filtered.slice(0, limit)
  const selectedDeptIds = new Set(selected.map((d) => d.department_id))

  const summary = {
    total_departments: selected.length,
    root_departments: selected.filter((d) => !d.parent_id).length,
    total_member_count: selected.reduce((sum, d) => sum + (d.member_count ?? 0), 0),
    avg_member_count: selected.length > 0
      ? round(selected.reduce((sum, d) => sum + (d.member_count ?? 0), 0) / selected.length, 2)
      : 0,
  }

  if (!includeMembers) {
    return JSON.stringify({
      summary,
      total: selected.length,
      data: selected,
    })
  }

  const membersResult = await fetchMembersPortable(6000)
  if (membersResult.error) {
    return JSON.stringify({
      summary,
      total: selected.length,
      data: selected,
      member_warning: `部门数据已返回，但成员样本读取失败: ${membersResult.error}`,
    })
  }

  const members = membersResult.data
  const memberSamples = buildMemberSamples(members, selectedDeptIds, memberSampleLimit)
  const withSamples = selected.map((d) => ({
    ...d,
    member_samples: memberSamples[d.department_id] ?? [],
  }))

  return JSON.stringify({
    summary: {
      ...summary,
      member_sample_count: withSamples.reduce((sum, d) => sum + d.member_samples.length, 0),
    },
    total: withSamples.length,
    data: withSamples,
  })
}

async function analyzeBizOrgInsights(args: Args): Promise<string> {
  const focus = coerceString(args.focus) || 'overview'
  const topN = clamp(coerceNumber(args.top_n, 5), 1, 10)
  const minMemberCount = Math.max(0, coerceNumber(args.min_member_count, 0))

  // Query edu_biz_report instead of edu_logistics_biz_data
  let bizQuery = supabase
    .from('edu_biz_report')
    .select('node_name,metric_category,actual_value,budget_value,completion_rate')
    .eq('period_type', 'cumulative')
    .in('metric_category', ['revenue', 'pretax_profit', 'labor_cost', 'headcount'])
    .limit(1000)

  const center = coerceString(args.center).trim()
  if (center) bizQuery = bizQuery.ilike('node_name', `%${center}%`)

  const [{ data: bizRows, error: bizError }, { data: deptRows, error: deptError }, membersResult] = await Promise.all([
    bizQuery,
    supabase.from('feishu_departments').select('department_id,name,parent_id,member_count').limit(3000),
    fetchMembersPortable(6000),
  ])

  if (bizError) return JSON.stringify({ error: bizError.message })
  if (deptError) return JSON.stringify({ error: deptError.message })
  if (membersResult.error) return JSON.stringify({ error: membersResult.error })
  if (!bizRows?.length) return JSON.stringify({ message: '未查询到可分析的经营数据', data: [] })

  const departments = (deptRows ?? []) as Array<Pick<DepartmentRow, 'department_id' | 'name' | 'parent_id' | 'member_count'>>
  const members = membersResult.data

  // Group by node_name and pivot metrics
  const nodeMetrics = new Map<string, Record<string, { actual: number | null; budget: number | null; completion: number | null }>>()

  for (const row of bizRows) {
    const nodeName = String((row as Record<string, unknown>).node_name ?? '')
    const metricCategory = String((row as Record<string, unknown>).metric_category ?? '')

    if (!nodeMetrics.has(nodeName)) {
      nodeMetrics.set(nodeName, {})
    }

    const metrics = nodeMetrics.get(nodeName)!
    metrics[metricCategory] = {
      actual: toNullableNumber((row as Record<string, unknown>).actual_value),
      budget: toNullableNumber((row as Record<string, unknown>).budget_value),
      completion: normalizeRate((row as Record<string, unknown>).completion_rate),
    }
  }

  const results = Array.from(nodeMetrics.entries()).map(([nodeName, metrics]) => {
    const matchedDepartments = departments.filter((d) => isLikelyNameMatch(nodeName, d.name))
    const matchedDeptIds = new Set(matchedDepartments.map((d) => d.department_id))
    const memberCountFromDept = matchedDepartments.reduce((sum, d) => sum + (d.member_count ?? 0), 0)
    const memberCountFromMembers = members.reduce((sum, m) => {
      const ids = extractMemberDeptIds(m)
      return ids.some((id) => matchedDeptIds.has(id)) ? sum + 1 : sum
    }, 0)
    const orgMemberCount = memberCountFromMembers > 0 ? memberCountFromMembers : memberCountFromDept

    const revenue = metrics.revenue
    const profit = metrics.pretax_profit
    const laborCost = metrics.labor_cost
    const headcount = metrics.headcount

    const actualRevenue = revenue?.actual
    const budgetRevenue = revenue?.budget
    const revenueRate = revenue?.completion
    const actualProfit = profit?.actual
    const budgetProfit = profit?.budget
    const profitRate = profit?.completion
    const actualLaborCost = laborCost?.actual
    const budgetLaborCost = laborCost?.budget
    const actualHeadcount = headcount?.actual
    const budgetHeadcount = headcount?.budget

    const revenueGap = actualRevenue != null && budgetRevenue != null ? budgetRevenue - actualRevenue : null
    const profitGap = actualProfit != null && budgetProfit != null ? budgetProfit - actualProfit : null
    const laborRate = actualRevenue != null && actualLaborCost != null && actualRevenue > 0 ? actualLaborCost / actualRevenue : null
    const budgetLaborRate = budgetRevenue != null && budgetLaborCost != null && budgetRevenue > 0 ? budgetLaborCost / budgetRevenue : null
    const costPressure = laborRate != null && budgetLaborRate != null ? laborRate - budgetLaborRate : null

    return {
      node_name: nodeName,
      org_member_count: orgMemberCount,
      matched_department_count: matchedDepartments.length,
      matched_department_names: matchedDepartments.map((d) => d.name),
      actual_revenue: actualRevenue,
      budget_revenue: budgetRevenue,
      revenue_gap: revenueGap,
      revenue_completion_rate: revenueRate,
      revenue_completion_rate_pct: revenueRate == null ? null : round(revenueRate * 100, 2),
      actual_profit: actualProfit,
      budget_profit: budgetProfit,
      profit_gap: profitGap,
      profit_completion_rate: profitRate,
      profit_completion_rate_pct: profitRate == null ? null : round(profitRate * 100, 2),
      actual_labor_cost_rate: laborRate,
      budget_labor_cost_rate: budgetLaborRate,
      cost_pressure: costPressure,
      cost_pressure_pct: costPressure == null ? null : round(costPressure * 100, 2),
      actual_headcount: actualHeadcount,
      budget_headcount: budgetHeadcount,
      headcount_diff: actualHeadcount != null && budgetHeadcount != null ? actualHeadcount - budgetHeadcount : null,
      revenue_per_member: round(safeDivide(actualRevenue, orgMemberCount) ?? 0, 2),
      profit_per_member: round(safeDivide(actualProfit, orgMemberCount) ?? 0, 2),
    }
  })

  const filteredMetrics = results.filter((m) => m.org_member_count >= minMemberCount)
  if (!filteredMetrics.length) {
    return JSON.stringify({
      message: `未找到满足最小人数门槛（${minMemberCount}）的联合分析数据`,
      data: [],
    })
  }

  const revenueGapRank = [...filteredMetrics]
    .filter((m) => m.revenue_gap != null)
    .sort((a, b) => (b.revenue_gap ?? 0) - (a.revenue_gap ?? 0))
    .slice(0, topN)

  const perCapitaProfitRank = [...filteredMetrics]
    .filter((m) => m.org_member_count > 0)
    .sort((a, b) => (b.profit_per_member ?? 0) - (a.profit_per_member ?? 0))
    .slice(0, topN)

  const costPressureRank = [...filteredMetrics]
    .filter((m) => m.cost_pressure != null)
    .sort((a, b) => (b.cost_pressure ?? 0) - (a.cost_pressure ?? 0))
    .slice(0, topN)

  const lowExecutionRisk = [...filteredMetrics]
    .filter((m) => (m.revenue_completion_rate ?? 1) < 0.85 || (m.profit_completion_rate ?? 1) < 0.85)
    .sort((a, b) => (a.revenue_completion_rate ?? 1) - (b.revenue_completion_rate ?? 1))
    .slice(0, topN)

  const focusData = focus === 'revenue_gap'
    ? revenueGapRank
    : focus === 'per_capita_profit'
      ? perCapitaProfitRank
      : focus === 'cost_pressure'
        ? costPressureRank
        : filteredMetrics.slice(0, topN)

  return JSON.stringify({
    summary: {
      focus,
      total_centers: filteredMetrics.length,
      matched_centers: filteredMetrics.filter((m) => m.matched_department_count > 0).length,
      unmatched_centers: filteredMetrics.filter((m) => m.matched_department_count === 0).map((m) => m.node_name),
      total_departments: departments.length,
      total_members: members.length,
    },
    insights: {
      top_revenue_gap: revenueGapRank,
      top_profit_per_member: perCapitaProfitRank,
      top_cost_pressure: costPressureRank,
      low_execution_risk: lowExecutionRisk,
    },
    data: focusData,
  })
}

async function queryOpportunities(args: Args): Promise<string> {
  const cols = coerceString(args.columns) || '*'

  let snapshotDate = coerceString(args.snapshot_date)
  if (!snapshotDate) {
    const { data: latest } = await supabase
      .from('opportunity_ledger')
      .select('snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(1)
    snapshotDate = latest?.[0]?.snapshot_date || ''
  }

  let query = supabase.from('opportunity_ledger').select(cols)
  if (snapshotDate) query = query.eq('snapshot_date', snapshotDate)
  const itemType = coerceString(args.item_type)
  if (itemType) query = query.eq('item_type', itemType)
  const status = coerceString(args.status)
  if (status) query = query.eq('status', status)
  const region = coerceString(args.region)
  if (region) query = query.ilike('region', `%${region}%`)
  const minAmount = coerceNumber(args.min_amount, -1)
  if (minAmount >= 0) query = query.gte('estimated_amount', minAmount)
  const limit = coerceNumber(args.limit, 100)
  const { data, error } = await query.order('estimated_amount', { ascending: false }).limit(limit)
  if (error) return JSON.stringify({ error: error.message })
  if (!data?.length) return JSON.stringify({ message: '未查询到数据', data: [] })
  return JSON.stringify({ snapshot_date: snapshotDate, total: data.length, data })
}

async function queryWorkItems(args: Args): Promise<string> {
  const cols = coerceString(args.columns) || '*'
  let query = supabase.from('work_items').select(cols)
  const status = coerceString(args.status)
  if (status) query = query.eq('status', status)
  const priority = coerceString(args.priority)
  if (priority) query = query.eq('priority', priority)
  const moduleId = coerceString(args.module_id)
  if (moduleId) query = query.eq('module_id', moduleId)
  const limit = coerceNumber(args.limit, 50)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit)
  if (error) return JSON.stringify({ error: error.message })
  if (!data?.length) return JSON.stringify({ message: '未查询到数据', data: [] })
  return JSON.stringify({ total: data.length, data })
}

async function querySchedules(args: Args): Promise<string> {
  const cols = coerceString(args.columns) || '*'
  let query = supabase.from('schedule_items').select(cols)
  const dateFrom = coerceString(args.date_from)
  if (dateFrom) query = query.gte('date', dateFrom)
  const dateTo = coerceString(args.date_to)
  if (dateTo) query = query.lte('date', dateTo)
  const type = coerceString(args.type)
  if (type) query = query.eq('type', type)
  if (args.has_notes === 'true') query = query.not('meeting_notes', 'is', null)
  const limit = coerceNumber(args.limit, 50)
  const { data, error } = await query.order('date', { ascending: false }).limit(limit)
  if (error) return JSON.stringify({ error: error.message })
  if (!data?.length) return JSON.stringify({ message: '未查询到数据', data: [] })
  return JSON.stringify({ total: data.length, data })
}

async function queryAttendance(args: Args): Promise<string> {
  const cols = coerceString(args.columns) || '*'
  let query = supabase.from('attendance_records').select(cols.includes('feishu_members') ? cols : `${cols === '*' ? '*' : cols},feishu_members:member_id(name,employee_no,job_title,department_id)`)
  const yearMonth = coerceNumber(args.year_month, -1)
  if (yearMonth > 0) query = query.eq('year_month', yearMonth)
  const employeeName = coerceString(args.employee_name)
  if (employeeName) query = query.ilike('feishu_members.name', `%${employeeName}%`)
  const limit = coerceNumber(args.limit, 100)
  const { data, error } = await query.order('year_month', { ascending: false }).limit(limit)
  if (error) return JSON.stringify({ error: error.message })
  if (!data?.length) return JSON.stringify({ message: '未查询到数据', data: [] })
  let filtered = data as unknown[]
  const minRate = coerceNumber(args.min_attendance_rate, -1)
  const maxRate = coerceNumber(args.max_attendance_rate, -1)
  if (minRate >= 0 || maxRate >= 0) {
    filtered = (data as unknown[]).filter((r) => {
      const record = r as Record<string, unknown>
      const expectedDays = Number(record.expected_days) || 0
      const actualDays = Number(record.actual_days) || 0
      const rate = expectedDays > 0 ? (actualDays / expectedDays) * 100 : 0
      if (minRate >= 0 && rate < minRate) return false
      if (maxRate >= 0 && rate > maxRate) return false
      return true
    })
  }
  return JSON.stringify({ total: filtered.length, data: filtered })
}

async function queryTrips(args: Args): Promise<string> {
  const cols = coerceString(args.columns) || '*'
  let query = supabase.from('business_trips').select(cols)
  const employeeName = coerceString(args.employee_name)
  if (employeeName) query = query.ilike('employee_name', `%${employeeName}%`)
  const department = coerceString(args.department)
  if (department) query = query.ilike('department', `%${department}%`)
  const customerName = coerceString(args.customer_name)
  if (customerName) query = query.ilike('customer_name', `%${customerName}%`)
  const opportunityName = coerceString(args.opportunity_name)
  if (opportunityName) query = query.ilike('opportunity_name', `%${opportunityName}%`)
  const startDateFrom = coerceString(args.start_date_from)
  if (startDateFrom) query = query.gte('start_time', startDateFrom)
  const startDateTo = coerceString(args.start_date_to)
  if (startDateTo) query = query.lte('start_time', startDateTo)
  const limit = coerceNumber(args.limit, 100)
  const { data, error } = await query.order('start_time', { ascending: false }).limit(limit)
  if (error) return JSON.stringify({ error: error.message })
  if (!data?.length) return JSON.stringify({ message: '未查询到数据', data: [] })
  let filtered = data as unknown[]
  const minDays = coerceNumber(args.min_days, -1)
  if (minDays > 0) {
    filtered = (data as unknown[]).filter((r) => {
      const record = r as Record<string, unknown>
      const endTime = record.end_time as string
      const startTime = record.start_time as string
      const days = Math.ceil((new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60 * 60 * 24))
      return days >= minDays
    })
  }
  return JSON.stringify({ total: filtered.length, data: filtered })
}

async function webSearch(args: Args, tavilyApiKey?: string): Promise<string> {
  if (!tavilyApiKey) {
    return JSON.stringify({ error: '未配置 Tavily API Key，请在「设置」页面添加。免费申请：https://tavily.com/' })
  }
  const query = coerceString(args.query)
  if (!query) return JSON.stringify({ error: '请提供搜索关键词' })
  const maxResults = Math.min(Math.max(coerceNumber(args.count, 5), 1), 20)
  const resp = await appFetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: tavilyApiKey,
      query,
      max_results: maxResults,
      search_depth: 'basic',
      include_answer: true,
    }),
  })
  if (!resp.ok) {
    return JSON.stringify({ error: `搜索请求失败: ${resp.status} ${resp.statusText}` })
  }
  const json = await resp.json()
  const results = (json.results || []).map((r: { title?: string; content?: string; url?: string }) => ({
    title: r.title,
    snippet: r.content,
    url: r.url,
  }))
  return JSON.stringify({
    answer: json.answer || null,
    total: results.length,
    results,
  })
}

const EXECUTORS: Record<string, (args: Args) => Promise<string>> = {
  query_biz_data: queryBizData,
  query_org_data: queryOrgData,
  analyze_biz_org_insights: analyzeBizOrgInsights,
  query_opportunities: queryOpportunities,
  query_work_items: queryWorkItems,
  query_schedules: querySchedules,
  query_attendance: queryAttendance,
  query_trips: queryTrips,
}

export async function executeTool(
  name: string,
  args: Args,
  opts?: { tavilyApiKey?: string; sessionId?: string },
): Promise<string> {
  const { tavilyApiKey, sessionId } = opts ?? {}
  try {
    if (name === 'web_search') return await webSearch(args, tavilyApiKey)
    if (name === 'save_memory') {
      const mem: AgentMemory = {
        id: crypto.randomUUID(),
        content: String(args.content || ''),
        category: (args.category as AgentMemory['category']) || 'insight',
        keywords: String(args.keywords || '').split(',').map(s => s.trim()).filter(Boolean),
        sessionId: sessionId || '',
        createdAt: Date.now(),
      }
      saveMemory(mem)
      return JSON.stringify({ success: true, id: mem.id })
    }
    if (name === 'recall_memory') {
      const results = searchMemories(String(args.query || ''))
      return JSON.stringify({ total: results.length, memories: results.slice(0, 10) })
    }
    const executor = EXECUTORS[name]
    if (!executor) return JSON.stringify({ error: `未知工具: ${name}` })
    return await executor(args)
  } catch (e) {
    return JSON.stringify({ error: `工具执行失败: ${e instanceof Error ? e.message : String(e)}` })
  }
}
