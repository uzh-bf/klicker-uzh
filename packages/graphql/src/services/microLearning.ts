import {
  Element,
  ElementInstanceType,
  ElementStackType,
  PublicationStatus,
} from '@klicker-uzh/prisma'
import { PrismaClientKnownRequestError } from '@klicker-uzh/prisma/dist/runtime/library.js'
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

interface GetMicroLearningArgs {
  id: string
}

export async function getSingleMicroLearning(
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
        orderBy: {
          order: 'asc',
        },
        include: {
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
    },
  })

  // TODO: handle here if already responded to the element? goal with micro = one try

  if (!microLearning) return null

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
                type: ElementInstanceType.PRACTICE_QUIZ,
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
  const microLearning = await ctx.prisma.microLearning.update({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    data: {
      status: PublicationStatus.PUBLISHED,
    },
  })

  return microLearning
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

  return microLearning
}

interface DeleteMicroLearningArgs {
  id: string
}

export async function deleteMicroLearning(
  { id }: DeleteMicroLearningArgs,
  ctx: ContextWithUser
) {
  try {
    const deletedItem = await ctx.prisma.microLearning.delete({
      where: {
        id,
        ownerId: ctx.user.sub,
        status: PublicationStatus.DRAFT,
      },
    })

    ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })

    return deletedItem
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
      console.warn(
        'The microLearning is already published and cannot be deleted anymore.'
      )
      return null
    }

    throw e
  }
}
