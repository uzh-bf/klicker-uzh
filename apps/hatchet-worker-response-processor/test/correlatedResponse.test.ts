import {
  LiveQuizRespondentType,
  ResponseCorrectness,
  UserRole,
} from '@klicker-uzh/prisma/client'
import {
  createLiveQuizRespondentToken,
  getLiveQuizRespondentCookieName,
  hashLiveQuizRespondentToken,
  signJWT,
} from '@klicker-uzh/util'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describe, it } from 'node:test'
import {
  buildCorrelatedResponseCreateData,
  CorrelatedResponseIdentityError,
  getCorrelatedProcessedKey,
  isPersistedResponseRetry,
  resolveCorrelatedResponseOwner,
} from '../src/processors/correlatedResponse.js'

const secret = 'test-secret'
const issuer = 'https://api.klicker.test'

type RespondentRow = {
  id: string
  liveQuizId: string
  type: LiveQuizRespondentType
  verificationSecretHash: string | null
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
})
