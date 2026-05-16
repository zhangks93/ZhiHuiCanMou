import { invokeTauri } from '@/shared/lib/tauri'

export interface FeishuCliHealth {
  installed: boolean
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

export async function getFeishuCliHealth(cliPath?: string | null) {
  return invokeTauri<FeishuCliHealth>('feishu_cli_health', { cliPath })
}

export async function getFeishuAuthStatus(cliPath?: string | null) {
  return invokeTauri<FeishuCliResponse>('feishu_auth_status', { cliPath })
}

export async function runFeishuReadOperation(request: FeishuCliRequest, cliPath?: string | null) {
  return invokeTauri<FeishuCliResponse>('feishu_read_operation', {
    cliPath,
    request: {
      operation: request.operation,
      args: request.args ?? {},
    },
  })
}

export async function previewFeishuWriteOperation(request: FeishuCliRequest, cliPath?: string | null) {
  return invokeTauri<FeishuWritePreview>('feishu_write_preview', {
    cliPath,
    request: {
      operation: request.operation,
      args: request.args ?? {},
    },
  })
}

export async function confirmFeishuWriteOperation(operationId: string, cliPath?: string | null) {
  return invokeTauri<FeishuCliResponse>('feishu_write_confirm', {
    cliPath,
    operationId,
  })
}
