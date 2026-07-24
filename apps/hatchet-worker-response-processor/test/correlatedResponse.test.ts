import {
  LiveQuizRespondentType,
  ResponseCorrectness,
  UserRole,
} from '@klicker-uzh/prisma/client'
import {
  buildCorrelatedVoteKey,
  createLiveQuizRespondentToken,
  getLiveQuizRespondentCookieName,
  hashLiveQuizRespondentToken,
  signJWT,
} from '@klicker-uzh/util'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describe, it } from 'node:test'
import {
  applyCorrelatedRedisMutations,
  buildCorrelatedResponseCreateData,
  CorrelatedRedisMutationBuffer,
  CorrelatedResponseIdentityError,
  CorrelatedResponseProcessingBusyError,
  getCorrelatedProcessedKey,
  isPersistedResponseRetry,
  prepareCorrelatedMessageProcessing,
  prepareCorrelatedResponseProcessing,
  releaseCorrelatedProcessingLock,
  resolveCorrelatedResponseOwner,
  validateCorrelatedRedisHashKeys,
} from '../src/processors/correlatedResponse.js'

const secret = 'test-secret'
const issuer = 'https://api.klicker.test'

type RespondentRow = {
  id: string
  liveQuizId: string
  type: LiveQuizRespondentType
  verificationSecretHash: string | null
}

class MemoryProcessingRedis {
  private readonly hashes = new Map<string, Map<string, string>>()
  private readonly strings = new Map<string, string>()
  private readonly forcedTypes = new Map<string, string>()

  async hget(key: string, field: string) {
    return this.hashes.get(key)?.get(field) ?? null
  }

  async get(key: string) {
    return this.strings.get(key) ?? null
  }

  async set(
    key: string,
    value: string,
    _expiryMode: 'PX',
    _time: number,
    _setMode: 'NX'
  ) {
    if (this.strings.has(key)) return null
    this.strings.set(key, value)
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

  async type(key: string) {
    return (
      this.forcedTypes.get(key) ??
      (this.hashes.has(key)
        ? 'hash'
        : this.strings.has(key)
          ? 'string'
          : 'none')
    )
  }

  setHashValue(key: string, field: string, value: string) {
    const hash = this.hashes.get(key) ?? new Map<string, string>()
    hash.set(field, value)
    this.hashes.set(key, hash)
  }

  forceType(key: string, type: string) {
    this.forcedTypes.set(key, type)
  }
}

function createDatabase({
  participantIds = [],
  temporaryEntries = [],
  respondentRows = [],
}: {
  participantIds?: string[]
  temporaryEntries?: Array<{
    id: string
    quizId: string
    username: string
    avatar: string | null
    score: number
  }>
  respondentRows?: RespondentRow[]
} = {}) {
  const respondents = new Map(respondentRows.map((row) => [row.id, row]))
  const createdRespondents: RespondentRow[] = []

  return {
    database: {
      participant: {
        findUnique: async ({ where }: any) =>
          participantIds.includes(where.id) ? { id: where.id } : null,
      },
      temporaryLeaderboardEntry: {
        findUnique: async ({ where }: any) =>
          temporaryEntries.find(
            (entry) =>
              entry.id === where.id_quizId.id &&
              entry.quizId === where.id_quizId.quizId
          ) ?? null,
      },
      liveQuizRespondent: {
        upsert: async ({ where, create }: any) => {
          const existing = respondents.get(where.id)
          if (existing) return existing

          const row: RespondentRow = {
            id: create.id,
            liveQuizId: create.liveQuiz.connect.id,
            type: create.type,
            verificationSecretHash: create.verificationSecretHash ?? null,
          }
          respondents.set(row.id, row)
          createdRespondents.push(row)
          return row
        },
      },
    } as any,
    createdRespondents,
  }
}

describe('resolveCorrelatedResponseOwner', () => {
  it('accepts a signed participant identity that still exists', async () => {
    const liveQuizId = randomUUID()
    const participantId = randomUUID()
    const token = await signJWT(
      { sub: participantId, role: UserRole.PARTICIPANT },
      secret,
      { expiresIn: '1h', issuer }
    )
    const { database } = createDatabase({
      participantIds: [participantId],
    })

    const owner = await resolveCorrelatedResponseOwner({
      cookieHeader: `participant_token=${token}`,
      liveQuizId,
      secret,
      issuer,
      database,
    })

    assert.deepEqual(owner, {
      kind: 'participant',
      id: participantId,
      identityKey: `participant:${participantId}`,
    })
  })

  it('bridges a valid legacy temporary leaderboard entry', async () => {
    const liveQuizId = randomUUID()
    const respondentId = randomUUID()
    const token = await signJWT(
      {
        sub: respondentId,
        role: UserRole.TEMPORARY_PARTICIPANT,
        scopeQuizId: liveQuizId,
      },
      secret,
      { expiresIn: '1h', issuer }
    )
    const { database, createdRespondents } = createDatabase({
      temporaryEntries: [
        {
          id: respondentId,
          quizId: liveQuizId,
          username: 'Temporary',
          avatar: null,
          score: 4,
        },
      ],
    })

    const owner = await resolveCorrelatedResponseOwner({
      cookieHeader: `temporary_participant_token=${token}`,
      liveQuizId,
      secret,
      issuer,
      database,
    })

    assert.equal(owner.kind, 'temporary')
    assert.equal(owner.id, respondentId)
    assert.equal(
      createdRespondents[0]?.type,
      LiveQuizRespondentType.TEMPORARY_PSEUDONYM
    )
  })

  it('rejects a logged-out temporary identity', async () => {
    const liveQuizId = randomUUID()
    const respondentId = randomUUID()
    const token = await signJWT(
      {
        sub: respondentId,
        role: UserRole.TEMPORARY_PARTICIPANT,
        scopeQuizId: liveQuizId,
      },
      secret,
      { expiresIn: '1h', issuer }
    )
    const { database } = createDatabase()

    await assert.rejects(
      resolveCorrelatedResponseOwner({
        cookieHeader: `temporary_participant_token=${token}`,
        liveQuizId,
        secret,
        issuer,
        database,
      }),
      CorrelatedResponseIdentityError
    )
  })

  it('creates an anonymous respondent with the signed token hash', async () => {
    const liveQuizId = randomUUID()
    const respondentId = randomUUID()
    const token = await createLiveQuizRespondentToken({
      respondentId,
      liveQuizId,
      secret,
      issuer,
    })
    const { database, createdRespondents } = createDatabase()

    const owner = await resolveCorrelatedResponseOwner({
      cookieHeader: `${getLiveQuizRespondentCookieName(liveQuizId)}=${token}`,
      liveQuizId,
      secret,
      issuer,
      database,
    })

    assert.equal(owner.kind, 'anonymous')
    assert.equal(owner.id, respondentId)
    assert.equal(
      createdRespondents[0]?.verificationSecretHash,
      hashLiveQuizRespondentToken(token)
    )
  })

  it('rejects an anonymous token scoped to another quiz', async () => {
    const liveQuizId = randomUUID()
    const token = await createLiveQuizRespondentToken({
      respondentId: randomUUID(),
      liveQuizId: randomUUID(),
      secret,
      issuer,
    })
    const { database } = createDatabase()

    await assert.rejects(
      resolveCorrelatedResponseOwner({
        cookieHeader: `${getLiveQuizRespondentCookieName(liveQuizId)}=${token}`,
        liveQuizId,
        secret,
        issuer,
        database,
      }),
      CorrelatedResponseIdentityError
    )
  })

  it('rejects an anonymous token that does not match the stored hash', async () => {
    const liveQuizId = randomUUID()
    const respondentId = randomUUID()
    const token = await createLiveQuizRespondentToken({
      respondentId,
      liveQuizId,
      secret,
      issuer,
    })
    const { database } = createDatabase({
      respondentRows: [
        {
          id: respondentId,
          liveQuizId,
          type: LiveQuizRespondentType.ANONYMOUS_CORRELATED,
          verificationSecretHash: 'different-token-hash',
        },
      ],
    })

    await assert.rejects(
      resolveCorrelatedResponseOwner({
        cookieHeader: `${getLiveQuizRespondentCookieName(liveQuizId)}=${token}`,
        liveQuizId,
        secret,
        issuer,
        database,
      }),
      CorrelatedResponseIdentityError
    )
  })
})

describe('correlated response persistence helpers', () => {
  it('builds a participant response without respondent identifiers', () => {
    const participantId = randomUUID()
    const submittedAt = Date.now()

    const data = buildCorrelatedResponseCreateData({
      owner: {
        kind: 'participant',
        id: participantId,
        identityKey: `participant:${participantId}`,
      },
      instanceId: 42,
      blockExecution: 3,
      response: { choices: [{ ix: 0, selected: true }] },
      submittedAt,
      correctnessPercentage: 0.5,
      basePoints: 10,
      correctnessPoints: 5,
      bonusPoints: 2,
    })

    assert.equal(data.correctness, ResponseCorrectness.PARTIAL)
    assert.deepEqual(data.participant, { connect: { id: participantId } })
    assert.equal('respondent' in data, false)
    assert.equal(data.submittedAt.getTime(), submittedAt)
  })

  it('builds an anonymous response without participant identifiers', () => {
    const respondentId = randomUUID()
    const data = buildCorrelatedResponseCreateData({
      owner: {
        kind: 'anonymous',
        id: respondentId,
        identityKey: `respondent:${respondentId}`,
      },
      instanceId: 42,
      blockExecution: 3,
      response: { value: 'answer' },
      submittedAt: Date.now(),
      correctnessPercentage: null,
      basePoints: 0,
      correctnessPoints: 0,
      bonusPoints: 0,
    })

    assert.deepEqual(data.respondent, { connect: { id: respondentId } })
    assert.equal('participant' in data, false)
  })

  it('recognizes only the owning event as a persisted retry', () => {
    const timestamp = Date.now()
    assert.equal(
      isPersistedResponseRetry({
        existingSubmittedAt: new Date(timestamp),
        responseTimestamp: timestamp,
        claimOwnerMessageId: 'message-1',
        messageId: 'message-1',
      }),
      true
    )
    assert.equal(
      isPersistedResponseRetry({
        existingSubmittedAt: new Date(timestamp),
        responseTimestamp: timestamp + 1,
        claimOwnerMessageId: 'message-1',
        messageId: 'message-1',
      }),
      false
    )
  })

  it('scopes the processed marker to one execution', () => {
    assert.equal(
      getCorrelatedProcessedKey({
        liveQuizId: 'quiz',
        instanceId: '7',
        blockExecution: 2,
      }),
      'lq:quiz:i:7:correlatedProcessed:2'
    )
  })

  it('serializes overlapping processing of the same response', async () => {
    const redis = new MemoryProcessingRedis()
    const database = {
      liveQuizResponse: { findUnique: async () => null },
    } as any
    const params = {
      redis,
      database,
      processedKey: 'processed-key',
      owner: {
        kind: 'anonymous' as const,
        id: 'respondent-id',
        identityKey: 'respondent:respondent-id',
      },
      instanceId: 42,
      blockExecution: 3,
      responseTimestamp: 123,
      claimOwnerMessageId: 'message-1',
      messageId: 'message-1',
    }

    const first = await prepareCorrelatedResponseProcessing(params)
    assert.equal(first.status, 'process')
    await assert.rejects(
      prepareCorrelatedResponseProcessing(params),
      CorrelatedResponseProcessingBusyError
    )

    if (first.status === 'process') {
      assert.equal(
        await releaseCorrelatedProcessingLock({
          redis,
          lockKey: first.lockKey,
          messageId: params.messageId,
        }),
        true
      )
    }
  })

  it('resumes aggregation after the response row was persisted', async () => {
    const timestamp = Date.now()
    const result = await prepareCorrelatedResponseProcessing({
      redis: new MemoryProcessingRedis(),
      database: {
        liveQuizResponse: {
          findUnique: async () => ({ submittedAt: new Date(timestamp) }),
        },
      } as any,
      processedKey: 'processed-key',
      owner: {
        kind: 'participant',
        id: 'participant-id',
        identityKey: 'participant:participant-id',
      },
      instanceId: 42,
      blockExecution: 3,
      responseTimestamp: timestamp,
      claimOwnerMessageId: 'message-1',
      messageId: 'message-1',
    })

    assert.equal(result.status, 'process')
    if (result.status === 'process') {
      assert.equal(result.responsePersisted, true)
    }
  })

  it('rejects a different event when a response row already exists', async () => {
    const result = await prepareCorrelatedResponseProcessing({
      redis: new MemoryProcessingRedis(),
      database: {
        liveQuizResponse: {
          findUnique: async () => ({ submittedAt: new Date(123) }),
        },
      } as any,
      processedKey: 'processed-key',
      owner: {
        kind: 'anonymous',
        id: 'respondent-id',
        identityKey: 'respondent:respondent-id',
      },
      instanceId: 42,
      blockExecution: 3,
      responseTimestamp: 456,
      claimOwnerMessageId: 'message-2',
      messageId: 'message-2',
    })

    assert.deepEqual(result, { status: 'duplicate' })
  })

  it('returns a completed response without acquiring a processing lock', async () => {
    const redis = new MemoryProcessingRedis()
    redis.setHashValue('processed-key', 'respondent:respondent-id', 'message-1')

    const result = await prepareCorrelatedResponseProcessing({
      redis,
      database: {
        liveQuizResponse: { findUnique: async () => null },
      } as any,
      processedKey: 'processed-key',
      owner: {
        kind: 'anonymous',
        id: 'respondent-id',
        identityKey: 'respondent:respondent-id',
      },
      instanceId: 42,
      blockExecution: 3,
      responseTimestamp: 123,
      claimOwnerMessageId: 'message-1',
      messageId: 'message-1',
    })

    assert.deepEqual(result, { status: 'processed' })
  })

  it('rejects non-hash aggregate keys before writes are executed', async () => {
    const redis = new MemoryProcessingRedis()
    redis.forceType('invalid-key', 'string')

    await assert.rejects(
      validateCorrelatedRedisHashKeys({
        redis,
        keys: ['valid-key', 'invalid-key'],
      }),
      /Expected Redis hash/
    )
  })

  it('processes an accepted event after its ingress claim expires', async () => {
    const liveQuizId = randomUUID()
    const respondentId = randomUUID()
    const messageId = randomUUID()
    const token = await createLiveQuizRespondentToken({
      respondentId,
      liveQuizId,
      secret,
      issuer,
    })
    const identityKey = `respondent:${respondentId}` as const
    const claimKey = buildCorrelatedVoteKey({
      liveQuizId,
      instanceId: '42',
      blockExecution: '3',
      identityKey,
    })
    const redis = new MemoryProcessingRedis()
    const { database } = createDatabase()
    ;(database as any).liveQuizResponse = {
      findUnique: async () => null,
    }

    const result = await prepareCorrelatedMessageProcessing({
      redis,
      database,
      message: {
        messageId,
        sessionId: liveQuizId,
        instanceId: '42',
        responseTimestamp: 123,
        cookie: `${getLiveQuizRespondentCookieName(liveQuizId)}=${token}`,
        correlatedClaim: { key: claimKey, identityKey },
      },
      blockExecution: '3',
      sessionBlockId: randomUUID(),
      secret,
      issuer,
    })

    assert.equal(result.status, 'process')
    if (result.status === 'process') {
      assert.equal(result.state.owner.id, respondentId)
      assert.equal(result.state.blockExecution, 3)
    }
  })

  it('buffers typed Redis mutations for one atomic apply operation', async () => {
    const buffer = new CorrelatedRedisMutationBuffer()
    buffer.hincrby('results', 'participants', 1)
    buffer.hset('responses', 'respondent', 'answer')
    buffer.hsetnx('info', 'firstResponseReceivedAt', 123)

    let args: Array<number | string> = []
    const result = await applyCorrelatedRedisMutations({
      redis: {
        eval: async (
          _script: string,
          _numberOfKeys: number,
          ...received: Array<number | string>
        ) => {
          args = received
          return 1
        },
      },
      mutations: buffer.mutations,
      processedKey: 'processed',
      identityKey: 'respondent:abc',
      messageId: 'message-1',
    })

    assert.equal(result, 'applied')
    assert.deepEqual(JSON.parse(String(args[1])), buffer.mutations)
    assert.deepEqual(args.slice(2), ['respondent:abc', 'message-1'])
  })
})
