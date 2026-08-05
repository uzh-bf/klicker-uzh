import type { Context, JsonObject } from '@hatchet-dev/typescript-sdk'
import { type AppLogger, toSafeError } from '@klicker-uzh/logging/node'
import { normalizeDiagnosticId } from '@klicker-uzh/logging/request'
import type { HatchetLoggingContext } from '@klicker-uzh/types'

export interface LoggableHatchetInput extends JsonObject {
  loggingContext?: HatchetLoggingContext
}

export type HatchetTaskContext<TInput> = Pick<
  Context<TInput>,
  'workflowRunId' | 'taskRunId'
>

export function withHatchetTaskLogging<
  TInput extends LoggableHatchetInput,
  TOutput,
  TContext extends HatchetTaskContext<TInput>,
>({
  logger,
  taskName,
  handler,
}: {
  logger: AppLogger
  taskName: string
  handler: (input: TInput, context: TContext) => Promise<TOutput> | TOutput
}) {
  return async (input: TInput, context: TContext): Promise<TOutput> => {
    const requestId = normalizeDiagnosticId(input.loggingContext?.requestId)
    const correlationId = normalizeDiagnosticId(
      input.loggingContext?.correlationId
    )
    const taskLogger = logger.child({
      ...(requestId ? { requestId } : {}),
      ...(correlationId ? { correlationId } : {}),
      workflow: taskName,
      workflowRunId: context.workflowRunId(),
      taskRunId: context.taskRunId(),
    })
    const startedAt = performance.now()

    taskLogger.info({ event: 'hatchet.task.started' }, 'Hatchet task started')

    try {
      const result = await handler(input, context)
      taskLogger.info(
        {
          event: 'hatchet.task.completed',
          durationMs: Math.round(performance.now() - startedAt),
        },
        'Hatchet task completed'
      )
      return result
    } catch (error) {
      taskLogger.error(
        {
          event: 'hatchet.task.failed',
          durationMs: Math.round(performance.now() - startedAt),
          err: toSafeError('Hatchet task failed'),
        },
        'Hatchet task failed'
      )
      throw error
    }
  }
}
