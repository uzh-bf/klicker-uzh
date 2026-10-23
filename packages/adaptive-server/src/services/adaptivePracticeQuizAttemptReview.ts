import type { ContextWithUser } from '@klicker-uzh/graphql/adaptive-context-types'
import * as DB from '@klicker-uzh/prisma/client'
import {
  type AdaptiveDiagnosticReview,
  adaptivePseudonymCode,
} from './adaptivePracticeQuizAttemptDiagnosticsModel.js'
import { adaptivePracticeQuizError } from './adaptivePracticeQuizErrors.js'
import { getEffectivelyEnabledRuntimeNodes } from './adaptivePracticeQuizEstimatePersistence.js'
import { loadAdaptiveRuntime } from './adaptivePracticeQuizRuntimeData.js'
import { isAdaptiveTestingInfoEnabled } from './adaptivePracticeQuizTestingInfo.js'

export const ADAPTIVE_ATTEMPT_REVIEW_COMMENT_LIMIT = 2000

export type SaveAdaptiveAttemptReviewInput = {
  practiceQuizId: string
  attemptCode: string
  verdict: string
  expectedOverallLevelLabel?: string | null
  expectedCompetenceLevels?: Array<{
    nodeId: number
    levelLabel: string
  }> | null
  comment?: string | null
}

function reviewError(message: string) {
  return adaptivePracticeQuizError(message, 'ADAPTIVE_ATTEMPT_REVIEW_INVALID')
}

/**
 * Saves the requesting lecturer's review of one attempt (testing
 * environments only; the GraphQL field checks ADMIN permission on the quiz).
 * Levels must be labels of the published scale and competences enabled root
 * nodes of the publication; one review per attempt and lecturer is upserted.
 */
export async function saveAdaptivePracticeQuizAttemptReview(
  input: SaveAdaptiveAttemptReviewInput,
  ctx: ContextWithUser,
  showSolutions: string | undefined = process.env.ADAPTIVE_QUIZ_SHOW_SOLUTIONS
): Promise<AdaptiveDiagnosticReview> {
  if (!isAdaptiveTestingInfoEnabled(showSolutions)) {
    throw adaptivePracticeQuizError(
      'Attempt reviews are only available in testing environments.',
      'ADAPTIVE_DIAGNOSTICS_DISABLED'
    )
  }
  if (
    !Object.values(DB.AdaptiveAttemptReviewVerdict).includes(
      input.verdict as DB.AdaptiveAttemptReviewVerdict
    )
  ) {
    throw reviewError('The review verdict is not supported.')
  }
  const comment = input.comment?.trim() || null
  if (comment && comment.length > ADAPTIVE_ATTEMPT_REVIEW_COMMENT_LIMIT) {
    throw reviewError('The review comment is too long.')
  }

  const runtime = await loadAdaptiveRuntime(ctx.prisma, input.practiceQuizId, {
    includeAlgorithmData: true,
  })
  const levelLabels = new Set(
    runtime.algorithm.levels.map(({ label }) => label)
  )
  const rootIds = new Set(
    getEffectivelyEnabledRuntimeNodes(runtime.algorithm.nodes)
      .filter(({ parentId }) => parentId === null)
      .map(({ id }) => id)
  )
  const expectedOverallLevelLabel = input.expectedOverallLevelLabel || null
  if (
    expectedOverallLevelLabel &&
    !levelLabels.has(expectedOverallLevelLabel)
  ) {
    throw reviewError('The expected overall level is not on the quiz scale.')
  }
  const expectedCompetenceLevels = [
    ...new Map(
      (input.expectedCompetenceLevels ?? []).map((entry) => [
        entry.nodeId,
        entry,
      ])
    ).values(),
  ]
  for (const { nodeId, levelLabel } of expectedCompetenceLevels) {
    if (!rootIds.has(nodeId) || !levelLabels.has(levelLabel)) {
      throw reviewError('An expected competence level is not valid.')
    }
  }

  const attempts = await ctx.prisma.adaptivePracticeQuizAttempt.findMany({
    where: {
      practiceQuizId: input.practiceQuizId,
      publicationId: runtime.publication.id,
      status: DB.AdaptivePracticeQuizAttemptStatus.COMPLETED,
    },
    select: { id: true },
  })
  const attempt = attempts.find(
    ({ id }) => adaptivePseudonymCode('attempt', id) === input.attemptCode
  )
  if (!attempt) {
    throw adaptivePracticeQuizError(
      'The adaptive attempt was not found in this practice quiz.',
      'ADAPTIVE_ATTEMPT_NOT_FOUND'
    )
  }

  const data = {
    verdict: input.verdict as DB.AdaptiveAttemptReviewVerdict,
    expectedOverallLevelLabel,
    expectedCompetenceLevels,
    comment,
  }
  const review = await ctx.prisma.adaptivePracticeQuizAttemptReview.upsert({
    where: {
      attemptId_reviewerId: { attemptId: attempt.id, reviewerId: ctx.user.sub },
    },
    create: { ...data, attemptId: attempt.id, reviewerId: ctx.user.sub },
    update: data,
    select: {
      verdict: true,
      expectedOverallLevelLabel: true,
      expectedCompetenceLevels: true,
      comment: true,
      updatedAt: true,
    },
  })
  return review
}
