export function getErrorMessage(error: unknown, fallback = '操作失败，请稍后重试。'): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    for (const key of ['message', 'error', 'details', 'hint', 'code']) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) {
        return value
      }
    }

    try {
      const serialized = JSON.stringify(error)
      if (serialized && serialized !== '{}') {
        return serialized
      }
    } catch {
      // Fall through to fallback.
    }
  }

  return fallback
}
