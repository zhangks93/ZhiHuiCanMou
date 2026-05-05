import { loadLLMConfig } from '@/shared/lib/llmConfig'
import type { RegisteredTool, ToolDefinition } from '../types'
import type { BusinessReportPack } from './reportPackTypes'
import { queryBusinessReportPackTool } from './queryBusinessReportPack'
import { validateBusinessReportPack } from './businessReportQuality'
import {
  buildBusinessReportSectionInputs,
  composeAndAuditBusinessReport,
  extractSectionDraft,
  type BusinessReportSectionDraft,
  type BusinessReportSectionInput,
} from '../reportWriting/sectionComposer'
import {
  runBusinessReportSectionWorker,
  sectionWorkerErrorMessage,
} from '../reportWriting/workerClient'

const DEFAULT_CONCURRENCY = 3

interface ComposeArgs {
  node_name?: string
  org_scope_key?: string
  month: string
  previous_month?: string
  cumulative_period?: string
  school_year_target_period?: string
  report_types?: Array<'fone' | 'tuwei'>
  max_units?: number
  worker_concurrency?: number
  disable_subagents?: boolean
}

function parseArgs(args: Record<string, unknown>): { ok: true; values: ComposeArgs } | { ok: false; message: string } {
  const month = typeof args.month === 'string' ? args.month.trim() : ''
  if (!month) return { ok: false, message: 'month 为必填参数' }

  const reportTypes = Array.isArray(args.report_types)
    ? args.report_types.filter((item): item is 'fone' | 'tuwei' => item === 'fone' || item === 'tuwei')
    : undefined

  return {
    ok: true,
    values: {
      node_name: typeof args.node_name === 'string' ? args.node_name : undefined,
      org_scope_key: typeof args.org_scope_key === 'string' ? args.org_scope_key : undefined,
      month,
      previous_month: typeof args.previous_month === 'string' ? args.previous_month : undefined,
      cumulative_period: typeof args.cumulative_period === 'string' ? args.cumulative_period : undefined,
      school_year_target_period: typeof args.school_year_target_period === 'string' ? args.school_year_target_period : undefined,
      report_types: reportTypes?.length ? reportTypes : undefined,
      max_units: typeof args.max_units === 'number' ? args.max_units : undefined,
      worker_concurrency: typeof args.worker_concurrency === 'number' ? args.worker_concurrency : undefined,
      disable_subagents: args.disable_subagents === true,
    },
  }
}

function parsePack(value: string): BusinessReportPack | null {
  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed && typeof parsed === 'object' && 'metadata' in parsed) {
      return parsed as BusinessReportPack
    }
    return null
  } catch {
    return null
  }
}

function buildToolCallArgs(values: ComposeArgs): Record<string, unknown> {
  return {
    node_name: values.node_name,
    org_scope_key: values.org_scope_key,
    month: values.month,
    previous_month: values.previous_month,
    cumulative_period: values.cumulative_period,
    school_year_target_period: values.school_year_target_period,
    report_types: values.report_types,
    max_units: values.max_units,
  }
}

function evidenceFallback(input: BusinessReportSectionInput, reason: string): BusinessReportSectionDraft {
  const evidenceLines = input.evidence.length
    ? input.evidence.slice(0, 8).map(item => `- ${item.evidence_text}`).join('\n')
    : '- 本节缺少可直接引用的证据，结论需降低强度。'
  const guidance = input.writingGuidance.length
    ? input.writingGuidance.map(item => `- ${item}`).join('\n')
    : '- 按现有证据保守表达。'

  return {
    section: input.section,
    markdown: [
      `## ${input.section}`,
      '',
      evidenceLines,
      '',
      '本节判断基于以上系统证据，未覆盖的数据不扩写为已确认事实。',
      '',
      '后续关注：',
      guidance,
    ].join('\n'),
    usedEvidenceIds: input.evidence.map(item => item.id),
    limitations: input.dataStatus === 'missing' || input.dataStatus === 'manual_required'
      ? [`${input.section}数据状态为${input.dataStatus}，已降低结论强度。`]
      : [],
    findings: [reason],
    source: 'fallback',
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  let nextIndex = 0
  const runner = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(items[index])
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner))
  return results
}

async function writeSections(params: {
  inputs: BusinessReportSectionInput[]
  disableSubagents: boolean
  concurrency: number
}): Promise<BusinessReportSectionDraft[]> {
  const config = loadLLMConfig()
  if (!config || params.disableSubagents) {
    return params.inputs.map(input => evidenceFallback(input, config ? 'subagents_disabled' : 'llm_config_missing'))
  }

  return runWithConcurrency(params.inputs, params.concurrency, async (input) => {
    try {
      const raw = await runBusinessReportSectionWorker(input, config)
      return extractSectionDraft(raw, input.section, 'worker')
    } catch (error) {
      return evidenceFallback(input, sectionWorkerErrorMessage(error))
    }
  })
}

export const composeBusinessReportTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'compose_business_report',
      description:
        '受控生成完整经营分析报告。工具内部先调用 query_business_report_pack 获取唯一报告包，再按章节 worker 分章写作、总控合并并执行确定性质量审核。适用于完整报告、月报、汇报材料；非完整报告不要调用。',
      parameters: {
        type: 'object',
        properties: {
          node_name: {
            type: 'string',
            description: '组织节点名称。传空字符串表示集团整体/整棵树。若已通过 resolve_org_nodes 得到 org_scope_key，应同时传 org_scope_key。',
          },
          org_scope_key: {
            type: 'string',
            description: '可选。组织稳定路径键，用于精确定位同名组织，优先级高于 node_name。',
          },
          month: {
            type: 'string',
            description: '目标月份，必须使用 Runtime Data Context 中合法 monthly period，例如 202603。',
          },
          previous_month: {
            type: 'string',
            description: '上月月份。可不传，底层报告包工具会自动推断。',
          },
          cumulative_period: {
            type: 'string',
            description: '截至当月累计期间。可不传，底层报告包工具会自动推断。',
          },
          school_year_target_period: {
            type: 'string',
            description: '学年目标累计期间。可不传，底层报告包工具会自动推断。',
          },
          report_types: {
            type: 'array',
            description: '报表口径，默认同时返回学年预算与突围考核。内部枚举：fone=学年预算，tuwei=突围考核。',
            items: { type: 'string', enum: ['fone', 'tuwei'] },
          },
          max_units: {
            type: 'number',
            description: '最多返回多少个重点单位卡片，默认沿用报告包工具。',
          },
          worker_concurrency: {
            type: 'number',
            description: '章节 worker 并发数，默认 3。',
          },
          disable_subagents: {
            type: 'boolean',
            description: '调试用。为 true 时不调用章节 worker，使用确定性证据 fallback 写作。',
          },
        },
        required: ['month'],
      } as ToolDefinition['function']['parameters'],
    },
  },

  execute: async (args: Record<string, unknown>): Promise<string> => {
    const validated = parseArgs(args)
    if (!validated.ok) return JSON.stringify({ error: validated.message }, null, 2)

    const packResult = await queryBusinessReportPackTool.execute(buildToolCallArgs(validated.values))
    const pack = parsePack(packResult)
    if (!pack) {
      return JSON.stringify({
        passed: false,
        markdown: '',
        error: '报告包生成失败或返回值不是有效报告包。',
        report_pack_result: packResult,
      }, null, 2)
    }

    const packAudit = validateBusinessReportPack(pack)
    if (!packAudit.passed) {
      return JSON.stringify({
        passed: false,
        markdown: [
          `# ${pack.metadata.scope_name}经营分析报告数据不足说明`,
          '',
          '核心经营数据未通过生成前校验，暂不生成完整经营分析报告。',
          '',
          ...packAudit.findings.map(finding => `- ${finding.message}`),
        ].join('\n'),
        pack_audit: packAudit,
      }, null, 2)
    }

    const inputs = buildBusinessReportSectionInputs(pack)
    const drafts = await writeSections({
      inputs,
      disableSubagents: validated.values.disable_subagents === true,
      concurrency: Math.max(1, Math.min(6, validated.values.worker_concurrency ?? DEFAULT_CONCURRENCY)),
    })
    const composition = composeAndAuditBusinessReport(pack, drafts)

    return JSON.stringify({
      passed: composition.audit.passed,
      markdown: composition.markdown,
      output_audit: composition.audit,
      blocking_findings: composition.blockingFindings,
      section_worker_summary: composition.drafts.map(draft => ({
        section: draft.section,
        source: draft.source,
        used_evidence_ids: draft.usedEvidenceIds,
        limitations: draft.limitations,
        findings: draft.findings,
      })),
      pack_audit: packAudit,
      guidance: composition.audit.passed
        ? '可以输出 markdown 作为终稿。'
        : '存在审核问题。请基于 markdown 和 blocking_findings 修复后，再调用 audit_business_report 或重新调用本工具。',
    }, null, 2)
  },
}
