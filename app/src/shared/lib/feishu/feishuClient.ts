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
  bundledVersion?: string | null
  activeVersion?: string | null
  requiredVersion: string
  updateAvailable: boolean
  updateStatus?: string | null
  autoUpdateStatus?: string | null
  lastUpdateError?: string | null
  recommendedAction: 'configure' | 'authorize' | 'syncScopes' | 'update' | 'ready' | string
}

export interface FeishuAuthDomainOption {
  id: string
  label: string
  description: string
  enabledScopeCount: number
  available: boolean
  recommended: boolean
}

export interface FeishuAuthScopeCatalog {
  domains: FeishuAuthDomainOption[]
  appScopes: string[]
  recommendedDomains: string[]
  appId?: string | null
  brand?: string | null
  error?: string | null
}

export interface FeishuAuthPreset {
  id: string
  label: string
  description: string
  domains: string[]
  recommended: boolean
}

export interface FeishuAuthPresetCatalog {
  presets: FeishuAuthPreset[]
  defaultPresetId: string
}

export interface FeishuAuthPreferences {
  selectedDomains: string[]
  lastSyncedDomains: string[]
  pendingSyncDomains: string[]
  pendingDeviceCode?: string | null
  pendingVerificationUrl?: string | null
}

export interface FeishuAuthEffectiveState {
  selectedDomains: string[]
  syncedDomains: string[]
  pendingSyncDomains: string[]
  grantedDomains: string[]
  needsSync: boolean
  pendingAuthUrl?: string | null
  authenticated: boolean
  configured: boolean
}

export interface FeishuCliUpdateCheck {
  activeVersion?: string | null
  bundledVersion?: string | null
  latestVersion?: string | null
  requiredVersion: string
  updateAvailable: boolean
  activeSource: string
}

export interface FeishuCliUpdateResult {
  success: boolean
  activeVersion?: string | null
  activeSource: string
  message: string
  updateStatus: string
}

export interface FeishuAuthPreferencesSaveRequest {
  selectedDomains: string[]
}

export interface FeishuAuthSyncRequest {
  selectedDomains: string[]
}

export interface FeishuAuthSyncResult {
  selectedDomains: string[]
  lastSyncedDomains: string[]
  verificationUrl?: string | null
  pendingDeviceCode?: string | null
  hasDeviceCode: boolean
  reauthRequired: boolean
  status: string
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

export async function autoEnsureFeishuCliReady() {
  return invokeTauri<FeishuCliHealth>('feishu_cli_auto_ensure_ready')
}

export async function checkFeishuCliUpdate() {
  return invokeTauri<FeishuCliUpdateCheck>('feishu_cli_check_update')
}

export async function updateFeishuCli() {
  return invokeTauri<FeishuCliUpdateResult>('feishu_cli_update')
}

export async function getFeishuAuthEffectiveState() {
  return invokeTauri<FeishuAuthEffectiveState>('feishu_auth_effective_state')
}

export async function initFeishuConfig(request: FeishuConfigInitRequest) {
  return invokeTauri<FeishuCliResponse>('feishu_config_init', { request })
}

export async function beginFeishuAuth(request: FeishuAuthBeginRequest = {}) {
  return invokeTauri<FeishuCliResponse>('feishu_auth_begin', { request })
}

export async function getFeishuAuthScopeCatalog() {
  return invokeTauri<FeishuAuthScopeCatalog>('feishu_auth_scope_catalog')
}

export async function getFeishuAuthPresets() {
  return invokeTauri<FeishuAuthPresetCatalog>('feishu_auth_presets_get')
}

export async function getFeishuAuthPreferences() {
  return invokeTauri<FeishuAuthPreferences>('feishu_auth_preferences_get')
}

export async function saveFeishuAuthPreferences(request: FeishuAuthPreferencesSaveRequest) {
  return invokeTauri<FeishuAuthPreferences>('feishu_auth_preferences_save', { request })
}

export async function syncFeishuAuth(request: FeishuAuthSyncRequest) {
  return invokeTauri<FeishuAuthSyncResult>('feishu_auth_sync', { request })
}

export async function completeFeishuAuth(request: FeishuAuthCompleteRequest) {
  return invokeTauri<FeishuCliResponse>('feishu_auth_complete', { request })
}

export async function logoutFeishuAuth() {
  return invokeTauri<FeishuCliResponse>('feishu_auth_logout')
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
