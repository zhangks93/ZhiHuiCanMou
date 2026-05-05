import type { LLMConfig } from '@/shared/lib/llmConfig'
import { appFetch } from '@/shared/lib/httpClient'
import { getErrorMessage } from '@/shared/lib/errorMessage'
import type { BusinessReportSectionInput } from './sectionComposer'

interface WorkerClientOptions {
  timeoutMs?: number
}

function buildSectionWorkerPrompt(input: BusinessReportSectionInput): string {
  return [
    '你是经营分析报告的分章写作 worker。只写指定章节，不写其他章节。',
    '',
    '硬约束：',
    '- 只能使用输入 JSON 中的数据、证据和规则，不得编造数字、业务原因、责任人或完成时点。',
    '- 不得输出英文字符、内部字段名、工具名、表名、内部枚举或禁用词。',
    '- 学年预算、突围考核、当月、截至当月累计、学年目标累计必须用中文表述。',
    '- 人工补充数据只能写入数据限制类章节，不能写成已发生事实。',
    '- 每张核心表后至少写带数字依据的判断。',
    '',
    '输出必须是严格 JSON，不要包裹 Markdown 代码块：',
    '{"markdown":"## 章节标题\\n\\n正文","used_evidence_ids":["..."],"limitations":["..."],"findings":["..."]}',
    '',
    '章节输入 JSON：',
    JSON.stringify(input),
  ].join('\n')
}

function extractTextFromOpenAICompatible(payload: unknown): string {
  const record = payload as Record<string, unknown>
  const choices = Array.isArray(record.choices) ? record.choices : []
  const first = choices[0] as Record<string, unknown> | undefined
  const message = first?.message as Record<string, unknown> | undefined
  return typeof message?.content === 'string' ? message.content : ''
}

function extractTextFromClaude(payload: unknown): string {
  const record = payload as Record<string, unknown>
  const content = Array.isArray(record.content) ? record.content : []
  return content
    .map(item => {
      const block = item as Record<string, unknown>
      return block.type === 'text' && typeof block.text === 'string' ? block.text : ''
    })
    .join('')
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await appFetch(url, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function runBusinessReportSectionWorker(
  input: BusinessReportSectionInput,
  config: LLMConfig,
  options: WorkerClientOptions = {}
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 90_000
  const prompt = buildSectionWorkerPrompt(input)

  if (config.provider === 'claude') {
    const response = await fetchWithTimeout(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    }, timeoutMs)

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`章节 worker 调用失败：${response.status} ${text.slice(0, 200)}`)
    }

    return extractTextFromClaude(await response.json())
  }

  const response = await fetchWithTimeout(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      temperature: 0.2,
    }),
  }, timeoutMs)

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`章节 worker 调用失败：${response.status} ${text.slice(0, 200)}`)
  }

  const content = extractTextFromOpenAICompatible(await response.json())
  if (!content.trim()) {
    throw new Error('章节 worker 未返回内容')
  }
  return content
}

export function sectionWorkerErrorMessage(error: unknown): string {
  return getErrorMessage(error, '章节 worker 失败')
}
