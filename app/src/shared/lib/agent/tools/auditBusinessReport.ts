import type { RegisteredTool, ToolDefinition } from '../types'
import type { BusinessReportPack } from './reportPackTypes'
import { validateBusinessReportOutput, validateBusinessReportPack } from './businessReportQuality'

function parsePack(value: unknown): BusinessReportPack | undefined {
  if (!value) return undefined
  if (typeof value === 'object') return value as BusinessReportPack
  if (typeof value !== 'string' || !value.trim()) return undefined

  try {
    return JSON.parse(value) as BusinessReportPack
  } catch {
    return undefined
  }
}

export const auditBusinessReportTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'audit_business_report',
      description:
        '对完整经营分析报告 Markdown 进行确定性质量审核，检查必需章节、口径、禁用词、人工补充数据边界、表格密度与报告包质量契约。完整报告终稿前应调用一次。',
      parameters: {
        type: 'object',
        properties: {
          markdown: {
            type: 'string',
            description: '待审核的经营分析报告 Markdown 初稿或终稿。',
          },
          report_pack_json: {
            type: 'string',
            description: '可选。query_business_report_pack 返回的数据包 JSON 字符串；传入后会结合报告包质量契约审核。',
          },
        },
        required: ['markdown'],
      } as ToolDefinition['function']['parameters'],
    },
  },

  execute: async (args: Record<string, unknown>): Promise<string> => {
    const markdown = typeof args.markdown === 'string' ? args.markdown : ''
    const pack = parsePack(args.report_pack_json)
    const outputAudit = validateBusinessReportOutput(markdown, pack)
    const packAudit = pack ? validateBusinessReportPack(pack) : undefined

    return JSON.stringify({
      passed: outputAudit.passed && (packAudit?.passed ?? true),
      output_audit: outputAudit,
      pack_audit: packAudit,
      guidance:
        outputAudit.passed && (packAudit?.passed ?? true)
          ? '可以输出终稿。'
          : '请先修复 error 级问题；warning 级问题如因数据缺失无法修复，需在数据限制与待补说明中交代。',
    }, null, 2)
  },
}
