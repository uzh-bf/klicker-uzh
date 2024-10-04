import {
  Element,
  ElementInstanceType,
  ElementStackType,
  PublicationStatus,
} from '@klicker-uzh/prisma'
import {
  getInitialElementResults,
  getInitialInstanceStatistics,
  processElementData,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { StackInput } from 'src/types/app.js'
import { v4 as uuidv4 } from 'uuid'
import { Context, ContextWithUser } from '../lib/context.js'
import { computeStackEvaluation } from './practiceQuizzes.js'

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
            scheduledStartAt: { lte: new Date() },
            scheduledEndAt: { gte: new Date() },
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

  // TODO: handle here if already responded to the element? goal with micro = one try

  return microLearning
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
      status: PublicationStatus.PUBLISHED,
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
  stacks: StackInput[]
  courseId?: string | null
  multiplier: number
  startDate: Date
  endDate: Date
}

// TODO: merge this entire logic with manipulatePracticeQuiz (or extract duplications into helper functions)
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
  if (id) {
    // find all instances belonging to the old session and delete them as the content of the questions might have changed
    const oldElement = await ctx.prisma.microLearning.findUnique({
      where: {
        id,
        ownerId: ctx.user.sub,
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

    if (!oldElement) {
      throw new GraphQLError('MicroLearning not found')
    }
    if (oldElement.status === PublicationStatus.PUBLISHED) {
      throw new GraphQLError('Cannot edit a published microLearning')
    }

    await ctx.prisma.microLearning.update({
      where: { id },
      data: {
        stacks: {
          deleteMany: {},
        },
      },
    })
  }

  const elements = stacks
    .flatMap((stack) => stack.elements)
    .map((stackElem) => stackElem.elementId)
    .filter(
      (stackElem) => stackElem !== null && typeof stackElem !== 'undefined'
    )

  const dbElements = await ctx.prisma.element.findMany({
    where: {
      id: { in: elements },
      ownerId: ctx.user.sub,
    },
  })

  const uniqueElements = new Set(dbElements.map((q) => q.id))
  if (dbElements.length !== uniqueElements.size) {
    throw new GraphQLError('Not all elements could be found')
  }

  const elementMap = dbElements.reduce<Record<number, Element>>(
    (acc, elem) => ({ ...acc, [elem.id]: elem }),
    {}
  )

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
          options: {},
          elements: {
            create: stack.elements.map((elem) => {
              const element = elementMap[elem.elementId]!
              const processedElementData = processElementData(element)
              const initialResults =
                getInitialElementResults(processedElementData)

              return {
                elementType: element.type,
                migrationId: uuidv4(),
                order: elem.order,
                type: ElementInstanceType.MICROLEARNING,
                elementData: processedElementData,
                options: {
                  pointsMultiplier: multiplier * element.pointsMultiplier,
                },
                results: initialResults,
                anonymousResults: initialResults,
                instanceStatistics: {
                  create: getInitialInstanceStatistics(
                    ElementInstanceType.MICROLEARNING
                  ),
                },
                element: {
                  connect: { id: element.id },
                },
                owner: {
                  connect: { id: ctx.user.sub },
                },
              }
            }),
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

  const element = await ctx.prisma.microLearning.upsert({
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

  ctx.emitter.emit('invalidate', {
    typename: 'MicroLearning',
    id,
  })

  return element
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

export async function publishScheduledMicroLearnings(ctx: Context) {
  const microlearningsToPublish = await ctx.prisma.microLearning.findMany({
    where: {
      status: PublicationStatus.SCHEDULED,
      scheduledStartAt: {
        lte: new Date(),
      },
    },
  })

  const updatedMicroLearnings = await Promise.all(
    microlearningsToPublish.map((micro) =>
      ctx.prisma.microLearning.update({
        where: {
          id: micro.id,
        },
        data: {
          status: PublicationStatus.PUBLISHED,
        },
      })
    )
  )

  updatedMicroLearnings.forEach((micro) => {
    ctx.emitter.emit('invalidate', {
      typename: 'MicroLearning',
      id: micro.id,
    })
  })

  return true
}

interface UnpublishMicroLearningArgs {
  id: string
}

export async function unpublishMicroLearning(
  { id }: UnpublishMicroLearningArgs,
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.update({
    where: {
      id,
      ownerId: ctx.user.sub,
      status: PublicationStatus.SCHEDULED,
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

  ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })
  return microLearning
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
