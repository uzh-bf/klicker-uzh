import type { AppLogger } from '@klicker-uzh/logging/node'

export function createTaskAppLogger(
  context: {
    logger: {
      debug: (message: string, extra?: any) => unknown
      info: (message: string, extra?: any) => unknown
      warn: (message: string, extra?: any) => unknown
      error: (message: string, extra?: any) => unknown
    }
  },
  fields: Record<string, unknown> = {}
): AppLogger {
  const forward = (
    level: 'debug' | 'info' | 'warn' | 'error',
    extra: Record<string, unknown> | undefined,
    message?: string
  ) => {
    const merged = { ...fields, ...extra }
    const text = message ?? ''
    return level === 'warn' || level === 'error'
      ? context.logger[level](text, { extra: merged })
      : context.logger[level](text, merged)
  }

  return {
    debug: (extra: Record<string, unknown>, message?: string) =>
      forward('debug', extra, message),
    info: (extra: Record<string, unknown>, message?: string) =>
      forward('info', extra, message),
    warn: (extra: Record<string, unknown>, message?: string) =>
      forward('warn', extra, message),
    error: (extra: Record<string, unknown>, message?: string) =>
      forward('error', extra, message),
    fatal: (extra: Record<string, unknown>, message?: string) =>
      forward('error', extra, message),
    child: (childFields: Record<string, unknown>) =>
      createTaskAppLogger(context, { ...fields, ...childFields }),
  } as unknown as AppLogger
}
