import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildCorrelatedVoteKey,
  claimCorrelatedResponse,
  hasJsonContentType,
  hasPersistedCorrelatedResponse,
  hasValidLiveQuizPin,
  isAllowedCorsOrigin,
  isCorrelatedResponseWorkerReady,
  releaseCorrelatedResponse,
  resolveResponseCollectionMode,
  serializeLiveQuizRespondentCookie,
} from '../src/correlatedResponses.js'

class MemoryRedis {
  private readonly strings = new Map<string, string>()
  lastTtlMs: number | undefined

  async get(key: string) {
    return this.strings.get(key) ?? null
  }

  async set(
    key: string,
    value: string,
    _expiryMode?: 'PX',
    time?: number,
    _setMode?: 'NX'
  ) {
    if (_setMode === 'NX' && this.strings.has(key)) return null
    this.strings.set(key, value)
    this.lastTtlMs = time
    return 'OK' as const
  }

  async eval(
    _script: string,
    _numberOfKeys: number,
    key: string,
    expectedValue: string
  ) {
    if (this.strings.get(key) !== expectedValue) return 0
    return this.strings.delete(key) ? 1 : 0
  }
}

describe('correlated response claim', () => {
  it('allows only the first response for one identity and block execution', async () => {
    const redis = new MemoryRedis()
    const key = buildCorrelatedVoteKey({
      liveQuizId: 'quiz-1',
      instanceId: '42',
      blockExecution: '3',
      identityKey: 'respondent:abc',
    })

    assert.equal(
      await claimCorrelatedResponse({
        redis,
        key,
        identityKey: 'respondent:abc',
        messageId: 'message-1',
      }),
      true
    )
    assert.equal(redis.lastTtlMs, 5 * 60 * 1000)
    assert.equal(
      await claimCorrelatedResponse({
        redis,
        key,
        identityKey: 'respondent:abc',
        messageId: 'message-2',
      }),
      false
    )
  })

  it('releases only the claim owned by the failed event', async () => {
    const redis = new MemoryRedis()
    const key = 'claim-key'
    await claimCorrelatedResponse({
      redis,
      key,
      identityKey: 'participant:abc',
      messageId: 'message-1',
    })

    assert.equal(
      await releaseCorrelatedResponse({
        redis,
        key,
        identityKey: 'participant:abc',
        messageId: 'message-2',
      }),
      false
    )
    assert.equal(
      await releaseCorrelatedResponse({
        redis,
        key,
        identityKey: 'participant:abc',
        messageId: 'message-1',
      }),
      true
    )
  })
})

describe('correlated response request safeguards', () => {
  it('requires allowlisted browser origins while permitting non-browser clients', () => {
    assert.equal(
      isAllowedCorsOrigin({
        origin: undefined,
        allowedOrigins: ['https://pwa.klicker.test'],
      }),
      true
    )
    assert.equal(
      isAllowedCorsOrigin({
        origin: 'https://pwa.klicker.test',
        allowedOrigins: ['https://pwa.klicker.test'],
      }),
      true
    )
    assert.equal(
      isAllowedCorsOrigin({
        origin: 'https://attacker.test',
        allowedOrigins: ['https://pwa.klicker.test'],
      }),
      false
    )
  })

  it('accepts only JSON request content types', () => {
    assert.equal(hasJsonContentType('application/json'), true)
    assert.equal(hasJsonContentType('application/json; charset=utf-8'), true)
    assert.equal(hasJsonContentType('text/plain'), false)
    assert.equal(hasJsonContentType(undefined), false)
  })

  it('checks worker compatibility through the protocol heartbeat', async () => {
    const redis = new MemoryRedis()
    assert.equal(await isCorrelatedResponseWorkerReady({ redis }), false)
    await redis.set('lq:correlatedResponses:workerProtocol:v1', 'v1')
    assert.equal(await isCorrelatedResponseWorkerReady({ redis }), true)
  })

  it('detects an existing response for either owner type', async () => {
    const calls: any[] = []
    const database = {
      liveQuizResponse: {
        findUnique: async (args: any) => {
          calls.push(args)
          return { id: 'response-id' }
        },
      },
    } as any

    assert.equal(
      await hasPersistedCorrelatedResponse({
        database,
        identity: {
          kind: 'participant',
          id: 'participant-id',
          token: 'token',
          cookieName: 'participant_token',
        },
        instanceId: 42,
        blockExecution: 3,
      }),
      true
    )
    assert.equal(
      await hasPersistedCorrelatedResponse({
        database,
        identity: {
          kind: 'anonymous',
          id: 'respondent-id',
          liveQuizId: 'quiz-id',
          token: 'token',
          cookieName: 'cookie',
        },
        instanceId: 42,
        blockExecution: 3,
      }),
      true
    )
    assert.equal(calls.length, 2)
  })
})

describe('live quiz respondent cookie', () => {
  it('uses the same two-week lifetime as the signed token', () => {
    assert.equal(
      serializeLiveQuizRespondentCookie({
        token: 'signed-token',
        liveQuizId: '11111111-1111-4111-8111-111111111111',
        domain: 'klicker.test',
        secure: true,
      }),
      'live_quiz_respondent_token_11111111-1111-4111-8111-111111111111=signed-token; Max-Age=1209600; Domain=klicker.test; Path=/; HttpOnly; Secure; SameSite=Lax'
    )
  })
})

describe('live quiz PIN access', () => {
  it('allows quizzes without PIN protection', () => {
    assert.equal(
      hasValidLiveQuizPin({
        cookieHeader: undefined,
        liveQuizId: 'quiz-1',
        pinCode: null,
      }),
      true
    )
  })

  it('requires the quiz-scoped PIN cookie', () => {
    assert.equal(
      hasValidLiveQuizPin({
        cookieHeader: 'live-quiz-pin-other=ABC123; live-quiz-pin-quiz-1=DEF456',
        liveQuizId: 'quiz-1',
        pinCode: 'DEF456',
      }),
      true
    )
    assert.equal(
      hasValidLiveQuizPin({
        cookieHeader: 'live-quiz-pin-quiz-1=WRONG1',
        liveQuizId: 'quiz-1',
        pinCode: 'DEF456',
      }),
      false
    )
  })
})

describe('response collection mode', () => {
  it('uses cached correlated mode without a database lookup', async () => {
    let lookupCalled = false

    assert.equal(
      await resolveResponseCollectionMode({
        cachedMode: 'CORRELATED_EXPORT',
        liveQuizId: 'quiz-1',
        lookupMode: async () => {
          lookupCalled = true
          return 'AGGREGATED_ANONYMOUS'
        },
      }),
      'CORRELATED_EXPORT'
    )
    assert.equal(lookupCalled, false)
  })

  it('falls back to the stored mode for rolling deployments', async () => {
    assert.equal(
      await resolveResponseCollectionMode({
        cachedMode: undefined,
        liveQuizId: 'quiz-1',
        lookupMode: async () => 'CORRELATED_EXPORT',
      }),
      'CORRELATED_EXPORT'
    )
  })
})
