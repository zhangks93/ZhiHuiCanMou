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
    return stringifyResult(await getFeishuCliHealth())
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
    return stringifyResult(await getFeishuAuthStatus())
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
            description: 'Operation arguments. Common examples: start/end ISO time, query, limit, status, due, user_ids.',
          },
        },
        required: ['operation'],
      },
    },
  },
  async execute(args) {
    const operation = requireEnum<readonly ReadOperation[]>(args.operation, READ_OPERATIONS, 'operation')
    const operationArgs = asRecord(args.args)
    return stringifyResult(await runFeishuReadOperation({ operation, args: operationArgs }))
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
            description: 'Operation arguments. For task_create use title, description, due, reminder. For calendar_event_create use title, start, end, description, location, attendee_ids. For doc_create_markdown use title and markdown.',
          },
        },
        required: ['operation', 'args'],
      },
    },
  },
  async execute(args) {
    const operation = requireEnum<readonly WriteOperation[]>(args.operation, WRITE_OPERATIONS, 'operation')
    const operationArgs = asRecord(args.args)
    return stringifyResult(await previewFeishuWriteOperation({ operation, args: operationArgs }))
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
    return stringifyResult(await confirmFeishuWriteOperation(operationId))
  },
}

export const feishuTools = [
  feishuCliHealthTool,
  feishuAuthStatusTool,
  feishuReadTool,
  feishuWritePreviewTool,
  feishuWriteConfirmTool,
]
