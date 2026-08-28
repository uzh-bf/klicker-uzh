import { createHash } from 'node:crypto'
import { validateSemanticFreeTextConfig } from '@klicker-uzh/grading'
import * as DB from '@klicker-uzh/prisma/client'
import type { SemanticFreeTextConfig } from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '@/lib/context.js'

const DEFAULT_DISCLOSURE_VERSION = '2026-08-18'

export type FreeTextEvaluationServiceOptions = {
  disclosureVersion?: string
}

export type SemanticFreeTextCapabilityData = {
  entitled: boolean
  availability: 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE'
  reason: string | null
  retryable: boolean
  disclosureVersion: string
  provider: string
}

export type SemanticInstanceAccess = {
  instance: DB.ElementInstance
  practiceQuiz: DB.PracticeQuiz & { owner: DB.User }
  participation: DB.Participation
  config: SemanticFreeTextConfig
}

type FreeTextEvaluationErrorCode =
  | 'BAD_USER_INPUT'
  | 'FORBIDDEN'
  | 'FREE_TEXT_ATTEMPT_LIMIT_REACHED'
  | 'FREE_TEXT_EVALUATION_INVALID_STATE'
  | 'FREE_TEXT_EVALUATION_NOT_CONFIGURED'
  | 'FREE_TEXT_EVALUATION_NOT_RETRYABLE'
  | 'FREE_TEXT_SOLUTION_NOT_REVEALABLE'
  | 'NOT_FOUND'
  | 'SEMANTIC_DISCLOSURE_STALE'
  | 'CONSENT_DECLINED'
  | 'CONSENT_REQUIRED'
  | 'EVALUATOR_UNAVAILABLE'
  | 'LECTURER_ENTITLEMENT_UNAVAILABLE'

export function freeTextEvaluationError(
  message: string,
  code: FreeTextEvaluationErrorCode
) {
  return new GraphQLError(message, { extensions: { code } })
}

export function assertParticipant(ctx: ContextWithUser) {
  if (ctx.user.role !== DB.UserRole.PARTICIPANT) {
    throw freeTextEvaluationError(
      'Participant authentication is required',
      'FORBIDDEN'
    )
  }
}

export function getDisclosureVersion(
  options?: FreeTextEvaluationServiceOptions
) {
  return (
    options?.disclosureVersion ||
    process.env.SEMANTIC_EVALUATION_DISCLOSURE_VERSION ||
    DEFAULT_DISCLOSURE_VERSION
  )
}

export function getSemanticEvaluationDisclosureVersion() {
  return getDisclosureVersion()
}

export function getSemanticFreeTextCapability(
  ctx: ContextWithUser
): SemanticFreeTextCapabilityData {
  const entitled = ctx.user.catalystInstitutional || ctx.user.catalystIndividual
  const available = !!process.env.CATALYST_FORMATIVE_EVALUATOR_URL
  return {
    entitled,
    availability: available ? 'AVAILABLE' : 'UNAVAILABLE',
    reason: available ? null : 'EVALUATOR_NOT_CONFIGURED',
    retryable: !available,
    disclosureVersion: getSemanticEvaluationDisclosureVersion(),
    provider: 'CATALYST',
  }
}

export function parseSemanticConfig(instance: DB.ElementInstance) {
  if (instance.elementData.type !== DB.ElementType.FREE_TEXT) {
    throw freeTextEvaluationError(
      'Semantic evaluation is only available for free text',
      'FREE_TEXT_EVALUATION_NOT_CONFIGURED'
    )
  }

  const config = instance.elementData.options.semanticEvaluation
  if (!config || validateSemanticFreeTextConfig(config).length > 0) {
    throw freeTextEvaluationError(
      'Semantic free-text evaluation is not configured',
      'FREE_TEXT_EVALUATION_NOT_CONFIGURED'
    )
  }

  return config as SemanticFreeTextConfig
}

export function getSemanticFreeTextConfig(instance: DB.ElementInstance) {
  return parseSemanticConfig(instance)
}

export function getSemanticFreeTextConfigHash(config: SemanticFreeTextConfig) {
  return createHash('sha256').update(JSON.stringify(config)).digest('hex')
}

export async function getSemanticInstance(
  instanceId: number,
  ctx: ContextWithUser
): Promise<SemanticInstanceAccess> {
  assertParticipant(ctx)
  const instance = await ctx.prisma.elementInstance.findUnique({
    where: { id: instanceId },
    include: {
      elementStack: {
        include: {
          practiceQuiz: { include: { owner: true } },
        },
      },
    },
  })
  const practiceQuiz = instance?.elementStack?.practiceQuiz
  if (
    !instance ||
    instance.type !== DB.ElementInstanceType.PRACTICE_QUIZ ||
    !practiceQuiz ||
    practiceQuiz.status !== DB.PublicationStatus.PUBLISHED
  ) {
    throw freeTextEvaluationError(
      'Published practice quiz instance not found',
      'NOT_FOUND'
    )
  }

  const participation = await ctx.prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId: practiceQuiz.courseId,
        participantId: ctx.user.sub,
      },
    },
  })
  if (!participation) {
    throw freeTextEvaluationError(
      'Participant does not have access to this course',
      'FORBIDDEN'
    )
  }

  return {
    instance,
    practiceQuiz,
    participation,
    config: parseSemanticConfig(instance),
  }
}

export function ownerHasCatalyst(
  practiceQuiz: DB.PracticeQuiz & { owner: DB.User }
) {
  return (
    practiceQuiz.owner.catalystInstitutional ||
    practiceQuiz.owner.catalystIndividual
  )
}

export async function getConsentDecision(
  participantId: string,
  disclosureVersion: string,
  ctx: ContextWithUser
) {
  return await ctx.prisma.freeTextConsentEvent.findFirst({
    where: { participantId, disclosureVersion },
    orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }],
  })
}

export function evaluationAvailabilityReason({
  ownerEntitled,
  consent,
}: {
  ownerEntitled: boolean
  consent: DB.SemanticEvaluationConsentDecision | null
}) {
  if (!ownerEntitled) return 'LECTURER_ENTITLEMENT_UNAVAILABLE'
  if (!process.env.CATALYST_FORMATIVE_EVALUATOR_URL) {
    return 'EVALUATOR_UNAVAILABLE'
  }
  if (consent === DB.SemanticEvaluationConsentDecision.DECLINED) {
    return 'CONSENT_DECLINED'
  }
  if (consent !== DB.SemanticEvaluationConsentDecision.ACCEPTED) {
    return 'CONSENT_REQUIRED'
  }
  return null
}

export function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  )
}
