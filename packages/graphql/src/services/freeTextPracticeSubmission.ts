import * as DB from '@klicker-uzh/prisma/client'
import type {
  InstanceEvaluation,
  InstanceEvaluationFreeText,
} from '@klicker-uzh/types'
import { StackFeedbackStatus } from '@klicker-uzh/types'
import type { ContextWithUser } from '@/lib/context.js'
import { createFreeTextAttempt } from './freeTextEvaluationCommands.js'
import { POINTS_PER_INSTANCE } from './questionResponseEvaluation.js'

type SemanticResponse = {
  instanceId: number
  type: DB.ElementType
  freeTextResponse?: string | null
  clientSubmissionId?: string | null
}

/** Maps semantic practice state back to the longstanding stack response API. */
export async function submitSemanticFreeTextPracticeResponse({
  ctx,
  response,
  answerTime,
  instance,
}: {
  ctx: ContextWithUser
  response: SemanticResponse
  answerTime: number
  instance: DB.ElementInstance
}): Promise<{
  grading: StackFeedbackStatus | null
  score: number | null
  evaluation: InstanceEvaluation | null
}> {
  if (!response.freeTextResponse || !response.clientSubmissionId) {
    throw new Error(
      'Semantic free-text responses require an answer and client submission ID'
    )
  }
  const semanticState = await createFreeTextAttempt(
    {
      instanceId: response.instanceId,
      answer: response.freeTextResponse,
      answerTime,
      clientSubmissionId: response.clientSubmissionId,
    },
    ctx
  )
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

  return {
    grading,
    score,
    evaluation: {
      instanceId: response.instanceId,
      elementType: DB.ElementType.FREE_TEXT,
      score: score ?? 0,
      pointsMultiplier: instance.options.pointsMultiplier ?? 1,
      explanation: semanticState.solutionAuthorized
        ? semanticState.explanation
        : null,
      feedbacks: [],
      answers: [],
      solutions: [],
      semanticState,
    } as InstanceEvaluationFreeText,
  }
}
