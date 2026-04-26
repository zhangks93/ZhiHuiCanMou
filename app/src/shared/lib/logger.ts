type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const REDACTED_KEYS = ['token', 'key', 'authorization', 'cookie', 'secret', 'password']

function shouldLog(level: LogLevel) {
  if (level === 'debug') {
    return import.meta.env.DEV
  }
  return true
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => {
        const shouldRedact = REDACTED_KEYS.some((candidate) => key.toLowerCase().includes(candidate))
        return [key, shouldRedact ? '[REDACTED]' : redactValue(nestedValue)]
      }),
    )
  }

  return value
}

function write(level: Exclude<LogLevel, 'debug'> | 'debug', message: string, meta?: unknown) {
  if (!shouldLog(level)) {
    return
  }

  const payload = meta === undefined ? undefined : redactValue(meta)
  const prefix = `[Canmou] ${message}`

  if (level === 'error') {
    console.error(prefix, payload)
    return
  }
  if (level === 'warn') {
    console.warn(prefix, payload)
    return
  }
  if (level === 'info') {
    console.info(prefix, payload)
    return
  }

  console.debug(prefix, payload)
}

export const logger = {
  debug(message: string, meta?: unknown) {
    write('debug', message, meta)
  },
  info(message: string, meta?: unknown) {
    write('info', message, meta)
  },
  warn(message: string, meta?: unknown) {
    write('warn', message, meta)
  },
  error(message: string, meta?: unknown) {
    write('error', message, meta)
  },
}
