import { supabase } from '@/lib/supabase'

interface DataMeta {
  centers: string[]
  fiscalYear: string | null
  lowRevenueNodes: string[]
  highProfitNodes: string[]
  opportunityCount: number
  trackingCount: number
  biddingCount: number
}

async function fetchDataMeta(): Promise<DataMeta> {
  const meta: DataMeta = {
    centers: [],
    fiscalYear: null,
    lowRevenueNodes: [],
    highProfitNodes: [],
    opportunityCount: 0,
    trackingCount: 0,
    biddingCount: 0,
  }

  // Get centers (level 1 = has center, no biz_class)
  const { data: l1 } = await supabase
    .from('edu_logistics_biz_data')
    .select('node_name,revenue_completion_rate,profit_completion_rate')
    .not('center', 'is', null)
    .is('biz_class', null)
    .limit(20)

  if (l1?.length) {
    meta.centers = l1.map(r => r.node_name)
    meta.fiscalYear = '2025'
    meta.lowRevenueNodes = l1
      .filter(r => r.revenue_completion_rate != null && r.revenue_completion_rate < 0.85)
      .map(r => r.node_name)
    meta.highProfitNodes = l1
      .filter(r => r.profit_completion_rate != null && r.profit_completion_rate >= 0.90)
      .map(r => r.node_name)
  }

  // Get opportunity stats
  const { data: opps } = await supabase
    .from('opportunity_ledger')
    .select('status')
    .limit(500)

  if (opps?.length) {
    meta.opportunityCount = opps.length
    meta.trackingCount = opps.filter(o => o.status === 'tracking').length
    meta.biddingCount = opps.filter(o => o.status === 'bidding').length
  }

  return meta
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export async function generateSuggestedQuestions(count = 8): Promise<string[]> {
  const meta = await fetchDataMeta()
  const pool: string[] = []

  // General questions (always available)
  pool.push(
    '本年度整体经营情况如何？有哪些风险点？',
    '各中心的利润率表现排名如何？给出优化建议',
    '人力成本率最高的部门是哪些？如何优化？',
    '毛利率同比变化最大的业务板块有哪些？',
    '哪些业务单位的预算执行偏差最大？',
    '各区域的营收贡献占比是怎样的？',
    '在岗人数与预算人数差异最大的部门有哪些？',
  )

  // Center-specific questions
  if (meta.centers.length > 0) {
    const c1 = pick(meta.centers)
    const c2 = pick(meta.centers.filter(c => c !== c1) || meta.centers)
    pool.push(
      `${c1}的经营数据详细分析，包括营收、利润和成本情况`,
      `对比${c1}和${c2}的经营表现，哪个更优？`,
      `${c1}下属各业务单位的达成率排名`,
    )
  }

  // Low revenue nodes
  if (meta.lowRevenueNodes.length > 0) {
    const node = pick(meta.lowRevenueNodes)
    pool.push(
      `${node}营收达成率偏低，深入分析原因和改进建议`,
      `哪些业务板块营收达成率低于80%？如何弥补缺口？`,
    )
  }

  // High profit nodes
  if (meta.highProfitNodes.length > 0) {
    const node = pick(meta.highProfitNodes)
    pool.push(`${node}利润表现突出，分析其成功经验和可复制性`)
  }

  // Opportunity questions
  if (meta.opportunityCount > 0) {
    pool.push(
      '当前有哪些高价值商机？转化情况如何？',
      '商机管道各阶段的分布情况，转化瓶颈在哪里？',
      `当前共${meta.opportunityCount}个商机，按金额排名前10的是哪些？`,
    )
    if (meta.trackingCount > 0) {
      pool.push(`有${meta.trackingCount}个商机处于跟踪阶段，哪些最有可能转化？`)
    }
    if (meta.biddingCount > 0) {
      pool.push(`有${meta.biddingCount}个商机在投标中，预计中标金额是多少？`)
    }
  }

  // Fiscal year specific
  if (meta.fiscalYear) {
    pool.push(`${meta.fiscalYear}年度经营目标完成进度如何？能否达标？`)
  }

  // Cross-domain questions
  pool.push(
    '结合经营数据和商机情况，给出下季度重点工作建议',
    '哪些区域的经营缺口可以通过现有商机弥补？',
    '当前团队工作重点是什么？有哪些高优先级任务？',
  )

  // Web search questions
  pool.push(
    '搜索最新的后勤服务行业政策法规，分析对我们的影响',
    '查找团餐行业市场规模和发展趋势',
    '搜索物业管理行业最新动态和竞争格局',
  )

  return shuffle(pool).slice(0, count)
}
