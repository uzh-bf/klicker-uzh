import {
  ElementBlockStatus,
  LiveQuizRespondentType,
  LiveQuizResponseCollectionMode,
  PublicationStatus,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  buildCorrelatedResponseKey,
  buildLiveQuizResponseIdentityKey,
  encryptCorrelatedResponseEvent,
  getLiveQuizRespondentCookieName,
  hashLiveQuizRespondentToken,
  LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS,
  parseCookiesHeader,
  type CorrelatedResponseEventMessage,
  type CorrelatedResponseInstanceInfo,
  type LiveQuizResponseIdentity,
} from '@klicker-uzh/util'

const CORRELATED_OUTBOX_RETRY_MS = 30_000

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

export async function admitCorrelatedResponse({
  database,
  identity,
  liveQuizId,
  instanceId,
  messageId,
  response,
  responseTimestamp,
  instanceInfo,
  cookieHeader,
  secret,
  nextDeliveryAt = new Date(Date.now() + CORRELATED_OUTBOX_RETRY_MS),
}: {
  database: Pick<PrismaClient, '$transaction'>
  identity: LiveQuizResponseIdentity
  liveQuizId: string
  instanceId: string
  messageId: string
  response: CorrelatedResponseEventMessage['response']
  responseTimestamp: number
  instanceInfo: CorrelatedResponseInstanceInfo
  cookieHeader: string | undefined
  secret: string
  nextDeliveryAt?: Date
}) {
  const blockExecution = instanceInfo.blockExecution
  const parsedInstanceId = Number(instanceId)
  const parsedBlockExecution = Number(blockExecution)
  const parsedSessionBlockId = Number(instanceInfo.sessionBlockId)
  if (
    !instanceId.trim() ||
    !blockExecution.trim() ||
    !instanceInfo.sessionBlockId.trim() ||
    !Number.isInteger(parsedInstanceId) ||
    !Number.isInteger(parsedBlockExecution) ||
    !Number.isInteger(parsedSessionBlockId)
  ) {
    return { status: 'invalid_metadata' }
  }

  try {
    return await database.$transaction(async (prisma) => {
      const [admission] = await prisma.$queryRaw<
        {
          activeBlockId: number | null
          blockExecution: number
          blockId: number
          blockStatus: ElementBlockStatus
          isAssessmentEnabled: boolean
          pinCode: string | null
          responseCollectionMode: LiveQuizResponseCollectionMode
          status: PublicationStatus
        }[]
      >`
        SELECT
          quiz."activeBlockId",
          block."execution" AS "blockExecution",
          block."id" AS "blockId",
          block."status"::text AS "blockStatus",
          quiz."isAssessmentEnabled",
          quiz."pinCode",
          quiz."responseCollectionMode"::text AS "responseCollectionMode",
          quiz."status"::text AS "status"
        FROM "public"."LiveQuiz" AS quiz
        JOIN "public"."ElementBlock" AS block
          ON block."liveQuizId" = quiz."id"
        JOIN "public"."ElementInstance" AS instance
          ON instance."elementBlockId" = block."id"
        WHERE
          quiz."id" = ${liveQuizId}::uuid AND
          quiz."isDeleted" = false AND
          instance."id" = ${parsedInstanceId}
        FOR SHARE OF quiz, block
      `

      if (
        !admission ||
        admission.status !== PublicationStatus.PUBLISHED ||
        admission.isAssessmentEnabled ||
        admission.responseCollectionMode !==
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT ||
        admission.activeBlockId !== admission.blockId ||
        admission.blockStatus !== ElementBlockStatus.ACTIVE ||
        admission.blockId !== parsedSessionBlockId ||
        admission.blockExecution !== parsedBlockExecution
      ) {
        return { status: 'not_found' as const }
      }
      if (
        !hasValidLiveQuizPin({
          cookieHeader,
          liveQuizId,
          pinCode: admission.pinCode,
        })
      ) {
        return { status: 'pin_required' as const }
      }

      if (identity.kind === 'participant') {
        const participant = await prisma.participant.findUnique({
          where: { id: identity.id },
          select: { id: true },
        })
        if (!participant) {
          return { status: 'invalid_identity' as const }
        }
      } else if (identity.kind === 'temporary') {
        const temporaryEntry =
          await prisma.temporaryLeaderboardEntry.findUnique({
            where: {
              id_quizId: {
                id: identity.id,
                quizId: liveQuizId,
              },
            },
            select: { id: true },
          })
        if (!temporaryEntry) {
          return { status: 'invalid_identity' as const }
        }

        const respondent = await prisma.liveQuizRespondent.upsert({
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
          return { status: 'invalid_identity' as const }
        }
      } else {
        const verificationSecretHash = hashLiveQuizRespondentToken(
          identity.token
        )
        const respondent = await prisma.liveQuizRespondent.upsert({
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
          return { status: 'invalid_identity' as const }
        }
      }

      const acceptedIdentity = {
        kind: identity.kind,
        id: identity.id,
      }
      const responseKey = buildCorrelatedResponseKey({
        liveQuizId,
        instanceId,
        blockExecution,
        identityKey: buildLiveQuizResponseIdentityKey(identity),
      })
      const eventMessage: CorrelatedResponseEventMessage = {
        messageId,
        sessionId: liveQuizId,
        instanceId,
        response,
        responseTimestamp,
        acceptedIdentity,
        instanceInfo,
      }
      await prisma.liveQuizPendingResponse.create({
        data: {
          id: messageId,
          liveQuizId,
          responseKey,
          eventPayload: encryptCorrelatedResponseEvent({
            message: eventMessage,
            secret,
          }),
          nextDeliveryAt,
        },
      })
      return { status: 'registered' as const }
    })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return { status: 'duplicate' as const }
    }
    throw error
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
