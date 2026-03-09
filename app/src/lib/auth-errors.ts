/**
 * Error message catalog for authentication flows
 * Maps error codes to user-friendly messages with actionable suggestions
 */

export interface AuthError {
  code: string
  title: string
  message: string
  suggestion: string
  retryable: boolean
}

export const AUTH_ERROR_CATALOG: Record<string, AuthError> = {
  // Backend errors (from feishu-callback)
  AUTH_001: {
    code: 'AUTH_001',
    title: '配置错误',
    message: '服务器配置不完整，无法完成登录',
    suggestion: '请联系系统管理员检查飞书应用配置',
    retryable: false,
  },
  AUTH_002: {
    code: 'AUTH_002',
    title: '授权失败',
    message: '未收到飞书授权码',
    suggestion: '请重新尝试登录，确保完成飞书授权流程',
    retryable: true,
  },
  AUTH_003: {
    code: 'AUTH_003',
    title: '安全验证失败',
    message: '缺少安全验证参数',
    suggestion: '请重新登录以获取新的安全令牌',
    retryable: true,
  },
  AUTH_004: {
    code: 'AUTH_004',
    title: '飞书服务异常',
    message: '无法获取飞书应用令牌',
    suggestion: '飞书服务可能暂时不可用，请稍后重试',
    retryable: true,
  },
  AUTH_005: {
    code: 'AUTH_005',
    title: '授权码无效',
    message: '无法使用授权码获取访问令牌',
    suggestion: '授权码可能已过期，请重新登录',
    retryable: true,
  },
  AUTH_006: {
    code: 'AUTH_006',
    title: '获取用户信息失败',
    message: '无法从飞书获取您的用户信息',
    suggestion: '请检查飞书账号权限设置，或稍后重试',
    retryable: true,
  },
  AUTH_007: {
    code: 'AUTH_007',
    title: '数据库查询失败',
    message: '无法查询用户数据',
    suggestion: '数据库服务可能暂时不可用，请稍后重试',
    retryable: true,
  },
  AUTH_008: {
    code: 'AUTH_008',
    title: '创建用户失败',
    message: '无法创建新用户账号',
    suggestion: '请联系系统管理员或稍后重试',
    retryable: true,
  },
  AUTH_009: {
    code: 'AUTH_009',
    title: '会话创建失败',
    message: '无法生成登录会话',
    suggestion: '请稍后重试，如问题持续请联系支持',
    retryable: true,
  },
  AUTH_999: {
    code: 'AUTH_999',
    title: '未知错误',
    message: '登录过程中发生意外错误',
    suggestion: '请重试，如问题持续请联系技术支持',
    retryable: true,
  },

  // Frontend errors
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    title: '网络连接失败',
    message: '无法连接到服务器',
    suggestion: '请检查网络连接后重试',
    retryable: true,
  },
  TIMEOUT_ERROR: {
    code: 'TIMEOUT_ERROR',
    title: '请求超时',
    message: '服务器响应时间过长',
    suggestion: '请检查网络状况或稍后重试',
    retryable: true,
  },
  STATE_VALIDATION_FAILED: {
    code: 'STATE_VALIDATION_FAILED',
    title: '安全验证失败',
    message: 'CSRF 令牌验证失败',
    suggestion: '可能存在安全风险，请重新登录',
    retryable: true,
  },
  MISSING_TOKENS: {
    code: 'MISSING_TOKENS',
    title: '认证信息缺失',
    message: '未收到访问令牌',
    suggestion: '请重新登录完成授权流程',
    retryable: true,
  },
  SESSION_SET_FAILED: {
    code: 'SESSION_SET_FAILED',
    title: '会话设置失败',
    message: '无法保存登录会话',
    suggestion: '请检查浏览器设置是否允许存储数据',
    retryable: true,
  },
  DEEP_LINK_TIMEOUT: {
    code: 'DEEP_LINK_TIMEOUT',
    title: '回调超时',
    message: '等待授权回调超时',
    suggestion: '请确保完成飞书授权，或重新尝试登录',
    retryable: true,
  },
  DEEP_LINK_FAILED: {
    code: 'DEEP_LINK_FAILED',
    title: 'Deep Link 失败',
    message: '无法通过 Deep Link 返回应用',
    suggestion: '请尝试手动返回应用或重新登录',
    retryable: true,
  },
}

/**
 * Get error details by code
 */
export function getAuthError(code: string): AuthError {
  return AUTH_ERROR_CATALOG[code] || {
    code: 'UNKNOWN',
    title: '未知错误',
    message: '发生了未知错误',
    suggestion: '请重试或联系技术支持',
    retryable: true,
  }
}

/**
 * Parse error from backend response
 */
export function parseBackendError(error: unknown): AuthError {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: string; error_code?: string }).code || (error as { code?: string; error_code?: string }).error_code
    if (code && AUTH_ERROR_CATALOG[code]) {
      return AUTH_ERROR_CATALOG[code]
    }
  }
  return getAuthError('AUTH_999')
}

/**
 * Create error from exception
 */
export function createAuthError(error: unknown): AuthError {
  if (error instanceof Error) {
    // Network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return AUTH_ERROR_CATALOG.NETWORK_ERROR
    }
    // Timeout errors
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return AUTH_ERROR_CATALOG.TIMEOUT_ERROR
    }
  }
  return getAuthError('AUTH_999')
}

/**
 * Format error for display
 */
export function formatAuthError(error: AuthError): string {
  return `${error.title}: ${error.message}\n建议: ${error.suggestion}`
}
