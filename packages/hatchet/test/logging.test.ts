import { createLogger } from '@klicker-uzh/logging/node'
import { describe, expect, it, vi } from 'vitest'
import { withHatchetTaskLogging } from '../src/logging.js'

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
  return {
    workflowRunId: () => 'workflow-run-1',
    taskRunId: () => 'task-run-1',
  }
}

describe('withHatchetTaskLogging', () => {
  it('logs correlated start and completion records around a successful task', async () => {
    const { logger, records } = testLogger()
    const handler = vi.fn(async () => ({ success: true }))
    const wrapped = withHatchetTaskLogging({
      logger,
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
        fakeHatchetContext()
      )
    ).resolves.toEqual({ success: true })

    expect(handler).toHaveBeenCalledOnce()
    expect(records).toHaveLength(2)
    expect(records.map(({ event }) => event)).toEqual([
      'hatchet.task.started',
      'hatchet.task.completed',
    ])
    expect(records[0]).toMatchObject({
      requestId: 'request-1',
      correlationId: 'correlation-1',
      workflow: 'publish-scheduled-live-quiz',
      workflowRunId: 'workflow-run-1',
      taskRunId: 'task-run-1',
    })
    expect(records[1]?.durationMs).toEqual(expect.any(Number))
  })

  it('supports old inputs without diagnostic context', async () => {
    const { logger, records } = testLogger()
    const wrapped = withHatchetTaskLogging({
      logger,
      taskName: 'legacy-task',
      handler: async () => 'done',
    })

    await expect(wrapped({}, fakeHatchetContext())).resolves.toBe('done')
    expect(records[0]).not.toHaveProperty('requestId')
    expect(records[0]).not.toHaveProperty('correlationId')
  })

  it('does not bind invalid diagnostic identifiers from task input', async () => {
    const { logger, records } = testLogger()
    const wrapped = withHatchetTaskLogging({
      logger,
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
      fakeHatchetContext()
    )

    expect(records[0]).not.toHaveProperty('requestId')
    expect(records[0]).not.toHaveProperty('correlationId')
  })

  it.each([
    new Error('private dependency detail'),
    'string rejection',
  ])('logs one safe failure record and rethrows the original failure', async (failure) => {
    const { logger, records } = testLogger()
    const wrapped = withHatchetTaskLogging({
      logger,
      taskName: 'failing-task',
      handler: async () => {
        throw failure
      },
    })

    await expect(wrapped({}, fakeHatchetContext())).rejects.toBe(failure)
    expect(records.map(({ event }) => event)).toEqual([
      'hatchet.task.started',
      'hatchet.task.failed',
    ])
    expect(records[1]).toMatchObject({
      err: {
        type: 'Error',
        message: 'Hatchet task failed',
      },
    })
    expect(JSON.stringify(records[1])).not.toContain(
      'private dependency detail'
    )
    expect(JSON.stringify(records[1])).not.toContain('string rejection')
  })
})
