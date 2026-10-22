import {
  admitLiveQuizResponse,
  getResponseAdmissionKeys,
  undoLiveQuizResponseAdmission,
  type ResponseAdmission,
  type ResponseAdmissionArgs,
} from '@klicker-uzh/util'
import { randomUUID } from 'crypto'
import { Redis } from 'ioredis'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

const redis = new Redis({
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
})

describe('live quiz response admission', () => {
  let instanceKey: string

  function args(
    overrides: Partial<ResponseAdmissionArgs> = {}
  ): ResponseAdmissionArgs {
    return {
      redis,
      instanceKey,
      messageId: randomUUID(),
      participantKey: 'participant-1',
      responseHash: randomUUID(),
      responseLimit: 3,
      ...overrides,
    }
  }

  beforeEach(() => {
    instanceKey = `lq:test-${randomUUID()}:i:1`
  })

  afterAll(async () => {
    const keys = await redis.keys('lq:test-*')
    if (keys.length > 0) await redis.del(...keys)
    await redis.quit()
  })

  it('admits responses up to the limit and marks only the first', async () => {
    const results: ResponseAdmission[] = []
    for (let i = 0; i < 4; i++) {
      results.push(await admitLiveQuizResponse(args()))
    }

    expect(results).toEqual([
      { admitted: true, isFirstResponse: true },
      { admitted: true, isFirstResponse: false },
      { admitted: true, isFirstResponse: false },
      { admitted: false, reason: 'limit' },
    ])
  })

  it('counts each participant separately', async () => {
    await admitLiveQuizResponse(args())
    expect(
      await admitLiveQuizResponse(args({ participantKey: 'participant-2' }))
    ).toEqual({ admitted: true, isFirstResponse: true })
  })

  it('drops a repeated answer without using up the limit', async () => {
    const responseHash = randomUUID()
    await admitLiveQuizResponse(args({ responseHash }))

    expect(await admitLiveQuizResponse(args({ responseHash }))).toEqual({
      admitted: false,
      reason: 'duplicate',
    })
    expect(await admitLiveQuizResponse(args())).toEqual({
      admitted: true,
      isFirstResponse: false,
    })
  })

  it('admits a retried message only once', async () => {
    const retried = args()
    await admitLiveQuizResponse(retried)

    expect(await admitLiveQuizResponse(retried)).toEqual({
      admitted: false,
      reason: 'processed',
    })
  })

  it('never exceeds the limit under concurrent responses', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => admitLiveQuizResponse(args()))
    )

    expect(results.filter((r) => r.admitted)).toHaveLength(3)
    expect(results.filter((r) => r.admitted && r.isFirstResponse)).toHaveLength(
      1
    )
  })

  it('lets a retry apply exactly once after an undo', async () => {
    const message = args()
    await admitLiveQuizResponse(message)
    expect(await undoLiveQuizResponseAdmission(message)).toBe(true)

    expect(await admitLiveQuizResponse(message)).toEqual({
      admitted: true,
      isFirstResponse: true,
    })
    expect(await admitLiveQuizResponse(message)).toEqual({
      admitted: false,
      reason: 'processed',
    })
    const keys = getResponseAdmissionKeys(instanceKey)
    expect(await redis.hget(keys.responseCounts, 'participant-1')).toBe('1')
  })

  it('does not undo a message that was never admitted', async () => {
    expect(await undoLiveQuizResponseAdmission(args())).toBe(false)
  })

  it('takes the first-response flag from anonymous messages', async () => {
    const anonymous = { participantKey: undefined }

    expect(
      await admitLiveQuizResponse(
        args({ ...anonymous, anonymousIsFirstResponse: true })
      )
    ).toEqual({ admitted: true, isFirstResponse: true })
    expect(
      await admitLiveQuizResponse(
        args({ ...anonymous, anonymousIsFirstResponse: false })
      )
    ).toEqual({ admitted: true, isFirstResponse: false })
  })
})
