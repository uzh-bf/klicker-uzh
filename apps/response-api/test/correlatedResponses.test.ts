import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildCorrelatedVoteKey,
  claimCorrelatedResponse,
  hasValidLiveQuizPin,
  releaseCorrelatedResponse,
  resolveResponseCollectionMode,
  serializeLiveQuizRespondentCookie,
} from '../src/correlatedResponses.js'

class MemoryRedis {
  private readonly hashes = new Map<string, Map<string, string>>()

  async hsetnx(key: string, field: string, value: string) {
    const hash = this.hashes.get(key) ?? new Map<string, string>()
    this.hashes.set(key, hash)
    if (hash.has(field)) return 0
    hash.set(field, value)
    return 1
  }

  async eval(
    _script: string,
    _numberOfKeys: number,
    key: string,
    field: string,
    expectedValue: string
  ) {
    const hash = this.hashes.get(key)
    if (hash?.get(field) !== expectedValue) return 0
    return hash.delete(field) ? 1 : 0
  }
}

describe('correlated response claim', () => {
  it('allows only the first response for one identity and block execution', async () => {
    const redis = new MemoryRedis()
    const key = buildCorrelatedVoteKey({
      liveQuizId: 'quiz-1',
      instanceId: '42',
      blockExecution: '3',
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
