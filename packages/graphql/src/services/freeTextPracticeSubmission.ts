import * as DB from '@klicker-uzh/prisma/client'
import type {
  ElementOptionsFreeText,
  InstanceEvaluation,
  InstanceEvaluationFreeText,
} from '@klicker-uzh/types'
import { StackFeedbackStatus } from '@klicker-uzh/types'
import type { Context, ContextWithUser } from '@/lib/context.js'
import {
  assertConfiguredFreeTextAnswerLength,
  assertValidFreeTextAnswerInput,
  assertValidFreeTextAttemptInput,
  createFreeTextAttempt,
  createLocalExactFreeTextAttempt,
} from './freeTextEvaluationCommands.js'
import { freeTextEvaluationError } from './freeTextEvaluationPolicy.js'
import type {
  FreeTextAttemptState,
  FreeTextPracticeState,
} from './freeTextEvaluationState.js'
import { POINTS_PER_INSTANCE } from './questionResponseEvaluation.js'

export type SemanticStackResponse = {
  instanceId: number
  type: DB.ElementType
  freeTextResponse?: string | null
  clientSubmissionId?: string | null
  semanticEvaluationMode?: 'LOCAL_EXACT_ONLY'
}

export async function prepareSemanticStackResponses<
  T extends SemanticStackResponse,
>({
  ctx,
  stackId,
  responses,
  answerTime,
  skipTracking,
}: {
  ctx: Context
  stackId: number
  responses: T[]
  answerTime: number
  skipTracking?: boolean
}) {
  const indexes = responses.map((_, index) => index)
  const preparedResponses: T[] = responses.map((response) => ({ ...response }))
  const instances = await ctx.prisma.elementInstance.findMany({
    where: { id: { in: responses.map((response) => response.instanceId) } },
  })
  const instancesById = new Map(
    instances.map((instance) => [instance.id, instance])
  )
  for (const response of responses) {
    const instance = instancesById.get(response.instanceId)
    if (
      !instance ||
      instance.elementStackId !== stackId ||
      instance.elementType !== response.type
    ) {
      throw freeTextEvaluationError(
        'Stack response does not match the requested stack',
        'BAD_USER_INPUT'
      )
    }
  }

  if (
    !ctx.user?.sub ||
    ctx.user.role !== DB.UserRole.PARTICIPANT ||
    skipTracking ||
    responses.every((response) => response.type !== DB.ElementType.FREE_TEXT)
  ) {
    return { order: indexes, responses: preparedResponses }
  }

  const semanticInstanceIds = new Set(
    instances.flatMap((instance) =>
      instance.type === DB.ElementInstanceType.PRACTICE_QUIZ &&
      instance.elementData.type === DB.ElementType.FREE_TEXT &&
      instance.elementData.options.semanticEvaluation
        ? [instance.id]
        : []
    )
  )

  const semanticIndexes: number[] = []
  const remainingIndexes: number[] = []
  for (const index of indexes) {
    const response = responses[index]!
    if (!semanticInstanceIds.has(response.instanceId)) {
      remainingIndexes.push(index)
      continue
    }
    if (!response.freeTextResponse) {
      throw freeTextEvaluationError(
        'Semantic free-text responses require an answer',
        'BAD_USER_INPUT'
      )
    }
    const instance = instancesById.get(response.instanceId)!
    const maxLength = (instance.elementData.options as ElementOptionsFreeText)
      .restrictions?.maxLength
    assertValidFreeTextAnswerInput({
      answer: response.freeTextResponse,
      answerTime,
    })
    assertConfiguredFreeTextAnswerLength({
      answer: response.freeTextResponse,
      maxLength,
    })
    if (
      response.clientSubmissionId === null ||
      typeof response.clientSubmissionId === 'undefined'
    ) {
      preparedResponses[index] = {
        ...response,
        semanticEvaluationMode: 'LOCAL_EXACT_ONLY',
      }
    } else {
      assertValidFreeTextAttemptInput({
        answer: response.freeTextResponse,
        answerTime,
        clientSubmissionId: response.clientSubmissionId,
      })
    }
    semanticIndexes.push(index)
  }

  // Semantic submissions are idempotent. Applying them first prevents a later
  // semantic state error from leaving non-idempotent legacy responses behind.
  return {
    order: [...semanticIndexes, ...remainingIndexes],
    responses: preparedResponses,
  }
}

export type SemanticFreeTextInstanceEvaluation = InstanceEvaluationFreeText & {
  semanticState?: FreeTextPracticeState | null
}

function redactLegacySemanticState(state: FreeTextPracticeState) {
  const redactAttempt = (attempt: FreeTextAttemptState) => ({
    ...attempt,
    aggregateScore: null,
    outcomeBandId: null,
    outcomeBandLabel: null,
    evaluatorVersion: null,
    modelVersion: null,
    structuredResult: null,
  })

  return {
    ...state,
    solutionAuthorized: false,
    referenceSolution: null,
    explanation: null,
    attempts: state.attempts.map(redactAttempt),
    currentAttempt: state.currentAttempt
      ? redactAttempt(state.currentAttempt)
      : null,
    peerAnswers: [],
  }
}

/** Maps semantic practice state back to the longstanding stack response API. */
export async function submitSemanticFreeTextPracticeResponse({
  ctx,
  response,
  answerTime,
  instance,
  localExactOnly = false,
}: {
  ctx: ContextWithUser
  response: SemanticStackResponse
  answerTime: number
  instance: DB.ElementInstance
  localExactOnly?: boolean
}): Promise<{
  grading: StackFeedbackStatus | null
  score: number | null
  evaluation: InstanceEvaluation | null
}> {
  if (!response.freeTextResponse) {
    throw freeTextEvaluationError(
      'Semantic free-text responses require an answer',
      'BAD_USER_INPUT'
    )
  }
  if (!localExactOnly && !response.clientSubmissionId) {
    throw freeTextEvaluationError(
      'Semantic free-text responses require a client submission ID',
      'BAD_USER_INPUT'
    )
  }
  const input = {
    instanceId: response.instanceId,
    answer: response.freeTextResponse,
    answerTime,
  }
  const semanticState = localExactOnly
    ? await createLocalExactFreeTextAttempt(input, ctx)
    : await createFreeTextAttempt(
        { ...input, clientSubmissionId: response.clientSubmissionId! },
        ctx
      )
  const exposedSemanticState = localExactOnly
    ? redactLegacySemanticState(semanticState)
    : semanticState
  const currentAttempt = semanticState.currentAttempt
  const grading =
    currentAttempt?.correctness === DB.FreeTextCorrectnessCategory.CORRECT
      ? StackFeedbackStatus.CORRECT
      : currentAttempt?.correctness === DB.FreeTextCorrectnessCategory.PARTIAL
        ? StackFeedbackStatus.PARTIAL
        : currentAttempt?.correctness ===
            DB.FreeTextCorrectnessCategory.INCORRECT
          ? StackFeedbackStatus.INCORRECT
          : null
  const score =
    typeof currentAttempt?.aggregateScore === 'number'
      ? (currentAttempt.aggregateScore / 100) *
        POINTS_PER_INSTANCE *
        (instance.options.pointsMultiplier ?? 1)
      : null

  const evaluation: SemanticFreeTextInstanceEvaluation = {
    instanceId: response.instanceId,
    elementType: DB.ElementType.FREE_TEXT,
    score: score ?? 0,
    pointsMultiplier: instance.options.pointsMultiplier ?? 1,
    explanation: exposedSemanticState.solutionAuthorized
      ? exposedSemanticState.explanation
      : null,
    feedbacks: [],
    answers: [],
    solutions: [],
    semanticState: exposedSemanticState,
  }

  return {
    grading,
    score,
    evaluation,
  }
}
