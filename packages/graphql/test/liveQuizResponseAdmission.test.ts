import {
  admitLiveQuizResponse,
  getResponseAdmissionKeys,
  parseResponseLimit,
  type ResponseAdmission,
  type ResponseAdmissionArgs,
} from '@klicker-uzh/util'
import { randomUUID } from 'crypto'
import { Redis } from 'ioredis'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const redis = new Redis({
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
})

describe('live quiz response admission', () => {
  let instanceKey: string
  let liveQuizKey: string
  const testQuizKeys: string[] = []
  const sessionBlockId = 'block-1'
  const responseTimestamp = 1_700_000_000_000

  function args(
    overrides: Partial<ResponseAdmissionArgs> = {}
  ): ResponseAdmissionArgs {
    return {
      redis,
      instanceKey,
      liveQuizKey,
      messageId: randomUUID(),
      participantKey: 'participant-1',
      participantRole: 'PARTICIPANT',
      responseHash: randomUUID(),
      responseValue: randomUUID(),
      responseLimit: 3,
      sessionBlockId,
      responseTimestamp,
      pointsAwarded: 7,
      xpAwarded: 4,
      setFirstResponseTimestamp: true,
      ...overrides,
    }
  }

  beforeEach(() => {
    liveQuizKey = `lq:test-${randomUUID()}`
    instanceKey = `${liveQuizKey}:i:1`
    testQuizKeys.push(liveQuizKey)
  })

  afterAll(async () => {
    const keys = (
      await Promise.all(testQuizKeys.map((key) => redis.keys(`${key}:*`)))
    ).flat()
    if (keys.length > 0) await redis.del(...keys)
    await redis.quit()
  })

  it('commits counters, response state and first-response scoring atomically', async () => {
    const admissions = Array.from({ length: 3 }, () => args())
    const results: ResponseAdmission[] = []
    for (const admission of admissions) {
      results.push(await admitLiveQuizResponse(admission))
    }
    const denied = args()
    results.push(await admitLiveQuizResponse(denied))

    expect(results).toEqual([
      { admitted: true, isFirstResponse: true },
      { admitted: true, isFirstResponse: false },
      { admitted: true, isFirstResponse: false },
      { admitted: false, reason: 'limit' },
    ])

    const keys = getResponseAdmissionKeys(instanceKey)
    expect(await redis.scard(keys.messages)).toBe(3)
    expect(await redis.sismember(keys.messages, denied.messageId)).toBe(0)
    expect(await redis.hget(keys.responseCounts, 'participant-1')).toBe('3')
    expect(await redis.get(keys.respondents)).toBe('1')
    expect(await redis.hget(keys.results, 'participants')).toBe('3')
    expect(await redis.hget(keys.results, admissions[0]!.responseHash)).toBe(
      '1'
    )
    expect(await redis.hget(keys.results, admissions[1]!.responseHash)).toBe(
      '1'
    )
    expect(await redis.hget(keys.results, admissions[2]!.responseHash)).toBe(
      '1'
    )
    expect(
      await redis.hget(keys.responseHashes, admissions[0]!.responseHash)
    ).toBe(admissions[0]!.responseValue)
    expect(await redis.hget(keys.responses, 'participant-1')).toBe(
      admissions[0]!.responseValue
    )
    expect(await redis.hget(keys.info, 'firstResponseReceivedAt')).toBe(
      String(responseTimestamp)
    )
    expect(
      await redis.hget(`${liveQuizKey}:b:${sessionBlockId}:lb`, 'participant-1')
    ).toBe('7')
    expect(await redis.hget(`${liveQuizKey}:lb`, 'participant-1')).toBe('7')
    expect(await redis.hget(`${liveQuizKey}:xp`, 'participant-1')).toBe('4')
  })

  it('awards first-response scoring once per participant', async () => {
    await admitLiveQuizResponse(args({ pointsAwarded: 7, xpAwarded: 4 }))
    await admitLiveQuizResponse(
      args({
        participantKey: 'participant-2',
        pointsAwarded: 5,
        xpAwarded: 2,
        responseTimestamp: responseTimestamp + 1000,
      })
    )

    const keys = getResponseAdmissionKeys(instanceKey)
    expect(await redis.get(keys.respondents)).toBe('2')
    expect(await redis.hget(keys.info, 'firstResponseReceivedAt')).toBe(
      String(responseTimestamp)
    )
    expect(
      await redis.hget(`${liveQuizKey}:b:${sessionBlockId}:lb`, 'participant-1')
    ).toBe('7')
    expect(
      await redis.hget(`${liveQuizKey}:b:${sessionBlockId}:lb`, 'participant-2')
    ).toBe('5')
    expect(await redis.hget(`${liveQuizKey}:lb`, 'participant-2')).toBe('5')
    expect(await redis.hget(`${liveQuizKey}:xp`, 'participant-2')).toBe('2')
  })

  it('uses the temporary leaderboard keys without XP', async () => {
    const participantKey = 'temporary-participant-1'
    await admitLiveQuizResponse(
      args({
        participantKey,
        participantRole: 'TEMPORARY_PARTICIPANT',
      })
    )

    expect(
      await redis.hget(
        `${liveQuizKey}:b:${sessionBlockId}:lbTemporary`,
        'participant-1'
      )
    ).toBe('7')
    expect(
      await redis.hget(`${liveQuizKey}:lbTemporary`, 'participant-1')
    ).toBe('7')
    expect(await redis.hexists(`${liveQuizKey}:xp`, participantKey)).toBe(0)
  })

  it('drops a repeated answer without consuming another slot', async () => {
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

    const keys = getResponseAdmissionKeys(instanceKey)
    expect(await redis.hget(keys.responseCounts, 'participant-1')).toBe('2')
    expect(await redis.hget(keys.results, 'participants')).toBe('2')
    expect(await redis.get(keys.respondents)).toBe('1')
    expect(await redis.hget(`${liveQuizKey}:lb`, 'participant-1')).toBe('7')
    expect(await redis.hget(`${liveQuizKey}:xp`, 'participant-1')).toBe('4')
  })

  it('reconciles a lost commit reply without applying scoring or counters twice', async () => {
    const retried = args()
    const evalCommand = redis.eval.bind(redis)
    const lostReply = vi
      .spyOn(redis, 'eval')
      .mockImplementationOnce(async (...parameters) => {
        await evalCommand(...parameters)
        throw new Error('Synthetic lost response after Redis committed')
      })
    await expect(admitLiveQuizResponse(retried)).rejects.toThrow(
      /Synthetic lost response/
    )
    lostReply.mockRestore()
    const keys = getResponseAdmissionKeys(instanceKey)
    const resultsBefore = await redis.hgetall(keys.results)

    expect(await admitLiveQuizResponse(retried)).toEqual({
      admitted: false,
      reason: 'processed',
    })
    expect(await redis.hgetall(keys.results)).toEqual(resultsBefore)
    expect(await redis.get(keys.respondents)).toBe('1')
    expect(await redis.hget(keys.responseCounts, 'participant-1')).toBe('1')
    expect(await redis.hget(`${liveQuizKey}:lb`, 'participant-1')).toBe('7')
    expect(await redis.hget(`${liveQuizKey}:xp`, 'participant-1')).toBe('4')
  })

  it('never exceeds the limit under concurrent different answers', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => admitLiveQuizResponse(args()))
    )

    expect(results.filter((result) => result.admitted)).toHaveLength(3)
    expect(
      results.filter((result) => result.admitted && result.isFirstResponse)
    ).toHaveLength(1)

    const keys = getResponseAdmissionKeys(instanceKey)
    expect(await redis.get(keys.respondents)).toBe('1')
    expect(await redis.hget(keys.responseCounts, 'participant-1')).toBe('3')
    expect(await redis.hget(keys.results, 'participants')).toBe('3')
    expect(await redis.hget(`${liveQuizKey}:lb`, 'participant-1')).toBe('7')
    expect(await redis.hget(`${liveQuizKey}:xp`, 'participant-1')).toBe('4')
  })

  it('uses the anonymous first-response flag with legacy defaulting', async () => {
    const first = args({
      participantKey: undefined,
      participantRole: undefined,
      anonymousIsFirstResponse: undefined,
    })
    const repeat = args({
      participantKey: undefined,
      participantRole: undefined,
      anonymousIsFirstResponse: false,
    })

    expect(await admitLiveQuizResponse(first)).toEqual({
      admitted: true,
      isFirstResponse: true,
    })
    expect(await admitLiveQuizResponse(repeat)).toEqual({
      admitted: true,
      isFirstResponse: false,
    })

    const keys = getResponseAdmissionKeys(instanceKey)
    expect(await redis.get(keys.respondents)).toBe('1')
    expect(await redis.hget(keys.results, 'participants')).toBe('2')
    expect(await redis.hget(keys.info, 'firstResponseReceivedAt')).toBeNull()
    expect(await redis.exists(`${liveQuizKey}:lb`)).toBe(0)
    expect(await redis.exists(`${liveQuizKey}:xp`)).toBe(0)
  })

  it('fails closed before mutation when a Redis key has the wrong type', async () => {
    const keys = getResponseAdmissionKeys(instanceKey)
    const admission = args()
    await redis.set(keys.results, 'not-a-hash')

    await expect(admitLiveQuizResponse(admission)).rejects.toThrow(/WRONGTYPE/)
    expect(await redis.sismember(keys.messages, admission.messageId)).toBe(0)
    expect(await redis.hget(keys.responseCounts, 'participant-1')).toBeNull()
    expect(await redis.get(keys.respondents)).toBeNull()
    expect(await redis.hget(keys.info, 'firstResponseReceivedAt')).toBeNull()
  })

  it('fails closed before mutation on nonnumeric counter, leaderboard or score state', async () => {
    const keys = getResponseAdmissionKeys(instanceKey)
    const invalidCount = args()
    await redis.hset(keys.responseCounts, 'participant-1', 'not-a-number')

    await expect(admitLiveQuizResponse(invalidCount)).rejects.toThrow(
      /non-negative integer/
    )
    expect(await redis.sismember(keys.messages, invalidCount.messageId)).toBe(0)
    expect(await redis.exists(keys.results)).toBe(0)
    expect(await redis.get(keys.respondents)).toBeNull()

    await redis.del(keys.responseCounts)
    await redis.hset(`${liveQuizKey}:lb`, 'participant-1', 'not-a-number')
    await expect(admitLiveQuizResponse(args())).rejects.toThrow(
      /leaderboard points/
    )
    expect(await redis.exists(keys.messages)).toBe(0)
    expect(await redis.exists(keys.results)).toBe(0)

    await expect(
      admitLiveQuizResponse(args({ pointsAwarded: Number.NaN }))
    ).rejects.toThrow(/pointsAwarded/)
    expect(await redis.exists(keys.messages)).toBe(0)
    expect(await redis.exists(keys.results)).toBe(0)
  })

  it('does not start the timing bonus clock for an incorrect first response', async () => {
    await admitLiveQuizResponse(args({ setFirstResponseTimestamp: false }))
    const keys = getResponseAdmissionKeys(instanceKey)
    expect(await redis.hget(keys.info, 'firstResponseReceivedAt')).toBeNull()
    await admitLiveQuizResponse(args({ participantKey: 'participant-2' }))
    expect(await redis.hget(keys.info, 'firstResponseReceivedAt')).toBe(
      String(responseTimestamp)
    )
  })

  it('rejects noncanonical Redis integers before consuming a response slot', async () => {
    const keys = getResponseAdmissionKeys(instanceKey)
    await redis.hset(`${liveQuizKey}:lb`, 'participant-1', '01')
    await expect(admitLiveQuizResponse(args())).rejects.toThrow(
      /non-negative integer/
    )
    expect(await redis.exists(keys.messages)).toBe(0)
    expect(await redis.exists(keys.results)).toBe(0)
  })

  it('keeps the legacy limit-one path and clamps larger limits', () => {
    expect(parseResponseLimit(undefined)).toBe(1)
    expect(parseResponseLimit('1')).toBe(1)
    expect(parseResponseLimit('0')).toBe(1)
    expect(parseResponseLimit('invalid')).toBe(1)
    expect(parseResponseLimit('11')).toBe(10)
  })
})
