import * as DB from '@klicker-uzh/prisma/client'
import {
  ActivityType,
  type ElementStackInput,
  type HatchetHandlers,
} from '@klicker-uzh/types'
import {
  getActivityInstanceConnectOrCreate,
  type PrismaTransactionClient,
  propagateActivityToElements,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { v4 as uuidv4 } from 'uuid'
import type { Context, ContextWithUser } from '../lib/context.js'
import { orderStacks } from '../lib/util.js'
import {
  deleteWithPublicationStatusGuard,
  persistActivityWithPermissions,
  UNPUBLISHED_ACTIVITY_STATUSES,
} from './activities.js'
import { splitActivityInstances } from './liveQuizzes.js'
import { sendTeamsNotification } from './notifications.js'
import { computeStackEvaluation } from './stacks.js'

export async function getPracticeQuizData(
  { id }: { id: string },
  ctx: Context
) {
  const quiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      isDeleted: false,
      course: { isDeleted: false },
      OR: [
        { status: DB.PublicationStatus.PUBLISHED },
        { status: DB.PublicationStatus.SCHEDULED },
        // if user has access to the microlearning, the query should be enabled for loading the preview
        ...(ctx.user?.sub
          ? [{ permissions: { some: { userId: ctx.user.sub } } }]
          : []),
      ],
    },
    include: {
      course: true,
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
  const isOwner =
    ctx.user?.sub &&
    (ctx.user.role === DB.UserRole.USER || ctx.user.role === DB.UserRole.ADMIN)
      ? ctx.user.sub === quiz.ownerId
      : false

  // if the quiz is scheduled, return the quiz without the stacks
  if (quiz.status === DB.PublicationStatus.SCHEDULED) {
    return isOwner ? { ...quiz, isOwner } : { ...quiz, isOwner, stacks: [] }
  }

  if (ctx.user?.sub && ctx.user.role === DB.UserRole.PARTICIPANT) {
    const orderedStacks =
      quiz.orderType === DB.ElementOrderType.SPACED_REPETITION
        ? orderStacks(quiz.stacks)
        : quiz.stacks

    return {
      ...quiz,
      isOwner,
      stacks: orderedStacks,
      numOfStacks: orderedStacks.length,
    }
  }

  return { ...quiz, isOwner }
}

export async function getPracticeQuizEvaluation(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      status: DB.PublicationStatus.PUBLISHED,
      isDeleted: false,
      course: { isDeleted: false },
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
    where: { id, isDeleted: false, course: { isDeleted: false } },
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
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId, isDeleted: false },
    include: {
      practiceQuizzes: {
        where: { status: DB.PublicationStatus.PUBLISHED, isDeleted: false },
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

interface ManipulatePracticeQuizArgs {
  id?: string
  name: string
  displayName: string
  description?: string | null
  stacks: ElementStackInput[]
  courseId: string
  multiplier: number
  order: DB.ElementOrderType
  resetTimeDays: number
}

export async function manipulatePracticeQuiz(
  {
    id,
    name,
    displayName,
    description,
    stacks,
    courseId,
    multiplier,
    order,
    resetTimeDays,
  }: ManipulatePracticeQuizArgs,
  ctx: ContextWithUser,
  transactionPrisma?: PrismaTransactionClient
) {
  const prisma = transactionPrisma ?? ctx.prisma

  // in EDIT mode - validate that the practice quiz exists and is not published
  let existingActivity: DB.PracticeQuiz | null = null
  if (id) {
    existingActivity = await prisma.practiceQuiz.findUnique({
      where: { id, isDeleted: false },
    })

    if (!existingActivity) {
      throw new GraphQLError('Practice quiz not found')
    }
    if (existingActivity.status === DB.PublicationStatus.PUBLISHED) {
      throw new GraphQLError('Cannot edit a published practice quiz')
    }
  }

  // get the course to which the practice quiz should be assigned
  const course = await prisma.course.findUnique({
    where: { id: courseId, isDeleted: false },
    select: { isGamificationEnabled: true, isAssessmentEnabled: true },
  })

  if (!course) {
    throw new GraphQLError('Course not found')
  }

  // get required splits of instances based on provided stacks values
  const {
    persistentInstanceIds,
    persistentInstances,
    persistentInstanceOrderMap,
    duplicationInstances,
    elementMap,
    anyInstanceOutdated,
  } = await splitActivityInstances({ stacksOrBlocks: stacks }, ctx, prisma)

  // in EDIT mode - check which instances and stacks should be removed
  let instancesToDelete: number[] = []
  let unlinkedElementIds: number[] = [] // ids of all elements, which will no longer require a derived permissions link to the activity
  let stacksToDelete: number[] = []
  if (id) {
    const instances = await prisma.elementInstance.findMany({
      where: {
        id: { notIn: persistentInstanceIds },
        elementStack: { practiceQuizId: id },
      },
    })

    const stacks = await prisma.elementStack.findMany({
      where: { practiceQuizId: id },
    })

    instancesToDelete = instances.map((instance) => instance.id)
    unlinkedElementIds = instances.map((instance) => instance.elementId)
    stacksToDelete = stacks.map((stack) => stack.id)
  }

  const createOrUpdateJSON = {
    name: name.trim(),
    displayName: displayName.trim(),
    description,
    pointsMultiplier: multiplier,
    orderType: order,
    resetTimeDays: resetTimeDays,
    areInstancesOutdated: anyInstanceOutdated,
    isGamificationEnabled: course.isGamificationEnabled,
    isAssessmentEnabled: course.isAssessmentEnabled,
    reviewStatus:
      existingActivity?.courseId !== courseId
        ? DB.ReviewStatus.INCOMPLETE
        : existingActivity?.reviewStatus === DB.ReviewStatus.REVIEWED
          ? DB.ReviewStatus.MODIFIED_AFTER_REVIEW
          : undefined,
    stacks: {
      create: stacks.map((stack) => ({
        type: DB.ElementStackType.PRACTICE_QUIZ,
        order: stack.order,
        displayName: stack.displayName?.trim() ?? '',
        description: stack.description ?? '',
        elements: {
          connectOrCreate: stack.elements.map((instance) =>
            getActivityInstanceConnectOrCreate({
              instance,
              instanceType: DB.ElementInstanceType.PRACTICE_QUIZ,
              activityMultiplier: multiplier,
              persistentInstances,
              duplicationInstances,
              elementMap,
              userId: ctx.user.sub,
              additionalInstanceOptions: { resetTimeDays },
            })
          ),
        },
      })),
    },
    course: { connect: { id: courseId } },
  }

  const persistPracticeQuiz = async (prisma: PrismaTransactionClient) => {
    // delete all instances that are not used anymore
    await prisma.elementInstance.deleteMany({
      where: { id: { in: instancesToDelete } },
    })

    // disconnect all instances that should be kept in edit mode and set new order value (to satisfy uniqueness constraints)
    for (const instance of persistentInstances) {
      const elementMultiplier =
        'pointsMultiplier' in instance.elementData
          ? ((instance.elementData.pointsMultiplier as number) ?? 1)
          : 1

      await prisma.elementInstance.update({
        where: { id: instance.id },
        data: {
          elementStackId: null,
          order: persistentInstanceOrderMap[instance.id],
          options: {
            ...instance.options,
            resetTimeDays,
            pointsMultiplier: multiplier * elementMultiplier,
          },
        },
      })
    }

    // delete all stacks
    await prisma.elementStack.deleteMany({
      where: { id: { in: stacksToDelete } },
    })

    const upsertedQuiz = await prisma.practiceQuiz.upsert({
      where: { id: id ?? uuidv4() },
      create: {
        ...createOrUpdateJSON,
        owner: { connect: { id: ctx.user.sub } }, // only connect the owner during activity creation (not editing)!
      },
      update: createOrUpdateJSON,
      include: {
        templateInfo: true,
        permissions: {
          where: { userId: ctx.user.sub },
          include: { directPermission: true },
          take: 1,
        },
        course: {
          include: {
            _count: {
              select: {
                permissions: {
                  where: {
                    userId: ctx.user.sub,
                    permissionLevel: {
                      in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
                    },
                  },
                },
              },
            },
          },
        },
        stacks: {
          include: { _count: { select: { elements: true } } },
          orderBy: { order: 'asc' },
        },
        _count: { select: { permissions: true } },
      },
    })

    // enforce dervied permissions update to elements that were potentially removed from the quiz (-> removal of derived permissions)
    if (unlinkedElementIds.length > 0) {
      for (const elementId of unlinkedElementIds) {
        await recomputeDerivedPermissions({ elementId }, prisma)
      }
    }

    await recomputeDerivedPermissions(
      { practiceQuizId: upsertedQuiz.id },
      prisma
    )

    return upsertedQuiz
  }

  const {
    activity,
    permissionLevel,
    derived,
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    sharingType,
  } = await persistActivityWithPermissions({
    persist: persistPracticeQuiz,
    invalidateTypename: 'PracticeQuiz',
    invalidateId: id,
    ctx,
    transactionPrisma,
  })

  return {
    id: activity.id,
    templateId: activity.templateInfo?.id ?? null,
    name: activity.name,
    displayName: activity.displayName,
    reviewStatus: activity.reviewStatus,
    type: ActivityType.PRACTICE_QUIZ,
    status: activity.status,
    courseId: activity.course?.id,
    courseName: activity.course?.name,
    courseLanguage: activity.course?.language,
    courseStartDate: activity.course?.startDate,
    numOfStacks: activity.stacks.length,
    numOfElements: activity.stacks.reduce(
      (acc, block) => acc + block._count.elements,
      0
    ),
    automaticPublicationAt: activity.availableFrom,
    permissionLevel,
    derivedAccess: derived,
    areInstancesOutdated: activity.areInstancesOutdated,
    isGamificationEnabled: activity.isGamificationEnabled,
    isAssessmentEnabled: activity.isAssessmentEnabled,
    numSharedUsers: id ? activity._count.permissions - 1 : 0,
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    isActivityReviewer: activity.course._count.permissions > 0,
    sharingType,
    updatedAt: activity.updatedAt,
  }
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
  // if the practice quiz starts in the future, change its status to scheduled, otherwise publish it
  if (availableFrom && dayjs(availableFrom).isAfter(dayjs())) {
    try {
      // schedule the task to publish the practice quiz
      const scheduledTask =
        await ctx.tasks.publishScheduledPracticeQuiz.schedule(availableFrom, {
          practiceQuizId: id,
        })
      const taskId = scheduledTask.metadata.id

      // change the status of the practice quiz to scheduled
      const updatedQuiz = await ctx.prisma.practiceQuiz.update({
        where: { id, isDeleted: false },
        data: {
          availableFrom,
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
      where: { id, isDeleted: false },
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
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: { id, status: DB.PublicationStatus.SCHEDULED },
  })

  if (!practiceQuiz) {
    return null
  }

  // remove the scheduled hatchet publication task, if it exists
  if (practiceQuiz.scheduledPublicationTaskId) {
    try {
      await ctx.hatchet.scheduled.delete(
        practiceQuiz.scheduledPublicationTaskId
      )
    } catch (error) {
      console.error(
        `Failed to delete scheduled task for practice quiz ${id}:`,
        error
      )
    }
  }

  // reset the status of the practice quiz to draft and remove the availableFrom date
  const updatedPracticeQuiz = await ctx.prisma.practiceQuiz.update({
    where: { id, status: DB.PublicationStatus.SCHEDULED },
    data: {
      availableFrom: null,
      status: DB.PublicationStatus.DRAFT,
      scheduledPublicationTaskId: null,
    },
    include: { stacks: { include: { elements: true } } },
  })

  ctx.emitter.emit('invalidate', { typename: 'PracticeQuiz', id })
  return updatedPracticeQuiz
}

export async function deletePracticeQuiz(
  {
    id,
    onlyIfUnpublished = false,
  }: { id: string; onlyIfUnpublished?: boolean },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: { id },
    include: { responses: true, stacks: { include: { elements: true } } },
  })

  if (!practiceQuiz) {
    return null
  }

  const isUnpublished = UNPUBLISHED_ACTIVITY_STATUSES.includes(
    practiceQuiz.status
  )

  if (onlyIfUnpublished && !isUnpublished) {
    return null
  }

  // if the practice quiz is not published yet or has no responses -> hard deletion
  // anonymous results are ignored, since deleting them does not have an impage on data consistency
  if (
    isUnpublished ||
    (!onlyIfUnpublished && practiceQuiz.responses.length === 0)
  ) {
    // Recheck publication status in the delete statement because the initial
    // read can become stale while the user confirms the batch.
    const deletedItem = onlyIfUnpublished
      ? await deleteWithPublicationStatusGuard(() =>
          ctx.prisma.practiceQuiz.delete({
            where: { id, status: { in: UNPUBLISHED_ACTIVITY_STATUSES } },
          })
        )
      : await ctx.prisma.practiceQuiz.delete({ where: { id } })

    if (!deletedItem) {
      return null
    }

    // remove the scheduled publication task, if it exists (should only exist for scheduled practice quizzes)
    if (
      deletedItem.scheduledPublicationTaskId &&
      deletedItem.status === DB.PublicationStatus.SCHEDULED
    ) {
      try {
        await ctx.hatchet.scheduled.delete(
          deletedItem.scheduledPublicationTaskId
        )
      } catch (error) {
        console.error(
          `Failed to delete scheduled task for practice quiz ${id}:`,
          error
        )
      }
    }

    // update derived permissions on all linked elements (to make sure that invalid derived permissions are also removed)
    // this case cannot be handled by the permissions module, since the practice quiz is already hard deleted
    // access requests need to be updated as well, since the derived permissions on elements might have changed
    await propagateActivityToElements(
      { stacks: practiceQuiz.stacks, updateAccessRequests: true },
      ctx.prisma
    )

    ctx.emitter.emit('invalidate', { typename: 'PracticeQuiz', id })

    return deletedItem
  } else {
    // if the practice quiz is published and has responses -> soft deletion
    const updatedPracticeQuiz = await ctx.prisma.$transaction(
      async (prisma) => {
        const quiz = await prisma.practiceQuiz.update({
          where: { id },
          data: {
            isDeleted: true,
            directPermissions: { deleteMany: {} }, // delete all direct permissions on the activity
          },
          include: { stacks: true },
        })

        // disconnect the stacks from the course they are linked to
        const stackIds = quiz.stacks.map((stack) => stack.id)
        await prisma.elementStack.updateMany({
          where: { id: { in: stackIds } },
          data: { courseId: null },
        })

        // update derived permissions for this practice quiz (after soft deletion)
        // this function call automatically includes permission updates for all linked elements
        await recomputeDerivedPermissions({ practiceQuizId: quiz.id }, prisma)

        return quiz
      },
      { timeout: 60000 }
    )

    ctx.emitter.emit('invalidate', { typename: 'PracticeQuiz', id })
    return updatedPracticeQuiz
  }
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
      // check if the practice quiz exists and if its availableFrom date is in the past
      const practiceQuiz = await globalCtx.prisma.practiceQuiz.findUnique({
        where: { id: practiceQuizId },
        include: { course: { select: { isDeleted: true } } },
      })

      if (practiceQuiz?.course.isDeleted) return true

      if (!practiceQuiz) {
        await sendTeamsNotification({
          scope: 'hatchet/practice-quiz-start',
          text: `Practice quiz with ID ${practiceQuizId} not found or scheduled start time is not in the past yet.`,
        })
        throw new Error(
          `Practice quiz with ID ${practiceQuizId} not found or scheduled start time is not in the past yet.`
        )
      }

      if (
        practiceQuiz.isDeleted ||
        practiceQuiz.status !== DB.PublicationStatus.SCHEDULED ||
        !practiceQuiz.availableFrom ||
        practiceQuiz.availableFrom > new Date()
      ) {
        await sendTeamsNotification({
          scope: 'hatchet/practice-quiz-start',
          text: `Practice quiz with ID ${practiceQuizId} not found or scheduled start time is not in the past yet.`,
        })
        throw new Error(
          `Practice quiz with ID ${practiceQuizId} not found or scheduled start time is not in the past yet.`
        )
      }

      // publish the practice quiz
      const updatedPracticeQuiz = await globalCtx.prisma.practiceQuiz.update({
        where: {
          id: practiceQuizId,
          isDeleted: false,
          course: { isDeleted: false },
        },
        data: { status: DB.PublicationStatus.PUBLISHED },
        include: { stacks: true },
      })

      // send a teams notification
      await sendTeamsNotification({
        scope: 'graphql/publishScheduledPracticeQuizs',
        text: `Successfully published scheduled practice quiz ${updatedPracticeQuiz.id}`,
      })

      // link stacks of practice quiz to course
      await globalCtx.prisma.course.update({
        where: { id: updatedPracticeQuiz.courseId, isDeleted: false },
        data: {
          elementStacks: {
            connect: updatedPracticeQuiz.stacks.map((stack) => ({
              id: stack.id,
            })),
          },
        },
      })

      // invalidate the cache for the microlearning
      globalCtx.emitter.emit('invalidate', {
        typename: 'PracticeQuiz',
        id: updatedPracticeQuiz.id,
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
