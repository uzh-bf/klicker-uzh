import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildCorrelatedVoteKey,
  claimCorrelatedResponse,
  releaseCorrelatedResponse,
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
        domain: 'klicker.test',
        secure: true,
      }),
      'live_quiz_respondent_token=signed-token; Max-Age=1209600; Domain=klicker.test; Path=/; HttpOnly; Secure; SameSite=Lax'
    )
  })
})
