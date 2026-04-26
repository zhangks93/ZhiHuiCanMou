# financial-analysis Skill P0/P1 代码整改计划（给 Codex）

> 目标：把当前 `financial-analysis` skill 从“通用经营问答/财务分析模板”升级为“可稳定生成接近业务人员真实月度经营分析报告的报告型 Agent”。
>
> 重要边界：本轮不接入新的应收、资金计划、核心费用明细数据表。因为业务侧暂时取不到这些数据，报告最终输出时必须保留人工补充占位，不得编造。不要新增 `edu_receivable_collection`、`edu_cash_plan_execution`、`edu_core_expense_spend` 表，也不要新增对应 Supabase 查询工具。

---

## 1. 背景与目标

上传的业务样例 PDF 是“后勤集团经营分析”类真实经营分析报告，其结构不是通用财务报告，而是典型管理汇报材料：

1. 对标后勤集团考核努力目标的经营情况
2. 实际情况
3. 应收账款回款情况
4. 资金计划执行情况
5. 当月核心费用支出情况

该报告的特征：

- 章节结构固定，且围绕业务管理动作展开。
- 表格先行，再输出数据判断、原因、风险和关注动作。
- 同时使用目标、实际、完成率、差额、全年目标/努力目标、剩余缺口等字段。
- 按集团总表、明细构成、区域/中心小表、当月情况表拆解。
- 专项章节（应收、资金、核心费用）目前系统无法自动取数，应输出人工补充占位表。

当前代码已经具备 `query_with_hierarchy`、`query_monthly_plan`、`query_biz_data` 等基础查数能力，但缺少“报告专用数据包”，导致模型需要多次调用工具、自己拼表、自己算排行，稳定性差且容易被工具结果压缩截断。本次整改的核心是新增 `query_business_report_pack`，让工具层一次性整理报告所需经营数据，LLM 负责写作和解释。

---

## 2. 本轮范围

### 2.1 做什么

P0：必须完成。

- 重构完整报告模板 `biz-analysis-report.md`，改成与业务样例 PDF 同构的报告结构。
- 修改 `prompt.md`，让“完整经营分析报告/月报/汇报材料”进入自动报告流程，不再逐项确认每个读取、查数和写作动作。
- 新增报告专用工具 `query_business_report_pack`，基于现有 `edu_biz_report`、`edu_biz_monthly_plan`、`edu_org_hierarchy` 整理报告数据包。
- 注册新工具到 skill、runtime loader、tool registry。
- 修改工具结果压缩策略，确保报告包不会被截断到只剩少量节点。
- 新增/调整 artifact 保存逻辑，尽量保存原始报告包，便于后续续写或复核。

P1：应该完成。

- 新增真实报告风格规范、质量自审 rubric、数据覆盖说明三个 reference 文件。
- 修改 `skills/index.ts` 引入这些 reference。
- 修改 `report-generation.md`，强制报告按“业务报告”方式输出，不输出泛化摘要。
- 修改 session/runtime context，使新工具和新增 reference 能被识别、复用。
- 在最终报告里对“应收账款回款、资金计划执行、核心费用支出”输出人工补充占位表。

### 2.2 不做什么

本轮明确不做：

- 不新增应收回款数据库表。
- 不新增资金计划执行数据库表。
- 不新增核心费用支出数据库表。
- 不新增 `query_receivable_collection`、`query_cash_plan_execution`、`query_core_expense` 三个工具。
- 不伪造应收、资金、核心费用明细数据。
- 不把专项章节直接删掉。应保留章节和占位表，方便业务人员人工补充。

---

## 3. 当前代码落点

相关文件路径：

```text
app/src/shared/lib/agent/skills/financial-analysis/skill.json
app/src/shared/lib/agent/skills/financial-analysis/prompt.md
app/src/shared/lib/agent/skills/financial-analysis/assets/biz-analysis-report.md
app/src/shared/lib/agent/skills/financial-analysis/references/report-generation.md
app/src/shared/lib/agent/skills/financial-analysis/runtimeContext.ts
app/src/shared/lib/agent/skills/financial-analysis/sessionContext.ts
app/src/shared/lib/agent/skills/index.ts

app/src/shared/lib/agent/tools/queryWithHierarchy.ts
app/src/shared/lib/agent/tools/queryMonthlyPlan.ts
app/src/shared/lib/agent/tools/queryBizData.ts
app/src/shared/lib/agent/tools/toolRegistry.ts
app/src/shared/lib/agent/tools/index.ts

app/src/shared/lib/agent/runtimeLoader.ts
app/src/shared/lib/agent/chatAgent.ts
app/src/shared/lib/agent/conversationMemory.ts
app/src/shared/lib/agent/types.ts

app/src/features/biz-data/services/bizDataService.ts
app/src/features/biz-data/types.ts
app/src/shared/lib/supabase.ts
```

现有可复用能力：

- `fetchBizReport()`：分页读取 `edu_biz_report`，支持 `period`、`periodType`、`reportTypes`、`sheetCodes`。
- `fetchMonthlyPlan()`：读取 `edu_biz_monthly_plan`。
- `aggregateByNode()`：按组织节点聚合 fone/tuwei 指标，并挂接月度计划。
- `buildNestedHierarchy()` / `buildNestedSubtree()`：生成树状组织结构。
- `findHierarchyNodeMatches()`：组织节点模糊匹配。
- `MetricCategory` 已包含核心经营指标和部分费用指标。

---

## 4. P0-1：新增报告专用类型文件

新增文件：

```text
app/src/shared/lib/agent/tools/reportPackTypes.ts
```

建议内容：

```ts
import type { MetricCategory } from '@/features/biz-data/types'

export type ReportType = 'fone' | 'tuwei'
export type PeriodScope = 'monthly' | 'cumulative'
export type ReportStatus = 'good' | 'watch' | 'risk' | 'missing'
export type WarningSeverity = 'red' | 'yellow' | 'info'

export interface ReportMetricValue {
  metric: MetricCategory
  metric_label: string
  actual: number | null
  target: number | null
  completion_rate: number | null
  diff: number | null
  yoy: number | null
  mom?: number | null
}

export interface SummaryCard extends ReportMetricValue {
  report_type: ReportType
  period_scope: PeriodScope
  status: ReportStatus
}

export interface TargetVsActualRow {
  report_type: ReportType
  period_scope: PeriodScope
  node_name: string
  revenue_actual: number | null
  revenue_target: number | null
  revenue_completion_rate: number | null
  revenue_diff: number | null
  pretax_profit_actual: number | null
  pretax_profit_target: number | null
  pretax_profit_completion_rate: number | null
  pretax_profit_diff: number | null
}

export interface CompositionRow {
  level_1: string | null
  level_2: string | null
  node_name: string
  node_kind: string
  revenue_actual: number | null
  revenue_share: number | null
  revenue_completion_rate: number | null
  pretax_profit_actual: number | null
  pretax_profit_share: number | null
  pretax_profit_completion_rate: number | null
  business_judgement: string
}

export interface UnitCard {
  node_name: string
  node_kind: string
  level_1: string | null
  level_2: string | null
  cumulative: TargetVsActualRow
  monthly: TargetVsActualRow
  warnings: string[]
  suggested_analysis_points: string[]
}

export interface RankingRow {
  node_name: string
  node_kind?: string
  level_1?: string | null
  level_2?: string | null
  actual?: number | null
  share?: number | null
  diff?: number | null
  completion_rate?: number | null
}

export interface ManualFillSection {
  status: 'manual_required'
  heading: string
  reason: string
  instructions: string[]
  table_markdown: string
}

export interface BusinessReportWarning {
  severity: WarningSeverity
  section: string
  node_name?: string
  message: string
  evidence: Record<string, unknown>
}

export interface BusinessReportPack {
  metadata: {
    scope_name: string
    month: string
    previous_month: string
    cumulative_period: string
    generated_at: string
    unit: '万元'
  }
  coverage: {
    core_biz_data: 'available' | 'partial' | 'missing'
    monthly_plan: 'available' | 'partial' | 'missing'
    receivables: 'manual_required'
    cash_plan: 'manual_required'
    core_expenses: 'manual_required'
    gaps: Array<{
      section: string
      field: string
      reason: string
      handling: 'manual_placeholder'
    }>
  }
  summary_cards: SummaryCard[]
  target_vs_actual_table: TargetVsActualRow[]
  composition_table: CompositionRow[]
  unit_cards: UnitCard[]
  monthly_actual_table: TargetVsActualRow[]
  variance_rankings: {
    revenue_gap_top: RankingRow[]
    profit_gap_top: RankingRow[]
    revenue_contribution_top: RankingRow[]
    profit_contribution_top: RankingRow[]
  }
  manual_fill_sections: {
    receivables: ManualFillSection
    cash_plan: ManualFillSection
    core_expenses: ManualFillSection
  }
  warnings: BusinessReportWarning[]
}
```

说明：

- `manual_fill_sections` 是本轮替代专项数据接入的关键设计。
- 报告最终必须渲染这些占位表。
- `coverage.receivables/cash_plan/core_expenses` 固定返回 `manual_required`，防止模型误以为可以自动生成。

---

## 5. P0-2：新增报告计算工具函数

新增文件：

```text
app/src/shared/lib/agent/tools/reportCalculations.ts
```

建议包含以下函数：

```ts
import type { MetricCategory } from '@/features/biz-data/types'
import type { ReportStatus } from './reportPackTypes'

export const DEFAULT_REPORT_METRICS: MetricCategory[] = [
  'revenue',
  'gross_profit',
  'gross_margin',
  'pretax_profit',
  'pretax_margin',
  'labor_cost',
  'salary',
  'social_insurance',
  'housing_fund',
  'labor_service_fee',
  'other_labor_cost',
  'catering_expense',
  'material_cost',
  'other_expense',
  'external_expense',
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

export const LOWER_IS_BETTER_METRICS = new Set<MetricCategory>([
  'labor_cost',
  'salary',
  'social_insurance',
  'housing_fund',
  'labor_service_fee',
  'other_labor_cost',
  'catering_expense',
  'material_cost',
  'other_expense',
  'external_expense',
  'vehicle_expense',
  'energy_expense',
  'travel_expense',
  'entertainment_expense',
])

export function inferPreviousMonth(month: string): string {
  const match = /^(\d{4})(\d{2})$/.exec(month)
  if (!match) return month
  const year = Number(match[1])
  const monthNo = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(monthNo) || monthNo < 1 || monthNo > 12) return month
  const previous = new Date(year, monthNo - 2, 1)
  return `${previous.getFullYear()}${String(previous.getMonth() + 1).padStart(2, '0')}`
}

export function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function diff(actual: number | null, target: number | null): number | null {
  if (actual == null || target == null) return null
  return actual - target
}

export function completion(actual: number | null, target: number | null): number | null {
  if (actual == null || target == null || target === 0) return null
  return actual / target
}

export function contributionShare(value: number | null, total: number | null): number | null {
  if (value == null || total == null || total === 0) return null
  return value / total
}

export function statusByCompletion(rate: number | null, lowerIsBetter = false): ReportStatus {
  if (rate == null) return 'missing'
  if (lowerIsBetter) {
    if (rate <= 1.0) return 'good'
    if (rate <= 1.1) return 'watch'
    return 'risk'
  }
  if (rate >= 0.95) return 'good'
  if (rate >= 0.8) return 'watch'
  return 'risk'
}

export function formatPctForJudgement(rate: number | null): string {
  if (rate == null) return '无数据'
  return `${(rate * 100).toFixed(0)}%`
}
```

注意：

- 百分比在数据包里保持小数，例如 `0.84`，不要在工具层转成字符串。
- 文案输出阶段由模型或前端展示为 `84%`。
- 费用类指标是“低于或等于预算更好”，不要简单用完成率高低判断好坏。

---

## 6. P0-3：新增主工具 `queryBusinessReportPack.ts`

新增文件：

```text
app/src/shared/lib/agent/tools/queryBusinessReportPack.ts
```

### 6.1 工具职责

该工具一次性返回完整月度经营分析报告的数据包。它只基于现有数据表：

- `edu_biz_report`
- `edu_biz_monthly_plan`
- `edu_org_hierarchy`

它必须同时覆盖：

- 当月 `monthly`
- 上月 `monthly`
- 累计 `cumulative`
- 年初预算口径 `fone`
- 突围考核口径 `tuwei`
- 集团/目标节点总表
- 明细构成表
- 区域/中心累计完成情况
- 当月完成情况
- 缺口排行、贡献排行
- 人工补充章节占位

### 6.2 工具参数

建议参数：

```ts
type QueryBusinessReportPackArgs = {
  node_name?: string
  month: string
  previous_month?: string
  cumulative_period: string
  report_types?: Array<'fone' | 'tuwei'>
  max_units?: number
}
```

工具 definition：

```ts
export const queryBusinessReportPackTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'query_business_report_pack',
      description:
        '生成完整月度经营分析报告所需的数据包。一次性返回 fone/tuwei、当月/上月/累计、组织构成、差异排行、风险预警和人工补充章节占位。适用于经营分析报告、月报、汇报材料。',
      parameters: {
        type: 'object',
        properties: {
          node_name: {
            type: 'string',
            description: '组织节点名称。传空字符串表示集团整体/整棵树。',
          },
          month: {
            type: 'string',
            description: '目标月份，必须使用 Runtime Data Context 中合法 monthly period，例如 202603。',
          },
          previous_month: {
            type: 'string',
            description: '上月月份。可不传，工具会从 month 推断，例如 202603 -> 202602。',
          },
          cumulative_period: {
            type: 'string',
            description: '累计期间，必须使用 Runtime Data Context 中合法 cumulative period。',
          },
          report_types: {
            type: 'array',
            description: '报表口径，默认同时返回 fone 和 tuwei。',
            items: { type: 'string', enum: ['fone', 'tuwei'] },
          },
          max_units: {
            type: 'number',
            description: '最多返回多少个 unit_cards，默认 60。',
          },
        },
        required: ['month', 'cumulative_period'],
      },
    },
  },
  execute: async (args) => {
    // implementation below
  },
}
```

### 6.3 工具实现思路

伪代码：

```ts
import type { RegisteredTool } from '../types'
import type { MetricCategory } from '@/features/biz-data/types'
import {
  aggregateByNode,
  buildNestedHierarchy,
  buildNestedSubtree,
  fetchBizReport,
  fetchMonthlyPlan,
  findHierarchyNodeMatches,
  getNodeKind,
} from '@/features/biz-data/services/bizDataService'
import { DEFAULT_REPORT_METRICS, inferPreviousMonth, contributionShare, statusByCompletion } from './reportCalculations'
import type { BusinessReportPack, ReportType } from './reportPackTypes'

function parseArgs(args: Record<string, unknown>) { ... }
function splitReportsByType(reports: EduBizReport[]) { ... }
function buildAggregatedNodes(reports: EduBizReport[], monthlyPlans: EduBizMonthlyPlan[]) { ... }
function findRootOrSubtree(nodes, nodeName) { ... }
function getMetric(node, metric, reportType) { ... }
function buildTargetVsActualRow(...) { ... }
function buildCompositionRows(...) { ... }
function buildUnitCards(...) { ... }
function buildRankings(...) { ... }
function buildManualFillSections() { ... }
function buildWarnings(...) { ... }

export const queryBusinessReportPackTool: RegisteredTool = {
  definition: { ... },
  execute: async (args) => {
    const parsed = parseArgs(args)
    if (!parsed.ok) return JSON.stringify({ error: parsed.message }, null, 2)

    const nodeName = parsed.node_name ?? ''
    const month = parsed.month
    const previousMonth = parsed.previous_month || inferPreviousMonth(month)
    const cumulativePeriod = parsed.cumulative_period
    const reportTypes = parsed.report_types?.length ? parsed.report_types : ['fone', 'tuwei']
    const maxUnits = parsed.max_units ?? 60

    const [monthReports, previousReports, cumulativeReports, monthlyPlans] = await Promise.all([
      fetchBizReport({ period: month, periodType: 'monthly', reportTypes }),
      fetchBizReport({ period: previousMonth, periodType: 'monthly', reportTypes }),
      fetchBizReport({ period: cumulativePeriod, periodType: 'cumulative', reportTypes }),
      fetchMonthlyPlan(),
    ])

    const monthNodes = aggregateReportNodes(monthReports, monthlyPlans)
    const previousNodes = aggregateReportNodes(previousReports, monthlyPlans)
    const cumulativeNodes = aggregateReportNodes(cumulativeReports, monthlyPlans)

    const monthRoot = resolveReportRoot(monthNodes, nodeName)
    const previousRoot = resolveReportRoot(previousNodes, nodeName)
    const cumulativeRoot = resolveReportRoot(cumulativeNodes, nodeName)

    if (!monthRoot && !cumulativeRoot) {
      return JSON.stringify({
        message: '未找到可用于生成报告的经营数据',
        query_echo: { node_name: nodeName, month, previous_month: previousMonth, cumulative_period: cumulativePeriod, report_types: reportTypes },
      }, null, 2)
    }

    const pack: BusinessReportPack = {
      metadata: {
        scope_name: getScopeName(cumulativeRoot || monthRoot, nodeName),
        month,
        previous_month: previousMonth,
        cumulative_period: cumulativePeriod,
        generated_at: new Date().toISOString(),
        unit: '万元',
      },
      coverage: buildCoverage({ monthReports, previousReports, cumulativeReports, monthlyPlans }),
      summary_cards: buildSummaryCards({ monthRoot, previousRoot, cumulativeRoot, reportTypes }),
      target_vs_actual_table: buildTargetVsActualTable({ monthRoot, cumulativeRoot, reportTypes }),
      composition_table: buildCompositionRows({ cumulativeRoot, reportType: 'tuwei' }),
      unit_cards: buildUnitCards({ monthRoot, previousRoot, cumulativeRoot, reportTypes, maxUnits }),
      monthly_actual_table: buildMonthlyActualTable({ monthRoot, reportTypes }),
      variance_rankings: buildRankings({ cumulativeRoot, reportType: 'tuwei' }),
      manual_fill_sections: buildManualFillSections(),
      warnings: buildWarnings({ monthRoot, cumulativeRoot, reportTypes }),
    }

    return JSON.stringify(pack, null, 2)
  },
}
```

### 6.4 关键实现细节

#### 6.4.1 聚合节点

```ts
function aggregateReportNodes(reports: EduBizReport[], monthlyPlans: EduBizMonthlyPlan[]) {
  const foneReports = reports.filter(row => row.report_type === 'fone')
  const tuweiReports = reports.filter(row => row.report_type === 'tuwei')
  return aggregateByNode(foneReports, tuweiReports, monthlyPlans)
}
```

#### 6.4.2 定位根节点

`node_name` 为空时，用 `buildNestedHierarchy(nodes)` 返回整棵树的第一个 total/root。`node_name` 不为空时，用 `findHierarchyNodeMatches()` 做匹配，再 `buildNestedSubtree()`。

```ts
function resolveReportRoot(nodes: EnrichedBizDataNode[], nodeName: string) {
  if (!nodes.length) return null

  if (!nodeName.trim()) {
    const roots = buildNestedHierarchy(nodes)
    return roots[0] ?? null
  }

  const matches = findHierarchyNodeMatches(nodes, nodeName)
  if (matches.length !== 1) {
    return null
  }

  return buildNestedSubtree(nodes, matches[0].node.node_name)
}
```

若匹配多个节点，不要随机选择。返回 `message: 匹配到多个组织节点` 和候选列表。

#### 6.4.3 获取口径指标

```ts
function getMetricSnapshot(node, metric: MetricCategory, reportType: ReportType) {
  const raw = node?.metrics?.[metric]
  if (!raw) {
    return { actual: null, target: null, completion_rate: null, diff: null, yoy: null }
  }

  return {
    actual: raw.actual ?? null,
    target: reportType === 'fone' ? raw.budget_fone ?? null : raw.budget_tuwei ?? null,
    completion_rate: reportType === 'fone' ? raw.completion_fone ?? null : raw.completion_tuwei ?? null,
    diff: reportType === 'fone' ? raw.diff_fone ?? null : raw.diff_tuwei ?? null,
    yoy: raw.yoy ?? null,
  }
}
```

#### 6.4.4 生成手工补充章节

```ts
function buildManualFillSections(): BusinessReportPack['manual_fill_sections'] {
  return {
    receivables: {
      status: 'manual_required',
      heading: '3. 应收账款回款情况',
      reason: '当前系统未接入应收账款、回款、账龄和合同维度数据，本章节需业务人员人工补充。',
      instructions: [
        '请补充项目/合同类别、期初/期末应收、当月应回款、当月已回款、未回款金额和风险原因。',
        '若存在逾期或回款率异常，请在风险等级列标注红色/黄色预警。',
      ],
      table_markdown: `| 项目 / 合同类别 | 期末应收余额 | 本月应回款 | 本月已回款 | 回款率 | 未回款金额 | 风险等级 | 原因/备注 |
|---|---:|---:|---:|---:|---:|---|---|
| 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 |`,
    },
    cash_plan: {
      status: 'manual_required',
      heading: '4. 资金计划执行情况',
      reason: '当前系统未接入资金计划预算、资金实际收支、现金净流量和奖惩测算数据，本章节需业务人员人工补充。',
      instructions: [
        '请区分基本盘/增长报或业务侧使用的资金计划分类。',
        '请补充预算、实际、差异率、奖惩金额、现金净流量和偏差原因。',
      ],
      table_markdown: `| 分类 | 月份 | 资金计划 | 实际资金收入/支出 | 差异率 | 奖惩金额 | 现金净流量 | 偏差原因 |
|---|---|---:|---:|---:|---:|---:|---|
| 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 |`,
    },
    core_expenses: {
      status: 'manual_required',
      heading: '5. 当月核心费用支出情况',
      reason: '当前系统未接入业务报告所需的核心费用明细，如办公用品费、咨询/维修/服务费等，本章节需业务人员人工补充。系统现有部分费用指标只能作为经营参考，不替代该专项表。',
      instructions: [
        '请按业务报告口径补充招待费、办公用品费、咨询/维修/服务费及其他重点费用。',
        '费用异常单元需补充原因、整改动作和后续关注人。',
      ],
      table_markdown: `| 分析单元 | 招待费 | 办公用品费 | 咨询/维修/服务费 | 其他重点费用 | 当月合计 | 预算/额度 | 偏差 | 风险判断 |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 |`,
    },
  }
}
```

#### 6.4.5 风险判断

工具层至少生成以下风险：

- 收入累计完成率低于 80%：红色预警。
- 利润累计完成率低于 80%：红色预警。
- 收入完成率 >= 90%，利润完成率 < 70%：利润转化风险。
- 当月利润为负：红色预警。
- 费用类指标超预算 10% 以上：黄色或红色预警。

示例：

```ts
function detectProfitConversionRisk(unit: UnitCard): string[] {
  const warnings: string[] = []
  const revenueRate = unit.cumulative.revenue_completion_rate
  const profitRate = unit.cumulative.pretax_profit_completion_rate

  if (revenueRate != null && profitRate != null && revenueRate >= 0.9 && profitRate < 0.7) {
    warnings.push('收入完成进度相对正常，但税前利润完成明显不足，存在利润转化风险')
  }

  return warnings
}
```

---

## 7. P0-4：注册新工具

### 7.1 修改 `skill.json`

文件：

```text
app/src/shared/lib/agent/skills/financial-analysis/skill.json
```

把 `tools` 改为：

```json
"tools": [
  "resolve_org_nodes",
  "query_business_report_pack",
  "query_with_hierarchy",
  "query_monthly_plan",
  "query_biz_data",
  "read_file"
]
```

建议同步更新描述：

```json
"description": "用于查询和分析教育后勤经营数据，支持查数、预算对比、组织节点分析、异常扫描与月度经营分析报告生成；完整报告优先使用报告数据包工具，并对系统暂无数据的专项章节输出人工补充占位。",
"tagline": "查数、诊断、生成经营分析报告"
```

### 7.2 修改 `toolRegistry.ts`

文件：

```text
app/src/shared/lib/agent/tools/toolRegistry.ts
```

新增：

```ts
import { queryBusinessReportPackTool } from './queryBusinessReportPack'
```

注册：

```ts
const toolMap: Record<string, RegisteredTool> = {
  resolve_org_nodes: resolveOrgNodesTool,
  query_business_report_pack: queryBusinessReportPackTool,
  query_with_hierarchy: queryWithHierarchyTool,
  query_monthly_plan: queryMonthlyPlanTool,
  query_biz_data: queryBizDataTool,
  read_file: readFileTool,
}
```

### 7.3 修改 `tools/index.ts`

文件：

```text
app/src/shared/lib/agent/tools/index.ts
```

新增：

```ts
export { queryBusinessReportPackTool } from './queryBusinessReportPack'
```

### 7.4 修改 `runtimeLoader.ts`

文件：

```text
app/src/shared/lib/agent/runtimeLoader.ts
```

在 `Promise.all` 中新增 import：

```ts
import('./tools/queryBusinessReportPack'),
```

解构新增：

```ts
queryBusinessReportPackModule,
```

`tools` 数组新增到 `query_with_hierarchy` 前：

```ts
resolveOrgNodesModule.resolveOrgNodesTool,
queryBusinessReportPackModule.queryBusinessReportPackTool,
queryWithHierarchyModule.queryWithHierarchyTool,
```

---

## 8. P0-5：修改 `chatAgent.ts`，避免报告包被截断

文件：

```text
app/src/shared/lib/agent/chatAgent.ts
```

### 8.1 增加工具核心参数识别

在 `pickCoreArgs()` 里新增：

```ts
query_business_report_pack: [
  'node_name',
  'month',
  'previous_month',
  'cumulative_period',
  'report_types',
  'max_units',
],
```

### 8.2 调整常量

当前值偏小：

```ts
const MAX_TOOL_RESULT_CHAR_BUDGET = 12000
const MAX_READ_FILE_CHAR_BUDGET = 8000
const MAX_QUERY_ROWS_PREVIEW = 24
const MAX_QUERY_TREE_NODES_PREVIEW = 18
const MAX_METRICS_PER_NODE_PREVIEW = 14
```

建议改为：

```ts
const MAX_TOOL_RESULT_CHAR_BUDGET = 20000
const MAX_READ_FILE_CHAR_BUDGET = 30000
const MAX_BUSINESS_REPORT_PACK_CHAR_BUDGET = 50000
const MAX_QUERY_ROWS_PREVIEW = 80
const MAX_QUERY_TREE_NODES_PREVIEW = 80
const MAX_METRICS_PER_NODE_PREVIEW = 25
```

不要无限制放大所有工具结果。优先对 `query_business_report_pack` 单独压缩。

### 8.3 补齐核心指标优先级

`HIERARCHY_CORE_METRICS` 增加费用类：

```ts
const HIERARCHY_CORE_METRICS = [
  'revenue',
  'gross_profit',
  'gross_margin',
  'pretax_profit',
  'pretax_margin',
  'labor_cost',
  'salary',
  'social_insurance',
  'housing_fund',
  'labor_service_fee',
  'other_labor_cost',
  'catering_expense',
  'material_cost',
  'other_expense',
  'external_expense',
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
```

### 8.4 新增报告包压缩函数

```ts
function compactBusinessReportPack(content: string): string {
  try {
    const pack = JSON.parse(content) as Record<string, unknown>
    const unitCards = Array.isArray(pack.unit_cards) ? pack.unit_cards : []
    const compositionTable = Array.isArray(pack.composition_table) ? pack.composition_table : []
    const monthlyActualTable = Array.isArray(pack.monthly_actual_table) ? pack.monthly_actual_table : []

    const compacted = {
      metadata: pack.metadata,
      coverage: pack.coverage,
      summary_cards: pack.summary_cards,
      target_vs_actual_table: pack.target_vs_actual_table,
      composition_table: compositionTable.slice(0, 80),
      unit_cards: unitCards.slice(0, 60),
      monthly_actual_table: monthlyActualTable.slice(0, 80),
      variance_rankings: pack.variance_rankings,
      manual_fill_sections: pack.manual_fill_sections,
      warnings: pack.warnings,
      original_counts: {
        composition_table: compositionTable.length,
        unit_cards: unitCards.length,
        monthly_actual_table: monthlyActualTable.length,
      },
      tool_result_compacted: true,
    }

    const serialized = JSON.stringify(compacted, null, 2)
    return serialized.length <= MAX_BUSINESS_REPORT_PACK_CHAR_BUDGET
      ? serialized
      : truncateText(serialized, MAX_BUSINESS_REPORT_PACK_CHAR_BUDGET, 'business report pack exceeded model context budget')
  } catch {
    return truncateText(content, MAX_BUSINESS_REPORT_PACK_CHAR_BUDGET, 'business report pack exceeded model context budget')
  }
}
```

### 8.5 修改 `prepareToolResultForModel()`

```ts
function prepareToolResultForModel(name: string, content: string): string {
  if (!content) return content

  if (name === 'query_business_report_pack') {
    return compactBusinessReportPack(content)
  }

  if (name === 'read_file') {
    return truncateText(content, MAX_READ_FILE_CHAR_BUDGET, 'reference/template content exceeded model context budget')
  }

  ...
}
```

---

## 9. P0-6：保存原始工具结果，便于后续续写

文件：

```text
app/src/shared/lib/agent/types.ts
app/src/shared/lib/agent/chatAgent.ts
app/src/shared/lib/agent/conversationMemory.ts
```

### 9.1 修改类型

`ToolCallRecord` 增加：

```ts
rawResult?: string
```

### 9.2 执行工具时写入 rawResult

在 `chatAgent.ts` 中两处执行工具的逻辑都要改。

当前类似：

```ts
const result = await tool.execute(args)
const preparedResult = prepareToolResultForModel(tc.name, result)
toolCallRecord.status = 'success'
toolCallRecord.result = preparedResult
```

改为：

```ts
const result = await tool.execute(args)
const preparedResult = prepareToolResultForModel(tc.name, result)
toolCallRecord.status = 'success'
toolCallRecord.rawResult = result
toolCallRecord.result = preparedResult
```

缓存命中时没有必要恢复 `rawResult`，但如果缓存里已经保存的是原始 `content`，可以：

```ts
toolCallRecord.rawResult = cachedResult.content
```

### 9.3 artifact 保存优先 rawResult

文件：

```text
app/src/shared/lib/agent/conversationMemory.ts
```

修改：

```ts
payload: cleanText(toolCall.rawResult || toolCall.result, MAX_ARTIFACT_PAYLOAD),
```

`shouldCaptureArtifact()` 增加新工具：

```ts
return toolCall.result.length > 600 || [
  'query_business_report_pack',
  'query_with_hierarchy',
  'query_biz_data',
  'query_monthly_plan',
  'resolve_org_nodes',
].includes(toolCall.name)
```

可选：把 `MAX_ARTIFACT_PAYLOAD` 从 `12000` 调整到 `50000`。如果担心 localStorage/IndexedDB 压力，只对 `query_business_report_pack` 单独放大。

---

## 10. P0-7：重构报告模板 `biz-analysis-report.md`

文件：

```text
app/src/shared/lib/agent/skills/financial-analysis/assets/biz-analysis-report.md
```

建议将当前通用模板替换为以下业务报告结构。不要再以“经营摘要、年初预算总览、重点项目、突围考核、图表配置”为主结构。

```md
# 后勤集团经营分析

**报告对象**：`{{scope_name}}`  
**统计周期**：`{{month_label}} / {{cumulative_label}}`  
**编制日期**：`{{generated_at}}`  
**数据口径**：年初预算口径（fone）+ 突围考核口径（tuwei）  
**单位**：万元，比例为百分比  

> 输出要求：
> - 完整报告必须优先使用 `query_business_report_pack` 返回的数据包。
> - 当系统返回 `manual_fill_sections` 时，必须把对应人工补充表原样输出到报告中。
> - 不得编造应收账款、资金计划、核心费用明细数据。
> - 每张核心经营表后必须有业务判断，不得只贴表。

---

## 1. 对标后勤集团考核努力目标的经营情况

### 1.1 总体情况

输出集团/目标节点总表：

| 分析单元 | 口径 | 期间 | 营收实际 | 营收目标 | 营收完成率 | 营收差额 | 税前利润实际 | 税前利润目标 | 税前利润完成率 | 税前利润差额 |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|

表后输出 3-5 条判断：
- 总量完成情况。
- 收入和利润是否匹配。
- 主要支撑板块和拖累板块。
- 低于阈值的完成率必须写“预警”。

### 1.2 明细构成

输出构成表：

| 板块 | 分析单元 | 营收实际 | 营收占比 | 营收完成率 | 税前利润实际 | 利润占比 | 利润完成率 | 经营判断 |
|---|---|---:|---:|---:|---:|---:|---:|---|

表后写结构判断：
- 基本盘贡献。
- 三大区域贡献。
- 商业/增长极贡献。
- 数字营销或其他新增业务贡献。
- 结构变化或数据缺口说明。

---

## 2. 实际情况

### 2.1 中心 / 区域累计完成情况

按区域/中心分别输出小表。每个小表格式：

| 指标 | 累计实际 | 累计预算/目标 | 完成率 | 差额 | 全年预算/努力目标 | 当前进度 | 剩余缺口 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 营业收入 | | | | | | | |
| 税前利润 | | | | | | | |

每个小表后输出一段诊断：
- 完成率是否达标。
- 主要缺口来自收入还是利润。
- 收入达标但利润不足时，说明利润转化风险。
- 利润达标但收入不足时，说明项目节奏或成本控制因素。
- 指出 1-2 个后续关注点。

### 2.2 当月实际完成情况

输出当月表：

| 分析单元 | 口径 | 当月营收实际 | 当月营收预算/目标 | 完成率 | 差额 | 当月利润实际 | 当月利润预算/目标 | 完成率 | 差额 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|

表后输出：
- 当月表现最好的 3 个单元。
- 当月缺口最大的 3 个单元。
- 对异常完成率、负利润、利润明显偏离收入的单元做预警。

---

## 3. 应收账款回款情况

本章节由 `manual_fill_sections.receivables` 生成。必须输出人工补充说明和占位表。

---

## 4. 资金计划执行情况

本章节由 `manual_fill_sections.cash_plan` 生成。必须输出人工补充说明和占位表。

---

## 5. 当月核心费用支出情况

本章节由 `manual_fill_sections.core_expenses` 生成。必须输出人工补充说明和占位表。

如系统已有费用类经营指标，可在占位表前增加“系统可取费用指标参考”，但必须说明其不能替代业务报告核心费用明细表。

---

## 6. 管理层关注事项与后续动作

| 事项 | 涉及单位 | 风险等级 | 主要依据 | 建议动作 | 建议完成时间 |
|---|---|---|---|---|---|

要求：
- 不得写泛泛建议。
- 每条建议必须对应前文数据。
- 对红色/黄色预警必须有动作闭环。
- 对人工补充章节必须提示“待业务补数后复核”。
```

---

## 11. P0-8：修改 `prompt.md` 的报告执行策略

文件：

```text
app/src/shared/lib/agent/skills/financial-analysis/prompt.md
```

当前 prompt 强制“所有执行动作之前，先和用户确认”。这会导致完整报告任务流程过长。需要改为双轨：轻量查数仍可确认，完整报告在信息足够时直接执行。

建议替换“交互总原则”和“经营分析/报告”相关段落，加入：

```md
# 完整月度经营分析报告强制路线

当用户请求“经营分析报告 / 月报 / 汇报材料 / 完整报告 / markdown 报告”，且已给出月份或可由 Runtime Data Context 推断最新月份时，视为已授权进入报告流程，不再逐项确认读取模板、查询工具和写作动作。

默认规则：
- 分析对象：优先使用用户指定对象；未指定时使用当前会话高置信 scope；仍无 scope 时默认集团整体（node_name=""）。
- 月度期间：使用用户指定月份；未指定时使用 latest_monthly_period。
- 上月期间：由目标月推断，并优先校验 Runtime Data Context 是否存在。
- 累计期间：必须从 cumulative_periods 中选择覆盖目标月的合法 period，不得自行编造。
- 统计口径：完整报告默认同时覆盖 fone 与 tuwei。
- 报告详度：默认详版，不压缩成摘要版。
- 专项章节：应收账款回款、资金计划执行、核心费用支出当前无法自动取业务明细，必须输出人工补充占位表，不得编造。

完整报告必须优先调用 `query_business_report_pack`。只有当该工具不存在、报错或返回缺口时，才使用 `query_with_hierarchy` / `query_monthly_plan` / `query_biz_data` 补查。
```

同时把“查询主线”改为：

```md
完整报告查询主线：
1. 必要时 `resolve_org_nodes`
2. `read_file` 读取报告模板与报告生成规范
3. `query_business_report_pack`
4. 仅在数据包缺少关键字段时，用 `query_with_hierarchy` 或 `query_monthly_plan` 补查

轻量查数查询主线仍保持：
1. `resolve_org_nodes`（必要时）
2. `query_with_hierarchy`
3. `query_monthly_plan`（仅用户明确问计划）
4. `query_biz_data`（兜底）
```

在“数据边界”中保留但修改表达：

```md
以下数据当前不能自动获取，完整报告中必须保留人工补充占位，禁止编造：
- 回款、应收账款、账龄结构
- 资金计划预算、实际收支、现金净流量、奖惩测算
- 核心费用专项明细，如办公用品费、咨询/维修/服务费等
- 新签合同额、在手订单
- 项目进度、项目台账
- 全年预测
- 责任部门、责任人、完成时点
```

---

## 12. P1-1：新增真实报告风格 reference

新增文件：

```text
app/src/shared/lib/agent/skills/financial-analysis/references/actual-march-report-style.md
```

建议内容：

```md
# 真实经营分析报告风格规范

本 skill 的完整月度经营分析报告，应接近业务人员真实编写的后勤集团经营分析报告，而不是通用财务分析文章。

## 结构要求

必须优先采用以下结构：
1. 对标后勤集团考核努力目标的经营情况
2. 实际情况
3. 应收账款回款情况
4. 资金计划执行情况
5. 当月核心费用支出情况
6. 管理层关注事项与后续动作

## 写作密度

每个核心经营章节必须包含：
- 一张或多张数据表。
- 表后 2-5 条业务判断。
- 对黄色/红色风险给出具体对象和原因。
- 不得只写“整体良好/需关注”这类空泛判断。

## 专项章节数据缺口

由于当前系统暂未接入应收、资金、核心费用专项明细，报告必须保留人工补充占位。写法要求：
- 明确说明“当前系统未接入该专项数据”。
- 输出占位表。
- 提示业务人员补充字段。
- 不得把占位章节改写成泛泛建议。

## 语言要求

表达方式：
- 结论先行。
- 数字落点明确。
- 先说对象，再说指标，再说差异，再说经营含义。
- 避免宣传腔、咨询腔、AI腔。

推荐句式：
- “从累计完成看，A 单元营收完成率为 X%，低于目标 Y 个百分点，主要缺口集中在 B/C。”
- “收入端完成进度尚可，但税前利润完成率明显低于收入完成率，说明利润转化不足，需关注成本刚性和项目毛利。”
- “该专项章节当前为人工补充区，待业务侧补齐后需复核差异率、风险等级和整改动作。”
```

---

## 13. P1-2：新增质量自审 rubric

新增文件：

```text
app/src/shared/lib/agent/skills/financial-analysis/references/report-quality-rubric.md
```

建议内容：

```md
# 经营分析报告质量自审 Rubric

输出前必须逐项自审。

## 结构完整性
- 是否覆盖目标对标、实际情况、应收回款、资金计划、核心费用、管理动作？
- 专项章节无数据时，是否输出人工补充占位，而不是删掉或编造？

## 数据完整性
- 是否同时覆盖当月、上月、累计？
- 是否同时覆盖 fone 和 tuwei？
- 是否包含 actual、target、completion_rate、diff？
- 是否出现口径混写？

## 颗粒度
- 是否至少输出集团/目标节点总表、构成表、区域/中心小表、当月完成表？
- 是否点名具体区域/中心/业务单元？
- 是否有 TOP 缺口和 TOP 贡献？

## 业务判断
- 每张核心表后是否有判断？
- 判断是否有数字依据？
- 是否区分收入问题、利润问题、费用问题、进度问题？

## 风险闭环
- 黄色/红色预警是否有建议动作？
- 建议是否对应具体对象？
- 对人工补充专项章节是否提示“补数后复核”？

## 禁止
- 禁止保留普通经营章节的 `【待补】`。
- 禁止编造应收、资金、核心费用专项数据。
- 禁止把完整报告写成摘要。
- 禁止只输出表格不写分析。
```

---

## 14. P1-3：新增数据覆盖说明 reference

新增文件：

```text
app/src/shared/lib/agent/skills/financial-analysis/references/data-requirements.md
```

建议内容：

```md
# 经营分析报告数据覆盖说明

## 系统当前可自动生成

来自 `edu_biz_report`、`edu_biz_monthly_plan`、`edu_org_hierarchy`：
- 营业收入
- 毛利额、毛利率
- 税前利润、税前利润率
- 人力成本及部分明细
- 部分费用类指标
- 人数、人均营收、人力成本率、一元创收、一元创利
- 年初预算目标、突围考核目标
- 完成率、差额、同比值
- 组织层级树
- 突围月度计划中的 revenue、pretax_profit

## 当前必须人工补充

以下数据目前业务侧取不到，报告只能输出占位表：
- 应收账款回款情况
- 资金计划执行情况
- 核心费用专项明细
- 合同/在手订单
- 项目进度
- 全年预测
- 责任人和完成时点

## 输出规则

- 可自动生成的章节必须尽量完整，不得以“数据缺失”为由省略核心经营表。
- 必须人工补充的章节不得编造；保留标题、说明、字段表和补充指引。
- 如果系统已有部分费用指标，只能作为“系统可取费用指标参考”，不能替代“核心费用支出情况”专项表。
```

---

## 15. P1-4：修改 `report-generation.md`

文件：

```text
app/src/shared/lib/agent/skills/financial-analysis/references/report-generation.md
```

建议追加或重写为以下重点规则：

```md
# 完整经营分析报告生成规范

## 1. 数据准备

完整月度经营分析报告必须优先调用 `query_business_report_pack`。

若该工具返回：
- `coverage.core_biz_data = missing`：不得生成完整报告，只输出缺数说明。
- `coverage.receivables = manual_required`：第 3 节输出人工补充占位。
- `coverage.cash_plan = manual_required`：第 4 节输出人工补充占位。
- `coverage.core_expenses = manual_required`：第 5 节输出人工补充占位。
- `warnings` 非空：必须在报告正文和管理层关注事项中体现。

## 2. 章节要求

终稿必须采用：
1. 对标后勤集团考核努力目标的经营情况
2. 实际情况
3. 应收账款回款情况
4. 资金计划执行情况
5. 当月核心费用支出情况
6. 管理层关注事项与后续动作

除非用户明确要求摘要版，不得改成“经营摘要 + 建议”的短报告。

## 3. 表格数量要求

数据充足时，至少输出：
- 目标对标总表 1 张
- 明细构成表 1 张
- 区域/中心累计完成小表 3 张以上，若实际少于 3 个单位则全部输出
- 当月完成情况表 1 张
- 应收回款人工补充表 1 张
- 资金计划人工补充表 1 张
- 核心费用人工补充表 1 张
- 管理动作表 1 张

## 4. 文字密度要求

每个核心章节必须满足：
- 表前最多 1 句背景。
- 表后至少 2 条分析。
- 分析必须包含数字、对象、原因或风险。
- 不允许只复述表格。

## 5. 人工补充章节要求

对于人工补充章节，必须包含：
- “当前系统未接入该专项数据”的说明。
- 占位表。
- 业务人员需要补充的字段。
- “补数后需复核”的提示。

## 6. 自审

输出前按 `report-quality-rubric.md` 自审。未通过时先修正，再输出终稿。
```

---

## 16. P1-5：修改 `skills/index.ts` 引入新增 references

文件：

```text
app/src/shared/lib/agent/skills/index.ts
```

新增 imports：

```ts
import actualMarchReportStyle from './financial-analysis/references/actual-march-report-style.md?raw'
import reportQualityRubric from './financial-analysis/references/report-quality-rubric.md?raw'
import dataRequirements from './financial-analysis/references/data-requirements.md?raw'
```

注册到 `loadSkill()` 的 assets map：

```ts
{
  'biz-analysis-report.md': bizAnalysisReport,
  'references/report-generation.md': reportGenerationReference,
  'references/analysis-method.md': analysisMethodReference,
  'references/chart-guidance.md': chartGuidanceReference,
  'references/workflow.md': workflowReference,
  'references/metrics.md': metricsReference,
  'references/actual-march-report-style.md': actualMarchReportStyle,
  'references/report-quality-rubric.md': reportQualityRubric,
  'references/data-requirements.md': dataRequirements,
}
```

---

## 17. P1-6：修改 `prompt.md` 的读取策略

文件：

```text
app/src/shared/lib/agent/skills/financial-analysis/prompt.md
```

在“完整报告”读文件规则里新增：

```md
用户要求“完整报告 / 经营分析报告 / 月报 / markdown 报告 / 汇报版材料”时：
- 首次进入报告写作阶段时读取 `/assets/financial-analysis/biz-analysis-report.md`
- 读取 `/assets/financial-analysis/references/report-generation.md`
- 读取 `/assets/financial-analysis/references/actual-march-report-style.md`
- 读取 `/assets/financial-analysis/references/report-quality-rubric.md`
- 读取 `/assets/financial-analysis/references/data-requirements.md`
```

同时明确：同一路径同一任务最多读取一次，已读则复用。

---

## 18. P1-7：修改 `sessionContext.ts` 识别新工具和 references

文件：

```text
app/src/shared/lib/agent/skills/financial-analysis/sessionContext.ts
```

### 18.1 识别 `query_business_report_pack` 的 scope/time

在 `deriveScopeFromToolCalls()` 中，把新工具纳入：

```ts
if (toolCall.name === 'query_with_hierarchy' || toolCall.name === 'query_biz_data' || toolCall.name === 'query_business_report_pack') {
  const nodeNameArg = typeof toolCall.arguments.node_name === 'string'
    ? toolCall.arguments.node_name.trim()
    : ''
  ...
}
```

在 `deriveTimeFromToolCalls()` 中新增：

```ts
if (toolCall.name === 'query_business_report_pack') {
  return {
    periodType: 'monthly',
    period: typeof toolCall.arguments.month === 'string' ? toolCall.arguments.month : undefined,
    confidence: 'high',
  }
}
```

### 18.2 识别新增 reference 已加载

在 `deriveReportMode()` 中新增路径判断：

```ts
const actualMarchReportStyleLoaded = readFilePaths.includes('/assets/financial-analysis/references/actual-march-report-style.md')
const reportQualityRubricLoaded = readFilePaths.includes('/assets/financial-analysis/references/report-quality-rubric.md')
const dataRequirementsLoaded = readFilePaths.includes('/assets/financial-analysis/references/data-requirements.md')
```

`FinancialAnalysisSessionContext['reportMode']` 类型也要扩展：

```ts
actualMarchReportStyleLoaded?: boolean
reportQualityRubricLoaded?: boolean
dataRequirementsLoaded?: boolean
```

`buildFinancialAnalysisSessionContextBlock()` 输出这些标记，避免重复读取。

---

## 19. P1-8：修改 `runtimeContext.ts` 的数据可用性说明

文件：

```text
app/src/shared/lib/agent/skills/financial-analysis/runtimeContext.ts
```

当前：

```ts
'- data_not_available: 回款/应收, 合同签约/在手订单, 项目进度, 全年预测, 责任人/完成时点',
```

建议改为：

```ts
'- data_available: revenue, gross_profit, gross_margin, pretax_profit, pretax_margin, labor_cost with detail breakdown, available expense metrics, headcount, per_capita_revenue, labor_cost_rate, revenue_creation, profit_creation, budget value, completion_rate, diff, year_over_year, monthly_plan',
'- data_manual_required: 应收账款回款情况, 资金计划执行情况, 核心费用专项明细',
'- data_not_available: 合同签约/在手订单, 项目进度, 全年预测, 责任人/完成时点',
```

并在 guidance 增加：

```ts
'For complete business reports, keep manual placeholder sections for receivables, cash plan execution, and core expense details. Do not invent values for these manual sections.'
```

---

## 20. P1-9：生成报告时的最终输出要求

报告最终 Markdown 必须满足：

### 20.1 第 3 节固定输出占位

```md
## 3. 应收账款回款情况

> 【人工补充】当前系统未接入应收账款、回款、账龄和合同维度数据，本章节需业务人员补充后复核。

| 项目 / 合同类别 | 期末应收余额 | 本月应回款 | 本月已回款 | 回款率 | 未回款金额 | 风险等级 | 原因/备注 |
|---|---:|---:|---:|---:|---:|---|---|
| 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 |
```

### 20.2 第 4 节固定输出占位

```md
## 4. 资金计划执行情况

> 【人工补充】当前系统未接入资金计划预算、实际收支、现金净流量和奖惩测算数据，本章节需业务人员补充后复核。

| 分类 | 月份 | 资金计划 | 实际资金收入/支出 | 差异率 | 奖惩金额 | 现金净流量 | 偏差原因 |
|---|---|---:|---:|---:|---:|---:|---|
| 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 |
```

### 20.3 第 5 节固定输出占位

```md
## 5. 当月核心费用支出情况

> 【人工补充】当前系统未接入业务报告所需核心费用明细，如办公用品费、咨询/维修/服务费等。本章节需业务人员补充后复核。系统已有部分费用类经营指标只能作为参考，不能替代该专项表。

| 分析单元 | 招待费 | 办公用品费 | 咨询/维修/服务费 | 其他重点费用 | 当月合计 | 预算/额度 | 偏差 | 风险判断 |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 | 【人工补充】 |
```

---

## 21. 建议 Codex 执行顺序

请按以下顺序改代码，减少联动错误：

1. 新增 `reportPackTypes.ts`。
2. 新增 `reportCalculations.ts`。
3. 新增 `queryBusinessReportPack.ts`。
4. 注册工具：`skill.json`、`toolRegistry.ts`、`tools/index.ts`、`runtimeLoader.ts`。
5. 修改 `chatAgent.ts` 压缩策略和核心参数识别。
6. 修改 `types.ts` 增加 `rawResult`，并更新 `chatAgent.ts`、`conversationMemory.ts`。
7. 替换 `biz-analysis-report.md`。
8. 修改 `prompt.md`。
9. 新增三个 reference 文件。
10. 修改 `report-generation.md`。
11. 修改 `skills/index.ts`。
12. 修改 `sessionContext.ts`。
13. 修改 `runtimeContext.ts`。
14. 运行校验。

---

## 22. 验收标准

### 22.1 构建验收

在仓库根目录运行：

```bash
npm run build --prefix app
```

如项目已有 lint/test 环境，也运行：

```bash
npm run lint --prefix app
npm run test --prefix app
```

### 22.2 功能验收

用以下用户输入测试：

```text
给我出一份后勤集团 202603 的经营分析报告，按业务汇报版详细输出。
```

期望行为：

- 进入报告模式，不反复询问是否读取模板或是否查数。
- 读取报告模板和新增 references。
- 调用 `query_business_report_pack`。
- 报告包含 6 个主章节：
  1. 对标后勤集团考核努力目标的经营情况
  2. 实际情况
  3. 应收账款回款情况
  4. 资金计划执行情况
  5. 当月核心费用支出情况
  6. 管理层关注事项与后续动作
- 第 1、2 节有真实系统经营数据表和判断。
- 第 3、4、5 节输出人工补充占位表。
- 不编造应收、资金、核心费用专项数据。
- 每张核心经营表后至少有 2 条业务判断。
- 管理动作表能引用前文预警，不是泛泛建议。

### 22.3 数据包验收

直接让模型调用或在开发环境测试 `query_business_report_pack`：

```json
{
  "node_name": "",
  "month": "202603",
  "cumulative_period": "202507-202603",
  "report_types": ["fone", "tuwei"]
}
```

期望返回：

- `metadata` 完整。
- `coverage.receivables/cash_plan/core_expenses` 均为 `manual_required`。
- `summary_cards` 非空。
- `target_vs_actual_table` 非空。
- `composition_table` 非空。
- `unit_cards` 非空。
- `variance_rankings` 有 revenue/profit 缺口或贡献排行。
- `manual_fill_sections` 三个章节都有 `table_markdown`。
- `warnings` 至少能在异常数据存在时输出。

### 22.4 反幻觉验收

测试输入：

```text
把 202603 的应收账款回款情况也详细分析一下。
```

期望输出：

- 明确说明当前系统未接入应收账款/回款明细。
- 输出人工补充表。
- 不编造客户、合同、金额、回款率。

---

## 23. 注意事项

1. 不要把专项章节删掉。真实业务报告需要这些章节，即使系统暂无数据，也要占位。
2. 不要为了“详细”而在 prompt 中硬写大量数字样例。数字必须来自工具返回。
3. 不要把 `query_business_report_pack` 做成只返回纯文本报告。它应该返回结构化 JSON，让 LLM 基于 JSON 写报告。
4. 不要让 LLM 临时承担所有计算。完成率状态、贡献排行、差额排行、风险预警应尽量在工具层完成。
5. 不要全局无限放大工具结果。优先对报告包做结构化压缩。
6. 不要新增数据库 migration。本轮数据策略是“现有数据自动生成 + 缺失专项人工占位”。
7. 不要破坏轻量查数体验。轻量查数仍然优先 `query_with_hierarchy`，不要强制走报告包。

---

## 24. 交付物清单

Codex 完成后应至少提交以下新增/修改文件：

新增：

```text
app/src/shared/lib/agent/tools/reportPackTypes.ts
app/src/shared/lib/agent/tools/reportCalculations.ts
app/src/shared/lib/agent/tools/queryBusinessReportPack.ts
app/src/shared/lib/agent/skills/financial-analysis/references/actual-march-report-style.md
app/src/shared/lib/agent/skills/financial-analysis/references/report-quality-rubric.md
app/src/shared/lib/agent/skills/financial-analysis/references/data-requirements.md
```

修改：

```text
app/src/shared/lib/agent/skills/financial-analysis/skill.json
app/src/shared/lib/agent/skills/financial-analysis/prompt.md
app/src/shared/lib/agent/skills/financial-analysis/assets/biz-analysis-report.md
app/src/shared/lib/agent/skills/financial-analysis/references/report-generation.md
app/src/shared/lib/agent/skills/financial-analysis/runtimeContext.ts
app/src/shared/lib/agent/skills/financial-analysis/sessionContext.ts
app/src/shared/lib/agent/skills/index.ts
app/src/shared/lib/agent/tools/toolRegistry.ts
app/src/shared/lib/agent/tools/index.ts
app/src/shared/lib/agent/runtimeLoader.ts
app/src/shared/lib/agent/chatAgent.ts
app/src/shared/lib/agent/conversationMemory.ts
app/src/shared/lib/agent/types.ts
```

---

## 25. 可直接发给 Codex 的任务指令

```text
请按照 financial-analysis Skill P0/P1 代码整改计划执行修改。

重点：
1. 新增 query_business_report_pack 工具，基于现有 edu_biz_report、edu_biz_monthly_plan、edu_org_hierarchy 生成完整月度经营分析报告数据包。
2. 不新增应收、资金、核心费用专项数据表，也不新增对应查询工具。
3. 第 3/4/5 章必须通过 manual_fill_sections 输出人工补充占位表，禁止编造专项数据。
4. 重构 biz-analysis-report.md、prompt.md、report-generation.md，使完整报告结构接近业务人员真实经营分析报告。
5. 修改 chatAgent.ts 的工具结果压缩，确保 query_business_report_pack 的 summary、tables、rankings、warnings、manual_fill_sections 不被截断。
6. 完成后运行 npm run build --prefix app，修复所有 TypeScript 错误。
```
