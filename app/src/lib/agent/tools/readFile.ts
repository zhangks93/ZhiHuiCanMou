// 读取应用内模板文件 Tool
// 只允许读取 public/templates/ 目录下的文件，防止路径穿越

import type { RegisteredTool } from '../types'

const ALLOWED_PREFIX = '/templates/'

export const readFileTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'read_template',
      description: '读取应用内置的模板文件。当需要按照标准格式输出经营分析报告时，调用此工具读取报告模板，然后按模板结构填写数据。目前可用文件：/templates/biz-analysis-report.md（经营分析报告模板）。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '文件路径，必须以 /templates/ 开头。例如：/templates/biz-analysis-report.md',
          },
        },
        required: ['path'],
      },
    },
  },

  execute: async (args: Record<string, unknown>): Promise<string> => {
    const path = args.path as string

    if (!path || !path.startsWith(ALLOWED_PREFIX)) {
      throw new Error(`路径不合法：只允许读取 ${ALLOWED_PREFIX} 目录下的文件`)
    }

    // 防止路径穿越
    if (path.includes('..')) {
      throw new Error('路径不合法：不允许使用 ".."')
    }

    const response = await fetch(path)
    if (!response.ok) {
      throw new Error(`文件未找到：${path} (${response.status})`)
    }

    const content = await response.text()
    return content
  },
}
