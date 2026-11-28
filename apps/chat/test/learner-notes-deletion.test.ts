import { deriveLearnerMemoryKey } from '@klicker-uzh/util/learner-memory'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const db = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@klicker-uzh/prisma', () => {
  const learnerMemoryForgetRequest = {
    create: db.create,
    findMany: db.findMany,
    update: db.update,
  }
  const tx = { $queryRaw: db.queryRaw, learnerMemoryForgetRequest }
  return {
    prisma: {
      learnerMemoryForgetRequest,
      $transaction: (run: (client: typeof tx) => unknown) => run(tx),
    },
  }
})

import { requestLearnerNotesDeletion } from '../src/lib/server/learnerMemory'

const KEY_SECRET = 'synthetic-key-secret-with-enough-length'
const PARTICIPANT_ID = 'participant-synthetic'
const COURSE_ID = '11111111-2222-4333-8444-555555555555'
const DATABASE_NOW = new Date('2026-11-26T12:00:00.000Z')
const service = vi.fn()

function learnerKey() {
  return deriveLearnerMemoryKey(PARTICIPANT_ID, {
    LEARNER_MEMORY_KEY_SECRET: KEY_SECRET,
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('LEARNER_MEMORY_SERVICE_URL', 'https://memory.synthetic.test')
  vi.stubEnv('LEARNER_MEMORY_SERVICE_TOKEN', 'synthetic-token')
  vi.stubEnv('LEARNER_MEMORY_KEY_SECRET', KEY_SECRET)
  vi.stubGlobal('fetch', service)
  db.queryRaw.mockResolvedValue([{ epoch: 3, now: DATABASE_NOW }])
  db.create.mockResolvedValue({ id: 7 })
  db.findMany.mockResolvedValue([
    {
      id: 7,
      learnerKey: learnerKey(),
      courseId: COURSE_ID,
      epoch: 3,
      requestedAt: DATABASE_NOW,
    },
  ])
  db.update.mockResolvedValue({})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const deletion = { participantId: PARTICIPANT_ID, courseId: COURSE_ID }

describe('deleting the learning notes of one course', () => {
  test('records the request at the database time and sends it right away', async () => {
    service.mockResolvedValue(Response.json({ status: 'forgotten' }))

    await expect(requestLearnerNotesDeletion(deletion)).resolves.toBe('deleted')

    expect(db.create.mock.calls[0][0].data).toEqual({
      learnerKey: learnerKey(),
      courseId: COURSE_ID,
      epoch: 3,
      requestedAt: DATABASE_NOW,
    })
    const [url, init] = service.mock.calls[0]
    expect(url).toBe('https://memory.synthetic.test/learner-memory/v1/forget')
    expect(JSON.parse(init.body)).toEqual({
      learnerKey: learnerKey(),
      courseId: COURSE_ID,
      epoch: 3,
      forgottenAt: DATABASE_NOW.toISOString(),
    })
    expect(db.update.mock.calls[0][0].data).toHaveProperty('completedAt')
  })

  test('keeps the request for the retry task when the service fails', async () => {
    service.mockRejectedValue(new TypeError('fetch failed'))

    await expect(requestLearnerNotesDeletion(deletion)).resolves.toBe('pending')

    expect(db.create).toHaveBeenCalledOnce()
    expect(db.update.mock.calls[0][0].data).not.toHaveProperty('completedAt')
  })

  test('keeps the request while no service is configured', async () => {
    vi.stubEnv('LEARNER_MEMORY_SERVICE_URL', '')

    await expect(requestLearnerNotesDeletion(deletion)).resolves.toBe('pending')

    expect(db.create).toHaveBeenCalledOnce()
    expect(service).not.toHaveBeenCalled()
  })

  test('has nothing to delete in a deployment without the key secret', async () => {
    vi.stubEnv('LEARNER_MEMORY_KEY_SECRET', '')

    await expect(requestLearnerNotesDeletion(deletion)).resolves.toBe(
      'unavailable'
    )

    expect(db.create).not.toHaveBeenCalled()
    expect(service).not.toHaveBeenCalled()
  })
})
