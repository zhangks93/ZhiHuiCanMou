// 读取 Skill 内置资源文件 Tool
// 从 asset registry 读取，资源在构建时随 skill 一起打包

import type { RegisteredTool } from '../types'
import { readAsset, listAssets } from '../skills/assetRegistry'

export const readFileTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'read_file',
      description:
        '读取当前 Skill 已注册的模板与 references 资源。常用于报告模式读取模板、写作规范和图表指引。文件路径格式：/assets/<skill-id>/<asset-path> 或 /templates/<filename>（兼容旧路径）。' +
        '例如：/assets/financial-analysis/biz-analysis-report.md、/assets/financial-analysis/references/report-generation.md、/assets/financial-analysis/references/analysis-method.md、/assets/financial-analysis/references/chart-guidance.md。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              '文件路径。例如：/assets/financial-analysis/biz-analysis-report.md 或 /templates/biz-analysis-report.md',
          },
        },
        required: ['path'],
      },
    },
  },

  execute: async (args: Record<string, unknown>): Promise<string> => {
    const path = args.path as string

    if (!path) {
      throw new Error('缺少 path 参数')
    }

    // 防止路径穿越
    if (path.includes('..')) {
      throw new Error('路径不合法：不允许使用 ".."')
    }

    const content = readAsset(path)
    if (content === undefined) {
      const available = listAssets().join('\n  ')
      throw new Error(`文件未找到：${path}\n可用文件：\n  ${available}`)
    }

    return content
  },
}
