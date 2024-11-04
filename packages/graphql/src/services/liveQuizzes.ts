import {
  AccessMode,
  ConfusionTimestep,
  type Element,
  ElementBlockStatus,
  ElementInstanceType,
  ElementType,
  PublicationStatus,
} from '@klicker-uzh/prisma'
import type { BlockInput } from '@klicker-uzh/types'
import {
  getInitialElementResults,
  getInitialInstanceStatistics,
  processElementData,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { min } from 'mathjs'
import { createHmac } from 'node:crypto'
import { pick } from 'remeda'
import { v4 as uuidv4 } from 'uuid'
import type { Context, ContextWithUser } from '../lib/context.js'
import { sendTeamsNotifications } from '../lib/util.js'

// ------ LIVE QUIZ CREATION / EDITING ------
// #region
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
// #endregion

// ------ LIVE QUIZ GETTER FUNCTIONS (LECTURER) ------
// #region
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
// #endregion

// ------ LIVE QUIZ EXECUTION (LECTURER) ------
// #region
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

export async function getCockpitQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const session = await ctx.prisma.liveQuiz.findUnique({
    where: { id, ownerId: ctx.user.sub },
    include: {
      activeBlock: {
        include: {
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
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
        },
      },
      course: true,
      confusionFeedbacks: true,
      feedbacks: {
        include: {
          responses: true,
        },
      },
    },
  })

  if (!session || session?.status !== PublicationStatus.PUBLISHED) {
    return null
  }

  // number of participants per block
  const blockParticipants = session.blocks.reduce<Record<number, number>>(
    (acc, block) => {
      acc[block.id] = block.elements.reduce(
        (instanceAcc, instance) =>
          min(
            instanceAcc,
            instance.results.total + instance.anonymousResults.total
          ),
        100000
      )
      return acc
    },
    {}
  )

  if (session.activeBlock && session.activeBlock.id) {
    const activeInstanceIds = session.activeBlock?.elements.map(
      (instance) => instance.id
    )
    const redisMulti = ctx.redisExec.pipeline()
    activeInstanceIds?.forEach((instanceId) => {
      redisMulti.hgetall(`s:${id}:i:${instanceId}:results`)
    })
    const cacheContent = (await redisMulti.exec()) as
      | [
          Error | null,
          {
            // TODO: extend type with more content of cache (as needed)
            participants: string
          },
        ][]
      | null
    const activeBlockParticipants = cacheContent
      ?.map(([_, result]) => parseInt(result?.participants))
      .reduce((acc, val) => min(acc, val), 100000)
    blockParticipants[session.activeBlock.id] =
      activeBlockParticipants ?? blockParticipants[session.activeBlock.id] ?? 0
  }

  // recude session to only contain what is required for the lecturer cockpit
  const reducedSession = {
    ...session,
    activeBlock: session.activeBlock,
    blocks: session.blocks.map((block) => {
      return {
        ...block,
        numOfParticipants: blockParticipants[block.id],
        elements: block.elements.map((instance) => {
          const elementData = instance.elementData
          if (
            !elementData ||
            typeof elementData !== 'object' ||
            Array.isArray(elementData)
          ) {
            return instance
          } else {
            return {
              ...instance,
              elementData: {
                ...elementData,
                options: null,
              },
            }
          }
        }),
      }
    }),
    confusionSummary: aggregateFeedbacks(session.confusionFeedbacks),
  }

  return reducedSession
}

export async function changeLiveQuizSettings(
  {
    id,
    isLiveQAEnabled,
    isConfusionFeedbackEnabled,
    isModerationEnabled,
    isGamificationEnabled,
  }: {
    id: string
    isLiveQAEnabled?: boolean | null
    isConfusionFeedbackEnabled?: boolean | null
    isModerationEnabled?: boolean | null
    isGamificationEnabled?: boolean | null
  },
  ctx: ContextWithUser
) {
  const quiz = await ctx.prisma.liveQuiz.update({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    data: {
      isLiveQAEnabled: isLiveQAEnabled ?? undefined,
      isConfusionFeedbackEnabled: isConfusionFeedbackEnabled ?? undefined,
      isModerationEnabled: isModerationEnabled ?? undefined,
      isGamificationEnabled: isGamificationEnabled ?? undefined,
    },
  })
  return quiz
}

export async function changeLiveQuizName(
  { id, name, displayName }: { id: string; name: string; displayName: string },
  ctx: ContextWithUser
) {
  const updatedQuiz = await ctx.prisma.liveQuiz.update({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    data: {
      name,
      displayName,
    },
  })

  ctx.emitter.emit('invalidate', {
    typename: 'LiveQuiz',
    id,
  })

  return updatedQuiz
}

export async function getLiveQuizSummary(
  { quizId }: { quizId: string },
  ctx: ContextWithUser
) {
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: {
      id: quizId,
      ownerId: ctx.user.sub,
    },
    include: {
      _count: {
        select: {
          feedbacks: true,
          confusionFeedbacks: true,
          leaderboard: true,
        },
      },
      blocks: {
        include: {
          elements: true,
        },
      },
    },
  })

  if (!liveQuiz) return null

  const storedResponses = liveQuiz.blocks.reduce((acc_b, block) => {
    acc_b += block.elements.reduce((acc_i, instance) => {
      acc_i += instance.results.total + instance.anonymousResults.total
      return acc_i
    }, 0)
    return acc_b
  }, 0)

  return {
    numOfResponses: storedResponses,
    numOfFeedbacks: liveQuiz._count.feedbacks,
    numOfConfusionFeedbacks: liveQuiz._count.confusionFeedbacks,
    numOfLeaderboardEntries: liveQuiz._count.leaderboard,
  }
}

export async function cancelLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    include: {
      activeBlock: true,
      blocks: {
        include: {
          elements: { include: { element: true } },
          activeInLiveQuiz: true,
        },
      },
      leaderboard: true,
    },
  })

  if (!quiz) return null

  try {
    if (quiz.status !== PublicationStatus.PUBLISHED) {
      throw new Error('Session is not running')
    }

    const instances = quiz.blocks.flatMap((block) => block.elements)

    const [updatedQuiz] = await ctx.prisma.$transaction([
      ctx.prisma.liveQuiz.update({
        where: { id },
        data: {
          status: PublicationStatus.DRAFT,
          startedAt: null,
          pinCode: null,
          activeBlock: {
            disconnect: true,
          },
          leaderboard: {
            deleteMany: {},
          },
          feedbacks: {
            deleteMany: {},
          },
          confusionFeedbacks: {
            deleteMany: {},
          },
          blocks: {
            updateMany: {
              where: {
                status: {
                  in: [ElementBlockStatus.EXECUTED, ElementBlockStatus.ACTIVE],
                },
              },
              data: {
                status: ElementBlockStatus.SCHEDULED,
                expiresAt: null,
                execution: {
                  increment: 1,
                },
              },
            },
          },
        },
        include: {
          activeBlock: true,
          blocks: {
            include: {
              elements: true,
              activeInLiveQuiz: true,
            },
          },
        },
      }),

      ...instances.map((instance) =>
        ctx.prisma.elementInstance.update({
          where: {
            id: instance.id,
          },
          data: {
            results: getInitialElementResults(instance.element),
          },
        })
      ),
    ])

    const keys = await ctx.redisExec.keys(`s:${id}:*`)
    const pipe = ctx.redisExec.multi()
    for (const key of keys) {
      pipe.unlink(key)
    }
    await pipe.exec()

    await sendTeamsNotifications(
      'graphql/abortLiveQuiz',
      `CANCEL Session ${quiz.name} with id ${quiz.id}.`
    )

    return updatedQuiz
  } catch (error) {
    await sendTeamsNotifications(
      'graphql/abortLiveQuiz',
      `ERROR - failed to cancel session ${quiz.name} with id ${quiz.id}: ${error}`
    )
    throw error
  }
}

// #endregion

// ------ LIVE QUIZ MANAGEMENT (DELETION / EMBEDDING / ...) ------
// #region
export async function deleteLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  // fetch live quiz to check its status
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    select: {
      status: true,
    },
  })

  if (!liveQuiz) return null

  if (liveQuiz.status === PublicationStatus.PUBLISHED) {
    // running live quizzes cannot be deleted
    return null
  } else if (liveQuiz.status === PublicationStatus.ENDED) {
    const deletedLiveQuiz = await ctx.prisma.liveQuiz.update({
      where: {
        id,
        ownerId: ctx.user.sub,
        status: PublicationStatus.ENDED,
      },
      data: {
        isDeleted: true,
      },
    })

    ctx.emitter.emit('invalidate', {
      typename: 'Session',
      id,
    })

    return deletedLiveQuiz
  } else {
    const deletedLiveQuiz = await ctx.prisma.liveQuiz.delete({
      where: {
        id,
        ownerId: ctx.user.sub,
        status: {
          in: [PublicationStatus.DRAFT, PublicationStatus.SCHEDULED],
        },
      },
    })

    ctx.emitter.emit('invalidate', {
      typename: 'LiveQuiz',
      id,
    })

    return deletedLiveQuiz
  }
}

export async function getLiveQuizHMAC(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: {
      id,
    },
  })

  if (!quiz) return null

  const hmacEncoder = createHmac('sha256', process.env.APP_SECRET as string)
  hmacEncoder.update(quiz.namespace + quiz.id)
  const quizHmac = hmacEncoder.digest('hex')

  return quizHmac
}

// compute the average of all feedbacks that were given within the last 10 minutes
const aggregateFeedbacks = (feedbacks: ConfusionTimestep[]) => {
  // TODO: for improved efficiency, try to use descending feedback ordering
  // and break early once first is not within the filtering requirements anymore
  const recentFeedbacks = feedbacks.filter(
    (feedback) =>
      dayjs().diff(dayjs(feedback.createdAt)) > 0 &&
      dayjs().diff(dayjs(feedback.createdAt)) < 1000 * 60 * 10
  )

  if (recentFeedbacks.length > 0) {
    const summedFeedbacks = recentFeedbacks.reduce(
      (previousValue, feedback) => {
        return {
          speed: previousValue.speed + feedback.speed,
          difficulty: previousValue.difficulty + feedback.difficulty,
          numberOfParticipants: previousValue.numberOfParticipants + 1,
        }
      },
      { speed: 0, difficulty: 0, numberOfParticipants: 0 }
    )
    return {
      ...summedFeedbacks,
      speed: summedFeedbacks.speed / summedFeedbacks.numberOfParticipants,
      difficulty:
        summedFeedbacks.difficulty / summedFeedbacks.numberOfParticipants,
    }
  }
  return { speed: 0, difficulty: 0, numberOfParticipants: 0 }
}
// #endregion

// ------ LIVE QUIZ GETTER FUNCTIONS (STUDENT) ------
// #region
export async function getRunningLiveQuiz({ id }: { id: string }, ctx: Context) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id },
    include: {
      activeBlock: {
        include: {
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      course: true,
    },
  })

  // extract solution from instances in active block
  let quizWithoutSolutions: any
  if (quiz && quiz.activeBlock) {
    quizWithoutSolutions = {
      ...quiz,
      activeBlock: {
        ...quiz.activeBlock,
        elements: quiz.activeBlock.elements.map((instance) => {
          const elementData = instance.elementData
          if (
            !elementData ||
            typeof elementData !== 'object' ||
            Array.isArray(elementData)
          )
            return instance

          switch (elementData.type) {
            case ElementType.SC:
            case ElementType.MC:
              return {
                ...instance,
                elementData: {
                  ...elementData,
                  options: {
                    ...elementData.options,
                    choices: elementData.options.choices.map((choice) => ({
                      ...pick(choice, ['ix', 'value']),
                    })),
                  },
                },
              }

            case ElementType.NUMERICAL:
            case ElementType.FREE_TEXT:
              return {
                ...instance,
                elementData,
              }

            default:
              return instance
          }
        }),
      },
    }
  }

  if (quiz?.status === PublicationStatus.PUBLISHED) {
    return quizWithoutSolutions ?? quiz
  }

  return null
}

export async function getCourseRunningLiveQuizzes(
  { courseId }: { courseId: string },
  ctx: Context
) {
  const course = await ctx.prisma.course.findUnique({
    where: {
      id: courseId,
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

  return course?.liveQuizzes ?? []
}
// #endregion
