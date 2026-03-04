import { supabase } from '@/lib/supabase'
import type { ToolDefinition, AgentMemory } from './types'
import { saveMemory, searchMemories } from './memory'

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'query_biz_data',
    description: '查询教育后勤经营数据。可按节点名称、所属中心、板块分类、组织标签筛选。支持指定返回字段以减少数据量。数据共约428条。层级通过 center/biz_class/org_tag 判断：center为空=合计，biz_class为空=中心级，org_tag有值=业务单位。百分比字段以小数存储（0.75=75%）。',
    parameters: {
      type: 'object',
      properties: {
        node_name: { type: 'string', description: '节点名称，支持模糊匹配' },
        center: { type: 'string', description: '所属中心名称，支持模糊匹配。如 "后勤管理中心"、"三大区域"' },
        biz_class: { type: 'string', description: '板块业务分类，支持模糊匹配。如 "西南区域"、"教育园特色餐饮"' },
        org_tag: { type: 'string', description: '组织标签（最末级业务单位），支持模糊匹配' },
        level: { type: 'string', description: '层级筛选：total=合计(center为空), center=中心级(有center无biz_class), biz_class=板块级, unit=最末级(有org_tag)', enum: ['total', 'center', 'biz_class', 'unit'] },
        columns: { type: 'string', description: '需要返回的字段，逗号分隔。如 "node_name,center,actual_revenue,budget_revenue,revenue_completion_rate"。不传则返回全部字段。建议只选需要的字段以提高效率。' },
        limit: { type: 'number', description: '返回条数上限，默认200' },
      },
    },
  },
  {
    name: 'query_opportunities',
    description: '查询商机项目台账。包含项目名称、预估金额、状态、中标概率、区域等信息。默认返回最新快照日期的数据。可用于分析商机管道和转化情况。支持指定返回字段。',
    parameters: {
      type: 'object',
      properties: {
        snapshot_date: { type: 'string', description: '快照日期(YYYY-MM-DD)，不传则自动使用最新日期' },
        item_type: { type: 'string', description: '商机类型', enum: ['operation', 'expansion', 'tracking'] },
        status: { type: 'string', description: '商机状态', enum: ['tracking', 'bidding', 'contracted', 'operating', 'suspended', 'lost'] },
        region: { type: 'string', description: '区域名称，支持模糊匹配' },
        min_amount: { type: 'number', description: '最小预估金额（万元）' },
        columns: { type: 'string', description: '需要返回的字段，逗号分隔。不传则返回全部字段。' },
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
    description: '查询日程安排和会议纪要。包含日程标题、日期、时段（上午/下午/晚上）、类型、地点、会议纪要等。可用于了解用户的日程安排和会议决议。',
    parameters: {
      type: 'object',
      properties: {
        date_from: { type: 'string', description: '起始日期，如 "2025-06-01"' },
        date_to: { type: 'string', description: '结束日期，如 "2025-06-30"' },
        type: { type: 'string', description: '日程类型', enum: ['meeting', 'business', 'routine', 'urgent'] },
        has_notes: { type: 'string', description: '是否有会议纪要，传 "true" 只返回有纪要的日程' },
        columns: { type: 'string', description: '需要返回的字段，逗号分隔。不传则返回全部字段。' },
        limit: { type: 'number', description: '返回条数上限，默认50' },
      },
    },
  },
  {
    name: 'query_attendance',
    description: '查询员工考勤数据。包含应出勤天数、实出勤天数、请假天数、旷工天数、迟到早退次数等。可按部门、月份分析考勤情况和出勤率。支持指定返回字段。',
    parameters: {
      type: 'object',
      properties: {
        year_month: { type: 'number', description: '年月，如 202601 表示2026年1月' },
        department: { type: 'string', description: '部门名称，支持模糊匹配' },
        employee_name: { type: 'string', description: '员工姓名，支持模糊匹配' },
        min_attendance_rate: { type: 'number', description: '最低出勤率（0-100），筛选出勤率高于此值的记录' },
        max_attendance_rate: { type: 'number', description: '最高出勤率（0-100），筛选出勤率低于此值的记录' },
        columns: { type: 'string', description: '需要返回的字段，逗号分隔。不传则返回全部字段。' },
        limit: { type: 'number', description: '返回条数上限，默认100' },
      },
    },
  },
  {
    name: 'query_trips',
    description: '查询员工出差记录。包含出差人员、部门、客户、商机、出发/返回时间、出差天数、事由等。可用于分析出差频率、客户拜访情况、出差成本等。支持指定返回字段。',
    parameters: {
      type: 'object',
      properties: {
        employee_name: { type: 'string', description: '员工姓名，支持模糊匹配' },
        department: { type: 'string', description: '部门名称，支持模糊匹配' },
        customer_name: { type: 'string', description: '客户名称，支持模糊匹配' },
        opportunity_name: { type: 'string', description: '商机名称，支持模糊匹配' },
        start_date_from: { type: 'string', description: '出发日期起始，如 "2026-01-01"' },
        start_date_to: { type: 'string', description: '出发日期结束，如 "2026-01-31"' },
        min_days: { type: 'number', description: '最少出差天数' },
        columns: { type: 'string', description: '需要返回的字段，逗号分隔。不传则返回全部字段。' },
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

async function queryBizData(args: Args): Promise<string> {
  const cols = typeof args.columns === 'string' ? args.columns : '*'
  let query = supabase.from('edu_logistics_biz_data').select(cols)
  if (args.node_name) query = query.ilike('node_name', `%${args.node_name}%`)
  if (args.center) query = query.ilike('center', `%${args.center}%`)
  if (args.biz_class) query = query.ilike('biz_class', `%${args.biz_class}%`)
  if (args.org_tag) query = query.ilike('org_tag', `%${args.org_tag}%`)
  if (args.level === 'total') query = query.is('center', null)
  else if (args.level === 'center') query = query.not('center', 'is', null).is('biz_class', null)
  else if (args.level === 'biz_class') query = query.not('biz_class', 'is', null)
  else if (args.level === 'unit') query = query.not('org_tag', 'is', null)
  const limit = typeof args.limit === 'number' ? args.limit : 200
  const { data, error } = await query.limit(limit)
  if (error) return JSON.stringify({ error: error.message })
  if (!data?.length) return JSON.stringify({ message: '未查询到数据', data: [] })
  return JSON.stringify({ total: data.length, data })
}

async function queryOpportunities(args: Args): Promise<string> {
  const cols = typeof args.columns === 'string' ? args.columns : '*'

  // 如果没有指定快照日期，先获取最新的快照日期
  let snapshotDate = args.snapshot_date
  if (!snapshotDate) {
    const { data: latest } = await supabase
      .from('opportunity_ledger')
      .select('snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(1)
    snapshotDate = latest?.[0]?.snapshot_date
  }

  let query = supabase.from('opportunity_ledger').select(cols)
  if (snapshotDate) query = query.eq('snapshot_date', snapshotDate)
  if (args.item_type) query = query.eq('item_type', args.item_type)
  if (args.status) query = query.eq('status', args.status)
  if (args.region) query = query.ilike('region', `%${args.region}%`)
  if (typeof args.min_amount === 'number') query = query.gte('estimated_amount', args.min_amount)
  const limit = typeof args.limit === 'number' ? args.limit : 100
  const { data, error } = await query.order('estimated_amount', { ascending: false }).limit(limit)
  if (error) return JSON.stringify({ error: error.message })
  if (!data?.length) return JSON.stringify({ message: '未查询到数据', data: [] })
  return JSON.stringify({ snapshot_date: snapshotDate, total: data.length, data })
}

async function queryWorkItems(args: Args): Promise<string> {
  const cols = typeof args.columns === 'string' ? args.columns : '*'
  let query = supabase.from('work_items').select(cols)
  if (args.status) query = query.eq('status', args.status)
  if (args.priority) query = query.eq('priority', args.priority)
  if (args.module_id) query = query.eq('module_id', args.module_id)
  const limit = typeof args.limit === 'number' ? args.limit : 50
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit)
  if (error) return JSON.stringify({ error: error.message })
  if (!data?.length) return JSON.stringify({ message: '未查询到数据', data: [] })
  return JSON.stringify({ total: data.length, data })
}

async function querySchedules(args: Args): Promise<string> {
  const cols = typeof args.columns === 'string' ? args.columns : '*'
  let query = supabase.from('schedule_items').select(cols)
  if (args.date_from) query = query.gte('date', args.date_from)
  if (args.date_to) query = query.lte('date', args.date_to)
  if (args.type) query = query.eq('type', args.type)
  if (args.has_notes === 'true') query = query.not('meeting_notes', 'is', null)
  const limit = typeof args.limit === 'number' ? args.limit : 50
  const { data, error } = await query.order('date', { ascending: false }).limit(limit)
  if (error) return JSON.stringify({ error: error.message })
  if (!data?.length) return JSON.stringify({ message: '未查询到数据', data: [] })
  return JSON.stringify({ total: data.length, data })
}

async function queryAttendance(args: Args): Promise<string> {
  const cols = typeof args.columns === 'string' ? args.columns : '*'
  let query = supabase.from('attendance_records').select(cols.includes('employees') ? cols : `${cols === '*' ? '*' : cols},employees(name,department,company)`)
  if (args.year_month) query = query.eq('year_month', args.year_month)
  if (args.department) query = query.ilike('employees.department', `%${args.department}%`)
  if (args.employee_name) query = query.ilike('employees.name', `%${args.employee_name}%`)
  const limit = typeof args.limit === 'number' ? args.limit : 100
  const { data, error } = await query.order('year_month', { ascending: false }).limit(limit)
  if (error) return JSON.stringify({ error: error.message })
  if (!data?.length) return JSON.stringify({ message: '未查询到数据', data: [] })
  let filtered = data
  if (typeof args.min_attendance_rate === 'number' || typeof args.max_attendance_rate === 'number') {
    filtered = data.filter(r => {
      const rate = r.expected_days > 0 ? (r.actual_days / r.expected_days) * 100 : 0
      if (typeof args.min_attendance_rate === 'number' && rate < args.min_attendance_rate) return false
      if (typeof args.max_attendance_rate === 'number' && rate > args.max_attendance_rate) return false
      return true
    })
  }
  return JSON.stringify({ total: filtered.length, data: filtered })
}

async function queryTrips(args: Args): Promise<string> {
  const cols = typeof args.columns === 'string' ? args.columns : '*'
  let query = supabase.from('business_trips').select(cols)
  if (args.employee_name) query = query.ilike('employee_name', `%${args.employee_name}%`)
  if (args.department) query = query.ilike('department', `%${args.department}%`)
  if (args.customer_name) query = query.ilike('customer_name', `%${args.customer_name}%`)
  if (args.opportunity_name) query = query.ilike('opportunity_name', `%${args.opportunity_name}%`)
  if (args.start_date_from) query = query.gte('start_time', args.start_date_from)
  if (args.start_date_to) query = query.lte('start_time', args.start_date_to)
  const limit = typeof args.limit === 'number' ? args.limit : 100
  const { data, error } = await query.order('start_time', { ascending: false }).limit(limit)
  if (error) return JSON.stringify({ error: error.message })
  if (!data?.length) return JSON.stringify({ message: '未查询到数据', data: [] })
  let filtered = data
  if (typeof args.min_days === 'number') {
    filtered = data.filter(r => {
      const days = Math.ceil((new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / (1000 * 60 * 60 * 24))
      return days >= args.min_days
    })
  }
  return JSON.stringify({ total: filtered.length, data: filtered })
}

async function webSearch(args: Args, tavilyApiKey?: string): Promise<string> {
  if (!tavilyApiKey) {
    return JSON.stringify({ error: '未配置 Tavily API Key，请在「设置」页面添加。免费申请：https://tavily.com/' })
  }
  const query = String(args.query || '')
  if (!query) return JSON.stringify({ error: '请提供搜索关键词' })
  const maxResults = Math.min(Math.max(Number(args.count) || 5, 1), 20)
  const resp = await fetch('https://api.tavily.com/search', {
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
