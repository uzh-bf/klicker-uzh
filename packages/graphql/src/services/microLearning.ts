import {
  ElementInstanceType,
  ElementStackType,
  PublicationStatus,
} from '@klicker-uzh/prisma'
import type { ElementStackInput } from '@klicker-uzh/types'
import {
  getActivityInstanceConnectOrCreate,
  getInitialInstanceResults,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { v4 as uuidv4 } from 'uuid'
import type { Context, ContextWithUser } from '../lib/context.js'
import { splitActivityInstances } from './liveQuizzes.js'
import { computeStackEvaluation } from './stacks.js'

interface GetMicroLearningArgs {
  id: string
}

export async function getMicroLearningData(
  { id }: GetMicroLearningArgs,
  ctx: Context
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: {
      id,
      OR: [
        {
          AND: {
            status: PublicationStatus.PUBLISHED,
            isDeleted: false,
          },
        },
        {
          ownerId: ctx.user?.sub,
        },
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
    ? { ...microLearning, isOwner: ctx.user?.sub === microLearning.ownerId }
    : null
}

export async function getMicroLearningEvaluation(
  {
    id,
  }: {
    id: string
  },
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: {
      id,
      status: {
        in: [PublicationStatus.PUBLISHED, PublicationStatus.ENDED],
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
  { id }: GetMicroLearningArgs,
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
      isDeleted: false,
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
}

interface MarkMicroLearningCompletedArgs {
  courseId: string
  id: string
}

export async function markMicroLearningCompleted(
  { courseId, id }: MarkMicroLearningCompletedArgs,
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
        ownerId: ctx.user.sub,
        isDeleted: false,
      },
    })

    if (!existingActivity) {
      throw new GraphQLError('Microlearning not found')
    }
    if (
      existingActivity.status === PublicationStatus.PUBLISHED ||
      existingActivity.status === PublicationStatus.ENDED
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
          type: ElementStackType.MICROLEARNING,
          order: stack.order,
          displayName: stack.displayName?.trim() ?? '',
          description: stack.description ?? '',
          elements: {
            connectOrCreate: stack.elements.map((instance) =>
              getActivityInstanceConnectOrCreate({
                instance,
                instanceType: ElementInstanceType.MICROLEARNING,
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
    owner: {
      connect: { id: ctx.user.sub },
    },
    course: {
      connect: { id: courseId },
    },
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

    return prisma.microLearning.upsert({
      where: { id: id ?? uuidv4() },
      create: createOrUpdateJSON,
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
  })

  ctx.emitter.emit('invalidate', {
    typename: 'MicroLearning',
    id,
  })

  return activity
}

interface PublishMicroLearningArgs {
  id: string
}

export async function publishMicroLearning(
  { id }: PublishMicroLearningArgs,
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
      status: PublicationStatus.DRAFT,
    },
  })

  if (!microLearning) {
    return null
  }

  // if the microlearning only starts in the future, set its state to scheduled
  if (microLearning.scheduledStartAt > new Date()) {
    const updatedMicroLearning = await ctx.prisma.microLearning.update({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
      data: {
        status: PublicationStatus.SCHEDULED,
      },
    })

    ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })
    return updatedMicroLearning
  }

  // if the start date is in the past, directly publish the microlearning
  const updatedMicroLearning = await ctx.prisma.microLearning.update({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    data: {
      status: PublicationStatus.PUBLISHED,
    },
  })

  ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })
  return updatedMicroLearning
}

export async function unpublishMicroLearning(
  {
    id,
    deleteResponses,
  }: {
    id: string
    deleteResponses: boolean
  },
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
      status: {
        in: [PublicationStatus.PUBLISHED, PublicationStatus.SCHEDULED],
      },
      isDeleted: false,
    },
    include: {
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  if (!microLearning) {
    return null
  }

  const updatedMicroLearning = await ctx.prisma.$transaction(async (prisma) => {
    if (
      microLearning.status === PublicationStatus.PUBLISHED &&
      deleteResponses
    ) {
      // iterate over instances, delete all responses and responseDetails and reset responses
      for (const stack of microLearning.stacks) {
        for (const instance of stack.elements) {
          const initialResults = getInitialInstanceResults(instance.elementData)
          await prisma.elementInstance.update({
            where: {
              id: instance.id,
            },
            data: {
              responses: { deleteMany: {} },
              detailResponses: { deleteMany: {} },
              results: initialResults,
              anonymousResults: initialResults,
            },
          })
        }
      }
    }

    // Update microlearning status
    const draftMicroLearning = await prisma.microLearning.update({
      where: {
        id,
      },
      data: {
        status: PublicationStatus.DRAFT,
      },
      include: {
        stacks: {
          include: {
            elements: true,
          },
        },
      },
    })

    return draftMicroLearning
  })

  ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })
  return updatedMicroLearning
}

export async function extendMicroLearning(
  {
    id,
    endDate,
  }: {
    id: string
    endDate: Date
  },
  ctx: ContextWithUser
) {
  // check that the new end date lies in the future
  if (endDate < new Date()) {
    return null
  }

  return await ctx.prisma.microLearning.update({
    where: {
      id,
      ownerId: ctx.user.sub,
      scheduledEndAt: { gt: new Date() },
      isDeleted: false,
    },
    data: {
      scheduledEndAt: endDate,
    },
  })
}

export async function endMicroLearning(
  {
    id,
  }: {
    id: string
  },
  ctx: ContextWithUser
) {
  const updatedMicroLearning = await ctx.prisma.microLearning.update({
    where: {
      id,
      ownerId: ctx.user.sub,
      status: PublicationStatus.PUBLISHED,
      isDeleted: false,
    },
    data: {
      status: PublicationStatus.ENDED,
      scheduledEndAt: new Date(),
    },
  })

  ctx.pubSub.publish('microLearningEnded', updatedMicroLearning)
  return updatedMicroLearning
}

export async function getMicroLearningSummary(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    include: {
      stacks: {
        include: {
          elements: true,
        },
      },
    },
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

interface DeleteMicroLearningArgs {
  id: string
}

export async function deleteMicroLearning(
  { id }: DeleteMicroLearningArgs,
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    include: {
      responses: true,
    },
  })

  if (!microLearning) {
    return null
  }

  // if the microlearning is not published yet or has no responses -> hard deletion
  // anonymous results are ignored, since deleting them does not have an impage on data consistency
  if (
    microLearning.status === PublicationStatus.DRAFT ||
    microLearning.status === PublicationStatus.SCHEDULED ||
    microLearning.responses.length === 0
  ) {
    const deletedItem = await ctx.prisma.microLearning.delete({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
    })

    ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })

    return deletedItem
  } else {
    // if the microlearning is published and has responses -> soft deletion
    const updatedMicroLearning = await ctx.prisma.microLearning.update({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
      data: {
        isDeleted: true,
      },
    })

    ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })
    return updatedMicroLearning
  }
}
