import { randomUUID } from 'node:crypto'
import {
  ElementBlockStatus,
  LiveQuizResponseCollectionMode,
  type PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import {
  buildCorrelatedResponseKey,
  type CorrelatedResponseEventMessage,
  type CorrelatedResponseInstanceInfo,
  encryptCorrelatedResponseEvent,
  getLiveQuizRespondentCookieName,
  hashLiveQuizRespondentToken,
  LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS,
  type LiveQuizResponseIdentity,
  parseCookiesHeader,
} from '@klicker-uzh/util'

const CORRELATED_OUTBOX_RETRY_MS = 30_000

const CORRELATED_ADMISSION_MAX_ATTEMPTS = 3

type AdmitCorrelatedResponseInput = {
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
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  )
}

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
      publicationGeneration: true,
    },
  })

  if (!liveQuiz || liveQuiz.status !== PublicationStatus.PUBLISHED) {
    return { status: 'not_found' as const }
  }
  if (
    liveQuiz.isAssessmentEnabled ||
    liveQuiz.responseCollectionMode !==
      LiveQuizResponseCollectionMode.CORRELATED_EXPORT
  ) {
    return { status: 'not_required' as const }
  }
  if (
    !hasValidLiveQuizPin({
      cookieHeader,
      liveQuizId,
      pinCode: liveQuiz.pinCode,
    })
  ) {
    return { status: 'pin_required' as const }
  }
  return {
    status: 'ready' as const,
    publicationGeneration: liveQuiz.publicationGeneration,
  }
}

async function admitCorrelatedResponseAttempt({
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
}: AdmitCorrelatedResponseInput) {
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

  return database.$transaction(async (prisma) => {
    const [admission] = await prisma.$queryRaw<
      {
        activeBlockId: number | null
        blockExecution: number
        blockId: number
        blockStatus: ElementBlockStatus
        isAssessmentEnabled: boolean
        pinCode: string | null
        responseCollectionMode: LiveQuizResponseCollectionMode
        publicationGeneration: number
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
          quiz."publicationGeneration",
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

    if (identity.kind === 'temporary') {
      return { status: 'invalid_identity' as const }
    }
    if (
      identity.kind === 'anonymous' &&
      identity.publicationGeneration !== admission.publicationGeneration
    ) {
      return { status: 'invalid_identity' as const }
    }

    if (identity.kind === 'participant') {
      const participant = await prisma.participant.findUnique({
        where: { id: identity.id },
        select: { id: true },
      })
      if (!participant) {
        return { status: 'invalid_identity' as const }
      }
    }

    const expiresAt = new Date(
      Date.now() + LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS * 1000
    )
    const verificationSecretHash =
      identity.kind === 'anonymous'
        ? hashLiveQuizRespondentToken(identity.token)
        : null
    const bindingSelect = {
      respondentId: true,
      liveQuizId: true,
      publicationGeneration: true,
      participantId: true,
      verificationSecretHash: true,
      expiresAt: true,
    } as const
    const existingBinding =
      identity.kind === 'participant'
        ? await prisma.liveQuizRespondentBinding.findUnique({
            where: {
              liveQuizId_publicationGeneration_participantId: {
                liveQuizId,
                publicationGeneration: admission.publicationGeneration,
                participantId: identity.id,
              },
            },
            select: bindingSelect,
          })
        : await prisma.liveQuizRespondentBinding.findUnique({
            where: {
              liveQuizId_publicationGeneration_verificationSecretHash: {
                liveQuizId,
                publicationGeneration: admission.publicationGeneration,
                verificationSecretHash: hashLiveQuizRespondentToken(
                  identity.token
                ),
              },
            },
            select: bindingSelect,
          })
    const existingRespondent = existingBinding
      ? await prisma.liveQuizRespondent.findUnique({
          where: { id: existingBinding.respondentId },
          select: {
            finalizedAt: true,
            liveQuizId: true,
            publicationGeneration: true,
          },
        })
      : null

    if (
      existingBinding &&
      (!existingRespondent ||
        existingRespondent.liveQuizId !== liveQuizId ||
        existingRespondent.publicationGeneration !==
          admission.publicationGeneration ||
        existingRespondent.finalizedAt !== null)
    ) {
      return { status: 'invalid_identity' as const }
    }

    const binding = existingBinding
      ? await prisma.liveQuizRespondentBinding.update({
          where: { respondentId: existingBinding.respondentId },
          data: { expiresAt },
          select: bindingSelect,
        })
      : await (async () => {
          const respondentId =
            identity.kind === 'anonymous' ? identity.id : randomUUID()
          await prisma.liveQuizRespondent.create({
            data: {
              id: respondentId,
              liveQuizId,
              publicationGeneration: admission.publicationGeneration,
            },
          })
          return prisma.liveQuizRespondentBinding.create({
            data: {
              respondentId,
              liveQuizId,
              publicationGeneration: admission.publicationGeneration,
              participantId:
                identity.kind === 'participant' ? identity.id : null,
              verificationSecretHash,
              expiresAt,
            },
            select: bindingSelect,
          })
        })()

    const respondent =
      existingRespondent ??
      (await prisma.liveQuizRespondent.findUnique({
        where: { id: binding.respondentId },
        select: {
          finalizedAt: true,
          liveQuizId: true,
          publicationGeneration: true,
        },
      }))

    if (
      binding.liveQuizId !== liveQuizId ||
      binding.publicationGeneration !== admission.publicationGeneration ||
      !respondent ||
      respondent.liveQuizId !== liveQuizId ||
      respondent.publicationGeneration !== admission.publicationGeneration ||
      respondent.finalizedAt !== null ||
      (identity.kind === 'participant' &&
        binding.participantId !== identity.id) ||
      (identity.kind === 'anonymous' &&
        (binding.respondentId !== identity.id ||
          binding.verificationSecretHash !==
            hashLiveQuizRespondentToken(identity.token)))
    ) {
      return { status: 'invalid_identity' as const }
    }

    const acceptedIdentity = {
      kind: 'anonymous' as const,
      id: binding.respondentId,
    }
    const responseKey = buildCorrelatedResponseKey({
      liveQuizId,
      publicationGeneration: admission.publicationGeneration,
      instanceId,
      blockExecution,
      identityKey: `respondent:${binding.respondentId}`,
    })
    // A receipt for this exact response key means the submission was
    // already admitted. Identity-creation races surface as unique
    // constraint errors instead and are retried by the public wrapper.
    const existingReceipt = await prisma.liveQuizPendingResponse.findUnique({
      where: { responseKey },
      select: { id: true },
    })
    if (existingReceipt) {
      return { status: 'duplicate' as const }
    }
    const eventMessage: CorrelatedResponseEventMessage = {
      messageId,
      sessionId: liveQuizId,
      instanceId,
      publicationGeneration: admission.publicationGeneration,
      response,
      responseTimestamp,
      acceptedIdentity,
      instanceInfo,
    }
    await prisma.liveQuizPendingResponse.create({
      data: {
        id: messageId,
        liveQuizId,
        publicationGeneration: admission.publicationGeneration,
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
}

export async function admitCorrelatedResponse(
  input: AdmitCorrelatedResponseInput
) {
  // Two concurrent first submissions by one identity can collide on the
  // respondent or binding uniqueness constraints before either receipt
  // exists. Retrying resolves the winning generation-scoped binding, while
  // a receipt-key collision resolves as a duplicate on the next attempt.
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await admitCorrelatedResponseAttempt(input)
    } catch (error) {
      if (
        attempt >= CORRELATED_ADMISSION_MAX_ATTEMPTS ||
        !isUniqueConstraintViolation(error)
      ) {
        throw error
      }
    }
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
