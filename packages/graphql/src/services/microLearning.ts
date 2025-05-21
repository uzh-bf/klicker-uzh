import * as DB from '@klicker-uzh/prisma'
import type { ElementStackInput } from '@klicker-uzh/types'
import {
  getActivityInstanceConnectOrCreate,
  propagateActivityToElements,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { v4 as uuidv4 } from 'uuid'
import type { Context, ContextWithUser } from '../lib/context.js'
import { splitActivityInstances } from './liveQuizzes.js'
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

  return microLearning
    ? {
        ...microLearning,
        isOwner:
          ctx.user?.sub &&
          (ctx.user.role === DB.UserRole.USER ||
            ctx.user.role === DB.UserRole.ADMIN)
            ? ctx.user.sub === microLearning.ownerId
            : false,
      }
    : null
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
        course,
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
  }: ManipulateMicroLearningArgs,
  ctx: ContextWithUser
) {
  // in EDIT mode - validate that the microlearning exists and is not published
  if (id) {
    const existingActivity = await ctx.prisma.microLearning.findUnique({
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

  // get required splits of instances based on provided stacks values
  const {
    persistentInstanceIds,
    persistentInstances,
    persistentInstanceOrderMap,
    duplicationInstances,
    elementMap,
  } = await splitActivityInstances({ stacksOrBlocks: stacks }, ctx)

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

  const createOrUpdateJSON = {
    name: name.trim(),
    displayName: displayName.trim(),
    description,
    pointsMultiplier: multiplier,
    scheduledStartAt: dayjs(startDate).toDate(),
    scheduledEndAt: dayjs(endDate).toDate(),
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

  const activity = await ctx.prisma.$transaction(async (prisma) => {
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

    const upsertedMicrolearning = await prisma.microLearning.upsert({
      where: { id: id ?? uuidv4() },
      create: {
        ...createOrUpdateJSON,
        owner: { connect: { id: ctx.user.sub } }, // only connect the owner during activity creation (not editing)!
      },
      update: createOrUpdateJSON,
      include: {
        course: true,
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
  })

  ctx.emitter.emit('invalidate', {
    typename: 'MicroLearning',
    id,
  })

  return activity
}

export async function publishMicroLearning(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: { id, status: DB.PublicationStatus.DRAFT },
  })

  if (!microLearning) {
    return null
  }

  // if the microlearning only starts in the future, set its state to scheduled
  if (microLearning.scheduledStartAt > new Date()) {
    const updatedMicroLearning = await ctx.prisma.microLearning.update({
      where: { id },
      data: { status: DB.PublicationStatus.SCHEDULED },
    })

    ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })
    return updatedMicroLearning
  }

  // if the start date is in the past, directly publish the microlearning
  const updatedMicroLearning = await ctx.prisma.microLearning.update({
    where: { id },
    data: { status: DB.PublicationStatus.PUBLISHED },
  })

  ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })
  return updatedMicroLearning
}

export async function unpublishMicroLearning(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.update({
    where: { id, status: DB.PublicationStatus.SCHEDULED },
    data: { status: DB.PublicationStatus.DRAFT },
    include: { stacks: { include: { elements: true } } },
  })

  ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })
  return microLearning
}

export async function extendMicroLearning(
  { id, endDate }: { id: string; endDate: Date },
  ctx: ContextWithUser
) {
  // check that the new end date lies in the future
  if (endDate < new Date()) {
    return null
  }

  return await ctx.prisma.microLearning.update({
    where: {
      id,
      scheduledEndAt: { gt: new Date() },
      isDeleted: false,
    },
    data: {
      scheduledEndAt: endDate,
    },
  })
}

export async function endMicroLearning(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const updatedMicroLearning = await ctx.prisma.microLearning.update({
    where: {
      id,
      status: DB.PublicationStatus.PUBLISHED,
      isDeleted: false,
    },
    data: {
      status: DB.PublicationStatus.ENDED,
      scheduledEndAt: new Date(),
    },
  })

  ctx.pubSub.publish('microLearningEnded', updatedMicroLearning)
  return updatedMicroLearning
}

export async function changeMicroLearningName(
  { id, name, displayName }: { id: string; name: string; displayName: string },
  ctx: ContextWithUser
) {
  try {
    await ctx.prisma.microLearning.update({
      where: { id },
      data: { name, displayName },
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
        const updated = await prisma.microLearning.update({
          where: { id },
          data: { isDeleted: true },
        })

        // update derived permissions for this microlearning (after soft deletion)
        // this function call automatically includes permission updates for all linked elements
        await recomputeDerivedPermissions(
          { microLearningId: updated.id },
          prisma
        )

        return updated
      }
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
  await ctx.prisma.$transaction(async (prisma) => {
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
  })

  ctx.emitter.emit('invalidate', {
    typename: 'MicroLearning',
    id,
  })

  return id
}
