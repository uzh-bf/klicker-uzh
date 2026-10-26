export type LogLevel =
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal'
  | 'silent'

export const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: Number.POSITIVE_INFINITY,
}

export function normalizeLogLevel(level?: string): LogLevel {
  const normalized = level?.toLowerCase()
  return normalized && Object.hasOwn(LOG_LEVEL_VALUES, normalized)
    ? (normalized as LogLevel)
    : 'info'
}
