import { createLogger } from '@klicker-uzh/logging/node'
import { describe, expect, it, vi } from 'vitest'
import {
  createHatchetLoggerFactory,
  drainTaskLogWrites,
  withHatchetTaskLogging,
} from '../src/logging.js'

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// Faithful replica of the SDK 1.9.4 Context logger dispatch: every
// ctx.logger call fans out to the bridge logger AND one putLog POST.
function makeSdkContext(
  bridgeFactory: ReturnType<typeof createHatchetLoggerFactory>,
  putLog: () => Promise<void>
) {
  const dispatch = (
    message: string,
    level: string,
    extra?: { extra?: unknown; error?: unknown }
  ) => {
    const logger = bridgeFactory('ctx', 'INFO')
    const contextExtra = Object.assign(
      {
        workflowRunId: 'wr-1',
        taskRunId: 'tr-1',
        retryCount: 0,
        workflowName: 'latency-workflow',
      },
      extra?.extra
    )
    const promises: Promise<unknown>[] = []
    if (!level || level === 'INFO')
      promises.push(logger.info(message, contextExtra))
    else if (level === 'DEBUG')
      promises.push(logger.debug(message, contextExtra))
    else if (level === 'WARN')
      promises.push(logger.warn(message, extra?.error, contextExtra))
    else if (level === 'ERROR')
      promises.push(logger.error(message, extra?.error, contextExtra))
    promises.push(putLog())
    return Promise.all(promises)
  }
  return {
    workflowRunId: () => 'wr-1',
    taskRunId: () => 'tr-1',
    retryCount: () => 0,
    logger: {
      // Mirrors the SDK getter exactly: info/debug wrap their second
      // argument; warn/error pass the { error?, extra? } bag through.
      info: (m: string, extra?: unknown) => dispatch(m, 'INFO', { extra }),
      debug: (m: string, extra?: unknown) => dispatch(m, 'DEBUG', { extra }),
      warn: (m: string, extra?: unknown) =>
        dispatch(m, 'WARN', extra as { extra?: unknown; error?: unknown }),
      error: (m: string, extra?: unknown) =>
        dispatch(m, 'ERROR', extra as { extra?: unknown; error?: unknown }),
    },
  }
}

type SdkContext = ReturnType<typeof makeSdkContext>

function captureRoot(records: Record<string, unknown>[]) {
  return createLogger(
    { service: 'latency-test', environment: 'production' },
    {
      write(l) {
        records.push(JSON.parse(l) as Record<string, unknown>)
      },
    }
  )
}

const PUTLOG_DELAY_MS = 25

describe('task log latency contract', () => {
  it('keeps diagnostic lifecycle and in-task logs off the critical path', async () => {
    const records: Record<string, unknown>[] = []
    const factory = createHatchetLoggerFactory(captureRoot(records))
    const putLog = vi.fn(async () => {
      await delay(PUTLOG_DELAY_MS)
    })
    const context = makeSdkContext(factory, putLog)

    const handler = async (
      _input: unknown,
      ctx: { logger: SdkContext['logger'] }
    ) => {
      // Mirrors the response processor's per-response taskInfo calls.
      await ctx.logger.info('Response instance loaded', {
        event: 'response.instance.loaded',
      })
      await ctx.logger.info('Response processed', {
        event: 'response.processed',
      })
      await delay(5)
      return { status: 200 }
    }
    const wrapped = withHatchetTaskLogging({
      taskName: 'latency-task',
      handler,
    })

    const startedAt = performance.now()
    await wrapped(
      { loggingContext: { requestId: 'r-1', correlationId: 'c-1' } },
      context as never
    )
    const wall = performance.now() - startedAt

    // Four awaited writes at 25 ms each would previously inflate this task
    // to well over 100 ms; the critical path must stay near the handler's
    // own 5 ms of work.
    expect(wall).toBeLessThan(PUTLOG_DELAY_MS)
    expect(wall).toBeGreaterThanOrEqual(5)

    await drainTaskLogWrites()
    expect(putLog).toHaveBeenCalledTimes(4)
    expect(records.map((r) => r.event)).toEqual([
      'hatchet.task.started',
      'response.instance.loaded',
      'response.processed',
      'hatchet.task.completed',
    ])
    for (const record of records) {
      expect(record.requestId).toBe('r-1')
      expect(record.correlationId).toBe('c-1')
    }
  })

  it('awaits the failure lifecycle write before rethrowing', async () => {
    const records: Record<string, unknown>[] = []
    const factory = createHatchetLoggerFactory(captureRoot(records))
    const context = makeSdkContext(factory, async () => {
      await delay(PUTLOG_DELAY_MS)
    })

    const wrapped = withHatchetTaskLogging({
      taskName: 'failing-task',
      handler: async () => {
        throw new Error('task failed')
      },
    })

    const startedAt = performance.now()
    await expect(
      wrapped({ loggingContext: { correlationId: 'c-2' } }, context as never)
    ).rejects.toThrow('task failed')
    const wall = performance.now() - startedAt

    // The failure record is durable before the rethrow: its putLog round
    // trip is part of the observable wall time, without a drain.
    expect(wall).toBeGreaterThanOrEqual(PUTLOG_DELAY_MS)
    const failure = records.find((r) => r.event === 'hatchet.task.failed')
    expect(failure).toMatchObject({ errorType: 'Error' })
  })

  it('awaits facade error calls so handler failure evidence is durable', async () => {
    const records: Record<string, unknown>[] = []
    const factory = createHatchetLoggerFactory(captureRoot(records))
    const context = makeSdkContext(factory, async () => {
      await delay(PUTLOG_DELAY_MS)
    })

    const wrapped = withHatchetTaskLogging({
      taskName: 'task-error-task',
      handler: async (_input, ctx) => {
        // Mirrors the response processor's taskError helper.
        await ctx.logger.error('Response processing failed', {
          extra: { event: 'response.processing.failed' },
        })
        throw new Error('handler failed')
      },
    })

    const startedAt = performance.now()
    await expect(
      wrapped({ loggingContext: { correlationId: 'c-3' } }, context as never)
    ).rejects.toThrow('handler failed')
    const wall = performance.now() - startedAt

    expect(wall).toBeGreaterThanOrEqual(PUTLOG_DELAY_MS)
    const errorRecord = records.find(
      (r) => r.event === 'response.processing.failed'
    )
    expect(errorRecord).toBeDefined()
  })

  it('preserves per-task write order for background diagnostic logs', async () => {
    const records: Record<string, unknown>[] = []
    const factory = createHatchetLoggerFactory(captureRoot(records))
    // Staggered resolutions would invert an unordered pipeline.
    const context = makeSdkContext(factory, async () => {})

    const wrapped = withHatchetTaskLogging({
      taskName: 'ordered-task',
      handler: async (_input, ctx) => {
        ctx.logger.info('first', { event: 'ordered.first', delayMs: 20 })
        ctx.logger.info('second', { event: 'ordered.second', delayMs: 1 })
        ctx.logger.info('third', { event: 'ordered.third', delayMs: 1 })
      },
    })

    await wrapped(
      { loggingContext: { correlationId: 'c-4' } },
      context as never
    )
    await drainTaskLogWrites()

    expect(records.map((r) => r.event)).toEqual([
      'hatchet.task.started',
      'ordered.first',
      'ordered.second',
      'ordered.third',
      'hatchet.task.completed',
    ])
  })

  it('drains nothing when no background writes are pending', async () => {
    await expect(drainTaskLogWrites(10)).resolves.toBeUndefined()
  })
})
