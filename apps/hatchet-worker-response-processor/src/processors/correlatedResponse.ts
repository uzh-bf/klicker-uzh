import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'
import {
  LiveQuizRespondentType,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import type { LiveQuizResponseInput } from '@klicker-uzh/types'
import {
  hashLiveQuizRespondentToken,
  resolveLiveQuizResponseIdentity,
} from '@klicker-uzh/util'

type CorrelatedResponseDatabase = Pick<
  PrismaClient,
  'liveQuizRespondent' | 'participant' | 'temporaryLeaderboardEntry'
>

export type CorrelatedResponseOwner =
  | {
      kind: 'participant'
      id: string
      identityKey: string
    }
  | {
      kind: 'temporary'
      id: string
      identityKey: string
    }
  | {
      kind: 'anonymous'
      id: string
      identityKey: string
    }

export class CorrelatedResponseIdentityError extends Error {}

export async function resolveCorrelatedResponseOwner({
  cookieHeader,
  liveQuizId,
  secret,
  issuer,
  database,
}: {
  cookieHeader: string | undefined
  liveQuizId: string
  secret: string
  issuer: string
  database: CorrelatedResponseDatabase
}): Promise<CorrelatedResponseOwner> {
  const identity = await resolveLiveQuizResponseIdentity({
    cookieHeader,
    liveQuizId,
    secret,
    issuer,
  })
  if (!identity) {
    throw new CorrelatedResponseIdentityError(
      'Missing or invalid correlated response identity'
    )
  }

  if (identity.kind === 'participant') {
    const participant = await database.participant.findUnique({
      where: { id: identity.id },
      select: { id: true },
    })
    if (!participant) {
      throw new CorrelatedResponseIdentityError(
        'Correlated response participant no longer exists'
      )
    }

    return {
      kind: 'participant',
      id: identity.id,
      identityKey: `participant:${identity.id}`,
    }
  }

  if (identity.kind === 'temporary') {
    const legacyEntry = await database.temporaryLeaderboardEntry.findUnique({
      where: {
        id_quizId: {
          id: identity.id,
          quizId: liveQuizId,
        },
      },
    })
    if (!legacyEntry) {
      throw new CorrelatedResponseIdentityError(
        'Temporary correlated response identity is no longer active'
      )
    }

    const respondent = await database.liveQuizRespondent.upsert({
      where: { id: identity.id },
      update: {},
      create: {
        id: identity.id,
        type: LiveQuizRespondentType.TEMPORARY_PSEUDONYM,
        username: legacyEntry.username,
        avatar: legacyEntry.avatar,
        score: legacyEntry.score,
        liveQuiz: { connect: { id: liveQuizId } },
      },
    })
    if (
      respondent.liveQuizId !== liveQuizId ||
      respondent.type !== LiveQuizRespondentType.TEMPORARY_PSEUDONYM
    ) {
      throw new CorrelatedResponseIdentityError(
        'Temporary correlated response identity has invalid scope'
      )
    }
  } else {
    const verificationSecretHash = hashLiveQuizRespondentToken(identity.token)
    const respondent = await database.liveQuizRespondent.upsert({
      where: { id: identity.id },
      update: {},
      create: {
        id: identity.id,
        type: LiveQuizRespondentType.ANONYMOUS_CORRELATED,
        verificationSecretHash,
        liveQuiz: { connect: { id: liveQuizId } },
      },
    })
    if (
      respondent.liveQuizId !== liveQuizId ||
      respondent.type !== LiveQuizRespondentType.ANONYMOUS_CORRELATED ||
      respondent.verificationSecretHash !== verificationSecretHash
    ) {
      throw new CorrelatedResponseIdentityError(
        'Anonymous correlated response identity has invalid scope or secret'
      )
    }
  }

  return {
    kind: identity.kind,
    id: identity.id,
    identityKey: `respondent:${identity.id}`,
  }
}

export function buildCorrelatedResponseCreateData({
  owner,
  instanceId,
  blockExecution,
  response,
  submittedAt,
  correctnessPercentage,
  basePoints,
  correctnessPoints,
  bonusPoints,
}: {
  owner: CorrelatedResponseOwner
  instanceId: number
  blockExecution: number
  response: LiveQuizResponseInput
  submittedAt: number
  correctnessPercentage: number | null
  basePoints: number
  correctnessPoints: number
  bonusPoints: number
}): Prisma.LiveQuizResponseCreateInput {
  return {
    submittedAt: new Date(submittedAt),
    response,
    timeSpent: -1,
    correctness:
      correctnessPercentage === null || correctnessPercentage === 1
        ? ResponseCorrectness.CORRECT
        : correctnessPercentage === 0
          ? ResponseCorrectness.WRONG
          : ResponseCorrectness.PARTIAL,
    basePoints: Number.isNaN(basePoints) ? 0 : basePoints,
    correctnessPoints: Number.isNaN(correctnessPoints) ? 0 : correctnessPoints,
    bonusPoints: Number.isNaN(bonusPoints) ? 0 : bonusPoints,
    elementBlockExecution: blockExecution,
    instance: { connect: { id: instanceId } },
    ...(owner.kind === 'participant'
      ? { participant: { connect: { id: owner.id } } }
      : { respondent: { connect: { id: owner.id } } }),
  }
}

export function getCorrelatedProcessedKey({
  liveQuizId,
  instanceId,
  blockExecution,
}: {
  liveQuizId: string
  instanceId: string
  blockExecution: number
}) {
  return `lq:${liveQuizId}:i:${instanceId}:correlatedProcessed:${blockExecution}`
}

export function isPersistedResponseRetry({
  existingSubmittedAt,
  responseTimestamp,
  claimOwnerMessageId,
  messageId,
}: {
  existingSubmittedAt: Date
  responseTimestamp: number
  claimOwnerMessageId: string | null
  messageId: string
}) {
  return (
    existingSubmittedAt.getTime() === responseTimestamp &&
    claimOwnerMessageId === messageId
  )
}
