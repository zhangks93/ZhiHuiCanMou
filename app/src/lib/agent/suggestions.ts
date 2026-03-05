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
    meta.fiscalYear = '2026'
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
    '三大区域营收达成率仅62%，深入分析原因和改进路径',
    '对比后勤管理中心和商业业务的盈利能力，哪个更优？',
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
      '20个跟踪中商机总额2.02亿，平均中标率58%，哪些最值得重点投入？',
      '分析已签约和运营中的商机特征，总结成功经验',
      '哪些区域的商机密度最高？与经营缺口如何匹配？',
    )
    if (meta.trackingCount > 0) {
      pool.push(
        `有${meta.trackingCount}个商机处于跟踪阶段，哪些最有可能转化？`,
        '跟踪中商机的平均中标率58%，如何提升转化效率？',
      )
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
    '结合组织部门人数与经营结果，识别人效最高和最低的中心',
    '按部门规模对比各中心的人均营收、人均利润，给出优化建议',
    '哪些中心出现”人员增加但利润达成下降”？请定位风险点',
    '891名员工创造2.67亿营收，人均产出30万，行业水平如何？',
    '结合商机管道2.02亿和经营缺口，Q2能否达成全年目标？',
  )

  // Attendance questions
  pool.push(
    '2026年1月考勤数据分析：9109天实际出勤，856次迟到，整体情况如何？',
    '哪些部门或员工的出勤率低于80%？原因是什么？',
    '迟到早退最频繁的部门是哪些？如何改善？',
    '请假天数最多的员工有哪些？是否影响业务？',
    '对比各部门的出勤率和业绩达成率，是否有关联？',
  )

  // Trip questions
  pool.push(
    '2026年1-3月出差趋势分析：1月33次（平均4.7天），2月7次，3月4次，为何波动？',
    '分析出差与商机的关联，哪些客户拜访频率最高？',
    '9名员工拜访13个客户，人均出差负荷如何？是否合理？',
    '人均出差天数最多的部门是哪个？成本如何？',
    '出差超过5天的记录有哪些？事由是什么？',
    '哪些商机投入了最多的出差资源？ROI如何？',
  )

  // Combined analysis questions
  pool.push(
    '结合考勤和出差数据，分析团队工作强度和工作饱和度',
    '出差频繁的员工考勤情况如何？是否有异常？',
    '结合经营数据、商机管道、出差投入，给出Q2重点工作建议',
    '哪些中心的经营缺口可以通过现有商机弥补？匹配度如何？',
    '891名员工分布在242个部门，人均产出最高和最低的是哪些？',
    '三大区域营收缺口大，当前商机能否支撑目标达成？',
  )

  // Web search questions
  pool.push(
    '搜索2026年后勤服务行业最新政策法规，分析对我们的影响',
    '查找团餐行业市场规模和发展趋势，对标行业标杆',
    '搜索物业管理行业最新动态和竞争格局',
    '搜索高校后勤社会化改革最新进展，有哪些新机会？',
    '查找教育后勤行业人效标杆数据，对比我们的差距',
  )

  return shuffle(pool).slice(0, count)
}
