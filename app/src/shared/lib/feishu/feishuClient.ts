import { invokeTauri } from '@/shared/lib/tauri'

export interface FeishuCliHealth {
  installed: boolean
  bundled: boolean
  configured: boolean
  authenticated: boolean
  path?: string | null
  version?: string | null
  source?: string | null
  error?: string | null
}

export interface FeishuCliRequest {
  operation: string
  args?: Record<string, unknown>
}

export interface FeishuCliResponse {
  operation: string
  command: string[]
  stdout: string
  stderr: string
  parsed_json?: unknown
}

export interface FeishuWritePreview {
  operation_id: string
  operation: string
  summary: string
  command: string[]
  dry_run_command: string[]
  dry_run_result: FeishuCliResponse
  expires_at: number
}

export interface FeishuConfigInitRequest {
  appId: string
  appSecret: string
  brand?: 'feishu' | 'lark'
}

export interface FeishuAuthBeginRequest {
  domains?: string[]
  scopes?: string[]
  excludes?: string[]
}

export interface FeishuAuthCompleteRequest {
  device_code: string
}

export async function getFeishuCliHealth() {
  return invokeTauri<FeishuCliHealth>('feishu_cli_health')
}

export async function initFeishuConfig(request: FeishuConfigInitRequest) {
  return invokeTauri<FeishuCliResponse>('feishu_config_init', { request })
}

export async function beginFeishuAuth(request: FeishuAuthBeginRequest = {}) {
  return invokeTauri<FeishuCliResponse>('feishu_auth_begin', { request })
}

export async function completeFeishuAuth(request: FeishuAuthCompleteRequest) {
  return invokeTauri<FeishuCliResponse>('feishu_auth_complete', { request })
}

export async function removeFeishuConfig() {
  return invokeTauri<FeishuCliResponse>('feishu_config_remove')
}

export async function getFeishuAuthStatus() {
  return invokeTauri<FeishuCliResponse>('feishu_auth_status')
}

export async function runFeishuReadOperation(request: FeishuCliRequest) {
  return invokeTauri<FeishuCliResponse>('feishu_read_operation', {
    request: {
      operation: request.operation,
      args: request.args ?? {},
    },
  })
}

export async function previewFeishuWriteOperation(request: FeishuCliRequest) {
  return invokeTauri<FeishuWritePreview>('feishu_write_preview', {
    request: {
      operation: request.operation,
      args: request.args ?? {},
    },
  })
}

export async function confirmFeishuWriteOperation(operationId: string) {
  return invokeTauri<FeishuCliResponse>('feishu_write_confirm', {
    operationId,
  })
}
