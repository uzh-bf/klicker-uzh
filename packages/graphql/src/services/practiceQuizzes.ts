import * as DB from '@klicker-uzh/prisma/client'
import {
  ActivityType,
  ESCAPE_ROOM_SUPPORTED_ELEMENT_TYPES,
  getCurrentEscapeRoomInstance,
  HatchetHandlers,
  type ElementStackInput,
} from '@klicker-uzh/types'
import {
  getActivityInstanceConnectOrCreate,
  getEscapeRoomHintUpdate,
  propagateActivityToElements,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { v4 as uuidv4 } from 'uuid'
import type { Context, ContextWithUser } from '../lib/context.js'
import { orderStacks } from '../lib/util.js'
import {
  activityInputContainsElementType,
  getPermissionBooleans,
} from './activities.js'
import {
  ESCAPE_ROOM_GRACE_SECONDS,
  getRemainingSecondsUntil,
  isEscapeRoomStackCleared,
  restoreUsedEscapeRoomHints,
  validateEscapeRoomConfig,
} from './escapeRooms.js'
import { splitActivityInstances } from './liveQuizzes.js'
import { sendTeamsNotification } from './notifications.js'
import { checkAccess } from './sharing.js'
import { computeStackEvaluation } from './stacks.js'

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
      escapeRoomConfig: true,
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

    let filteredStacks = orderedStacks
    let attempt: DB.EscapeRoomAttempt | null = null
    if (quiz.escapeRoomConfig) {
      attempt = await ctx.prisma.escapeRoomAttempt.findUnique({
        where: {
          participantId_practiceQuizId: {
            participantId: ctx.user.sub,
            practiceQuizId: quiz.id,
          },
        },
      })
      if (!attempt || attempt.status === DB.EscapeRoomStatus.EXPIRED) {
        filteredStacks = []
      } else if (attempt.status === DB.EscapeRoomStatus.IN_PROGRESS) {
        const firstUnclearedIx = orderedStacks.findIndex(
          (stack) => !isEscapeRoomStackCleared(stack.elements)
        )
        if (firstUnclearedIx !== -1) {
          filteredStacks = orderedStacks.slice(0, firstUnclearedIx + 1)
        }
      }
    }

    return {
      ...quiz,
      isOwner,
      stacks: restoreUsedEscapeRoomHints(filteredStacks, attempt?.hintsUsed),
      numOfStacks: orderedStacks.length,
    }
  }

  // Escape room content must never reach a non-participant, non-owner caller
  // (the participant path above masks locked stacks; this covers anonymous /
  // temporary callers that fall through without an attempt).
  if (quiz.escapeRoomConfig && !isOwner) {
    return { ...quiz, isOwner, stacks: [] }
  }

  return { ...quiz, isOwner }
}

export async function getPracticeQuizEvaluation(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: { id, status: DB.PublicationStatus.PUBLISHED, isDeleted: false },
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
      escapeRoomConfig: true,
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
    where: { id: courseId },
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
  isEscapeRoom?: boolean | null
  escapeRoomTimeLimit?: number | null
  escapeRoomHintPenalty?: number | null
  escapeRoomIntroText?: string | null
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
    isEscapeRoom,
    escapeRoomTimeLimit,
    escapeRoomHintPenalty,
    escapeRoomIntroText,
  }: ManipulatePracticeQuizArgs,
  ctx: ContextWithUser
) {
  if (isEscapeRoom && order !== DB.ElementOrderType.SEQUENTIAL) {
    throw new GraphQLError('Escape room quizzes must have sequential order')
  }
  if (isEscapeRoom) {
    validateEscapeRoomConfig({
      timeLimit: escapeRoomTimeLimit ?? 3600,
      hintPenalty: escapeRoomHintPenalty ?? 120,
    })
  }

  // in EDIT mode - validate that the practice quiz exists and is not published
  let existingActivity: DB.PracticeQuiz | null = null
  if (id) {
    existingActivity = await ctx.prisma.practiceQuiz.findUnique({
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
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
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
  } = await splitActivityInstances({ stacksOrBlocks: stacks }, ctx)

  if (
    !isEscapeRoom &&
    activityInputContainsElementType({
      stacksOrBlocks: stacks,
      persistentInstances,
      duplicationInstances,
      elementMap,
      type: DB.ElementType.QR_SCAN,
    })
  ) {
    throw new GraphQLError(
      'QR scan questions are only supported in escape room activities'
    )
  }

  // in EDIT mode - check which instances and stacks should be removed
  let instancesToDelete: number[] = []
  let unlinkedElementIds: number[] = [] // ids of all elements, which will no longer require a derived permissions link to the activity
  let stacksToDelete: number[] = []
  if (id) {
    const instances = await ctx.prisma.elementInstance.findMany({
      where: {
        id: { notIn: persistentInstanceIds },
        elementStack: { practiceQuizId: id },
      },
    })

    const stacks = await ctx.prisma.elementStack.findMany({
      where: { practiceQuizId: id },
    })

    instancesToDelete = instances.map((instance) => instance.id)
    unlinkedElementIds = instances.map((instance) => instance.elementId)
    stacksToDelete = stacks.map((stack) => stack.id)
  }

  const createOrUpdateJSON: any = {
    name: name.trim(),
    displayName: displayName.trim(),
    description,
    pointsMultiplier: multiplier,
    orderType: order,
    resetTimeDays,
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

  // nested upsert is only valid on the update branch of the activity upsert;
  // the create branch needs a plain nested create
  const escapeRoomConfigData = isEscapeRoom
    ? {
        timeLimit: escapeRoomTimeLimit ?? 3600,
        hintPenalty: escapeRoomHintPenalty ?? 120,
        lockoutSeconds: 5,
        introText: escapeRoomIntroText?.trim() || null,
      }
    : null

  if (escapeRoomConfigData) {
    createOrUpdateJSON.escapeRoomConfig = {
      upsert: {
        create: escapeRoomConfigData,
        update: {
          timeLimit: escapeRoomConfigData.timeLimit,
          hintPenalty: escapeRoomConfigData.hintPenalty,
          introText: escapeRoomConfigData.introText,
        },
      },
    }
  }

  const activity = await ctx.prisma.$transaction(
    async (prisma) => {
      const persistentInputs = new Map(
        stacks
          .flatMap((stack) => stack.elements)
          .filter((instance) => !instance.duplicateInstance)
          .map((instance) => [instance.existingInstanceId, instance])
      )
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
              ...getEscapeRoomHintUpdate(
                persistentInputs.get(instance.id)?.escapeRoomHint
              ),
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

      if (!isEscapeRoom && id) {
        await prisma.escapeRoomConfig
          .delete({
            where: { practiceQuizId: id },
          })
          .catch(() => {})
      }

      const upsertedQuiz = await prisma.practiceQuiz.upsert({
        where: { id: id ?? uuidv4() },
        create: {
          ...createOrUpdateJSON,
          ...(escapeRoomConfigData
            ? { escapeRoomConfig: { create: escapeRoomConfigData } }
            : {}),
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
                        in: [
                          DB.PermissionLevel.ADMIN,
                          DB.PermissionLevel.OWNER,
                        ],
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
    },
    { timeout: 60000 }
  )

  ctx.emitter.emit('invalidate', {
    typename: 'PracticeQuiz',
    id,
  })

  const permissionLevel =
    activity.permissions[0]?.permissionLevel ?? DB.PermissionLevel.OWNER
  const derived = activity.permissions[0]?.derived ?? false
  const {
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    sharingType,
  } = getPermissionBooleans({
    permissionLevel,
    derived,
    directGroupPermission:
      activity.permissions[0]?.directPermission &&
      activity.permissions[0].directPermission.userGroupId !== null,
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
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: { id },
    include: { responses: true, stacks: { include: { elements: true } } },
  })

  if (!practiceQuiz) {
    return null
  }

  // if the practice quiz is not published yet or has no responses -> hard deletion
  // anonymous results are ignored, since deleting them does not have an impage on data consistency
  if (
    practiceQuiz.status === DB.PublicationStatus.DRAFT ||
    practiceQuiz.status === DB.PublicationStatus.SCHEDULED ||
    practiceQuiz.responses.length === 0
  ) {
    const deletedItem = await ctx.prisma.practiceQuiz.delete({
      where: { id },
    })

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
        where: {
          id: practiceQuizId,
          isDeleted: false,
          status: DB.PublicationStatus.SCHEDULED,
          availableFrom: { lte: new Date() },
        },
      })

      if (!practiceQuiz) {
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
        where: { id: practiceQuizId, isDeleted: false },
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
        where: { id: updatedPracticeQuiz.courseId },
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

interface StartEscapeRoomAttemptArgs {
  practiceQuizId?: string | null
  microLearningId?: string | null
  groupActivityId?: string | null
  elementBlockId?: number | null
}

export async function startEscapeRoomAttempt(
  {
    practiceQuizId,
    microLearningId,
    groupActivityId,
    elementBlockId,
  }: StartEscapeRoomAttemptArgs,
  ctx: ContextWithUser
) {
  if (!ctx.user?.sub || ctx.user.role !== DB.UserRole.PARTICIPANT) {
    throw new GraphQLError('Only participants can start escape room attempts')
  }

  const activityIdCount = [
    practiceQuizId,
    microLearningId,
    groupActivityId,
    elementBlockId,
  ].filter((value) => value != null).length
  if (activityIdCount !== 1) {
    throw new GraphQLError('Exactly one activity ID must be specified', {
      extensions: { code: 'ESCAPE_ROOM_FORBIDDEN' },
    })
  }

  const participantId = ctx.user.sub

  // 1. Identify active settings
  let isEscapeRoom = false
  let timeLimit: number
  let groupId: string | null = null
  let courseId: string | null = null

  if (practiceQuizId) {
    const pq = await ctx.prisma.practiceQuiz.findUnique({
      where: { id: practiceQuizId, isDeleted: false },
      include: { escapeRoomConfig: true },
    })
    // SECURITY: an unpublished quiz must be indistinguishable from a missing
    // one so participants cannot probe for / start escape attempts early.
    if (!pq || pq.status !== DB.PublicationStatus.PUBLISHED)
      throw new GraphQLError('Practice quiz not found')
    isEscapeRoom = !!pq.escapeRoomConfig
    timeLimit = pq.escapeRoomConfig?.timeLimit ?? 3600
    courseId = pq.courseId
  } else if (microLearningId) {
    const ml = await ctx.prisma.microLearning.findUnique({
      where: { id: microLearningId, isDeleted: false },
      include: { escapeRoomConfig: true },
    })
    // SECURITY: only a published microlearning may back an escape attempt;
    // hide the not-yet-published state behind the same not-found error.
    if (!ml || ml.status !== DB.PublicationStatus.PUBLISHED)
      throw new GraphQLError('Microlearning not found')
    isEscapeRoom = !!ml.escapeRoomConfig
    timeLimit = ml.escapeRoomConfig?.timeLimit ?? 3600
    courseId = ml.courseId
  } else if (groupActivityId) {
    const ga = await ctx.prisma.groupActivity.findUnique({
      where: { id: groupActivityId, isDeleted: false },
      include: { escapeRoomConfig: true },
    })
    // SECURITY: only a published group activity may back an escape attempt.
    if (!ga || ga.status !== DB.PublicationStatus.PUBLISHED)
      throw new GraphQLError('Group activity not found')
    isEscapeRoom = !!ga.escapeRoomConfig
    timeLimit = ga.escapeRoomConfig?.timeLimit ?? 3600
    courseId = ga.courseId

    // For group activities, find the participant's group for this course
    const participantGroup = await ctx.prisma.participantGroup.findFirst({
      where: {
        courseId: ga.courseId,
        participants: { some: { id: participantId } },
      },
    })
    if (!participantGroup) {
      throw new GraphQLError('Participant is not in a group for this course')
    }
    groupId = participantGroup.id
  } else if (elementBlockId) {
    const block = await ctx.prisma.elementBlock.findUnique({
      where: { id: elementBlockId },
      include: { escapeRoomConfig: true, liveQuiz: true },
    })
    // SECURITY: ElementBlock.id is a globally sequential, guessable integer.
    // Require the block to be ACTIVE so a participant cannot start a timer or
    // pull hint text for a scheduled (not-yet-activated) live-quiz block.
    if (!block || block.status !== DB.ElementBlockStatus.ACTIVE)
      throw new GraphQLError('Block not found')
    isEscapeRoom = !!block.escapeRoomConfig
    timeLimit = block.escapeRoomConfig?.timeLimit ?? 300
    courseId = block.liveQuiz.courseId
  } else {
    throw new GraphQLError('Invalid request: must specify an activity ID')
  }

  if (!isEscapeRoom) {
    throw new GraphQLError(
      'This activity is not configured for escape room mode'
    )
  }

  // Verify course enrollment (participation)
  if (courseId) {
    const participation = await ctx.prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId,
          participantId,
        },
      },
    })
    if (!participation) {
      throw new GraphQLError(
        'You are not enrolled in the course associated with this activity'
      )
    }
  }

  // 2. Query for existing attempt (check if running or complete)
  const attemptWhere: DB.Prisma.EscapeRoomAttemptWhereUniqueInput = groupId
    ? {
        groupId_groupActivityId: {
          groupId,
          groupActivityId: groupActivityId!,
        },
      }
    : practiceQuizId
      ? { participantId_practiceQuizId: { participantId, practiceQuizId } }
      : microLearningId
        ? {
            participantId_microLearningId: {
              participantId,
              microLearningId: microLearningId!,
            },
          }
        : {
            participantId_elementBlockId: {
              participantId,
              elementBlockId: elementBlockId!,
            },
          }
  const existingAttempt = await ctx.prisma.escapeRoomAttempt.findUnique({
    where: attemptWhere,
  })

  if (existingAttempt) {
    if (existingAttempt.status === DB.EscapeRoomStatus.IN_PROGRESS) {
      // Check expiration (plus 5 seconds grace period)
      const elapsed =
        (Date.now() - new Date(existingAttempt.startedAt).getTime()) / 1000
      const currentPenalty = existingAttempt.penaltySeconds
      const totalLimit = existingAttempt.timeLimit - currentPenalty
      if (elapsed > totalLimit + ESCAPE_ROOM_GRACE_SECONDS) {
        // Expired! Update status
        return await ctx.prisma.escapeRoomAttempt.update({
          where: { id: existingAttempt.id },
          data: { status: DB.EscapeRoomStatus.EXPIRED },
        })
      }
    }
    return existingAttempt
  }

  // 3. Create new attempt
  try {
    return await ctx.prisma.escapeRoomAttempt.upsert({
      where: attemptWhere,
      update: {},
      create: {
        timeLimit,
        penaltySeconds: 0,
        hintsUsed: [],
        status: DB.EscapeRoomStatus.IN_PROGRESS,
        participantId: groupId ? null : participantId,
        groupId,
        practiceQuizId,
        microLearningId,
        groupActivityId,
        elementBlockId,
      },
    })
  } catch (error) {
    // Prisma's emulated upsert can still race under the driver adapter: both
    // callers observe no row, then one loses the unique-key insert. The winner
    // is the shared attempt both callers intended to start, so read it back.
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return await ctx.prisma.escapeRoomAttempt.findUniqueOrThrow({
        where: attemptWhere,
      })
    }
    throw error
  }
}

interface RequestEscapeRoomHintArgs {
  practiceQuizId?: string | null
  microLearningId?: string | null
  groupActivityId?: string | null
  elementBlockId?: number | null
  instanceId: number
}

export interface EscapeRoomHintResult {
  hint: string
  attempt: DB.EscapeRoomAttempt
}

// SECURITY: This is the ONLY code path that reveals an element's escapeRoomHint
// text. The hint is stored in ElementInstance.options and is never exposed via
// any participant-facing query field (only the derived `hasHint` boolean is).
// A hint is revealed only after verifying: (1) the caller is a PARTICIPANT,
// (2) they own a running (IN_PROGRESS, non-expired, non-locked) attempt for the
// activity, and (3) the requested instance actually belongs to that activity.
export async function requestEscapeRoomHint(
  {
    practiceQuizId,
    microLearningId,
    groupActivityId,
    elementBlockId,
    instanceId,
  }: RequestEscapeRoomHintArgs,
  ctx: ContextWithUser
): Promise<EscapeRoomHintResult> {
  if (!ctx.user?.sub || ctx.user.role !== DB.UserRole.PARTICIPANT) {
    throw new GraphQLError('Only participants can request escape room hints', {
      extensions: { code: 'ESCAPE_ROOM_FORBIDDEN' },
    })
  }

  const participantId = ctx.user.sub

  // SECURITY: require exactly one activity ID. The settings-identification chain
  // below and the belongsToActivity check further down each pick the first
  // truthy ID in their own order; if a caller supplies two IDs, those orders
  // diverge and the ownership check could be satisfied against a different
  // activity than the one that gated auth — leaking a hint for an unrelated,
  // unenrolled activity. Enforcing a single ID collapses both chains to it.
  const activityIdCount = [
    practiceQuizId,
    microLearningId,
    groupActivityId,
    elementBlockId,
  ].filter((v) => v != null).length
  if (activityIdCount !== 1) {
    throw new GraphQLError('Exactly one activity ID must be specified', {
      extensions: { code: 'ESCAPE_ROOM_FORBIDDEN' },
    })
  }

  // 1. Identify active settings (mirrors startEscapeRoomAttempt)
  let isEscapeRoom = false
  let hintPenalty: number
  let groupId: string | null = null
  let courseId: string | null = null

  if (practiceQuizId) {
    const pq = await ctx.prisma.practiceQuiz.findUnique({
      where: { id: practiceQuizId, isDeleted: false },
      include: { escapeRoomConfig: true },
    })
    // SECURITY: an unpublished quiz must be indistinguishable from a missing
    // one so participants cannot probe for / start escape attempts early.
    if (!pq || pq.status !== DB.PublicationStatus.PUBLISHED)
      throw new GraphQLError('Practice quiz not found')
    isEscapeRoom = !!pq.escapeRoomConfig
    hintPenalty = pq.escapeRoomConfig?.hintPenalty ?? 30
    courseId = pq.courseId
  } else if (microLearningId) {
    const ml = await ctx.prisma.microLearning.findUnique({
      where: { id: microLearningId, isDeleted: false },
      include: { escapeRoomConfig: true },
    })
    // SECURITY: only a published microlearning may back an escape attempt;
    // hide the not-yet-published state behind the same not-found error.
    if (!ml || ml.status !== DB.PublicationStatus.PUBLISHED)
      throw new GraphQLError('Microlearning not found')
    isEscapeRoom = !!ml.escapeRoomConfig
    hintPenalty = ml.escapeRoomConfig?.hintPenalty ?? 30
    courseId = ml.courseId
  } else if (groupActivityId) {
    const ga = await ctx.prisma.groupActivity.findUnique({
      where: { id: groupActivityId, isDeleted: false },
      include: { escapeRoomConfig: true },
    })
    // SECURITY: only a published group activity may back an escape attempt.
    if (!ga || ga.status !== DB.PublicationStatus.PUBLISHED)
      throw new GraphQLError('Group activity not found')
    isEscapeRoom = !!ga.escapeRoomConfig
    hintPenalty = ga.escapeRoomConfig?.hintPenalty ?? 30
    courseId = ga.courseId

    const participantGroup = await ctx.prisma.participantGroup.findFirst({
      where: {
        courseId: ga.courseId,
        participants: { some: { id: participantId } },
      },
    })
    if (!participantGroup) {
      throw new GraphQLError('Participant is not in a group for this course')
    }
    groupId = participantGroup.id
  } else if (elementBlockId) {
    const block = await ctx.prisma.elementBlock.findUnique({
      where: { id: elementBlockId },
      include: { escapeRoomConfig: true, liveQuiz: true },
    })
    // SECURITY: ElementBlock.id is a globally sequential, guessable integer.
    // Require the block to be ACTIVE so a participant cannot start a timer or
    // pull hint text for a scheduled (not-yet-activated) live-quiz block.
    if (!block || block.status !== DB.ElementBlockStatus.ACTIVE)
      throw new GraphQLError('Block not found')
    isEscapeRoom = !!block.escapeRoomConfig
    hintPenalty = block.escapeRoomConfig?.hintPenalty ?? 30
    courseId = block.liveQuiz.courseId
  } else {
    throw new GraphQLError('Invalid request: must specify an activity ID')
  }

  if (!isEscapeRoom) {
    throw new GraphQLError(
      'This activity is not configured for escape room mode'
    )
  }

  // Verify course enrollment (participation)
  if (courseId) {
    const participation = await ctx.prisma.participation.findUnique({
      where: { courseId_participantId: { courseId, participantId } },
    })
    if (!participation) {
      throw new GraphQLError(
        'You are not enrolled in the course associated with this activity',
        { extensions: { code: 'ESCAPE_ROOM_FORBIDDEN' } }
      )
    }
  }

  // 2. Load the owning attempt (must already exist and be running)
  const attempt = await ctx.prisma.escapeRoomAttempt.findUnique({
    where: groupId
      ? {
          groupId_groupActivityId: {
            groupId,
            groupActivityId: groupActivityId!,
          },
        }
      : practiceQuizId
        ? { participantId_practiceQuizId: { participantId, practiceQuizId } }
        : microLearningId
          ? {
              participantId_microLearningId: {
                participantId,
                microLearningId: microLearningId!,
              },
            }
          : {
              participantId_elementBlockId: {
                participantId,
                elementBlockId: elementBlockId!,
              },
            },
  })

  if (!attempt || attempt.status !== DB.EscapeRoomStatus.IN_PROGRESS) {
    throw new GraphQLError(
      'No active escape room attempt found for this activity',
      { extensions: { code: 'ESCAPE_ROOM_NO_ATTEMPT' } }
    )
  }

  if (attempt.lockoutUntil && dayjs().isBefore(dayjs(attempt.lockoutUntil))) {
    throw new GraphQLError(
      'You are locked out due to a recent incorrect attempt',
      {
        extensions: {
          code: 'ESCAPE_ROOM_LOCKOUT',
          lockoutUntil: attempt.lockoutUntil.toISOString(),
          lockoutRemainingSeconds: getRemainingSecondsUntil(
            attempt.lockoutUntil
          ),
        },
      }
    )
  }

  const elapsed = (Date.now() - new Date(attempt.startedAt).getTime()) / 1000
  const totalLimit = attempt.timeLimit - attempt.penaltySeconds
  if (elapsed > totalLimit + ESCAPE_ROOM_GRACE_SECONDS) {
    await ctx.prisma.escapeRoomAttempt.update({
      where: { id: attempt.id },
      data: { status: DB.EscapeRoomStatus.EXPIRED },
    })
    throw new GraphQLError('Escape room time has expired', {
      extensions: { code: 'ESCAPE_ROOM_EXPIRED' },
    })
  }

  // 3. Load the instance and verify it belongs to THIS activity, then read hint
  const instance = await ctx.prisma.elementInstance.findUnique({
    where: { id: instanceId },
    include: { elementStack: true },
  })
  if (!instance) throw new GraphQLError('Element instance not found')

  const belongsToActivity = elementBlockId
    ? instance.elementBlockId === elementBlockId
    : practiceQuizId
      ? instance.elementStack?.practiceQuizId === practiceQuizId
      : microLearningId
        ? instance.elementStack?.microLearningId === microLearningId
        : instance.elementStack?.groupActivityId === groupActivityId
  if (!belongsToActivity) {
    throw new GraphQLError('Element does not belong to this activity', {
      extensions: { code: 'ESCAPE_ROOM_FORBIDDEN' },
    })
  }

  if (practiceQuizId || microLearningId) {
    const stacks = await ctx.prisma.elementStack.findMany({
      where: practiceQuizId
        ? { practiceQuizId }
        : { microLearningId: microLearningId! },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        order: true,
        elements: {
          select: {
            id: true,
            elementType: true,
            responses: {
              where: { participantId },
              select: { lastResponseCorrectness: true },
            },
          },
        },
      },
    })
    const currentStack = stacks.find(
      (stack) => !isEscapeRoomStackCleared(stack.elements)
    )
    if (!currentStack || instance.elementStackId !== currentStack.id) {
      throw new GraphQLError(
        'You must answer all preceding questions correctly before requesting this hint',
        { extensions: { code: 'ESCAPE_ROOM_GATED' } }
      )
    }
  } else if (elementBlockId) {
    const blockInstances = await ctx.prisma.elementInstance.findMany({
      where: {
        elementBlockId,
        elementType: { in: [...ESCAPE_ROOM_SUPPORTED_ELEMENT_TYPES] },
      },
      orderBy: { order: 'asc' },
      select: { id: true },
    })
    const clearedInstanceIds = new Set(
      await ctx.redisExec.smembers(`escape-attempt:${attempt.id}:cleared`)
    )
    const currentInstance = getCurrentEscapeRoomInstance(
      blockInstances,
      clearedInstanceIds
    )
    if (currentInstance?.id !== instanceId) {
      throw new GraphQLError(
        'You must answer all preceding questions correctly before requesting this hint',
        { extensions: { code: 'ESCAPE_ROOM_GATED' } }
      )
    }
  }

  const hint = instance.options.escapeRoomHint
  if (!hint) {
    throw new GraphQLError('No hint available for this element', {
      extensions: { code: 'ESCAPE_ROOM_NO_HINT' },
    })
  }

  // 4. Charge the time penalty exactly once, atomically. A read-then-write here
  // would lose updates when two members of a group activity (which share a
  // single attempt row) request different hints concurrently: both would read
  // the same penaltySeconds/hintsUsed and the later write would clobber the
  // earlier one, under-charging now and re-charging the "lost" hint later. This
  // single statement appends the instance key and increments the penalty only
  // when the key is not already present; Postgres re-evaluates the guard under
  // the row lock, making the charge race-free and idempotent. Raw SQL is used
  // because Prisma cannot append to a JSON array atomically.
  const hintKey = String(instanceId)
  await ctx.prisma.$executeRaw`
    UPDATE "EscapeRoomAttempt"
    SET "penaltySeconds" = "penaltySeconds" + ${hintPenalty},
        "hintsUsed" = "hintsUsed" || ${JSON.stringify([hintKey])}::jsonb
    WHERE "id" = ${attempt.id}::uuid
      AND NOT ("hintsUsed" @> ${JSON.stringify([hintKey])}::jsonb)
  `

  const updatedAttempt = await ctx.prisma.escapeRoomAttempt.findUniqueOrThrow({
    where: { id: attempt.id },
  })

  return { hint, attempt: updatedAttempt }
}

interface ResetEscapeRoomAttemptArgs {
  practiceQuizId?: string | null
  microLearningId?: string | null
  groupActivityId?: string | null
  elementBlockId?: number | null
  participantId?: string | null
  groupId?: string | null
}

export async function resetEscapeRoomAttempt(
  {
    practiceQuizId,
    microLearningId,
    groupActivityId,
    elementBlockId,
    participantId,
    groupId,
  }: ResetEscapeRoomAttemptArgs,
  ctx: ContextWithUser
) {
  const isLecturer =
    ctx.user?.role === DB.UserRole.USER || ctx.user?.role === DB.UserRole.ADMIN

  if (isLecturer) {
    const checks: any[] = []
    if (practiceQuizId) {
      checks.push({
        practiceQuizId,
        minimumPermissionLevel: DB.PermissionLevel.WRITE,
      })
    }
    if (microLearningId) {
      checks.push({
        microLearningId,
        minimumPermissionLevel: DB.PermissionLevel.WRITE,
      })
    }
    if (groupActivityId) {
      checks.push({
        groupActivityId,
        minimumPermissionLevel: DB.PermissionLevel.WRITE,
      })
    }
    if (elementBlockId) {
      const block = await ctx.prisma.elementBlock.findUnique({
        where: { id: elementBlockId },
        select: { liveQuizId: true },
      })
      if (block) {
        checks.push({
          liveQuizId: block.liveQuizId,
          minimumPermissionLevel: DB.PermissionLevel.WRITE,
        })
      }
    }

    if (checks.length > 0) {
      const hasAccess = await checkAccess(checks, ctx)
      if (!hasAccess) {
        throw new GraphQLError('You do not have write access to this activity')
      }
    }
  }

  // Reset is a lecturer-only recovery action. Participant self-reset is
  // intentionally not allowed: it would delete the participant's own
  // QuestionResponse rows (enabling unlimited retries / XP re-farming and a
  // fresh full countdown) and skipped the course-enrollment check that
  // startEscapeRoomAttempt enforces.
  if (!isLecturer) {
    throw new GraphQLError('Only lecturers can reset escape room attempts')
  }

  const finalParticipantId = participantId
  const finalGroupId = groupId

  const attemptWhere =
    finalGroupId && groupActivityId
      ? { groupId_groupActivityId: { groupId: finalGroupId, groupActivityId } }
      : practiceQuizId
        ? {
            participantId_practiceQuizId: {
              participantId: finalParticipantId!,
              practiceQuizId,
            },
          }
        : microLearningId
          ? {
              participantId_microLearningId: {
                participantId: finalParticipantId!,
                microLearningId: microLearningId!,
              },
            }
          : {
              participantId_elementBlockId: {
                participantId: finalParticipantId!,
                elementBlockId: elementBlockId!,
              },
            }

  // 1. Delete EscapeRoomAttempt
  await ctx.prisma.escapeRoomAttempt
    .delete({
      where: attemptWhere as any,
    })
    .catch(() => {})

  // 2. Clear responses / progress
  if (finalGroupId && groupActivityId) {
    await ctx.prisma.groupActivityInstance
      .delete({
        where: {
          groupActivityId_groupId: {
            groupActivityId,
            groupId: finalGroupId,
          },
        },
      })
      .catch(() => {})
  } else if (finalParticipantId) {
    if (practiceQuizId) {
      await ctx.prisma.questionResponse.deleteMany({
        where: {
          participantId: finalParticipantId,
          elementInstance: {
            elementStack: { practiceQuizId },
          },
        },
      })
    } else if (microLearningId) {
      await ctx.prisma.questionResponse.deleteMany({
        where: {
          participantId: finalParticipantId,
          elementInstance: {
            elementStack: { microLearningId },
          },
        },
      })
    }
  }

  return true
}
