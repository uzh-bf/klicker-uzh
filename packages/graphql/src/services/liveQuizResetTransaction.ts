import * as DB from '@klicker-uzh/prisma/client'
import { getInitialInstanceResults } from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
import {
  formatLiveQuizActivityInfo,
  type LiveQuizActivityInfo,
  type LiveQuizActivityInfoPermission,
} from './liveQuizActivityInfo.js'

function resetActivityInfoInclude(userId: string) {
  return {
    course: {
      include: {
        permissions: {
          where: { userId },
          select: { permissionLevel: true },
        },
      },
    },
    permissions: {
      where: { userId },
      include: { directPermission: true },
    },
    blocks: {
      include: { _count: { select: { elements: true } } },
      orderBy: { order: 'asc' },
    },
    templateInfo: true,
    _count: { select: { permissions: true } },
  } as const
}

function resetError(code: string, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } })
}

export async function resetLiveQuizExecutionState({
  liveQuizId,
  userId,
  tx,
}: {
  liveQuizId: string
  userId: string
  tx: DB.Prisma.TransactionClient
}) {
  const quiz = await tx.liveQuiz.findUniqueOrThrow({
    where: { id: liveQuizId },
    include: {
      blocks: {
        include: {
          elements: true,
        },
      },
    },
  })

  for (const block of quiz.blocks) {
    await tx.elementBlock.update({
      where: { id: block.id },
      data: {
        status: DB.ElementBlockStatus.SCHEDULED,
        startedAt: null,
        closedAt: null,
        expiresAt: null,
        execution: { increment: 1 },
      },
    })
    for (const instance of block.elements) {
      const initialResults = getInitialInstanceResults(instance.elementData)
      await tx.elementInstance.update({
        where: { id: instance.id },
        data: {
          liveQuizResponses: { deleteMany: {} },
          results: initialResults,
          anonymousResults: initialResults,
        },
      })
    }
  }

  const transitioned = await tx.liveQuiz.updateMany({
    where: {
      id: liveQuizId,
      status: DB.PublicationStatus.ENDED,
      isDeleted: false,
      isAssessmentEnabled: false,
    },
    data: {
      status: DB.PublicationStatus.DRAFT,
      startedAt: null,
      finishedAt: null,
      availableFrom: null,
      scheduledPublicationTaskId: null,
      activeBlockId: null,
    },
  })
  if (transitioned.count !== 1) {
    throw resetError(
      'LIVE_QUIZ_RESET_STATE_CHANGED',
      'Live quiz state changed while it was being reset'
    )
  }

  const updatedQuiz = await tx.liveQuiz.update({
    where: { id: liveQuizId },
    data: {
      feedbacks: { deleteMany: {} },
      confusionFeedbacks: { deleteMany: {} },
      leaderboard: {
        deleteMany: { type: DB.LeaderboardType.SESSION },
      },
      temporaryLeaderboard: { deleteMany: {} },
    },
    include: resetActivityInfoInclude(userId),
  })
  if (updatedQuiz.permissions.length !== 1 && updatedQuiz.ownerId !== userId) {
    throw resetError(
      'LIVE_QUIZ_RESET_PERMISSION_MISSING',
      'Reset activity permission could not be formatted safely'
    )
  }
  return { ...updatedQuiz, resetUserId: userId }
}

export type ResetActivityInfoSource = Awaited<
  ReturnType<typeof resetLiveQuizExecutionState>
>

export function formatResetActivityInfo(activity: ResetActivityInfoSource) {
  const storedPermission = activity.permissions[0]
  const isImplicitOwner =
    storedPermission === undefined && activity.ownerId === activity.resetUserId
  if (!storedPermission && !isImplicitOwner) {
    throw resetError(
      'LIVE_QUIZ_RESET_PERMISSION_MISSING',
      'Reset activity permission could not be formatted safely'
    )
  }

  const permission: LiveQuizActivityInfoPermission = storedPermission ?? {
    permissionLevel: DB.PermissionLevel.OWNER,
    derived: false,
    directPermission: null,
  }
  const isAdministrator = (permissionLevel: DB.PermissionLevel): boolean =>
    permissionLevel === DB.PermissionLevel.OWNER ||
    permissionLevel === DB.PermissionLevel.ADMIN
  const isActivityReviewer =
    activity.courseId === null
      ? isAdministrator(permission.permissionLevel)
      : activity.course?.ownerId === activity.resetUserId ||
        (activity.course?.permissions.some((coursePermission) =>
          isAdministrator(coursePermission.permissionLevel)
        ) ??
          false)
  return formatLiveQuizActivityInfo({
    activity,
    permission,
    isActivityReviewer,
    implicitOwner: isImplicitOwner,
  })
}

export type ResetLiveQuizServiceResult =
  | { outcome: 'SUCCESS'; activity: LiveQuizActivityInfo }
  | { outcome: 'INVALID_STATE'; activity: null }

async function loadResettableRegularQuiz({
  id,
  userId,
  tx,
}: {
  id: string
  userId: string
  tx: DB.Prisma.TransactionClient
}) {
  const quiz = await tx.liveQuiz.findUnique({
    where: { id },
    include: {
      permissions: {
        where: { userId },
        select: { permissionLevel: true },
      },
    },
  })
  if (!quiz) return null

  const isAdministrator = quiz.permissions.some(
    (permission) =>
      permission.permissionLevel === DB.PermissionLevel.ADMIN ||
      permission.permissionLevel === DB.PermissionLevel.OWNER
  )
  if (quiz.ownerId !== userId && !isAdministrator) {
    throw resetError('FORBIDDEN', 'LIVE_QUIZ_RESET_FORBIDDEN')
  }
  return quiz
}

export async function executeLiveQuizReset(
  { id }: { id: string },
  ctx: ContextWithUser
): Promise<ResetLiveQuizServiceResult> {
  return ctx.prisma.$transaction(
    async (tx) => {
      const lockedRows = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "LiveQuiz"
        WHERE "id" = ${id}::uuid
        FOR UPDATE
      `
      if (lockedRows.length === 0) {
        return { outcome: 'INVALID_STATE', activity: null }
      }

      const quiz = await loadResettableRegularQuiz({
        id,
        userId: ctx.user.sub,
        tx,
      })
      if (
        !quiz ||
        quiz.isDeleted ||
        quiz.isAssessmentEnabled ||
        quiz.status !== DB.PublicationStatus.ENDED
      ) {
        return { outcome: 'INVALID_STATE', activity: null }
      }

      const activity = await resetLiveQuizExecutionState({
        liveQuizId: id,
        userId: ctx.user.sub,
        tx,
      })
      return {
        outcome: 'SUCCESS',
        activity: formatResetActivityInfo(activity),
      }
    },
    { timeout: 60_000 }
  )
}
