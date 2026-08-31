import type { Redis } from 'ioredis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  acquireLiveQuizResponseProcessingLease,
  claimLiveQuizResponseProcessing,
  commitLiveQuizResponseProcessing,
  getLiveQuizCourseDeletedKey,
  getLiveQuizResponseProcessedKey,
  getLiveQuizResponseProcessingKey,
  getLiveQuizResponseProcessingToken,
  LIVE_QUIZ_RESPONSE_ADMISSION_LEASE_TTL_SECONDS,
  LIVE_QUIZ_RESPONSE_PROCESSED_VALUE,
  releaseLiveQuizResponseProcessingClaim,
  releaseLiveQuizResponseProcessingLease,
  renewLiveQuizResponseProcessingClaim,
  renewLiveQuizResponseProcessingLease,
  shouldRetryLiveQuizResponseProcessingResult,
  throwLiveQuizResponseProcessingClaimLost,
  trySetLiveQuizCourseDeletedFence,
} from '../src/liveQuizRedis.js'

class FakeRedis {
  readonly hashes = new Map<string, Map<string, string>>()
  readonly values = new Map<string, string>()
  readonly valueExpirations = new Map<string, number>()
  readonly leases = new Map<string, Map<string, number>>()

  private pruneExpired(now: number) {
    for (const [key, expiresAt] of this.valueExpirations) {
      if (expiresAt <= now) {
        this.valueExpirations.delete(key)
        this.values.delete(key)
      }
    }
  }

  async eval(script: string, numKeys: number, ...args: Array<string | number>) {
    if (script.includes('cjson.decode')) {
      const [
        leaseKey = '',
        processedKey = '',
        ownerNonce = '',
        processingValue = '',
        mutationsJson = '[]',
        completedValue = '',
        ttlSeconds = '0',
      ] = args.map(String)
      if (this.values.get(processedKey) !== processingValue) return 0

      const mutations = JSON.parse(mutationsJson) as Array<{
        command: 'hincrby' | 'hset'
        field: string
        increment?: number
        key: string
        value?: string
      }>
      for (const mutation of mutations) {
        const hash = this.hashes.get(mutation.key) ?? new Map<string, string>()
        if (mutation.command === 'hincrby') {
          const current = Number(hash.get(mutation.field) ?? 0)
          hash.set(
            mutation.field,
            String(current + Number(mutation.increment ?? 0))
          )
        } else {
          hash.set(mutation.field, mutation.value ?? '')
        }
        this.hashes.set(mutation.key, hash)
      }
      this.values.set(processedKey, completedValue)
      this.valueExpirations.set(
        processedKey,
        Date.now() + Number(ttlSeconds) * 1000
      )
      const leases = this.leases.get(leaseKey)
      leases?.delete(ownerNonce)
      if (leases?.size === 0) this.leases.delete(leaseKey)
      return 1
    }

    if (script.includes('local processed')) {
      const [
        deletedKey = '',
        leaseKey = '',
        processedKey = '',
        processingToken = '',
        ownerNonce = '',
        nowValue = '0',
        expiresAt = '0',
        processingValue = '',
        completedValue = '',
        ttlSeconds = '0',
      ] = args.map(String)
      const now = Number(nowValue)
      this.pruneExpired(now)
      const leases = this.leases.get(leaseKey) ?? new Map<string, number>()
      for (const [leaseToken, leaseExpiresAt] of leases) {
        if (leaseExpiresAt <= now) leases.delete(leaseToken)
      }
      if (this.values.has(deletedKey)) return -1
      const processed = this.values.get(processedKey)
      if (processed === completedValue) return 2
      if (processed) return 0
      leases.delete(processingToken)
      leases.set(ownerNonce, Number(expiresAt))
      this.leases.set(leaseKey, leases)
      this.values.set(processedKey, processingValue)
      this.valueExpirations.set(processedKey, now + Number(ttlSeconds) * 1000)
      return 1
    }

    if (script.includes('redis.call("zscore"')) {
      if (numKeys === 2) {
        const [
          leaseKey = '',
          processedKey = '',
          ownerNonce = '',
          expiresAt = '0',
          processingValue = '',
          ttlSeconds = '0',
        ] = args.map(String)
        const leases = this.leases.get(leaseKey)
        if (
          !leases?.has(ownerNonce) ||
          this.values.get(processedKey) !== processingValue
        ) {
          return 0
        }
        leases.set(ownerNonce, Number(expiresAt))
        this.valueExpirations.set(
          processedKey,
          Date.now() + Number(ttlSeconds) * 1000
        )
        return 1
      }
      const [leaseKey = '', token = '', expiresAt = '0'] = args.map(String)
      const leases = this.leases.get(leaseKey)
      if (!leases?.has(token)) return 0
      leases.set(token, Number(expiresAt))
      return 1
    }

    if (script.includes('redis.call("zrem", KEYS[1]')) {
      if (numKeys === 2) {
        const [
          leaseKey = '',
          processedKey = '',
          ownerNonce = '',
          processingValue = '',
        ] = args.map(String)
        const leases = this.leases.get(leaseKey)
        leases?.delete(ownerNonce)
        if (leases?.size === 0) this.leases.delete(leaseKey)
        if (this.values.get(processedKey) === processingValue) {
          this.values.delete(processedKey)
          this.valueExpirations.delete(processedKey)
        }
        return 1
      }
      const [leaseKey = '', token = ''] = args.map(String)
      const leases = this.leases.get(leaseKey)
      leases?.delete(token)
      if (leases?.size === 0) this.leases.delete(leaseKey)
      return 1
    }

    const [deletedKey = '', leaseKey = '', value = '', nowValue = '0'] =
      args.map(String)
    const now = Number(nowValue)
    const leases = this.leases.get(leaseKey) ?? new Map<string, number>()
    for (const [token, expiresAt] of leases) {
      if (expiresAt <= now) leases.delete(token)
    }

    if (script.includes('redis.call("zadd"')) {
      if (this.values.has(deletedKey)) return 0
      leases.set(value, Number(args[4]))
      this.leases.set(leaseKey, leases)
      return 1
    }

    if (leases.size > 0) return 0
    this.values.set(deletedKey, value)
    return 1
  }
}

describe('live quiz response processing fences', () => {
  afterEach(() => vi.restoreAllMocks())

  it('retries transient and durably admitted fenced results', () => {
    expect(
      shouldRetryLiveQuizResponseProcessingResult({
        status: 500,
        wasDurablyAdmitted: false,
      })
    ).toBe(true)
    expect(
      shouldRetryLiveQuizResponseProcessingResult({
        status: 410,
        wasDurablyAdmitted: true,
      })
    ).toBe(true)
    expect(
      shouldRetryLiveQuizResponseProcessingResult({
        status: 410,
        wasDurablyAdmitted: false,
      })
    ).toBe(false)
    expect(
      shouldRetryLiveQuizResponseProcessingResult({
        status: 400,
        wasDurablyAdmitted: true,
      })
    ).toBe(false)
  })

  it('uses the stable Hatchet message id for legacy response retries', () => {
    expect(
      getLiveQuizResponseProcessingToken({ messageId: 'legacy-message' })
    ).toBe('legacy-message')
    expect(
      getLiveQuizResponseProcessingToken({
        messageId: 'message-id',
        responseLeaseToken: 'admission-token',
      })
    ).toBe('admission-token')
  })

  it('retries a legacy response when its processing lease is lost', () => {
    expect(() => throwLiveQuizResponseProcessingClaimLost()).toThrow(
      'Live quiz response processing claim was lost'
    )
  })

  it('serializes duplicate attempts for the same response identity', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const fake = new FakeRedis()
    const redis = fake as unknown as Redis

    await expect(
      claimLiveQuizResponseProcessing(
        redis,
        'quiz-id',
        'message-id',
        'attempt-1'
      )
    ).resolves.toBe('acquired')
    await expect(
      claimLiveQuizResponseProcessing(
        redis,
        'quiz-id',
        'message-id',
        'attempt-2'
      )
    ).resolves.toBe('busy')

    await releaseLiveQuizResponseProcessingClaim(
      redis,
      'quiz-id',
      'message-id',
      'attempt-1'
    )
    await expect(
      claimLiveQuizResponseProcessing(
        redis,
        'quiz-id',
        'message-id',
        'attempt-2'
      )
    ).resolves.toBe('acquired')
  })

  it('recognizes a completed response after an ambiguous worker return', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const fake = new FakeRedis()
    const redis = fake as unknown as Redis

    await claimLiveQuizResponseProcessing(
      redis,
      'quiz-id',
      'message-id',
      'attempt-1'
    )
    fake.values.set(
      getLiveQuizResponseProcessedKey('quiz-id', 'message-id'),
      LIVE_QUIZ_RESPONSE_PROCESSED_VALUE
    )
    await releaseLiveQuizResponseProcessingClaim(
      redis,
      'quiz-id',
      'message-id',
      'attempt-1'
    )
    expect(fake.leases.has(getLiveQuizResponseProcessingKey('quiz-id'))).toBe(
      false
    )

    await expect(
      claimLiveQuizResponseProcessing(
        redis,
        'quiz-id',
        'message-id',
        'attempt-2'
      )
    ).resolves.toBe('processed')
  })

  it('prevents an expired attempt from acting on its successor claim', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const fake = new FakeRedis()
    const redis = fake as unknown as Redis

    await claimLiveQuizResponseProcessing(
      redis,
      'quiz-id',
      'message-id',
      'expired-attempt',
      1
    )
    vi.mocked(Date.now).mockReturnValue(2_001)
    await expect(
      claimLiveQuizResponseProcessing(
        redis,
        'quiz-id',
        'message-id',
        'successor-attempt',
        1
      )
    ).resolves.toBe('acquired')

    await expect(
      renewLiveQuizResponseProcessingClaim(
        redis,
        'quiz-id',
        'message-id',
        'expired-attempt',
        1
      )
    ).resolves.toBe(false)
    await releaseLiveQuizResponseProcessingClaim(
      redis,
      'quiz-id',
      'message-id',
      'expired-attempt'
    )
    await expect(
      commitLiveQuizResponseProcessing(
        redis,
        'quiz-id',
        'message-id',
        'expired-attempt',
        [
          {
            command: 'hincrby',
            field: 'participants',
            increment: 1,
            key: 'results',
          },
        ]
      )
    ).resolves.toBe(false)

    await expect(
      commitLiveQuizResponseProcessing(
        redis,
        'quiz-id',
        'message-id',
        'successor-attempt',
        [
          {
            command: 'hincrby',
            field: 'participants',
            increment: 1,
            key: 'results',
          },
        ]
      )
    ).resolves.toBe(true)
    expect(fake.hashes.get('results')?.get('participants')).toBe('1')
  })

  it('waits for active response leases before fencing a deleted course', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const fake = new FakeRedis()
    const redis = fake as unknown as Redis

    await expect(
      acquireLiveQuizResponseProcessingLease(redis, 'quiz-id', 'response-1')
    ).resolves.toBe(true)
    await expect(
      trySetLiveQuizCourseDeletedFence(redis, 'quiz-id', 'deletion-job')
    ).resolves.toBe(false)

    await releaseLiveQuizResponseProcessingLease(redis, 'quiz-id', 'response-1')
    await expect(
      trySetLiveQuizCourseDeletedFence(redis, 'quiz-id', 'deletion-job')
    ).resolves.toBe(true)
    await expect(
      acquireLiveQuizResponseProcessingLease(redis, 'quiz-id', 'response-2')
    ).resolves.toBe(false)

    expect(fake.values.get(getLiveQuizCourseDeletedKey('quiz-id'))).toBe(
      'deletion-job'
    )
    expect(fake.leases.has(getLiveQuizResponseProcessingKey('quiz-id'))).toBe(
      false
    )
  })

  it('fails closed when a response lease is lost', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const fake = new FakeRedis()
    const redis = fake as unknown as Redis

    await acquireLiveQuizResponseProcessingLease(
      redis,
      'quiz-id',
      'response-1',
      1
    )
    vi.mocked(Date.now).mockReturnValue(2_001)

    await expect(
      trySetLiveQuizCourseDeletedFence(redis, 'quiz-id', 'deletion-job')
    ).resolves.toBe(true)
    await expect(
      renewLiveQuizResponseProcessingLease(redis, 'quiz-id', 'response-1')
    ).resolves.toBe(false)
  })

  it('keeps an accepted response fenced while Hatchet hands it to a worker', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const fake = new FakeRedis()
    const redis = fake as unknown as Redis

    await expect(
      acquireLiveQuizResponseProcessingLease(
        redis,
        'quiz-id',
        'accepted-response',
        LIVE_QUIZ_RESPONSE_ADMISSION_LEASE_TTL_SECONDS
      )
    ).resolves.toBe(true)

    vi.mocked(Date.now).mockReturnValue(5 * 60 * 1000)
    await expect(
      renewLiveQuizResponseProcessingLease(
        redis,
        'quiz-id',
        'accepted-response'
      )
    ).resolves.toBe(true)
    await expect(
      trySetLiveQuizCourseDeletedFence(redis, 'quiz-id', 'deletion-job')
    ).resolves.toBe(false)

    await releaseLiveQuizResponseProcessingLease(
      redis,
      'quiz-id',
      'accepted-response'
    )
    await expect(
      trySetLiveQuizCourseDeletedFence(redis, 'quiz-id', 'deletion-job')
    ).resolves.toBe(true)
  })

  it('lets a durably admitted worker reacquire after the Redis handoff expires', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const fake = new FakeRedis()
    const redis = fake as unknown as Redis

    await acquireLiveQuizResponseProcessingLease(
      redis,
      'quiz-id',
      'durable-response',
      LIVE_QUIZ_RESPONSE_ADMISSION_LEASE_TTL_SECONDS
    )
    vi.mocked(Date.now).mockReturnValue(
      1_000 + LIVE_QUIZ_RESPONSE_ADMISSION_LEASE_TTL_SECONDS * 1000 + 1
    )

    // The worker only takes this path after finding the durable database
    // admission. Reacquisition replaces the expired Redis optimization, so
    // course deletion remains fenced until processing completes.
    await expect(
      acquireLiveQuizResponseProcessingLease(
        redis,
        'quiz-id',
        'durable-response'
      )
    ).resolves.toBe(true)
    await expect(
      trySetLiveQuizCourseDeletedFence(redis, 'quiz-id', 'deletion-job')
    ).resolves.toBe(false)
  })
})
