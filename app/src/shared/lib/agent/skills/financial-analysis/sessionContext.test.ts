import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../../types'
import { updateFinancialAnalysisSessionContext } from './sessionContext'

function user(content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content,
    timestamp: Date.now(),
  }
}

function assistant(toolCalls: ChatMessage['toolCalls']): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    toolCalls,
  }
}

describe('financial analysis session context', () => {
  it('keeps ambiguous org resolution below high confidence', () => {
    const context = updateFinancialAnalysisSessionContext({
      userMessage: user('看一下东部经营情况'),
      assistantMessage: assistant([
        {
          id: 'tool-1',
          name: 'resolve_org_nodes',
          arguments: { keyword: '东部' },
          status: 'success',
          result: JSON.stringify({
            keyword: '东部',
            match_count: 6,
            confidence: 'medium',
            suggested_filter_mode: 'level_1',
            canonical_scope: { level_0: '智汇后勤集团', level_1: '东部区域', level_2: null },
            top_matches: [],
            grouped_summary: [{ level_0: '智汇后勤集团', level_1: '东部区域', level_2_list: [], node_count: 6 }],
          }),
        },
      ]),
    })

    expect(context.scope?.level_1).toBe('东部区域')
    expect(context.scope?.confidence).toBe('medium')
  })

  it('does not replace previous scope when a query only returns candidates', () => {
    const previous = updateFinancialAnalysisSessionContext({
      userMessage: user('后勤管理中心 202603 收入是多少'),
      assistantMessage: assistant([
        {
          id: 'tool-1',
          name: 'resolve_org_nodes',
          arguments: { keyword: '后勤管理中心' },
          status: 'success',
          result: JSON.stringify({
            match_count: 1,
            confidence: 'high',
            suggested_filter_mode: 'node_name',
            canonical_scope: { level_0: '智汇后勤集团', level_1: '后勤管理中心', level_2: null },
            top_matches: [{ node_name: '后勤管理中心' }],
            grouped_summary: [],
          }),
        },
      ]),
    })

    const next = updateFinancialAnalysisSessionContext({
      previous,
      userMessage: user('再看一下餐饮'),
      assistantMessage: assistant([
        {
          id: 'tool-2',
          name: 'query_business_report_pack',
          arguments: { node_name: '餐饮', month: '202603', cumulative_period: '<202604' },
          status: 'success',
          result: JSON.stringify({
            message: '匹配到多个组织节点，请提供更精确的 node_name',
            candidates: [{ node_name: '广州餐饮' }, { node_name: '深圳餐饮' }],
          }),
        },
      ]),
    })

    expect(next.scope?.nodeNames).toEqual(['后勤管理中心'])
    expect(next.scope?.confidence).toBe('high')
  })

  it('remembers loaded report references without forcing rereads', () => {
    const context = updateFinancialAnalysisSessionContext({
      userMessage: user('生成完整经营分析报告'),
      assistantMessage: assistant([
        {
          id: 'tool-1',
          name: 'read_file',
          arguments: { path: '/assets/financial-analysis/biz-analysis-report.md' },
          status: 'success',
          result: '# template',
        },
        {
          id: 'tool-2',
          name: 'read_file',
          arguments: { path: '/assets/financial-analysis/references/report-generation.md' },
          status: 'success',
          result: '# reference',
        },
      ]),
    })

    expect(context.reportMode?.templateLoaded).toBe(true)
    expect(context.reportMode?.reportGenerationLoaded).toBe(true)
    expect(context.reportMode?.chartOutputMode).toBeUndefined()
    expect(context.intent?.goal).toBe('report')
  })

  it('only enables chart output mode after chart guidance is loaded', () => {
    const context = updateFinancialAnalysisSessionContext({
      userMessage: user('生成图表配置'),
      assistantMessage: assistant([
        {
          id: 'tool-1',
          name: 'read_file',
          arguments: { path: '/assets/financial-analysis/references/chart-guidance.md' },
          status: 'success',
          result: '# chart guidance',
        },
      ]),
    })

    expect(context.reportMode?.chartGuidanceLoaded).toBe(true)
    expect(context.reportMode?.chartOutputMode).toBe('structured_chart_spec_json')
  })
})
