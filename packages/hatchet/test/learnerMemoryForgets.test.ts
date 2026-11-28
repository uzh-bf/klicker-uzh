import { afterEach, describe, expect, it, vi } from 'vitest'
import { retryLearnerMemoryForgets } from '../src/learnerMemoryForgets.js'

const request = {
  id: 1,
  learnerKey: 'a'.repeat(64),
  courseId: null,
  epoch: 2,
  requestedAt: new Date('2026-11-26T12:00:00.000Z'),
}

function arrange(respond: () => Promise<Response>) {
  vi.stubEnv('LEARNER_MEMORY_SERVICE_URL', 'https://memory.synthetic.test')
  vi.stubEnv('LEARNER_MEMORY_SERVICE_TOKEN', 'synthetic-token')
  const service = vi.fn(respond)
  vi.stubGlobal('fetch', service)
  const store = {
    findMany: vi.fn().mockResolvedValue([request]),
    update: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  }
  const logger = { info: vi.fn(), warn: vi.fn() }
  return {
    service,
    store,
    logger,
    run: () =>
      retryLearnerMemoryForgets({
        prisma: { learnerMemoryForgetRequest: store } as unknown as Parameters<
          typeof retryLearnerMemoryForgets
        >[0]['prisma'],
        logger,
      }),
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('retrying learner-memory deletion requests', () => {
  it('sends open requests and marks the confirmed ones', async () => {
    const task = arrange(async () => Response.json({ status: 'forgotten' }))

    await expect(task.run()).resolves.toEqual({
      configured: true,
      delivered: 1,
      failed: 0,
      purged: 0,
    })
    expect(task.store.findMany.mock.calls[0][0].where).toEqual({
      completedAt: null,
    })
    expect(task.store.update.mock.calls[0][0].data).toHaveProperty(
      'completedAt'
    )
  })

  it('leaves a request open and warns when the service does not confirm', async () => {
    const task = arrange(async () => new Response('{}', { status: 502 }))

    await expect(task.run()).resolves.toMatchObject({ delivered: 0, failed: 1 })
    expect(task.store.update.mock.calls[0][0].data).not.toHaveProperty(
      'completedAt'
    )
    expect(task.logger.warn).toHaveBeenCalledOnce()
  })

  it('sends nothing in a deployment without the service', async () => {
    const task = arrange(async () => Response.json({ status: 'forgotten' }))
    vi.stubEnv('LEARNER_MEMORY_SERVICE_URL', '')

    await expect(task.run()).resolves.toMatchObject({
      configured: false,
      delivered: 0,
      failed: 0,
    })
    expect(task.service).not.toHaveBeenCalled()
    expect(task.store.update).not.toHaveBeenCalled()
  })
})
