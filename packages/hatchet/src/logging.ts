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

/**
 * Shape the fields into the second argument Hatchet 1.9.4's context logger
 * getter expects for warn/error: an `{ error?, extra? }` bag whose `extra`
 * the SDK merges top-level into the log record (see context.js log()). The
 * nesting is an SDK contract, not a record-shape decision — the pino bridge
 * receives these fields expanded, never nested under `extra`.
 */
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
 *
 * Diagnostic calls (info/debug/warn/util) are scheduled on the task's
 * background write queue so they never add a Hatchet round trip to the task
 * critical path; error calls are awaited so failure evidence is durable.
 */
function withTaskLoggingContext<TContext extends HatchetTaskContext<unknown>>(
  context: TContext,
  fields: Record<string, string>,
  queue: TaskLogQueue
): TContext {
  // Without a validated envelope the facade adds nothing; keep the original
  // context (identity-preserving for handlers) — lifecycle writes are still
  // queued by the wrapper itself.
  if (Object.keys(fields).length === 0) return context
  // Hatchet renders the message separately from extra metadata. Include only
  // the validated diagnostic ID so it is visible in the task's log text too.
  const visibleMessage = (message: string) =>
    fields.correlationId
      ? `${message} [correlationId=${fields.correlationId}]`
      : message

  const logger = {
    info: (message: string, extra?: Record<string, unknown>) => {
      enqueueTaskLogWrite(queue, fields, () =>
        context.logger.info(visibleMessage(message), { ...fields, ...extra })
      )
    },
    debug: (message: string, extra?: Record<string, unknown>) => {
      enqueueTaskLogWrite(queue, fields, () =>
        context.logger.debug(visibleMessage(message), { ...fields, ...extra })
      )
    },
    warn: (message: string, extra?: unknown) => {
      enqueueTaskLogWrite(queue, fields, () =>
        context.logger.warn(
          visibleMessage(message),
          mergeContextExtra(extra, fields)
        )
      )
    },
    error: (message: string, extra?: unknown) => {
      // Failure evidence must survive a retry or process restart, so unlike
      // the diagnostic levels this write is awaited — bounded, so a degraded
      // Hatchet API cannot stall the failure path indefinitely.
      return safeAwait(
        context.logger.error(
          visibleMessage(message),
          mergeContextExtra(extra, fields)
        )
      )
    },
    util: (key: string, message: string, extra?: Record<string, unknown>) => {
      enqueueTaskLogWrite(queue, fields, () =>
        context.logger.util?.(key, visibleMessage(message), {
          ...fields,
          ...extra,
        })
      )
    },
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
    event: 'hatchet.task.log',
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
    if (context === 'ctx') return taskLogger
    const logger = new DefaultHatchetLogger(context, logLevel)
    // Preserve the worker-thread watch-message guard used by the native client.
    // Hatchet 1.9.4 dispatches untyped development messages to logger.undefined.
    return Object.assign(logger, { undefined: () => undefined })
  }
}

/** Upper bound for awaited (failure-evidence) task log writes. */
const TASK_FAILURE_LOG_TIMEOUT_MS = 10_000

interface TaskLogQueue {
  tail: Promise<void>
  pending: number
}

/**
 * Queues whose writes have not all settled yet. Workers drain these before
 * exiting so background diagnostic writes are not lost at shutdown.
 */
const liveTaskLogQueues = new Set<TaskLogQueue>()

function enqueueTaskLogWrite(
  queue: TaskLogQueue,
  diagnosticFields: Record<string, string>,
  write: () => Promise<unknown> | unknown
): void {
  queue.pending += 1
  liveTaskLogQueues.add(queue)
  const settle = () => {
    queue.pending -= 1
    if (queue.pending === 0) liveTaskLogQueues.delete(queue)
  }
  // Queued writes run after the attempt's async context has exited, so each
  // one re-enters the captured envelope: the pino bridge reads the store to
  // stamp task records with the validated diagnostic IDs.
  const run = async () => {
    try {
      await taskDiagnosticContext.run(diagnosticFields, write)
    } catch {
      // Diagnostic writes must never surface as handler failures.
    }
  }
  queue.tail = queue.tail.then(run)
  queue.tail.then(settle, settle)
}

/**
 * Wait for all in-flight background task log writes, bounded by a timeout so
 * a degraded Hatchet API cannot block worker shutdown indefinitely.
 */
export async function drainTaskLogWrites(timeoutMs = 5_000): Promise<void> {
  const queues = [...liveTaskLogQueues]
  if (queues.length === 0) return
  await Promise.race([
    Promise.allSettled(queues.map((queue) => queue.tail)),
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, timeoutMs)
      timer.unref?.()
    }),
  ])
}

function safeAwait(write: Promise<unknown> | unknown): Promise<void> {
  return new Promise<void>((resolve) => {
    const bounded = Promise.race([
      Promise.resolve(write),
      new Promise<unknown>((resolveTimer) => {
        const timer = setTimeout(resolveTimer, TASK_FAILURE_LOG_TIMEOUT_MS)
        timer.unref?.()
      }),
    ])
    bounded.then(
      () => resolve(),
      () => resolve()
    )
  })
}

/**
 * Writes a lifecycle record through the task's facade. Info records are
 * scheduled on the background queue by the facade; error records are awaited
 * and bounded there, so failure evidence is durable before the rethrow.
 * Envelope-less tasks bypass the facade, so the error bag keeps the previous
 * `extra` wrapping the SDK logger unwraps.
 */
async function writeTaskLifecycleRecord<TInput>(
  context: HatchetTaskContext<TInput>,
  level: 'info' | 'error',
  message: string,
  fields: Record<string, unknown>
): Promise<void> {
  try {
    if (level === 'info') {
      context.logger.info(message, fields as LogExtra)
    } else {
      await context.logger.error(message, { extra: fields } as never)
    }
  } catch {
    // Diagnostic lifecycle persistence must not prevent execution, retry a
    // committed result, or replace the handler's original failure. The SDK
    // also emits through the process logger independently of its log API.
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
  return (input: TInput, context: TContext): Promise<TOutput> => {
    const diagnosticContext = diagnosticFields(input?.loggingContext)
    const queue: TaskLogQueue = { tail: Promise.resolve(), pending: 0 }

    return taskDiagnosticContext.run(diagnosticContext, async () => {
      const taskContext = withTaskLoggingContext(
        context,
        diagnosticContext,
        queue
      )
      const fields = {
        ...diagnosticContext,
        event: 'hatchet.task.started',
        workflow: taskName,
        workflowRunId: context.workflowRunId(),
        taskRunId: context.taskRunId(),
        retryCount: context.retryCount(),
      }
      const startedAt = performance.now()

      // Lifecycle records are diagnostic: the facade schedules them on the
      // background queue so the attempt never waits a network round trip to
      // start or return its result.
      writeTaskLifecycleRecord(
        taskContext,
        'info',
        'Hatchet task started',
        fields
      )

      try {
        const result = await handler(input, taskContext)
        writeTaskLifecycleRecord(
          taskContext,
          'info',
          'Hatchet task completed',
          {
            ...fields,
            event: 'hatchet.task.completed',
            durationMs: Math.round(performance.now() - startedAt),
          }
        )
        return result
      } catch (error) {
        // Failure evidence is the one awaited write: it must be durable
        // before the retry or rethrow, bounded against a hung API.
        await writeTaskLifecycleRecord(
          taskContext,
          'error',
          'Hatchet task failed',
          {
            ...fields,
            event: 'hatchet.task.failed',
            durationMs: Math.round(performance.now() - startedAt),
            errorType: error instanceof Error ? error.name : 'unknown',
          }
        )
        throw error
      }
    })
  }
}
