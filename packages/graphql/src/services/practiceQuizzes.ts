import * as DB from '@klicker-uzh/prisma/client'
import { HatchetHandlers } from '@klicker-uzh/types'
import {
  propagateActivityToElements,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import type { Context, ContextWithUser } from '../lib/context.js'
import { orderStacks } from '../lib/util.js'
import { lockAdaptiveLearningCourseEnabled } from './adaptiveLearningRollout.js'
import {
  assertAdaptivePublishedPool,
  clearAdaptivePublishedPool,
  materializeAdaptivePracticeQuizPool,
} from './adaptivePracticeQuizPublication.js'
import { purgeAttemptFreeAdaptivePublications } from './adaptivePracticeQuizPublicationCleanup.js'
import {
  lockAdaptiveCourseForShare,
  lockAdaptivePracticeQuizConfigForUpdate,
  lockPracticeQuizAdminPermissionForShare,
  lockPracticeQuizForUpdate,
  lockPracticeQuizForUpdateInCourse,
  lockPracticeQuizPermissionsForShare,
  type LockedPracticeQuiz,
} from './adaptivePracticeQuizRepository.js'
import { withAdaptiveOperationalTransaction } from './adaptiveTransactions.js'
import { sendTeamsNotification } from './notifications.js'
import { computeStackEvaluation } from './stacks.js'

export { manipulatePracticeQuiz } from './practiceQuizManipulation.js'

export async function getPracticeQuizData(
  { id }: { id: string },
  ctx: Context
) {
  const quiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      OR: [
        { status: DB.PublicationStatus.PUBLISHED, isDeleted: false },
        { status: DB.PublicationStatus.SCHEDULED },
        // if user has access to the microlearning, the query should be enabled for loading the preview
        ...(ctx.user?.sub
          ? [{ permissions: { some: { userId: ctx.user.sub } } }]
          : []),
      ],
    },
    include: {
      course: true,
      adaptiveConfig: {
        select: { totalQuestionCap: true },
      },
      stacks: {
        include: {
          elements: {
            include:
              ctx.user?.sub && ctx.user.role === DB.UserRole.PARTICIPANT
                ? { responses: { where: { participantId: ctx.user.sub } } }
                : undefined,
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!quiz) return null
  if (quiz.mode === DB.PracticeQuizMode.ADAPTIVE && !ctx.user) {
    return null
  }
  if (
    quiz.mode === DB.PracticeQuizMode.ADAPTIVE &&
    ctx.user?.role === DB.UserRole.PARTICIPANT
  ) {
    if (!quiz.course.isAdaptiveLearningEnabled) return null

    const participation = await ctx.prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId: quiz.courseId,
          participantId: ctx.user.sub,
        },
      },
      select: { id: true },
    })
    if (!participation) return null
  }
  const isOwner =
    ctx.user?.sub &&
    (ctx.user.role === DB.UserRole.USER || ctx.user.role === DB.UserRole.ADMIN)
      ? ctx.user.sub === quiz.ownerId
      : false
  const isLecturer =
    ctx.user?.role === DB.UserRole.USER || ctx.user?.role === DB.UserRole.ADMIN
  const sharedPreview =
    isLecturer && !isOwner
      ? await ctx.prisma.practiceQuiz.findFirst({
          where: {
            id,
            permissions: { some: { userId: ctx.user!.sub } },
          },
          select: { id: true },
        })
      : null
  const isPreview = Boolean(isOwner || sharedPreview)
  if (quiz.mode === DB.PracticeQuizMode.ADAPTIVE && isLecturer && !isPreview) {
    return null
  }
  if (
    quiz.mode === DB.PracticeQuizMode.ADAPTIVE &&
    !quiz.course.isAdaptiveLearningEnabled &&
    !isPreview
  ) {
    return null
  }

  // if the quiz is scheduled, return the quiz without the stacks
  if (quiz.status === DB.PublicationStatus.SCHEDULED) {
    return isPreview && quiz.mode === DB.PracticeQuizMode.STANDARD
      ? { ...quiz, isOwner, isPreview }
      : { ...quiz, isOwner, isPreview, stacks: [], numOfStacks: 0 }
  }

  if (quiz.mode === DB.PracticeQuizMode.ADAPTIVE) {
    return {
      ...quiz,
      isOwner,
      isPreview,
      stacks: [],
      numOfStacks: 0,
      adaptiveMaximumQuestions: quiz.adaptiveConfig?.totalQuestionCap ?? null,
    }
  }

  if (ctx.user?.sub && ctx.user.role === DB.UserRole.PARTICIPANT) {
    const orderedStacks =
      quiz.orderType === DB.ElementOrderType.SPACED_REPETITION
        ? orderStacks(quiz.stacks)
        : quiz.stacks

    return {
      ...quiz,
      isOwner,
      isPreview,
      stacks: orderedStacks,
      numOfStacks: orderedStacks.length,
    }
  }

  return { ...quiz, isOwner, isPreview }
}

export async function getPracticeQuizEvaluation(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      mode: DB.PracticeQuizMode.STANDARD,
      status: DB.PublicationStatus.PUBLISHED,
      isDeleted: false,
    },
    include: {
      stacks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!practiceQuiz) {
    return null
  }

  // compute evaluation
  const stackEvaluation = computeStackEvaluation(practiceQuiz.stacks)

  return {
    id: practiceQuiz.id,
    name: practiceQuiz.name,
    displayName: practiceQuiz.displayName,
    description: practiceQuiz.description,
    courseId: practiceQuiz.courseId,
    results: stackEvaluation,
  }
}

export async function getSinglePracticeQuiz(
  { id }: { id: string },
  ctx: Context
) {
  const quiz = await ctx.prisma.practiceQuiz.findUnique({
    where: { id, isDeleted: false },
    include: {
      course: true,
      stacks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  return quiz
}

export async function getCoursePublishedPracticeQuizzes(
  { courseId }: { courseId: string },
  ctx: Context
) {
  const adaptiveAccess =
    ctx.user?.role === DB.UserRole.PARTICIPANT
      ? {
          course: {
            isAdaptiveLearningEnabled: true,
            participations: {
              some: { participantId: ctx.user.sub },
            },
          },
        }
      : ctx.user?.role === DB.UserRole.USER ||
          ctx.user?.role === DB.UserRole.ADMIN
        ? {
            course: { isAdaptiveLearningEnabled: true },
            permissions: { some: { userId: ctx.user.sub } },
          }
        : null

  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
    include: {
      practiceQuizzes: {
        where: {
          status: DB.PublicationStatus.PUBLISHED,
          isDeleted: false,
          OR: [
            { mode: DB.PracticeQuizMode.STANDARD },
            ...(adaptiveAccess
              ? [
                  {
                    mode: DB.PracticeQuizMode.ADAPTIVE,
                    ...adaptiveAccess,
                  },
                ]
              : []),
          ],
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  return course?.practiceQuizzes
    ? (course.practiceQuizzes.map((quiz) => ({
        ...quiz,
        course: {
          ...course,
          practiceQuizzes: undefined, // remove practiceQuizzes to avoid circular reference
        },
      })) ?? [])
    : []
}

interface GetBookmarksPracticeQuizArgs {
  quizId?: string | null
  courseId: string
}

export async function getBookmarksPracticeQuiz(
  { quizId, courseId }: GetBookmarksPracticeQuizArgs,
  ctx: Context
) {
  if (!ctx.user?.sub || ctx.user.role !== DB.UserRole.PARTICIPANT) {
    return null
  }

  const participation = await ctx.prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId,
        participantId: ctx.user.sub,
      },
    },
    include: {
      bookmarkedElementStacks: {
        where: {
          practiceQuizId: quizId ?? undefined,
        },
      },
    },
  })

  return participation?.bookmarkedElementStacks.map((stack) => stack.id)
}

export async function changePracticeQuizName(
  { id, name, displayName }: { id: string; name: string; displayName: string },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: { id },
  })

  if (!practiceQuiz) return false

  // if both name and displayname remain unchanged, skip the update
  if (practiceQuiz.name === name && practiceQuiz.displayName === displayName) {
    return true
  }

  try {
    await ctx.prisma.practiceQuiz.update({
      where: { id },
      data: {
        name,
        displayName,
        reviewStatus:
          practiceQuiz.reviewStatus === DB.ReviewStatus.REVIEWED
            ? DB.ReviewStatus.MODIFIED_AFTER_REVIEW
            : undefined,
      },
    })

    ctx.emitter.emit('invalidate', { typename: 'PracticeQuiz', id })
    return true
  } catch (error) {
    console.error('Error changing practice quiz name:', error)
    return false
  }
}

export async function getPracticeQuizSummary(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: { id },
    include: { stacks: { include: { elements: true } } },
  })

  if (!practiceQuiz) {
    return null
  }

  const { responses, anonymousResponses } = practiceQuiz.stacks.reduce(
    (acc, stack) => {
      const elem_counts = stack.elements.reduce(
        (acc_elem, instance) => {
          acc_elem.responses += instance.results.total
          acc_elem.anonymousResponses += instance.anonymousResults.total
          return acc_elem
        },
        { responses: 0, anonymousResponses: 0 }
      )

      acc.responses += elem_counts.responses
      acc.anonymousResponses += elem_counts.anonymousResponses
      return acc
    },
    { responses: 0, anonymousResponses: 0 }
  )

  return {
    numOfResponses: responses,
    numOfAnonymousResponses: anonymousResponses,
  }
}

export async function publishPracticeQuiz(
  { id, availableFrom }: { id: string; availableFrom?: Date | null },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: { id, isDeleted: false },
    select: {
      id: true,
      mode: true,
      status: true,
      courseId: true,
      course: { select: { isAdaptiveLearningEnabled: true } },
    },
  })
  if (!practiceQuiz) return null

  const scheduledPublication = Boolean(
    availableFrom && dayjs(availableFrom).isAfter(dayjs())
  )
  if (practiceQuiz.mode === DB.PracticeQuizMode.ADAPTIVE) {
    if (!practiceQuiz.course.isAdaptiveLearningEnabled) {
      throw new GraphQLError(
        'Adaptive learning is not enabled for this course.',
        { extensions: { code: 'ADAPTIVE_COURSE_DISABLED' } }
      )
    }
    if (scheduledPublication) {
      throw new GraphQLError(
        'Scheduled publication is not available for adaptive practice quizzes until durable task dispatch is enabled.',
        { extensions: { code: 'ADAPTIVE_SCHEDULING_UNAVAILABLE' } }
      )
    }

    const updatedQuiz = await withAdaptiveOperationalTransaction(
      ctx.prisma,
      async (prisma) => {
        await lockAdaptiveLearningCourseEnabled(practiceQuiz.courseId, prisma)
        const lockedQuiz = requireLockedPracticeQuiz(
          await lockPracticeQuizForUpdateInCourse(
            id,
            practiceQuiz.courseId,
            prisma
          )
        )
        if (lockedQuiz.mode !== DB.PracticeQuizMode.ADAPTIVE) {
          throw new GraphQLError(
            'Practice quiz mode changed while publishing.',
            {
              extensions: { code: 'ADAPTIVE_PUBLICATION_STATE_INVALID' },
            }
          )
        }
        if (
          lockedQuiz.status !== DB.PublicationStatus.DRAFT &&
          lockedQuiz.status !== DB.PublicationStatus.PUBLISHED
        ) {
          throw new GraphQLError(
            'Adaptive practice quiz cannot be published from its current state.',
            { extensions: { code: 'ADAPTIVE_PUBLICATION_STATE_INVALID' } }
          )
        }
        await lockAdaptivePracticeQuizConfigForUpdate(id, prisma)
        const config = await prisma.practiceQuizAdaptiveConfig.findUnique({
          where: { practiceQuizId: id },
          select: { _count: { select: { attempts: true } } },
        })
        if (config && config._count.attempts > 0) {
          await assertAdaptivePublishedPool(id, prisma)
        } else {
          await materializeAdaptivePracticeQuizPool(id, ctx.user.sub, prisma)
        }
        return await prisma.practiceQuiz.update({
          where: { id, isDeleted: false },
          data: {
            availableFrom: null,
            status: DB.PublicationStatus.PUBLISHED,
            scheduledPublicationTaskId: null,
          },
        })
      },
      {
        errorCode: 'ADAPTIVE_PUBLICATION_CONFLICT',
        errorMessage:
          'The adaptive practice quiz could not be published due to concurrent activity.',
      }
    )

    ctx.emitter.emit('invalidate', { typename: 'PracticeQuiz', id })
    return updatedQuiz
  }

  // if the practice quiz starts in the future, change its status to scheduled, otherwise publish it
  if (scheduledPublication) {
    try {
      // schedule the task to publish the practice quiz
      const scheduledTask =
        await ctx.tasks.publishScheduledPracticeQuiz.schedule(availableFrom!, {
          practiceQuizId: id,
        })
      const taskId = scheduledTask.metadata.id

      // change the status of the practice quiz to scheduled
      const updatedQuiz = await ctx.prisma.practiceQuiz.update({
        where: {
          id,
          isDeleted: false,
          mode: DB.PracticeQuizMode.STANDARD,
        },
        data: {
          availableFrom: availableFrom!,
          status: DB.PublicationStatus.SCHEDULED,
          scheduledPublicationTaskId: taskId,
        },
      })

      ctx.emitter.emit('invalidate', { typename: 'PracticeQuiz', id })
      return updatedQuiz
    } catch (error) {
      console.error('Error scheduling practice quiz publication:', error)
      return null
    }
  } else {
    // publish practice quiz completely and link all stacks to the course
    const updatedQuiz = await ctx.prisma.practiceQuiz.update({
      where: {
        id,
        isDeleted: false,
        mode: DB.PracticeQuizMode.STANDARD,
      },
      data: { status: DB.PublicationStatus.PUBLISHED },
      include: { stacks: true },
    })

    // connect all elementStacks in the practice quiz to the course
    const courseId = updatedQuiz.courseId
    await ctx.prisma.course.update({
      where: { id: courseId },
      data: {
        elementStacks: {
          connect: updatedQuiz.stacks.map((stack) => ({ id: stack.id })),
        },
      },
    })

    ctx.emitter.emit('invalidate', { typename: 'PracticeQuiz', id })
    return updatedQuiz
  }
}

export async function unpublishPracticeQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findFirst({
    where: {
      id,
      OR: [
        {
          mode: DB.PracticeQuizMode.STANDARD,
          status: DB.PublicationStatus.SCHEDULED,
        },
        {
          mode: DB.PracticeQuizMode.ADAPTIVE,
          status: {
            in: [
              DB.PublicationStatus.SCHEDULED,
              DB.PublicationStatus.PUBLISHED,
            ],
          },
        },
      ],
    },
  })

  if (!practiceQuiz) {
    return null
  }

  // reset the status of the practice quiz to draft and remove the availableFrom date
  const updatedPracticeQuiz =
    practiceQuiz.mode === DB.PracticeQuizMode.ADAPTIVE
      ? await withAdaptiveOperationalTransaction(
          ctx.prisma,
          async (prisma) => {
            const lockedCourse = await lockAdaptiveCourseForShare(
              practiceQuiz.courseId,
              prisma
            )
            if (!lockedCourse) {
              throw new GraphQLError('Course not found.', {
                extensions: { code: 'NOT_FOUND' },
              })
            }
            const lockedQuiz = requireLockedPracticeQuiz(
              await lockPracticeQuizForUpdateInCourse(
                id,
                practiceQuiz.courseId,
                prisma
              )
            )
            if (
              lockedQuiz.status !== DB.PublicationStatus.SCHEDULED &&
              lockedQuiz.status !== DB.PublicationStatus.PUBLISHED
            ) {
              throw new GraphQLError(
                'Adaptive practice quiz is no longer published or scheduled.',
                { extensions: { code: 'ADAPTIVE_PUBLICATION_STATE_INVALID' } }
              )
            }
            await lockAdaptivePracticeQuizConfigForUpdate(id, prisma)
            await clearAdaptivePublishedPool(id, prisma, {
              retainWhenAttemptsExist: true,
            })
            return await prisma.practiceQuiz.update({
              where: {
                id,
                mode: DB.PracticeQuizMode.ADAPTIVE,
                status: {
                  in: [
                    DB.PublicationStatus.SCHEDULED,
                    DB.PublicationStatus.PUBLISHED,
                  ],
                },
              },
              data: {
                availableFrom: null,
                status: DB.PublicationStatus.DRAFT,
                scheduledPublicationTaskId: null,
              },
              include: { stacks: { include: { elements: true } } },
            })
          },
          {
            errorCode: 'ADAPTIVE_UNPUBLICATION_CONFLICT',
            errorMessage:
              'The adaptive practice quiz could not be unpublished due to concurrent activity.',
          }
        )
      : await (async () => {
          // Keep the existing standard-quiz task ordering unchanged.
          if (practiceQuiz.scheduledPublicationTaskId) {
            await deleteScheduledPracticeQuizTask(
              practiceQuiz.scheduledPublicationTaskId,
              id,
              ctx
            )
          }
          return await ctx.prisma.practiceQuiz.update({
            where: { id, status: DB.PublicationStatus.SCHEDULED },
            data: {
              availableFrom: null,
              status: DB.PublicationStatus.DRAFT,
              scheduledPublicationTaskId: null,
            },
            include: { stacks: { include: { elements: true } } },
          })
        })()

  // For adaptive quizzes, commit the status and pool rollback before deleting
  // the external task. A stale running task then observes DRAFT and exits.
  if (
    practiceQuiz.mode === DB.PracticeQuizMode.ADAPTIVE &&
    practiceQuiz.scheduledPublicationTaskId
  ) {
    await deleteScheduledPracticeQuizTask(
      practiceQuiz.scheduledPublicationTaskId,
      id,
      ctx
    )
  }

  ctx.emitter.emit('invalidate', { typename: 'PracticeQuiz', id })
  return updatedPracticeQuiz
}

export async function deletePracticeQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const deletion = await withAdaptiveOperationalTransaction(
    ctx.prisma,
    async (prisma) => {
      const identity = await prisma.practiceQuiz.findUnique({
        where: { id },
        select: { courseId: true },
      })
      if (!identity) return { kind: 'missing' } as const

      const course = await lockAdaptiveCourseForShare(identity.courseId, prisma)
      if (!course) return { kind: 'missing' } as const

      const lockedQuiz = await lockPracticeQuizForUpdateInCourse(
        id,
        identity.courseId,
        prisma
      )
      if (!lockedQuiz) return { kind: 'missing' } as const

      await lockPracticeQuizPermissionsForShare(id, prisma)
      const hasAdminPermission = await lockPracticeQuizAdminPermissionForShare(
        id,
        ctx.user.sub,
        prisma
      )
      if (!hasAdminPermission) return { kind: 'forbidden' } as const

      if (lockedQuiz.mode === DB.PracticeQuizMode.ADAPTIVE) {
        await lockAdaptivePracticeQuizConfigForUpdate(id, prisma)
      }

      const practiceQuiz = await prisma.practiceQuiz.findUniqueOrThrow({
        where: { id },
        include: {
          stacks: { include: { elements: true } },
          _count: { select: { responses: true, adaptiveAttempts: true } },
        },
      })
      const shouldHardDelete =
        (practiceQuiz.status === DB.PublicationStatus.DRAFT ||
          practiceQuiz.status === DB.PublicationStatus.SCHEDULED ||
          practiceQuiz._count.responses === 0) &&
        practiceQuiz._count.adaptiveAttempts === 0

      if (shouldHardDelete) {
        if (practiceQuiz.mode === DB.PracticeQuizMode.ADAPTIVE) {
          await purgeAttemptFreeAdaptivePublications(id, prisma)
        }
        const deletedItem = await prisma.practiceQuiz.delete({ where: { id } })
        return {
          kind: 'hard-deleted',
          item: deletedItem,
          stacks: practiceQuiz.stacks,
        } as const
      }

      const updatedPracticeQuiz = await prisma.practiceQuiz.update({
        where: { id },
        data: {
          isDeleted: true,
          directPermissions: { deleteMany: {} },
        },
        include: { stacks: true },
      })
      await prisma.elementStack.updateMany({
        where: { id: { in: updatedPracticeQuiz.stacks.map(({ id }) => id) } },
        data: { courseId: null },
      })
      await recomputeDerivedPermissions(
        { practiceQuizId: updatedPracticeQuiz.id },
        prisma
      )
      return { kind: 'soft-deleted', item: updatedPracticeQuiz } as const
    },
    {
      errorCode: 'PRACTICE_QUIZ_DELETE_CONFLICT',
      errorMessage:
        'The practice quiz could not be deleted due to concurrent activity.',
    }
  )

  if (deletion.kind === 'missing' || deletion.kind === 'forbidden') return null

  if (deletion.kind === 'hard-deleted') {
    if (
      deletion.item.scheduledPublicationTaskId &&
      deletion.item.status === DB.PublicationStatus.SCHEDULED
    ) {
      await deleteScheduledPracticeQuizTask(
        deletion.item.scheduledPublicationTaskId,
        id,
        ctx
      )
    }

    // The quiz no longer exists, so linked element permissions are repaired
    // from the stack snapshot captured by the deletion transaction.
    await propagateActivityToElements(
      { stacks: deletion.stacks, updateAccessRequests: true },
      ctx.prisma
    )
  }

  ctx.emitter.emit('invalidate', { typename: 'PracticeQuiz', id })
  return deletion.item
}

export async function removePracticeQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  // verify that the user has a direct permission on the specified practice quiz
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: { id, directPermissions: { some: { userId: ctx.user.sub } } },
  })

  if (!practiceQuiz) {
    return null
  }

  // remove direct permission and recompute derived permissions for this practice quiz and user
  await ctx.prisma.$transaction(
    async (prisma) => {
      // remove the direct permission for the user
      await prisma.practiceQuiz.update({
        where: { id },
        data: { directPermissions: { deleteMany: { userId: ctx.user.sub } } },
      })

      // create an audit log entry for the removal
      await prisma.auditLogEntry.create({
        data: {
          type: DB.AuditLogType.PERMISSION_REMOVED,
          objectId: String(id),
          objectType: DB.ObjectType.PRACTICE_QUIZ,
          sourceUserId: ctx.user.sub,
          message: `User ${ctx.user.sub} removed own permission on ${DB.ObjectType.PRACTICE_QUIZ} (ID: ${id})`,
        },
      })

      // recompute derived permissions for the user and the practice quiz
      await recomputeDerivedPermissions(
        { practiceQuizId: id, userId: ctx.user.sub },
        prisma
      )
    },
    { timeout: 60000 }
  )

  ctx.emitter.emit('invalidate', {
    typename: 'PracticeQuiz',
    id,
  })

  return id
}

export const handlePublishScheduledPracticeQuiz: HatchetHandlers['handlePublishScheduledPracticeQuiz'] =
  async ({ practiceQuizId }, globalCtx) => {
    try {
      const targetQuiz = await globalCtx.prisma.practiceQuiz.findUnique({
        where: { id: practiceQuizId, isDeleted: false },
        select: { mode: true, courseId: true },
      })
      const { didPublish, practiceQuiz } = await globalCtx.prisma.$transaction(
        async (prisma) => {
          if (targetQuiz?.mode === DB.PracticeQuizMode.ADAPTIVE) {
            await lockAdaptiveLearningCourseEnabled(targetQuiz.courseId, prisma)
          }
          const lockedQuiz = requireLockedPracticeQuiz(
            targetQuiz?.mode === DB.PracticeQuizMode.ADAPTIVE
              ? await lockPracticeQuizForUpdateInCourse(
                  practiceQuizId,
                  targetQuiz.courseId,
                  prisma
                )
              : await lockPracticeQuizForUpdate(practiceQuizId, prisma)
          )
          if (
            lockedQuiz.mode === DB.PracticeQuizMode.ADAPTIVE &&
            targetQuiz?.mode !== DB.PracticeQuizMode.ADAPTIVE
          ) {
            throw new GraphQLError(
              'Adaptive practice quiz mode changed before scheduled publication.',
              { extensions: { code: 'ADAPTIVE_PUBLICATION_STATE_INVALID' } }
            )
          }

          // Hatchet may retry a task after the transaction committed. Treat that
          // as success without repeating publication side effects.
          if (lockedQuiz.status === DB.PublicationStatus.PUBLISHED) {
            const publishedQuiz = await prisma.practiceQuiz.findUniqueOrThrow({
              where: { id: practiceQuizId, isDeleted: false },
              include: { stacks: true },
            })
            return { didPublish: false, practiceQuiz: publishedQuiz }
          }

          if (
            lockedQuiz.status === DB.PublicationStatus.DRAFT &&
            lockedQuiz.scheduledPublicationTaskId === null
          ) {
            const unpublishedQuiz = await prisma.practiceQuiz.findUniqueOrThrow(
              {
                where: { id: practiceQuizId, isDeleted: false },
                include: { stacks: true },
              }
            )
            return { didPublish: false, practiceQuiz: unpublishedQuiz }
          }

          if (
            lockedQuiz.status !== DB.PublicationStatus.SCHEDULED ||
            !lockedQuiz.availableFrom ||
            lockedQuiz.availableFrom > new Date()
          ) {
            throw new GraphQLError(
              `Practice quiz with ID ${practiceQuizId} is not ready for scheduled publication.`,
              { extensions: { code: 'PRACTICE_QUIZ_NOT_READY' } }
            )
          }

          if (lockedQuiz.mode === DB.PracticeQuizMode.ADAPTIVE) {
            await assertAdaptivePublishedPool(practiceQuizId, prisma)
          }

          const updatedQuiz = await prisma.practiceQuiz.update({
            where: { id: practiceQuizId, isDeleted: false },
            data: {
              status: DB.PublicationStatus.PUBLISHED,
              scheduledPublicationTaskId: null,
            },
            include: { stacks: true },
          })

          if (lockedQuiz.mode === DB.PracticeQuizMode.STANDARD) {
            await prisma.course.update({
              where: { id: updatedQuiz.courseId },
              data: {
                elementStacks: {
                  connect: updatedQuiz.stacks.map((stack) => ({
                    id: stack.id,
                  })),
                },
              },
            })
          }

          return { didPublish: true, practiceQuiz: updatedQuiz }
        }
      )

      if (didPublish) {
        await sendTeamsNotification({
          scope: 'graphql/publishScheduledPracticeQuizs',
          text: `Successfully published scheduled practice quiz ${practiceQuiz.id}`,
        })
      }

      // invalidate the cache for the microlearning
      globalCtx.emitter.emit('invalidate', {
        typename: 'PracticeQuiz',
        id: practiceQuiz.id,
      })

      return true
    } catch (error) {
      console.error('Error publishing scheduled practice quiz:', error)
      await sendTeamsNotification({
        scope: 'hatchet/practice-quiz-start',
        text: `Error publishing practice quiz with ID ${practiceQuizId}: ${error}`,
      })
      throw error // rethrow to allow Hatchet to handle retries
    }
  }

function requireLockedPracticeQuiz(
  practiceQuiz: LockedPracticeQuiz | null
): LockedPracticeQuiz {
  if (!practiceQuiz || practiceQuiz.isDeleted) {
    throw new GraphQLError('Practice quiz not found.', {
      extensions: { code: 'NOT_FOUND' },
    })
  }

  return practiceQuiz
}

async function deleteScheduledPracticeQuizTask(
  taskId: string,
  practiceQuizId: string,
  ctx: ContextWithUser
): Promise<void> {
  try {
    await ctx.hatchet.scheduled.delete(taskId)
  } catch (error) {
    console.error(
      'Failed to delete scheduled practice quiz task:',
      { practiceQuizId },
      error
    )
  }
}
