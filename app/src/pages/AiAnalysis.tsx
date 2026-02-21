import { useState, useEffect, useCallback } from 'react'
import { PageTitle } from '@/components/ui/PageTitle'
import { Sparkles, Loader2, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
interface WorkItemForSummary {
  module_id: string
  content: string | null
  links: { url: string; title?: string }[]
  reporter_name?: string | null
  period_start?: string | null
  period_end?: string | null
}

const staticInsights = [
  {
    type: 'positive',
    title: '优势业务：数智零售线上 —— 可深度挖掘',
    desc: '当前达成率95%，盈利能力领先。建议在 Q3 推进 2~3 个同类学校园区线上零售项目落地，预计可增量营收约 400 万元。',
  },
  {
    type: 'alert',
    title: '缺口预警：北区餐饮配送 · 当前缺口 166 万 / 月',
    desc: '按当前趋势，全年营收缺口约 996 万元。若通过商机转化弥补，需在 Q3 签约 A 级商机至少 2 单（合同体量 ≥ 500 万/单）；当前管道中可优先推进：广东某高校配餐（800万，A级）、深圳科技园项目（620万，A级）。',
  },
  {
    type: 'warning',
    title: '商机转化路径建议',
    desc: '初期洽谈阶段商机过多（5项），中后期推进力度不足。建议重点资源向「拟标阶段」4项倾斜，预计90天内可触发2~3单签约。',
  },
  {
    type: 'info',
    title: '利润优化空间',
    desc: '学校食堂特色餐利润率仅65%（红色预警），建议评估食材成本结构并与营养配餐供应商重新谈判，目标将利润率提升至75%以上，可增加约 8 万元/月利润贡献。',
  },
]

const insightStyles: Record<string, string> = {
  positive: 'border-l-success bg-success-100/30',
  alert: 'border-l-error bg-error-100/30',
  warning: 'border-l-warning bg-warning-100/30',
  info: 'border-l-primary-500 bg-primary-50/50',
}

export function AiAnalysis() {
  const [workSummary, setWorkSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [qaQuestion, setQaQuestion] = useState('')
  const [qaAnswer, setQaAnswer] = useState<string | null>(null)
  const [qaLoading, setQaLoading] = useState(false)

  const fetchAndSummarize = useCallback(async () => {
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setWorkSummary(null)
        return
      }
      const { data: teamItems } = await supabase
        .from('work_items')
        .select('*')
        .neq('reporter_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      const items = (teamItems ?? []) as Array<{
        module_id: string
        content: string | null
        links: unknown
        reporter_id: string
        period_start: string | null
        period_end: string | null
      }>

      if (items.length === 0) {
        setWorkSummary('暂无下属工作汇报数据，AI 汇总将在有汇报后生效。')
        return
      }

      const reporterIds = [...new Set(items.map((i) => i.reporter_id))]
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', reporterIds)

      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.name]))

      const payload: WorkItemForSummary[] = items.map((i) => ({
        module_id: i.module_id,
        content: i.content,
        links: Array.isArray(i.links) ? i.links : [],
        reporter_name: nameMap.get(i.reporter_id) ?? null,
        period_start: i.period_start,
        period_end: i.period_end,
      }))

      const { data, error } = await supabase.functions.invoke('ai-summarize', {
        body: { work_items: payload },
      })

      if (error) {
        setSummaryError(error.message)
        setWorkSummary(null)
        return
      }
      setWorkSummary(data?.summary ?? null)
    } catch (e) {
      setSummaryError(String(e))
      setWorkSummary(null)
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAndSummarize()
  }, [fetchAndSummarize])

  const askQuestion = useCallback(async () => {
    if (!qaQuestion.trim()) return
    setQaLoading(true)
    setQaAnswer(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setQaAnswer('请先登录')
        return
      }
      const { data: teamItems } = await supabase
        .from('work_items')
        .select('*')
        .neq('reporter_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)

      const items = (teamItems ?? []) as Array<{
        module_id: string
        content: string | null
        reporter_id: string
      }>
      const reporterIds = [...new Set(items.map((i) => i.reporter_id))]
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', reporterIds)
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.name]))

      const context: WorkItemForSummary[] = items.map((i) => ({
        module_id: i.module_id,
        content: i.content,
        links: [],
        reporter_name: nameMap.get(i.reporter_id) ?? null,
        period_start: null,
        period_end: null,
      }))

      const { data, error } = await supabase.functions.invoke('ai-qa', {
        body: { question: qaQuestion.trim(), context },
      })

      if (error) {
        setQaAnswer(`请求失败：${error.message}`)
        return
      }
      setQaAnswer(data?.answer ?? null)
    } catch (e) {
      setQaAnswer(`请求失败：${String(e)}`)
    } finally {
      setQaLoading(false)
    }
  }, [qaQuestion])

  return (
    <>
      <PageTitle breadcrumb="工具与分析 / 智能分析" title="智能分析" />

      <div className="space-y-6">
        {/* 工作进展 AI 汇总 */}
        <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Sparkles size={18} strokeWidth={1.5} className="text-accent" />
              <h3 className="font-medium text-gray-900">下属工作进展 AI 汇总</h3>
            </div>
            <button
              onClick={fetchAndSummarize}
              disabled={summaryLoading}
              className="btn btn-ghost btn-sm"
            >
              {summaryLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                '刷新'
              )}
            </button>
          </div>
          {summaryLoading ? (
            <div className="py-8 text-center text-gray-500">正在生成汇总...</div>
          ) : summaryError ? (
            <div className="py-4 text-error text-sm">{summaryError}</div>
          ) : workSummary ? (
            <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-line bg-gray-50 rounded-lg p-4">
              {workSummary}
            </div>
          ) : (
            <div className="py-4 text-gray-500 text-sm">暂无数据</div>
          )}
        </div>

        {/* 自然语言追问 */}
        <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-900">对汇报内容追问</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            基于下属工作汇报，向 AI 提问获取更深入的信息。
          </p>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={qaQuestion}
              onChange={(e) => setQaQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && askQuestion()}
              placeholder="例如：北区商机推进情况如何？"
              className="input input-bordered flex-1"
              disabled={qaLoading}
            />
            <button
              onClick={askQuestion}
              disabled={qaLoading || !qaQuestion.trim()}
              className="btn btn-primary"
            >
              {qaLoading ? <Loader2 size={18} className="animate-spin" /> : '提问'}
            </button>
          </div>
          {qaAnswer && (
            <div className="rounded-lg bg-primary-50 p-4 text-sm text-gray-800 leading-relaxed border-l-4 border-accent">
              {qaAnswer}
            </div>
          )}
        </div>

        {/* 经营 × 商机智能匹配分析 */}
        <div className="bg-surface rounded-lg border border-gray-200 p-5 shadow-card">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles size={18} strokeWidth={1.5} className="text-gray-600" />
            <h3 className="font-medium text-gray-900">经营 × 商机智能匹配分析（本月）</h3>
          </div>
          <div className="space-y-4">
            {staticInsights.map((i, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border-l-[3px] ${insightStyles[i.type]}`}
              >
                <div className="font-medium text-gray-900 mb-1">{i.title}</div>
                <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {i.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
