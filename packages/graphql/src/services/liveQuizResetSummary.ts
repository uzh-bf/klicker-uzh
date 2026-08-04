import * as DB from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../lib/context.js'

export type LiveQuizResetOutcome = 'SUCCESS' | 'INVALID_STATE'

export type LiveQuizResetEligibilityReason =
  | 'ELIGIBLE'
  | 'INVALID_STATE'
  | 'ASSESSMENT_POLICY'

export interface LiveQuizResetSummary {
  numOfResponses: number
  numOfFeedbacks: number
  numOfConfusionFeedbacks: number
  numOfLeaderboardEntries: number
  eligible: boolean
  reason: LiveQuizResetEligibilityReason
}

export async function getLiveQuizResetSummary(
  { quizId }: { quizId: string },
  ctx: ContextWithUser
): Promise<LiveQuizResetSummary | null> {
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id: quizId },
    include: {
      permissions: {
        where: { userId: ctx.user.sub },
        select: { permissionLevel: true },
      },
      course: {
        select: {
          ownerId: true,
          permissions: {
            where: { userId: ctx.user.sub },
            select: { permissionLevel: true },
          },
        },
      },
      blocks: {
        select: {
          elements: {
            select: {
              results: true,
              anonymousResults: true,
              _count: { select: { liveQuizResponses: true } },
            },
          },
        },
      },
      _count: {
        select: {
          feedbacks: true,
          confusionFeedbacks: true,
          leaderboard: {
            where: { type: DB.LeaderboardType.SESSION },
          },
          temporaryLeaderboard: true,
        },
      },
    },
  })

  if (!liveQuiz) return null

  const isAdministrator = (
    permissions: Array<{ permissionLevel: DB.PermissionLevel }>
  ) =>
    permissions.some(
      (permission) =>
        permission.permissionLevel === DB.PermissionLevel.ADMIN ||
        permission.permissionLevel === DB.PermissionLevel.OWNER
    )
  const canReset = liveQuiz.isAssessmentEnabled
    ? liveQuiz.course !== null &&
      (liveQuiz.course.ownerId === ctx.user.sub ||
        isAdministrator(liveQuiz.course.permissions))
    : liveQuiz.ownerId === ctx.user.sub || isAdministrator(liveQuiz.permissions)

  if (!canReset) return null

  const numOfResponses = liveQuiz.blocks.reduce(
    (quizTotal, block) =>
      quizTotal +
      block.elements.reduce(
        (blockTotal, instance) =>
          blockTotal +
          Math.max(
            instance._count.liveQuizResponses,
            instance.results.total + instance.anonymousResults.total
          ),
        0
      ),
    0
  )
  const quizCounts = {
    numOfResponses,
    numOfFeedbacks: liveQuiz._count.feedbacks,
    numOfConfusionFeedbacks: liveQuiz._count.confusionFeedbacks,
    numOfLeaderboardEntries:
      liveQuiz._count.leaderboard + liveQuiz._count.temporaryLeaderboard,
  }

  if (liveQuiz.status !== DB.PublicationStatus.ENDED || liveQuiz.isDeleted) {
    return {
      ...quizCounts,
      eligible: false,
      reason: 'INVALID_STATE',
    }
  }

  if (liveQuiz.isAssessmentEnabled) {
    return {
      ...quizCounts,
      eligible: false,
      reason: 'ASSESSMENT_POLICY',
    }
  }

  return {
    ...quizCounts,
    eligible: true,
    reason: 'ELIGIBLE',
  }
}
