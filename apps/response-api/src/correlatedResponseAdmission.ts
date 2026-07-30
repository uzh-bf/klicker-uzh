import {
  LiveQuizRespondentType,
  LiveQuizResponseCollectionMode,
  PublicationStatus,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  buildCorrelatedResponseKey,
  buildLiveQuizResponseIdentityKey,
  getLiveQuizRespondentCookieName,
  hashLiveQuizRespondentToken,
  LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS,
  parseCookiesHeader,
  type AcceptedCorrelatedResponseIdentity,
  type LiveQuizResponseIdentity,
} from '@klicker-uzh/util'

export async function getCorrelatedResponseAdmission({
  database,
  liveQuizId,
  cookieHeader,
}: {
  database: Pick<PrismaClient, 'liveQuiz'>
  liveQuizId: string
  cookieHeader: string | undefined
}) {
  const liveQuiz = await database.liveQuiz.findUnique({
    where: { id: liveQuizId },
    select: {
      isAssessmentEnabled: true,
      pinCode: true,
      responseCollectionMode: true,
      status: true,
    },
  })

  if (!liveQuiz || liveQuiz.status !== PublicationStatus.PUBLISHED) {
    return 'not_found' as const
  }
  if (
    liveQuiz.isAssessmentEnabled ||
    liveQuiz.responseCollectionMode !==
      LiveQuizResponseCollectionMode.CORRELATED_EXPORT
  ) {
    return 'not_required' as const
  }
  if (
    !hasValidLiveQuizPin({
      cookieHeader,
      liveQuizId,
      pinCode: liveQuiz.pinCode,
    })
  ) {
    return 'pin_required' as const
  }
  return 'ready' as const
}

export async function prepareCorrelatedResponseSubmission({
  database,
  identity,
  liveQuizId,
  instanceId,
  blockExecution,
}: {
  database: Pick<
    PrismaClient,
    'temporaryLeaderboardEntry' | 'liveQuizRespondent' | 'participant'
  >
  identity: LiveQuizResponseIdentity
  liveQuizId: string
  instanceId: string
  blockExecution: string | undefined
}): Promise<
  | { status: 'invalid_identity' }
  | { status: 'invalid_metadata' }
  | {
      status: 'ready'
      acceptedIdentity: AcceptedCorrelatedResponseIdentity
      responseKey: string
    }
> {
  if (!blockExecution) {
    throw new Error(
      `Missing block execution in correlated response metadata for lq:${liveQuizId}:i:${instanceId}:info`
    )
  }

  const parsedInstanceId = Number(instanceId)
  const parsedBlockExecution = Number(blockExecution)
  if (
    !Number.isInteger(parsedInstanceId) ||
    !Number.isInteger(parsedBlockExecution)
  ) {
    return { status: 'invalid_metadata' }
  }

  if (identity.kind === 'participant') {
    const participant = await database.participant.findUnique({
      where: { id: identity.id },
      select: { id: true },
    })
    if (!participant) {
      return { status: 'invalid_identity' }
    }
  } else if (identity.kind === 'temporary') {
    const temporaryEntry = await database.temporaryLeaderboardEntry.findUnique({
      where: {
        id_quizId: {
          id: identity.id,
          quizId: liveQuizId,
        },
      },
      select: { id: true },
    })
    if (!temporaryEntry) {
      return { status: 'invalid_identity' }
    }

    const respondent = await database.liveQuizRespondent.upsert({
      where: { id: identity.id },
      update: {},
      create: {
        id: identity.id,
        type: LiveQuizRespondentType.TEMPORARY_PSEUDONYM,
        liveQuiz: { connect: { id: liveQuizId } },
      },
    })
    if (
      respondent.liveQuizId !== liveQuizId ||
      respondent.type !== LiveQuizRespondentType.TEMPORARY_PSEUDONYM
    ) {
      return { status: 'invalid_identity' }
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
      return { status: 'invalid_identity' }
    }
  }

  const identityKey = buildLiveQuizResponseIdentityKey(identity)
  return {
    status: 'ready',
    acceptedIdentity: {
      kind: identity.kind,
      id: identity.id,
    },
    responseKey: buildCorrelatedResponseKey({
      liveQuizId,
      instanceId,
      blockExecution,
      identityKey,
    }),
  }
}

export function serializeLiveQuizRespondentCookie({
  token,
  liveQuizId,
  secure,
}: {
  token: string
  liveQuizId: string
  secure: boolean
}) {
  const attributes = [
    `${getLiveQuizRespondentCookieName(liveQuizId)}=${token}`,
    `Max-Age=${LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS}`,
  ]
  attributes.push('Path=/', 'HttpOnly')
  if (secure) attributes.push('Secure')
  attributes.push('SameSite=Lax')

  return attributes.join('; ')
}

export function hasValidLiveQuizPin({
  cookieHeader,
  liveQuizId,
  pinCode,
}: {
  cookieHeader: string | undefined
  liveQuizId: string
  pinCode: string | null
}) {
  if (!pinCode) return true

  const cookies = parseCookiesHeader(cookieHeader)
  return cookies[`live-quiz-pin-${liveQuizId}`] === pinCode
}
