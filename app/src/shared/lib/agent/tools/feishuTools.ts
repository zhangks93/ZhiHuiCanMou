import type { RegisteredTool } from '@/shared/lib/agent/types'
import {
  confirmFeishuWriteOperation,
  getFeishuAuthStatus,
  getFeishuCliHealth,
  previewFeishuWriteOperation,
  runFeishuReadOperation,
} from '@/shared/lib/feishu/feishuClient'

const READ_OPERATIONS = [
  'calendar_agenda',
  'calendar_freebusy',
  'contact_search',
  'task_list',
  'doc_search',
  'minutes_search',
] as const

const WRITE_OPERATIONS = [
  'task_create',
  'calendar_event_create',
  'doc_create_markdown',
] as const

type ReadOperation = (typeof READ_OPERATIONS)[number]
type WriteOperation = (typeof WRITE_OPERATIONS)[number]

interface FeishuCliStructuredError {
  code?: string
  message?: string
  settingsPath?: string
  missingDomains?: string[]
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function requireEnum<T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] {
  const text = asString(value)
  if ((allowed as readonly string[]).includes(text)) return text as T[number]
  throw new Error(`${label} 必须是以下值之一：${allowed.join(', ')}`)
}

function stringifyResult(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function parseStructuredFeishuError(error: unknown): FeishuCliStructuredError | null {
  const message = error instanceof Error ? error.message : String(error ?? '')
  try {
    const parsed = JSON.parse(message) as FeishuCliStructuredError
    if (parsed && typeof parsed === 'object' && parsed.code) return parsed
  } catch {
    return null
  }
  return null
}

function formatFeishuToolError(error: unknown) {
  const structured = parseStructuredFeishuError(error)
  if (!structured) {
    return stringifyResult({
      success: false,
      message: error instanceof Error ? error.message : String(error ?? '飞书 CLI 操作失败'),
    })
  }

  const guidance = (() => {
    switch (structured.code) {
      case 'CLI_OUTDATED':
        return '请打开设置页「飞书 CLI」，点击「一键更新 lark-cli」。'
      case 'AUTH_SCOPE_MISSING':
        return `请在设置页勾选并同步授权范围：${(structured.missingDomains ?? []).join('、') || '对应业务域'}。`
      case 'AUTH_REQUIRED':
        return '请打开设置页完成飞书 OAuth 授权。'
      case 'CLI_MISSING':
        return '内置 lark-cli 不可用，请在设置页尝试更新或重新安装应用。'
      default:
        return '请打开设置页检查飞书 CLI 配置与授权。'
    }
  })()

  return stringifyResult({
    success: false,
    code: structured.code,
    message: structured.message ?? '飞书 CLI 操作失败',
    settingsPath: structured.settingsPath ?? '/settings?tab=feishu-cli',
    missingDomains: structured.missingDomains ?? [],
    guidance,
  })
}

async function runFeishuTool<T>(action: () => Promise<T>) {
  try {
    return stringifyResult(await action())
  } catch (error) {
    return formatFeishuToolError(error)
  }
}

export const feishuCliHealthTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'feishu_cli_health',
      description: 'Check whether lark-cli is installed and available on this desktop client.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  async execute() {
    return runFeishuTool(() => getFeishuCliHealth())
  },
}

export const feishuAuthStatusTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'feishu_auth_status',
      description: 'Check current Feishu CLI login and authorization status.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  async execute() {
    return runFeishuTool(() => getFeishuAuthStatus())
  },
}

export const feishuReadTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'feishu_read',
      description: 'Run a safe read-only Feishu CLI operation, such as calendar agenda, freebusy, contact search, task list, doc search, or meeting minutes search.',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: [...READ_OPERATIONS],
            description: 'Read operation to run.',
          },
          args: {
            type: 'object',
            description: 'Operation arguments. calendar_agenda uses start/end. calendar_freebusy uses start/end and optional user_id. contact_search uses query and optional page_size or limit. task_list uses query, status, due_start/due_end, page_limit or limit. doc_search/minutes_search use query and optional page_size or limit.',
          },
        },
        required: ['operation'],
      },
    },
  },
  async execute(args) {
    const operation = requireEnum<readonly ReadOperation[]>(args.operation, READ_OPERATIONS, 'operation')
    const operationArgs = asRecord(args.args)
    return runFeishuTool(() => runFeishuReadOperation({ operation, args: operationArgs }))
  },
}

export const feishuWritePreviewTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'feishu_write_preview',
      description: 'Create a dry-run preview for a low-risk Feishu write operation. The user must confirm the returned operation_id before execution.',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: [...WRITE_OPERATIONS],
            description: 'Write operation to preview.',
          },
          args: {
            type: 'object',
            description: 'Operation arguments. task_create uses title, description, due, assignee_ids, follower_ids. calendar_event_create uses title, start, end, description, attendee_ids. doc_create_markdown uses title, markdown, folder_token or parent_token.',
          },
        },
        required: ['operation', 'args'],
      },
    },
  },
  async execute(args) {
    const operation = requireEnum<readonly WriteOperation[]>(args.operation, WRITE_OPERATIONS, 'operation')
    const operationArgs = asRecord(args.args)
    return runFeishuTool(() => previewFeishuWriteOperation({ operation, args: operationArgs }))
  },
}

export const feishuWriteConfirmTool: RegisteredTool = {
  definition: {
    type: 'function',
    function: {
      name: 'feishu_write_confirm',
      description: 'Execute a previously previewed Feishu write operation by operation_id after explicit user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          operation_id: {
            type: 'string',
            description: 'Operation id returned by feishu_write_preview.',
          },
        },
        required: ['operation_id'],
      },
    },
  },
  async execute(args) {
    const operationId = asString(args.operation_id)
    if (!operationId) throw new Error('operation_id 不能为空')
    return runFeishuTool(() => confirmFeishuWriteOperation(operationId))
  },
}

export const feishuTools = [
  feishuCliHealthTool,
  feishuAuthStatusTool,
  feishuReadTool,
  feishuWritePreviewTool,
  feishuWriteConfirmTool,
]
