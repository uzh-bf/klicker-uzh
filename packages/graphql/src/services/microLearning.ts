import * as DB from '@klicker-uzh/prisma/client'
import {
  ActivityType,
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
import {
  activityInputContainsElementType,
  getPermissionBooleans,
} from './activities.js'
import {
  isEscapeRoomStackCleared,
  restoreUsedEscapeRoomHints,
  validateEscapeRoomConfig,
} from './escapeRooms.js'
import { splitActivityInstances } from './liveQuizzes.js'
import { sendTeamsNotification } from './notifications.js'
import { computeStackEvaluation } from './stacks.js'

export async function getMicroLearningData(
  { id }: { id: string },
  ctx: Context
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: {
      id,
      OR: [
        { AND: { status: DB.PublicationStatus.PUBLISHED, isDeleted: false } },
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
            orderBy: {
              order: 'asc',
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  if (!microLearning) return null
  const isOwner =
    ctx.user?.sub &&
    (ctx.user.role === DB.UserRole.USER || ctx.user.role === DB.UserRole.ADMIN)
      ? ctx.user.sub === microLearning.ownerId
      : false

  if (ctx.user?.sub && ctx.user.role === DB.UserRole.PARTICIPANT) {
    const orderedStacks = microLearning.stacks

    let filteredStacks = orderedStacks
    let attempt: DB.EscapeRoomAttempt | null = null
    if (microLearning.escapeRoomConfig) {
      attempt = await ctx.prisma.escapeRoomAttempt.findUnique({
        where: {
          participantId_microLearningId: {
            participantId: ctx.user.sub,
            microLearningId: microLearning.id,
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
      ...microLearning,
      isOwner,
      stacks: restoreUsedEscapeRoomHints(filteredStacks, attempt?.hintsUsed),
    }
  }

  // Escape room content must never reach a non-participant, non-owner caller
  // (the participant path above masks locked stacks; this covers anonymous /
  // temporary callers that fall through without an attempt).
  if (microLearning.escapeRoomConfig && !isOwner) {
    return { ...microLearning, isOwner, stacks: [] }
  }

  return {
    ...microLearning,
    isOwner,
  }
}

export async function getMicroLearningEvaluation(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: {
      id,
      status: {
        in: [DB.PublicationStatus.PUBLISHED, DB.PublicationStatus.ENDED],
      },
      isDeleted: false,
    },
    include: {
      stacks: {
        include: {
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  if (!microLearning) {
    return null
  }

  // compute evaluation
  const stackEvaluation = computeStackEvaluation(microLearning.stacks)

  return {
    id: microLearning.id,
    name: microLearning.name,
    displayName: microLearning.displayName,
    description: microLearning.description,
    courseId: microLearning.courseId,
    results: stackEvaluation,
  }
}

export async function getSingleMicroLearning(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
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

  return microLearning
}

export async function getCoursePublishedMicroLearnings(
  { courseId }: { courseId: string },
  ctx: Context
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
    include: {
      microLearnings: {
        where: { status: DB.PublicationStatus.PUBLISHED, isDeleted: false },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  return course?.microLearnings
    ? (course.microLearnings.map((quiz) => ({
        ...quiz,
        course: {
          ...course,
          microLearnings: undefined, // remove microLearnings to avoid circular reference
        },
      })) ?? [])
    : []
}

export async function markMicroLearningCompleted(
  { courseId, id }: { courseId: string; id: string },
  ctx: ContextWithUser
) {
  return ctx.prisma.participation.update({
    where: {
      courseId_participantId: {
        courseId,
        participantId: ctx.user.sub,
      },
    },
    data: {
      completedMicroLearnings: {
        push: id,
      },
    },
  })
}

interface ManipulateMicroLearningArgs {
  id?: string
  name: string
  displayName: string
  description?: string | null
  stacks: ElementStackInput[]
  courseId: string
  multiplier: number
  startDate: Date
  endDate: Date
  isEscapeRoom?: boolean | null
  escapeRoomTimeLimit?: number | null
  escapeRoomHintPenalty?: number | null
  escapeRoomIntroText?: string | null
}

export async function manipulateMicroLearning(
  {
    id,
    name,
    displayName,
    description,
    stacks,
    courseId,
    multiplier,
    startDate,
    endDate,
    isEscapeRoom,
    escapeRoomTimeLimit,
    escapeRoomHintPenalty,
    escapeRoomIntroText,
  }: ManipulateMicroLearningArgs,
  ctx: ContextWithUser
) {
  if (isEscapeRoom) {
    validateEscapeRoomConfig({
      timeLimit: escapeRoomTimeLimit ?? 3600,
      hintPenalty: escapeRoomHintPenalty ?? 120,
    })
  }

  // in EDIT mode - validate that the microlearning exists and is not published
  let existingActivity: DB.MicroLearning | null = null
  if (id) {
    existingActivity = await ctx.prisma.microLearning.findUnique({
      where: {
        id,
        isDeleted: false,
      },
    })

    if (!existingActivity) {
      throw new GraphQLError('Microlearning not found')
    }
    if (
      existingActivity.status === DB.PublicationStatus.PUBLISHED ||
      existingActivity.status === DB.PublicationStatus.ENDED
    ) {
      throw new GraphQLError('Cannot edit a published or ended microlearning')
    }
  }

  // get the course to which the microlearning should be assigned
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
        elementStack: {
          microLearningId: id,
        },
      },
    })

    const stacks = await ctx.prisma.elementStack.findMany({
      where: {
        microLearningId: id,
      },
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
    scheduledStartAt: dayjs(startDate).toDate(),
    scheduledEndAt: dayjs(endDate).toDate(),
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
      create: stacks.map((stack) => {
        return {
          type: DB.ElementStackType.MICROLEARNING,
          order: stack.order,
          displayName: stack.displayName?.trim() ?? '',
          description: stack.description ?? '',
          elements: {
            connectOrCreate: stack.elements.map((instance) =>
              getActivityInstanceConnectOrCreate({
                instance,
                instanceType: DB.ElementInstanceType.MICROLEARNING,
                activityMultiplier: multiplier,
                persistentInstances,
                duplicationInstances,
                elementMap,
                userId: ctx.user.sub,
              })
            ),
          },
        }
      }),
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
        where: {
          id: { in: instancesToDelete },
        },
      })

      // disconnect all instances that should be kept in edit mode and set new order value (to satisfy uniqueness constraints)
      for (const instance of persistentInstances) {
        const elementMultiplier =
          'pointsMultiplier' in instance.elementData
            ? ((instance.elementData.pointsMultiplier as number) ?? 1)
            : 1

        await prisma.elementInstance.update({
          where: {
            id: instance.id,
          },
          data: {
            elementStackId: null,
            order: persistentInstanceOrderMap[instance.id],
            options: {
              ...instance.options,
              ...getEscapeRoomHintUpdate(
                persistentInputs.get(instance.id)?.escapeRoomHint
              ),
              pointsMultiplier: multiplier * elementMultiplier,
            },
          },
        })
      }

      // delete all stacks
      await prisma.elementStack.deleteMany({
        where: {
          id: { in: stacksToDelete },
        },
      })

      if (!isEscapeRoom && id) {
        await prisma.escapeRoomConfig
          .delete({
            where: { microLearningId: id },
          })
          .catch(() => {})
      }

      const upsertedMicrolearning = await prisma.microLearning.upsert({
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
        { microLearningId: upsertedMicrolearning.id },
        prisma
      )

      return upsertedMicrolearning
    },
    { timeout: 60000 }
  )

  ctx.emitter.emit('invalidate', {
    typename: 'MicroLearning',
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
    type: ActivityType.MICRO_LEARNING,
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
    scheduledStartAt: activity.scheduledStartAt,
    scheduledEndAt: activity.scheduledEndAt,
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

export async function publishMicroLearning(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: { id, isDeleted: false, status: DB.PublicationStatus.DRAFT },
  })

  if (!microLearning) {
    return null
  }

  if (microLearning.scheduledStartAt > new Date()) {
    // schedule the task to publish the microlearning at the scheduled start date (as well as a completion task)
    try {
      // schedule hatchet task for automated publication
      const publicationTask =
        await ctx.tasks.publishScheduledMicroLearning.schedule(
          microLearning.scheduledStartAt,
          { microLearningId: microLearning.id }
        )
      const publicationTaskId = publicationTask.metadata.id

      // schedule hatchet task for automated ending
      const completionTask = await ctx.tasks.endExpiredMicroLearning.schedule(
        microLearning.scheduledEndAt,
        { microLearningId: microLearning.id }
      )
      const completionTaskId = completionTask.metadata.id

      // set the status of the microlearning to scheduled and store the hatchet task ID
      const updatedMicroLearning = await ctx.prisma.microLearning.update({
        where: { id },
        data: {
          status: DB.PublicationStatus.SCHEDULED,
          scheduledPublicationTaskId: publicationTaskId,
          scheduledCompletionTaskId: completionTaskId,
        },
      })

      ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })
      return updatedMicroLearning
    } catch (error) {
      console.error(`Failed to schedule task for microlearning ${id}:`, error)
      return null
    }
  } else if (microLearning.scheduledEndAt < new Date()) {
    // if the scheduled end date is in the past, set the status to ended
    const updatedMicroLearning = await ctx.prisma.microLearning.update({
      where: { id },
      data: { status: DB.PublicationStatus.ENDED },
    })

    ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })
    return updatedMicroLearning
  }

  // if the start date is in the past, but the end date is in the future, schedule the completion task
  const completionTask = await ctx.tasks.endExpiredMicroLearning.schedule(
    microLearning.scheduledEndAt,
    { microLearningId: microLearning.id }
  )
  const completionTaskId = completionTask.metadata.id

  // if the start date is in the past, directly publish the microlearning
  const updatedMicroLearning = await ctx.prisma.microLearning.update({
    where: { id },
    data: {
      status: DB.PublicationStatus.PUBLISHED,
      scheduledCompletionTaskId: completionTaskId,
    },
  })

  ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })
  return updatedMicroLearning
}

export async function unpublishMicroLearning(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: { id, isDeleted: false, status: DB.PublicationStatus.SCHEDULED },
  })

  if (!microLearning) {
    return null
  }

  // remove the scheduled hatchet publication task, if it exists
  if (microLearning.scheduledPublicationTaskId) {
    try {
      await ctx.hatchet.scheduled.delete(
        microLearning.scheduledPublicationTaskId
      )
    } catch (error) {
      console.error(
        `Failed to delete scheduled publication task for microlearning ${id}:`,
        error
      )
    }
  }

  // remove the scheduled hatchet completion task, if it exists
  if (microLearning.scheduledCompletionTaskId) {
    try {
      await ctx.hatchet.scheduled.delete(
        microLearning.scheduledCompletionTaskId
      )
    } catch (error) {
      console.error(
        `Failed to delete scheduled completion task for microlearning ${id}:`,
        error
      )
    }
  }

  // reset the status of the microlearning to draft
  const updatedMicroLearning = await ctx.prisma.microLearning.update({
    where: { id, status: DB.PublicationStatus.SCHEDULED },
    data: {
      status: DB.PublicationStatus.DRAFT,
      scheduledPublicationTaskId: null,
      scheduledCompletionTaskId: null,
    },
    include: { stacks: { include: { elements: true } } },
  })

  ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })
  return updatedMicroLearning
}

export async function extendMicroLearning(
  { id, endDate }: { id: string; endDate: Date },
  ctx: ContextWithUser
) {
  // check that the new end date lies in the future
  if (endDate < new Date()) {
    return null
  }

  const microLearning = await ctx.prisma.microLearning.update({
    where: { id, scheduledEndAt: { gt: new Date() }, isDeleted: false },
    data: { scheduledEndAt: endDate },
  })

  if (!microLearning) {
    return null
  }

  // remove the previous scheduled completion task, if it exists and create a new one
  if (microLearning.scheduledCompletionTaskId) {
    try {
      await ctx.hatchet.scheduled.delete(
        microLearning.scheduledCompletionTaskId
      )
    } catch (error) {
      console.error(
        `Failed to delete scheduled completion task for microlearning ${id}:`,
        error
      )
    }
  }
  const completionTask = await ctx.tasks.endExpiredMicroLearning.schedule(
    endDate,
    { microLearningId: microLearning.id }
  )

  // store the task ID of the completion task on the microlearning
  const updatedMicroLearning = await ctx.prisma.microLearning.update({
    where: { id },
    data: { scheduledCompletionTaskId: completionTask.metadata.id },
  })

  return updatedMicroLearning
}

export async function endMicroLearning(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const updatedMicroLearning = await ctx.prisma.microLearning.update({
    where: { id, status: DB.PublicationStatus.PUBLISHED, isDeleted: false },
    data: { status: DB.PublicationStatus.ENDED, scheduledEndAt: new Date() },
  })

  // remove the scheduled completion task, if it exists
  if (updatedMicroLearning.scheduledCompletionTaskId) {
    try {
      await ctx.hatchet.scheduled.delete(
        updatedMicroLearning.scheduledCompletionTaskId
      )
    } catch (error) {
      console.error(
        `Failed to delete scheduled completion task for microlearning ${id}:`,
        error
      )
    }
  }

  ctx.pubSub.publish('microLearningEnded', updatedMicroLearning)
  return updatedMicroLearning
}

export async function changeMicroLearningName(
  { id, name, displayName }: { id: string; name: string; displayName: string },
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: { id },
  })

  if (!microLearning) return false

  // if both name and displayname remain unchanged, skip the update
  if (
    microLearning.name === name &&
    microLearning.displayName === displayName
  ) {
    return true
  }

  try {
    await ctx.prisma.microLearning.update({
      where: { id },
      data: {
        name,
        displayName,
        reviewStatus:
          microLearning.reviewStatus === DB.ReviewStatus.REVIEWED
            ? DB.ReviewStatus.MODIFIED_AFTER_REVIEW
            : undefined,
      },
    })

    ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })
    return true
  } catch (error) {
    console.error('Error changing microlearning name:', error)
    return false
  }
}

export async function getMicroLearningSummary(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: { id },
    include: { stacks: { include: { elements: true } } },
  })

  if (!microLearning) {
    return null
  }

  const { responses, anonymousResponses } = microLearning.stacks.reduce(
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

export async function deleteMicroLearning(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: { id },
    include: { responses: true, stacks: { include: { elements: true } } },
  })

  if (!microLearning) {
    return null
  }

  // if the microlearning is not published yet or has no responses -> hard deletion
  // anonymous results are ignored, since deleting them does not have an impage on data consistency
  if (
    microLearning.status === DB.PublicationStatus.DRAFT ||
    microLearning.status === DB.PublicationStatus.SCHEDULED ||
    microLearning.responses.length === 0
  ) {
    const deletedItem = await ctx.prisma.microLearning.delete({ where: { id } })

    // remove the scheduled publication task, if it exists (should only exist for scheduled microlearnings)
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
          `Failed to delete scheduled publication task for microlearning ${id}:`,
          error
        )
      }
    }

    // remove the scheduled completion task, if it exists (should only exist for scheduled/published microlearnings)
    if (
      deletedItem.scheduledCompletionTaskId &&
      (deletedItem.status === DB.PublicationStatus.SCHEDULED ||
        deletedItem.status === DB.PublicationStatus.PUBLISHED)
    ) {
      try {
        await ctx.hatchet.scheduled.delete(
          deletedItem.scheduledCompletionTaskId
        )
      } catch (error) {
        console.error(
          `Failed to delete scheduled completion task for microlearning ${id}:`,
          error
        )
      }
    }

    // update derived permissions on all linked elements (to make sure that invalid derived permissions are also removed)
    // this case cannot be handled by the permissions module, since the microlearning is already hard deleted
    // access requests need to be updated as well, since the derived permissions on elements might have changed
    await propagateActivityToElements(
      { stacks: microLearning.stacks, updateAccessRequests: true },
      ctx.prisma
    )

    ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })

    return deletedItem
  } else {
    // if the microlearning is published and has responses -> soft deletion
    const updatedMicroLearning = await ctx.prisma.$transaction(
      async (prisma) => {
        // remove the scheduled completion task, if it exists (should only exist for published microlearnings)
        if (
          microLearning.status === DB.PublicationStatus.PUBLISHED &&
          microLearning.scheduledCompletionTaskId
        ) {
          try {
            await ctx.hatchet.scheduled.delete(
              microLearning.scheduledCompletionTaskId
            )
          } catch (error) {
            console.error(
              `Failed to delete scheduled completion task for microlearning ${id}:`,
              error
            )
          }
        }

        const updatedMicroLearning = await prisma.microLearning.update({
          where: { id },
          data: {
            isDeleted: true,
            scheduledCompletionTaskId: null,
            directPermissions: { deleteMany: {} }, // delete all direct permissions on the activity
          },
        })

        // update derived permissions for this microlearning (after soft deletion)
        // this function call automatically includes permission updates for all linked elements
        await recomputeDerivedPermissions(
          { microLearningId: updatedMicroLearning.id },
          prisma
        )

        return updatedMicroLearning
      },
      { timeout: 60000 }
    )

    ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })
    return updatedMicroLearning
  }
}

export async function removeMicroLearning(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  // verify that the user has a direct permission on the specified microlearning
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: { id, directPermissions: { some: { userId: ctx.user.sub } } },
  })

  if (!microLearning) {
    return null
  }

  // remove direct permission and recompute derived permissions for this microlarning and user
  await ctx.prisma.$transaction(
    async (prisma) => {
      // remove the direct permission
      await prisma.microLearning.update({
        where: { id },
        data: { directPermissions: { deleteMany: { userId: ctx.user.sub } } },
      })

      // create an audit log entry for the removal
      await prisma.auditLogEntry.create({
        data: {
          type: DB.AuditLogType.PERMISSION_REMOVED,
          objectId: String(id),
          objectType: DB.ObjectType.MICRO_LEARNING,
          sourceUserId: ctx.user.sub,
          message: `User ${ctx.user.sub} removed own permission on ${DB.ObjectType.MICRO_LEARNING} (ID: ${id})`,
        },
      })

      // recompute derived permissions for this microlearning and user
      await recomputeDerivedPermissions(
        { microLearningId: id, userId: ctx.user.sub },
        prisma
      )
    },
    { timeout: 60000 }
  )

  ctx.emitter.emit('invalidate', {
    typename: 'MicroLearning',
    id,
  })

  return id
}

export const handleEndExpiredMicroLearning: HatchetHandlers['handleEndExpiredMicroLearning'] =
  async ({ microLearningId }, globalCtx) => {
    try {
      const microLearning = await globalCtx.prisma.microLearning.findUnique({
        where: {
          id: microLearningId,
          isDeleted: false,
          status: DB.PublicationStatus.PUBLISHED,
          scheduledEndAt: { lte: new Date() },
        },
      })

      if (!microLearning) {
        await sendTeamsNotification({
          scope: 'hatchet/microlearning-end',
          text: `Microlearning with ID ${microLearningId} not found or scheduled end time is not in the past yet.`,
        })
        throw new Error(
          `Microlearning with ID ${microLearningId} not found or scheduled end time is not in the past yet.`
        )
      }

      // end the microlearning
      const updatedMicroLearning = await globalCtx.prisma.microLearning.update({
        where: { id: microLearningId },
        data: { status: DB.PublicationStatus.ENDED },
      })

      await sendTeamsNotification({
        scope: 'hatchet/microlearning-end',
        text: `Successfully ended expired microlearning ${updatedMicroLearning.id}`,
      })

      // publish the event to subscribers
      globalCtx.pubSub.publish('microLearningEnded', updatedMicroLearning)
      globalCtx.emitter.emit('invalidate', {
        typename: 'MicroLearning',
        id: updatedMicroLearning.id,
      })

      return true
    } catch (error) {
      console.error('Error ending expired microlearning:', error)
      await sendTeamsNotification({
        scope: 'hatchet/microlearning-end',
        text: `Error ending microlearning with ID ${microLearningId}: ${error}`,
      })
      throw error // rethrow to allow Hatchet to handle retries
    }
  }

export const handlePublishScheduledMicroLearning: HatchetHandlers['handlePublishScheduledMicroLearning'] =
  async ({ microLearningId }, globalCtx) => {
    try {
      // check if the microlearning exists and if its start date is in the past
      const microLearning = await globalCtx.prisma.microLearning.findUnique({
        where: {
          id: microLearningId,
          scheduledStartAt: { lte: new Date() },
          status: DB.PublicationStatus.SCHEDULED,
        },
      })

      if (!microLearning) {
        await sendTeamsNotification({
          scope: 'hatchet/microlearning-start',
          text: `Microlearning with ID ${microLearningId} not found or scheduled start time is not in the past yet.`,
        })
        throw new Error(
          `Microlearning with ID ${microLearningId} not found or scheduled start time is not in the past yet.`
        )
      }

      // publish the microlearning
      await globalCtx.prisma.microLearning.update({
        where: { id: microLearningId },
        data: { status: DB.PublicationStatus.PUBLISHED },
      })

      // send a teams notification
      await sendTeamsNotification({
        scope: 'graphql/publishScheduledMicroLearnings',
        text: `Successfully published scheduled microlearning ${microLearning.id}`,
      })

      // invalidate the cache for the microlearning
      globalCtx.emitter.emit('invalidate', {
        typename: 'MicroLearning',
        id: microLearning.id,
      })

      return true
    } catch (error) {
      console.error('Error publishing scheduled microlearning:', error)
      await sendTeamsNotification({
        scope: 'hatchet/microlearning-start',
        text: `Error publishing microlearning with ID ${microLearningId}: ${error}`,
      })
      throw error // rethrow to allow Hatchet to handle retries
    }
  }
