import {
  AccessMode,
  type Element,
  ElementInstanceType,
  PublicationStatus,
} from '@klicker-uzh/prisma'
import type { BlockInput } from '@klicker-uzh/types'
import {
  getInitialElementResults,
  getInitialInstanceStatistics,
  processElementData,
} from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import { v4 as uuidv4 } from 'uuid'
import type { ContextWithUser } from '../lib/context.js'
import { sendTeamsNotifications } from '../lib/util.js'

interface ManipulateLiveQuizArgs {
  id?: string
  name: string
  displayName: string
  description?: string | null
  blocks: BlockInput[]
  courseId?: string | null
  multiplier: number
  maxBonusPoints?: number | null
  timeToZeroBonus?: number | null
  isGamificationEnabled: boolean
  isConfusionFeedbackEnabled: boolean
  isLiveQAEnabled: boolean
  isModerationEnabled: boolean
}

export async function manipulateLiveQuiz(
  {
    id,
    name,
    displayName,
    description,
    blocks,
    courseId,
    multiplier,
    maxBonusPoints,
    timeToZeroBonus,
    isGamificationEnabled,
    isConfusionFeedbackEnabled,
    isLiveQAEnabled,
    isModerationEnabled,
  }: ManipulateLiveQuizArgs,
  ctx: ContextWithUser
) {
  if (id) {
    // find all instances belonging to the old quiz and delete them as the content of the questions might have changed
    const oldElement = await ctx.prisma.liveQuiz.findUnique({
      where: {
        id,
        ownerId: ctx.user.sub,
        isDeleted: false,
      },
      include: {
        blocks: {
          include: {
            elements: true,
          },
        },
      },
    })

    if (!oldElement) {
      throw new GraphQLError('Live quiz not found')
    }
    if (oldElement.status === PublicationStatus.PUBLISHED) {
      throw new GraphQLError('Cannot edit a published live quiz')
    }

    await ctx.prisma.liveQuiz.update({
      where: { id },
      data: {
        blocks: {
          deleteMany: {},
        },
      },
    })
  }

  const elements = blocks
    .flatMap((block) => block.elements)
    .map((blockElem) => blockElem.elementId)
    .filter(
      (blockElem) => blockElem !== null && typeof blockElem !== 'undefined'
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
    maxBonusPoints: maxBonusPoints ?? undefined,
    timeToZeroBonus: timeToZeroBonus ?? undefined,
    isGamificationEnabled,
    isConfusionFeedbackEnabled,
    isLiveQAEnabled,
    isModerationEnabled,
    blocks: {
      create: blocks.map((block) => {
        return {
          order: block.order,
          timeLimit: block.timeLimit,
          elements: {
            create: block.elements.map((elem) => {
              const element = elementMap[elem.elementId]!
              const processedElementData = processElementData(element)
              const initialResults = getInitialElementResults(element)

              return {
                elementType: element.type,
                migrationId: uuidv4(),
                order: elem.order,
                type: ElementInstanceType.LIVE_QUIZ,
                elementData: processedElementData,
                options: {
                  pointsMultiplier: multiplier * element.pointsMultiplier,
                },
                results: initialResults,
                anonymousResults: initialResults,
                instanceStatistics: {
                  create: getInitialInstanceStatistics(
                    ElementInstanceType.LIVE_QUIZ
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
    course: courseId
      ? {
          connect: { id: courseId },
        }
      : undefined,
  }

  const element = await ctx.prisma.liveQuiz.upsert({
    where: { id: id ?? uuidv4() },
    create: createOrUpdateJSON,
    update: createOrUpdateJSON,
    include: {
      course: true,
      blocks: {
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
    typename: 'LiveQuiz',
    id,
  })

  return element
}

export async function getLiveQuizData(
  {
    id,
  }: {
    id: string
  },
  ctx: ContextWithUser
) {
  if (!id) {
    return null
  }

  const session = await ctx.prisma.liveQuiz.findUnique({
    where: { id, ownerId: ctx.user.sub },
    include: {
      blocks: {
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
      course: true,
    },
  })

  return session
}

export async function getUserLiveQuizzes(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      liveQuizzes: {
        where: {
          isDeleted: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          course: true,
          blocks: {
            orderBy: {
              order: 'asc',
            },
            include: {
              elements: {
                orderBy: {
                  order: 'asc',
                },
              },
              _count: {
                select: { elements: true },
              },
            },
          },
          _count: {
            select: { blocks: true },
          },
        },
      },
    },
  })

  return user?.liveQuizzes.map((quiz) => ({
    ...quiz,
    blocks: quiz.blocks.map((block) => ({
      ...block,
      numOfParticipants: block.elements[0]
        ? block.elements[0].results.total +
          block.elements[0].anonymousResults.total
        : 0,
    })),
    course: quiz.course ? quiz.course : undefined,
    numOfBlocks: quiz._count?.blocks,
    numOfInstances: quiz.blocks.reduce(
      (acc, block) => acc + block._count?.elements,
      0
    ),
  }))
}

export async function getUserRunningLiveQuizzes(ctx: ContextWithUser) {
  const user = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      liveQuizzes: {
        where: {
          status: PublicationStatus.PUBLISHED,
        },
        include: {
          course: true,
        },
      },
    },
  })

  return user?.liveQuizzes ?? []
}

export async function startLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  try {
    const quiz = await ctx.prisma.liveQuiz.findFirst({
      where: {
        id,
        ownerId: ctx.user.sub,
        status: {
          in: [
            PublicationStatus.DRAFT,
            PublicationStatus.SCHEDULED,
            PublicationStatus.PUBLISHED,
          ],
        },
      },
      include: {
        blocks: {
          orderBy: {
            id: 'asc',
          },
        },
      },
    })

    // if there is no session matching the current user and session id, exit early
    if (!quiz) {
      return null
    }

    switch (quiz.status) {
      case PublicationStatus.PUBLISHED:
        return quiz

      case PublicationStatus.DRAFT:
      case PublicationStatus.SCHEDULED: {
        try {
          await ctx.redisExec
            .pipeline()
            .hmset(`s:${quiz.id}:meta`, {
              namespace: quiz.namespace,
              startedAt: Number(new Date()),
            })
            .exec()
        } catch (e) {
          console.error(e)
        }

        // generate a random pin code
        const pinCode = 100000 + Math.floor(Math.random() * 900000)
        const startedLiveQuiz = await ctx.prisma.liveQuiz.update({
          where: {
            id,
          },
          data: {
            status: PublicationStatus.PUBLISHED,
            startedAt: new Date(),
            pinCode: quiz.accessMode === AccessMode.RESTRICTED ? pinCode : null,
          },
        })

        await sendTeamsNotifications(
          'graphql/startLiveQuiz',
          `START Live quiz ${quiz.name} with id ${quiz.id}.`
        )

        return startedLiveQuiz
      }
    }
  } catch (error) {
    await sendTeamsNotifications(
      'graphql/startLiveQuiz',
      `ERROR - failed to start live quiz: ${error}`
    )
    throw error
  }
}
