export type EdgeLoggerLevel = 'debug' | 'info' | 'warn' | 'error'

export interface EdgeLogger {
  debug: LogMethod
  info: LogMethod
  warn: LogMethod
  error: LogMethod
  child(bindings: Record<string, unknown>): EdgeLogger
}

export type LogMethod = {
  (message: string, context?: Record<string, unknown>): void
  (context: Record<string, unknown>, message?: string): void
  (): void
}

function emit(
  level: EdgeLoggerLevel,
  bindings: Record<string, unknown>,
  message?: string,
  context?: Record<string, unknown>
) {
  const payload = {
    level,
    ...bindings,
    ...(context ?? {}),
    ...(message ? { message } : {}),
  }

  const consoleMethod = level === 'debug' ? 'log' : level
  // eslint-disable-next-line no-console
  console[consoleMethod](payload)
}

export function createEdgeLogger(
  bindings: Record<string, unknown> = {}
): EdgeLogger {
  const log =
    (level: EdgeLoggerLevel): LogMethod =>
    (
      messageOrContext?: string | Record<string, unknown>,
      maybeContext?: Record<string, unknown>
    ) => {
      const isMessage = typeof messageOrContext === 'string'
      const message = isMessage ? (messageOrContext as string) : undefined
      const context = isMessage
        ? maybeContext
        : (messageOrContext as Record<string, unknown> | undefined)

      emit(level, bindings, message, context)
    }

  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    child(childBindings) {
      return createEdgeLogger({ ...bindings, ...childBindings })
    },
  }
}

export const edgeLogger = createEdgeLogger({ service: '@klicker-uzh/auth' })
