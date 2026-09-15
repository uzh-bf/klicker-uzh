import { Context } from '@hatchet-dev/typescript-sdk'
import { createLogger } from '@klicker-uzh/logging/node'
import { describe, expect, it, vi } from 'vitest'
import {
  getAuditLogDiagnosticBindings,
  getAuditLogFields,
} from '../src/auditLogging.js'
import {
  createHatchetLoggerFactory,
  withHatchetTaskLogging,
} from '../src/logging.js'

function testLogger() {
  const records: Record<string, unknown>[] = []
  const logger = createLogger(
    { service: 'hatchet-test', environment: 'production' },
    {
      write(line) {
        records.push(JSON.parse(line) as Record<string, unknown>)
      },
    }
  )

  return { logger, records }
}

function fakeHatchetContext() {
  const logger = {
    info: vi.fn(async () => undefined),
    debug: vi.fn(async () => undefined),
    warn: vi.fn(async () => undefined),
    error: vi.fn(async () => undefined),
    util: vi.fn(async () => undefined),
  } as any

  return {
    workflowRunId: () => 'workflow-run-1',
    taskRunId: () => 'task-run-1',
    retryCount: () => 2,
    logger,
  }
}

describe('withHatchetTaskLogging', () => {
  it('ignores untyped development messages in native SDK channels', () => {
    const { logger, records } = testLogger()
    const nativeLogger = createHatchetLoggerFactory(logger)('worker')
    expect(Reflect.get(nativeLogger, 'undefined')()).toBeUndefined()
    expect(records).toEqual([])
  })

  it.each([
    'started',
    'completed',
    'failed',
  ])('preserves task outcomes when SDK persistence rejects the %s lifecycle log', async (stage) => {
    const { logger, records } = testLogger()
    const failure = new Error('original task failure')
    const putLog = vi.fn(async (_id, message: string) => {
      if (message.startsWith(`Hatchet task ${stage}`)) {
        throw new Error('log persistence unavailable')
      }
    })
    const context = Object.assign(Object.create(Context.prototype), {
      action: {
        stepRunId: 'task-run-1',
        workflowRunId: 'workflow-run-1',
        retryCount: 0,
      },
      v1: {
        config: {
          logger: createHatchetLoggerFactory(logger),
          log_level: 'INFO',
        },
        event: { putLog },
      },
    })
    const handler = vi.fn(async () => {
      if (stage === 'failed') throw failure
      return 'committed result'
    })
    const wrapped = withHatchetTaskLogging({ taskName: 'sink-outage', handler })
    const result = wrapped({}, context)
    if (stage === 'failed') await expect(result).rejects.toBe(failure)
    else await expect(result).resolves.toBe('committed result')
    expect(handler).toHaveBeenCalledOnce()
    expect(
      records.some((record) => record.event === `hatchet.task.${stage}`)
    ).toBe(true)
  })

  it('includes correlation in the real SDK log message and structured output', async () => {
    const { logger, records } = testLogger()
    const putLog = vi.fn(async () => undefined)
    // Exercise the SDK logger and log method, replacing only its network sink.
    const context = Object.assign(Object.create(Context.prototype), {
      action: {
        stepRunId: 'task-run-1',
        workflowRunId: 'workflow-run-1',
        retryCount: 0,
      },
      v1: {
        config: {
          logger: createHatchetLoggerFactory(logger),
          log_level: 'INFO',
        },
        event: { putLog },
      },
    })
    const wrapped = withHatchetTaskLogging({
      taskName: 'visible-correlation',
      handler: async (_input, ctx) => {
        await ctx.logger.info('Inner milestone')
        await ctx.logger.debug('Debug milestone')
        await ctx.logger.warn('Warning milestone')
        throw new Error('private detail')
      },
    })
    await expect(
      wrapped({ loggingContext: { correlationId: 'correlation-1' } }, context)
    ).rejects.toThrow('private detail')

    expect(putLog).toHaveBeenCalledTimes(5)
    for (const call of putLog.mock.calls as unknown as unknown[][]) {
      expect(call[1]).toContain('[correlationId=correlation-1]')
      expect(call[4]).toMatchObject({ correlationId: 'correlation-1' })
    }
    expect(records).toHaveLength(4) // debug is filtered from info-level stdout
    for (const record of records) {
      expect(record.correlationId).toBe('correlation-1')
    }
    expect(JSON.stringify(putLog.mock.calls)).not.toContain('private detail')
  })
  it.each([
    null,
    undefined,
  ])('preserves empty cron input (%s) and logs its lifecycle', async (input) => {
    const context = fakeHatchetContext()
    const handler = vi.fn(async () => 'done')
    const wrapped = withHatchetTaskLogging({
      taskName: 'cron-task',
      handler,
    })

    // The SDK can deliver null at runtime despite its object-only input type.
    await expect(wrapped(input as any, context)).resolves.toBe('done')
    expect(handler).toHaveBeenCalledWith(input, context)
    expect(
      context.logger.info.mock.calls.map((call: any[]) => call[1].event)
    ).toEqual(['hatchet.task.started', 'hatchet.task.completed'])
  })

  it('logs correlated start and completion records around a successful task', async () => {
    const handler = vi.fn(async () => ({ success: true }))
    const context = fakeHatchetContext()
    const wrapped = withHatchetTaskLogging({
      taskName: 'publish-scheduled-live-quiz',
      handler,
    })

    await expect(
      wrapped(
        {
          loggingContext: {
            requestId: 'request-1',
            correlationId: 'correlation-1',
          },
        },
        context
      )
    ).resolves.toEqual({ success: true })

    expect(handler).toHaveBeenCalledOnce()
    expect(context.logger.info).toHaveBeenCalledTimes(2)
    expect(
      context.logger.info.mock.calls.map((call: any[]) => call[0])
    ).toEqual([
      'Hatchet task started [correlationId=correlation-1]',
      'Hatchet task completed [correlationId=correlation-1]',
    ])
    expect(context.logger.info.mock.calls[0]?.[1]).toMatchObject({
      requestId: 'request-1',
      correlationId: 'correlation-1',
      workflow: 'publish-scheduled-live-quiz',
      workflowRunId: 'workflow-run-1',
      taskRunId: 'task-run-1',
      retryCount: 2,
    })
    expect(context.logger.info.mock.calls[1]?.[1]).toMatchObject({
      event: 'hatchet.task.completed',
      durationMs: expect.any(Number),
    })
  })

  it('supports old inputs without diagnostic context', async () => {
    const context = fakeHatchetContext()
    const wrapped = withHatchetTaskLogging({
      taskName: 'legacy-task',
      handler: async () => 'done',
    })

    await expect(wrapped({}, context)).resolves.toBe('done')
    expect(context.logger.info.mock.calls[0]?.[1]).not.toHaveProperty(
      'requestId'
    )
    expect(context.logger.info.mock.calls[0]?.[1]).not.toHaveProperty(
      'correlationId'
    )
  })

  it('does not bind invalid diagnostic identifiers from task input', async () => {
    const context = fakeHatchetContext()
    const wrapped = withHatchetTaskLogging({
      taskName: 'untrusted-context-task',
      handler: async () => 'done',
    })

    await wrapped(
      {
        loggingContext: {
          requestId: 'request with spaces',
          correlationId: 'correlation/with/slashes',
        },
      },
      context
    )

    expect(context.logger.info.mock.calls[0]?.[1]).not.toHaveProperty(
      'requestId'
    )
    expect(context.logger.info.mock.calls[0]?.[1]).not.toHaveProperty(
      'correlationId'
    )
  })

  it('adds the validated envelope to inner context logger metadata', async () => {
    const context = fakeHatchetContext()
    const wrapped = withHatchetTaskLogging({
      taskName: 'correlated-task',
      handler: async (_input, ctx) => {
        await ctx.logger.info('Inner milestone', { event: 'task.milestone' })
      },
    })

    await wrapped(
      { loggingContext: { correlationId: 'correlation-1' } },
      context
    )

    const innerCall = context.logger.info.mock.calls.find(
      (call: unknown[]) =>
        call[0] === 'Inner milestone [correlationId=correlation-1]'
    )
    expect(innerCall?.[1]).toMatchObject({
      event: 'task.milestone',
      correlationId: 'correlation-1',
    })
  })

  it.each([
    new Error('private dependency detail'),
    'string rejection',
  ])('logs one safe failure record and rethrows the original failure', async (failure) => {
    const context = fakeHatchetContext()
    const wrapped = withHatchetTaskLogging({
      taskName: 'failing-task',
      handler: async () => {
        throw failure
      },
    })

    await expect(wrapped({}, context)).rejects.toBe(failure)
    expect(context.logger.error).toHaveBeenCalledOnce()
    expect(context.logger.error.mock.calls[0]?.[0]).toBe('Hatchet task failed')
    expect(context.logger.error.mock.calls[0]?.[1]).toMatchObject({
      extra: {
        event: 'hatchet.task.failed',
        errorType: failure instanceof Error ? 'Error' : 'unknown',
      },
    })
    expect(JSON.stringify(context.logger.error.mock.calls[0])).not.toContain(
      'private dependency detail'
    )
    expect(JSON.stringify(context.logger.error.mock.calls[0])).not.toContain(
      'string rejection'
    )
  })
})

describe('createHatchetLoggerFactory', () => {
  it('supplies a stable event for legacy task messages', () => {
    const { logger, records } = testLogger()
    createHatchetLoggerFactory(logger)('ctx', 'INFO').info('Legacy milestone')
    expect(records[0]).toMatchObject({
      event: 'hatchet.task.log',
      msg: 'Legacy milestone',
    })
  })
  it('writes context logger calls to the process Pino logger', () => {
    const { logger, records } = testLogger()
    const contextLogger = createHatchetLoggerFactory(logger)('ctx', 'INFO')

    contextLogger.info('Response processed', {
      event: 'response.processed',
      correlationId: 'correlation-1',
    })

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      msg: 'Response processed',
      event: 'response.processed',
      correlationId: 'correlation-1',
    })
  })

  it('maps warning and error calls without serializing the SDK error argument', () => {
    const { logger, records } = testLogger()
    const contextLogger = createHatchetLoggerFactory(logger)('ctx', 'INFO')

    contextLogger.warn('Dependency degraded', new Error('private detail'), {
      event: 'dependency.degraded',
      correlationId: 'correlation-1',
    })
    contextLogger.error('Dependency failed', new Error('private detail'), {
      event: 'dependency.failed',
      correlationId: 'correlation-1',
    })

    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({
      level: 'warn',
      msg: 'Dependency degraded',
      event: 'dependency.degraded',
      correlationId: 'correlation-1',
    })
    expect(records[1]).toMatchObject({
      level: 'error',
      msg: 'Dependency failed',
      event: 'dependency.failed',
      correlationId: 'correlation-1',
    })
    expect(JSON.stringify(records)).not.toContain('private detail')
  })

  it('carries the validated task envelope to inner context logger calls', async () => {
    const { logger, records } = testLogger()
    const contextLogger = createHatchetLoggerFactory(logger)('ctx', 'INFO')
    const context = fakeHatchetContext()
    context.logger = contextLogger as any

    const wrapped = withHatchetTaskLogging({
      taskName: 'response-task',
      handler: async (_input, ctx) => {
        await ctx.logger.info('Inner response milestone', {
          event: 'response.milestone',
        })
      },
    })

    await wrapped(
      { loggingContext: { correlationId: 'correlation-1' } },
      context
    )

    const innerRecord = records.find(
      ({ msg }) =>
        msg === 'Inner response milestone [correlationId=correlation-1]'
    )
    expect(innerRecord).toMatchObject({
      event: 'response.milestone',
      correlationId: 'correlation-1',
    })
  })
})

describe('audit log diagnostic bindings', () => {
  it('uses only the validated logging envelope and ignores business correlation IDs', () => {
    expect(
      getAuditLogDiagnosticBindings({
        correlationId: 'business-correlation',
        loggingContext: {
          requestId: 'request-1',
          correlationId: 'correlation-1',
        },
      })
    ).toEqual({ requestId: 'request-1', correlationId: 'correlation-1' })
  })

  it('never includes audit message content or arbitrary payload fields', () => {
    expect(
      getAuditLogFields({
        info: 'participant-id=private assessment answer=private',
        correlationId: 'business-correlation',
        loggingContext: { requestId: 'request-1' },
      })
    ).toEqual({ event: 'audit.entry.received', requestId: 'request-1' })
  })

  it('does not create bindings for missing or invalid context', () => {
    expect(
      getAuditLogDiagnosticBindings({
        loggingContext: {
          requestId: 'invalid request id',
          correlationId: 'invalid/correlation',
        },
      })
    ).toEqual({})
  })
})
