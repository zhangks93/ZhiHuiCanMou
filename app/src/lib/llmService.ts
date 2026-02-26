import { fetch } from '@tauri-apps/plugin-http'
import type { LLMConfig } from './llmConfig'
import type { BizDataSnapshot } from './supabase'

export interface Insight {
  type: 'danger' | 'warning' | 'success' | 'info'
  title: string
  detail: string
}

function buildDataSummary(total: BizDataSnapshot, level1: BizDataSnapshot[]): string {
  const fmt = (v: number | null | undefined) => (v == null ? '-' : v.toFixed(1))
  const fmtW = (v: number | null | undefined) => (v == null ? '-' : v.toLocaleString('zh-CN', { maximumFractionDigits: 0 }))

  let summary = `【整体概况 - ${total.node_name}】\n`
  summary += `实际营收: ${fmtW(total.actual_revenue)}万 | 预算: ${fmtW(total.budget_revenue)}万 | 达成率: ${fmt(total.revenue_completion_rate)}%\n`
  summary += `实际利润: ${fmtW(total.actual_profit)}万 | 预算: ${fmtW(total.budget_profit)}万 | 达成率: ${fmt(total.profit_completion_rate)}%\n`
  summary += `毛利率: ${fmt(total.actual_gross_margin)}% | 预算: ${fmt(total.budget_gross_margin)}%\n`
  summary += `人力成本率: ${fmt(total.actual_labor_cost_rate)}% | 预算: ${fmt(total.budget_labor_cost_rate)}%\n`
  summary += `在岗人数: ${fmtW(total.actual_headcount)} | 预算: ${fmtW(total.budget_headcount)}\n\n`

  summary += `【一级业务板块】\n`
  for (const u of level1) {
    summary += `${u.node_name}: 营收${fmtW(u.actual_revenue)}万(达成${fmt(u.revenue_completion_rate)}%) | 利润${fmtW(u.actual_profit)}万(达成${fmt(u.profit_completion_rate)}%) | 毛利率${fmt(u.actual_gross_margin)}% | 人力成本率${fmt(u.actual_labor_cost_rate)}% | 人数${fmtW(u.actual_headcount)}\n`
  }

  return summary
}

const SYSTEM_PROMPT = `你是一位教育后勤集团高级经营分析师。根据提供的经营数据，给出4-6条深度分析洞察。

要求：
1. 覆盖以下维度：营收缺口分析、利润结构分析、成本管控建议、人效分析、亮点板块、风险预警
2. 每条洞察的 title 不超过20个字，detail 不超过80个字
3. type 取值：danger（严重问题）、warning（需关注）、success（亮点）、info（建议）
4. 返回纯 JSON，格式为：{"insights": [{"type": "...", "title": "...", "detail": "..."}]}
5. 不要返回 markdown 或其他格式，只返回 JSON`

async function callOpenAI(config: LLMConfig, dataSummary: string): Promise<Insight[]> {
  const res = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: dataSummary },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    }),
  })

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('API Key 无效，请检查设置')
    throw new Error(`OpenAI API 错误: ${res.status}`)
  }

  const json = await res.json()
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI 返回内容为空')

  const parsed = JSON.parse(content)
  return validateInsights(parsed.insights)
}

async function callClaude(config: LLMConfig, dataSummary: string): Promise<Insight[]> {
  const res = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: dataSummary }],
      max_tokens: 2000,
    }),
  })

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('API Key 无效，请检查设置')
    throw new Error(`Claude API 错误: ${res.status}`)
  }

  const json = await res.json()
  const text = json.content?.[0]?.text
  if (!text) throw new Error('Claude 返回内容为空')

  const parsed = JSON.parse(text)
  return validateInsights(parsed.insights)
}

const VALID_TYPES = new Set(['danger', 'warning', 'success', 'info'])

function validateInsights(raw: unknown): Insight[] {
  if (!Array.isArray(raw)) throw new Error('LLM 返回格式错误：insights 不是数组')
  return raw.slice(0, 8).map((item: Record<string, unknown>) => ({
    type: (VALID_TYPES.has(item.type as string) ? item.type : 'info') as Insight['type'],
    title: String(item.title ?? '').slice(0, 30),
    detail: String(item.detail ?? '').slice(0, 120),
  }))
}

export async function analyzeBizData(
  config: LLMConfig,
  total: BizDataSnapshot,
  level1: BizDataSnapshot[],
): Promise<Insight[]> {
  const dataSummary = buildDataSummary(total, level1)

  if (config.provider === 'claude') {
    return callClaude(config, dataSummary)
  }
  return callOpenAI(config, dataSummary)
}
