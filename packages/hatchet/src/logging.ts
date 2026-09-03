import { AsyncLocalStorage } from 'node:async_hooks'
import type { Context, JsonObject } from '@hatchet-dev/typescript-sdk'
import type { LogConstructor } from '@hatchet-dev/typescript-sdk/clients/hatchet-client/client-config.js'
import { HatchetLogger as DefaultHatchetLogger } from '@hatchet-dev/typescript-sdk/clients/hatchet-client/hatchet-logger.js'
import type {
  Logger as HatchetSdkLogger,
  LogExtra,
  LogLevel,
} from '@hatchet-dev/typescript-sdk/util/logger/logger.js'
import type { AppLogger } from '@klicker-uzh/logging/node'
import { normalizeDiagnosticId } from '@klicker-uzh/logging/request'
import type { HatchetLoggingContext } from '@klicker-uzh/types'

export interface LoggableHatchetInput extends JsonObject {
  loggingContext?: HatchetLoggingContext
}

export type HatchetTaskContext<TInput> = Pick<
  Context<TInput>,
  'workflowRunId' | 'taskRunId' | 'retryCount' | 'logger'
>

const taskDiagnosticContext = new AsyncLocalStorage<Record<string, string>>()

function diagnosticFields(loggingContext?: HatchetLoggingContext) {
  const requestId = normalizeDiagnosticId(loggingContext?.requestId)
  const correlationId = normalizeDiagnosticId(loggingContext?.correlationId)

  return {
    ...(requestId ? { requestId } : {}),
    ...(correlationId ? { correlationId } : {}),
  }
}

function logExtra(fields: LogExtra): LogExtra {
  return { extra: fields }
}

function mergeContextExtra(
  extra: unknown,
  fields: Record<string, string>
): Record<string, unknown> {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) {
    return { extra: fields }
  }

  const candidate = extra as Record<string, unknown>
  const nested = candidate.extra
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return {
      ...candidate,
      extra: { ...fields, ...(nested as Record<string, unknown>) },
    }
  }

  return { extra: { ...fields, ...candidate } }
}

/**
 * Keeps Hatchet's context logger as the task API while adding the validated
 * attempt envelope to every call. The returned facade is not a Pino logger or
 * child logger; it delegates to the SDK logger so the SDK still writes its
 * native task-run record.
 */
function withTaskLoggingContext<TContext extends HatchetTaskContext<unknown>>(
  context: TContext,
  fields: Record<string, string>
): TContext {
  if (Object.keys(fields).length === 0) return context

  const logger = {
    info: (message: string, extra?: Record<string, unknown>) =>
      context.logger.info(message, { ...fields, ...extra }),
    debug: (message: string, extra?: Record<string, unknown>) =>
      context.logger.debug(message, { ...fields, ...extra }),
    warn: (message: string, extra?: unknown) =>
      context.logger.warn(message, mergeContextExtra(extra, fields)),
    error: (message: string, extra?: unknown) =>
      context.logger.error(message, mergeContextExtra(extra, fields)),
    util: (key: string, message: string, extra?: Record<string, unknown>) =>
      context.logger.util?.(key, message, { ...fields, ...extra }),
  } as TContext['logger']

  return new Proxy(context, {
    get(target, property, receiver) {
      if (property === 'logger') return logger
      return Reflect.get(target, property, receiver)
    },
  })
}

/**
 * Bridges Hatchet task-context logs to an existing process-level Pino logger.
 * Hatchet still persists the task log separately through `ctx.logger`; this
 * adapter only controls the SDK logger branch of that same call.
 */
export function createHatchetLoggerFactory(root: AppLogger): LogConstructor {
  const pinoFields = (extra?: LogExtra) => ({
    ...taskDiagnosticContext.getStore(),
    ...extra,
  })
  const taskLogger: HatchetSdkLogger = {
    debug(message, extra) {
      root.debug(pinoFields(extra), message)
    },
    info(message, extra) {
      root.info(pinoFields(extra), message)
    },
    green(message, extra) {
      root.info(pinoFields(extra), message)
    },
    warn(message, _error, extra) {
      root.warn(pinoFields(extra), message)
    },
    error(message, _error, extra) {
      root.error(pinoFields(extra), message)
    },
    util(key, message, extra) {
      if (key === 'trace') root.debug(pinoFields(extra), message)
    },
  }

  return (context: string, logLevel?: LogLevel) => {
    // Context logger calls are the task-owned path. Other SDK channels retain
    // Hatchet's native output and are not silently reclassified as app events.
    return context === 'ctx'
      ? taskLogger
      : new DefaultHatchetLogger(context, logLevel)
  }
}

async function logTaskContext<TInput>(
  context: HatchetTaskContext<TInput>,
  level: 'info' | 'error',
  message: string,
  fields: LogExtra
) {
  if (level === 'info') {
    await context.logger.info(message, fields)
  } else {
    await context.logger.error(message, logExtra(fields))
  }
}

export function withHatchetTaskLogging<
  TInput extends LoggableHatchetInput,
  TOutput,
  TContext extends HatchetTaskContext<TInput>,
>({
  taskName,
  handler,
}: {
  taskName: string
  handler: (input: TInput, context: TContext) => Promise<TOutput> | TOutput
}) {
  return (input: TInput, context: TContext): Promise<TOutput> =>
    taskDiagnosticContext.run(
      diagnosticFields(input.loggingContext),
      async () => {
        const diagnosticContext = diagnosticFields(input.loggingContext)
        const taskContext = withTaskLoggingContext(context, diagnosticContext)
        const fields = {
          ...diagnosticContext,
          event: 'hatchet.task.started',
          workflow: taskName,
          workflowRunId: context.workflowRunId(),
          taskRunId: context.taskRunId(),
          retryCount: context.retryCount(),
        }
        const startedAt = performance.now()

        await logTaskContext(
          taskContext,
          'info',
          'Hatchet task started',
          fields
        )

        try {
          const result = await handler(input, taskContext)
          await logTaskContext(taskContext, 'info', 'Hatchet task completed', {
            ...fields,
            event: 'hatchet.task.completed',
            durationMs: Math.round(performance.now() - startedAt),
          })
          return result
        } catch (error) {
          await logTaskContext(taskContext, 'error', 'Hatchet task failed', {
            ...fields,
            event: 'hatchet.task.failed',
            durationMs: Math.round(performance.now() - startedAt),
            errorType: error instanceof Error ? error.name : 'unknown',
          })
          throw error
        }
      }
    )
}
