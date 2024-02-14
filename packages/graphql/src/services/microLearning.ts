import {
  computeAwardedXp,
  computeSimpleAwardedPoints,
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionNumerical,
  gradeQuestionSC,
} from '@klicker-uzh/grading'
import {
  Element,
  ElementType,
  MicroLearningStatus,
  MicroSessionStatus,
  QuestionInstanceType,
  UserRole,
} from '@klicker-uzh/prisma'
import { PrismaClientKnownRequestError } from '@klicker-uzh/prisma/dist/runtime/library'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import * as R from 'ramda'
import { pick } from 'ramda'
import { ResponseInput } from 'src/ops'
import { Context, ContextWithUser } from '../lib/context'
import {
  prepareInitialInstanceResults,
  processQuestionData,
} from '../lib/questions'
import {
  AllElementTypeData,
  AllQuestionInstanceTypeData,
  QuestionResponse,
  QuestionResponseChoices,
} from '../types/app'

const POINTS_PER_INSTANCE = 10
const POINTS_AWARD_TIMEFRAME_DAYS = 6
const XP_AWARD_TIMEFRAME_DAYS = 1

export async function getQuestionMap(
  questions: number[],
  ctx: ContextWithUser
) {
  const dbQuestions = await ctx.prisma.element.findMany({
    where: {
      id: { in: questions },
      ownerId: ctx.user.sub,
    },
  })

  const uniqueQuestions = new Set(dbQuestions.map((q) => q.id))
  if (dbQuestions.length !== uniqueQuestions.size) {
    throw new GraphQLError('Not all questions could be found')
  }

  return dbQuestions.reduce<Record<number, Element>>(
    (acc, question) => ({ ...acc, [question.id]: question }),
    {}
  )
}

interface GetMicroSessionDataArgs {
  id: string
}

export async function getMicroSessionData(
  { id }: GetMicroSessionDataArgs,
  ctx: ContextWithUser
) {
  const microSession = await ctx.prisma.microSession.findUnique({
    where: { id },
    include: {
      course: true,
      instances: {
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  if (!microSession) return null

  const instancesWithoutSolution = microSession.instances.map((instance) => {
    const questionData = instance.questionData
    if (
      !questionData ||
      typeof questionData !== 'object' ||
      Array.isArray(questionData)
    )
      return instance

    switch (questionData.type) {
      case ElementType.SC:
      case ElementType.MC:
      case ElementType.KPRIM:
        return {
          ...instance,
          questionData: {
            ...questionData,
            options: {
              ...questionData.options,
              choices: questionData.options.choices.map(pick(['ix', 'value'])),
            },
          },
        }

      case ElementType.FREE_TEXT:
        return instance

      case ElementType.NUMERICAL:
        return instance

      default:
        return instance
    }
  })

  return {
    ...microSession,
    instances: instancesWithoutSolution,
  }
}

// TODO: remove after migration
export async function getSingleMicroSession(
  { id }: GetMicroSessionDataArgs,
  ctx: Context
) {
  const microSession = await ctx.prisma.microSession.findUnique({
    where: {
      id,
      OR: [
        {
          AND: {
            scheduledStartAt: { lte: new Date() },
            scheduledEndAt: { gte: new Date() },
            status: MicroSessionStatus.PUBLISHED,
          },
        },
        {
          ownerId: ctx.user?.sub,
        },
      ],
    },
    include: {
      course: true,
      instances: {
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  // TODO: handle here if already responded to the element? goal with micro = one try

  if (!microSession) return null

  return microSession
}

interface GetMicrolearningArgs {
  id: string
}

export async function getSingleMicrolearning(
  { id }: GetMicrolearningArgs,
  ctx: Context
) {
  const microlearning = await ctx.prisma.microLearning.findUnique({
    where: {
      id,
      OR: [
        {
          AND: {
            scheduledStartAt: { lte: new Date() },
            scheduledEndAt: { gte: new Date() },
            status: MicroLearningStatus.PUBLISHED,
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

  if (!microlearning) return null

  return microlearning
}

interface MarkMicroSessionCompletedArgs {
  courseId: string
  id: string
}

export async function markMicroSessionCompleted(
  { courseId, id }: MarkMicroSessionCompletedArgs,
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
      completedMicroSessions: {
        push: id,
      },
    },
  })
}

interface CreateMicroSessionArgs {
  name: string
  displayName: string
  description?: string | null
  questions: number[]
  courseId?: string | null
  multiplier: number
  startDate: Date
  endDate: Date
}

export async function createMicroSession(
  {
    name,
    displayName,
    description,
    questions,
    courseId,
    multiplier,
    startDate,
    endDate,
  }: CreateMicroSessionArgs,
  ctx: ContextWithUser
) {
  const questionMap = await getQuestionMap(questions, ctx)

  const session = await ctx.prisma.microSession.create({
    data: {
      name,
      displayName: displayName ?? name,
      description,
      pointsMultiplier: multiplier,
      scheduledStartAt: new Date(startDate),
      scheduledEndAt: new Date(endDate),
      instances: {
        create: questions.map((questionId, ix) => {
          const question = questionMap[questionId]

          const questionData = processQuestionData(question)

          return {
            order: ix,
            type: QuestionInstanceType.MICRO_SESSION,
            pointsMultiplier: multiplier * question.pointsMultiplier,
            questionData,
            results: prepareInitialInstanceResults(
              questionData as AllElementTypeData
            ),
            question: {
              connect: { id: questionId },
            },
            owner: {
              connect: { id: ctx.user.sub },
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
    },
    include: {
      instances: true,
    },
  })

  ctx.emitter.emit('invalidate', { typename: 'MicroSession', id: session.id })

  return session
}

interface EditMicroSessionArgs {
  id: string
  name: string
  displayName: string
  description?: string | null
  questions: number[]
  courseId?: string | null
  multiplier: number
  startDate: Date
  endDate: Date
}

export async function editMicroSession(
  {
    id,
    name,
    displayName,
    description,
    questions,
    courseId,
    multiplier,
    startDate,
    endDate,
  }: EditMicroSessionArgs,
  ctx: ContextWithUser
) {
  // find all instances belonging to the old microlearnings and delete them as the content of the questions might have changed
  const oldSession = await ctx.prisma.microSession.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    include: {
      instances: true,
    },
  })

  if (!oldSession) {
    throw new GraphQLError('Microlearning not found')
  }
  if (oldSession.status === MicroSessionStatus.PUBLISHED) {
    throw new GraphQLError('Microlearning is already published')
  }

  await ctx.prisma.questionInstance.deleteMany({
    where: {
      id: { in: oldSession.instances.map(({ id }) => id) },
    },
  })
  await ctx.prisma.microSession.update({
    where: { id },
    data: {
      instances: {
        deleteMany: {},
      },
      course: {
        disconnect: true,
      },
    },
  })

  const questionMap = await getQuestionMap(questions, ctx)

  const session = await ctx.prisma.microSession.update({
    where: { id },
    data: {
      name,
      displayName: displayName ?? name,
      description,
      pointsMultiplier: multiplier,
      scheduledStartAt: new Date(startDate),
      scheduledEndAt: new Date(endDate),
      instances: {
        create: questions.map((questionId, ix) => {
          const question = questionMap[questionId]
          const processedQuestionData = processQuestionData(question)

          return {
            order: ix,
            type: QuestionInstanceType.MICRO_SESSION,
            pointsMultiplier: multiplier * question.pointsMultiplier,
            questionData: processedQuestionData,
            results: prepareInitialInstanceResults(processedQuestionData),
            question: {
              connect: { id: questionId },
            },
            owner: {
              connect: { id: ctx.user.sub },
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
    },
    include: {
      instances: true,
    },
  })

  ctx.emitter.emit('invalidate', { typename: 'MicroSession', id: session.id })

  return session
}

interface PublishMicroSessionArgs {
  id: string
}

export async function publishMicroSession(
  { id }: PublishMicroSessionArgs,
  ctx: ContextWithUser
) {
  const microSession = await ctx.prisma.microSession.update({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    data: {
      status: MicroSessionStatus.PUBLISHED,
    },
    include: {
      instances: true,
    },
  })

  return {
    ...microSession,
    numOfInstances: microSession.instances.length,
  }
}

interface UnpublishMicroSessionArgs {
  id: string
}

export async function unpublishMicroSession(
  { id }: UnpublishMicroSessionArgs,
  ctx: ContextWithUser
) {
  const microSession = await ctx.prisma.microSession.update({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    data: {
      status: MicroSessionStatus.DRAFT,
    },
    include: {
      instances: true,
    },
  })

  return {
    ...microSession,
    numOfInstances: microSession.instances.length,
  }
}

interface DeleteMicroSessionArgs {
  id: string
}

export async function deleteMicroSession(
  { id }: DeleteMicroSessionArgs,
  ctx: ContextWithUser
) {
  try {
    const deletedItem = await ctx.prisma.microSession.delete({
      where: {
        id,
        ownerId: ctx.user.sub,
        status: MicroSessionStatus.DRAFT,
      },
    })

    ctx.emitter.emit('invalidate', { typename: 'MicroSession', id })

    return deletedItem
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
      console.log(
        'The microlearning is already published and cannot be deleted anymore.'
      )
      return null
    }

    throw e
  }
}

function evaluateQuestionResponse(
  questionData: AllElementTypeData,
  results: any,
  response: ResponseInput,
  multiplier?: number
) {
  switch (questionData.type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM: {
      // TODO: feedbacks only for selected options?
      // const feedbacks = questionData.options.choices.filter((choice) =>
      //   response.choices!.includes(choice.ix)
      // )

      const feedbacks = questionData.options.choices
      const solution = questionData.options.choices.reduce<number[]>(
        (acc, choice) => {
          if (choice.correct) return [...acc, choice.ix]
          return acc
        },
        []
      )

      if (questionData.type === ElementType.SC) {
        const pointsPercentage = gradeQuestionSC({
          responseCount: questionData.options.choices.length,
          response: (response as QuestionResponseChoices).choices,
          solution,
        })
        return {
          feedbacks,
          choices: results.choices,
          score: computeSimpleAwardedPoints({
            points: POINTS_PER_INSTANCE,
            pointsPercentage,
            pointsMultiplier: multiplier,
          }),
          xp: computeAwardedXp({
            pointsPercentage,
          }),
          percentile: pointsPercentage ?? 0,
        }
      } else if (questionData.type === ElementType.MC) {
        const pointsPercentage = gradeQuestionMC({
          responseCount: questionData.options.choices.length,
          response: (response as QuestionResponseChoices).choices,
          solution,
        })
        return {
          feedbacks,
          choices: results.choices,
          score: computeSimpleAwardedPoints({
            points: POINTS_PER_INSTANCE,
            pointsPercentage,
            pointsMultiplier: multiplier,
          }),
          xp: computeAwardedXp({
            pointsPercentage,
          }),
          percentile: pointsPercentage ?? 0,
        }
      } else {
        const pointsPercentage = gradeQuestionKPRIM({
          responseCount: questionData.options.choices.length,
          response: (response as QuestionResponseChoices).choices,
          solution,
        })
        return {
          feedbacks,
          choices: results.choices,
          score: computeSimpleAwardedPoints({
            points: POINTS_PER_INSTANCE,
            pointsPercentage,
            pointsMultiplier: multiplier,
          }),
          xp: computeAwardedXp({
            pointsPercentage,
          }),
          percentile: pointsPercentage ?? 0,
        }
      }
    }

    case ElementType.NUMERICAL: {
      const solutionRanges = questionData.options.solutionRanges

      const correct = gradeQuestionNumerical({
        response: parseFloat(String(response.value)),
        solutionRanges: solutionRanges ?? [],
      })

      // TODO: add feedbacks here once they are implemented for specified solution ranges
      return {
        feedbacks: [],
        answers: results ?? [],
        score: correct ? correct * 10 * (multiplier ?? 1) : 0,
        xp: computeAwardedXp({
          pointsPercentage: correct,
        }),
        percentile: correct ?? 0,
      }
    }

    case ElementType.FREE_TEXT: {
      const solutions = questionData.options.solutions

      const correct = gradeQuestionFreeText({
        response: response.value ?? '',
        solutions: solutions ?? [],
      })

      return {
        feedbacks: [],
        answers: results ?? [],
        score: correct ? correct * 10 * (multiplier ?? 1) : 0,
        xp: computeAwardedXp({
          pointsPercentage: correct,
        }),
        percentile: correct ?? 0,
      }
    }

    default:
      return null
  }
}

export async function respondToQuestionInstance(
  {
    courseId,
    id,
    response,
  }: { courseId: string; id: number; response: ResponseInput },
  ctx: Context
) {
  let treatAnonymous = false

  const participation = ctx.user?.sub
    ? await ctx.prisma.participation.findUnique({
        where: {
          courseId_participantId: {
            courseId,
            participantId: ctx.user.sub,
          },
        },
        include: {
          participant: true,
        },
      })
    : null

  // if the participant is logged in does not participate in the course, treat him as anonymous
  if (ctx.user?.sub && !participation) {
    treatAnonymous = true
  }

  const { instance, updatedInstance } = await ctx.prisma.$transaction(
    async (prisma) => {
      const instance = await prisma.questionInstance.findUnique({
        where: { id },
        // if the participant is logged in, fetch the last response of the participant
        // the response will not be counted and will only yield points if not within the past week
        include:
          ctx.user?.sub &&
          !treatAnonymous &&
          ctx.user.role === UserRole.PARTICIPANT
            ? {
                responses: {
                  where: {
                    participant: {
                      id: ctx.user.sub,
                    },
                  },
                  take: 1,
                },
              }
            : {
                responses: {
                  take: 1,
                },
              },
      })

      if (!instance) {
        return {}
      }

      // if the participant had already responded, don't track the new response
      // keeps the evaluation more accurate, as repeated entries do not skew into the "correct direction"
      const hasPreviousResponse = instance?.responses.length > 0
      if (ctx.user?.sub && !treatAnonymous && hasPreviousResponse) {
        return {
          instance,
          updatedInstance: instance,
        }
      }

      const questionData = instance?.questionData

      // FIXME: ensure the types of this allow assignment of the different element type results
      const results: AllQuestionInstanceTypeData['results'] = instance?.results

      if (!questionData) {
        return {}
      }

      let updatedResults:
        | {
            choices?: Record<string, number>
          }
        | Record<string, number> = {}

      switch (questionData.type) {
        case ElementType.SC:
        case ElementType.MC:
        case ElementType.KPRIM: {
          updatedResults.choices = (
            response as QuestionResponseChoices
          ).choices.reduce(
            (acc, ix) => ({
              ...acc,
              [ix]: acc[ix] + 1,
            }),
            results.choices as Record<string, number>
          )
          break
        }

        case ElementType.NUMERICAL: {
          if (
            typeof response.value === 'undefined' ||
            response.value === null ||
            response.value === ''
          ) {
            return {}
          }

          const parsedValue = parseFloat(response.value)
          if (
            isNaN(parsedValue) ||
            (typeof questionData.options.restrictions?.min === 'number' &&
              parsedValue < questionData.options.restrictions.min) ||
            (typeof questionData.options.restrictions?.max === 'number' &&
              parsedValue > questionData.options.restrictions.max)
          ) {
            return {}
          }

          const value = String(parsedValue)

          if (Object.keys(results).includes(value)) {
            updatedResults = {
              ...results,
              [value]: results[value] + 1,
            }
          } else {
            updatedResults = { ...results, [value]: 1 }
          }
          break
        }

        case ElementType.FREE_TEXT: {
          if (
            typeof response.value === 'undefined' ||
            response.value === null ||
            response.value === '' ||
            (typeof questionData.options.restrictions?.maxLength === 'number' &&
              response.value.length >
                questionData.options.restrictions?.maxLength)
          ) {
            return {}
          }

          const value = R.toLower(R.trim(response.value))

          if (Object.keys(results).includes(value)) {
            updatedResults = {
              ...results,
              [value]: results[value] + 1,
            }
          } else {
            updatedResults = { ...results, [value]: 1 }
          }
          break
        }

        default:
          break
      }

      const updatedInstance = await prisma.questionInstance.update({
        where: { id },
        data: {
          results: updatedResults,
          // TODO: re-introduce participant count - probably as part of results
          // participants: {
          //   increment: 1,
          // },
        },
      })

      return {
        instance,
        updatedInstance,
      }
    }
  )

  const questionData = updatedInstance?.questionData
  const results = updatedInstance?.results

  if (!instance || !updatedInstance || !questionData) return null

  const evaluation = evaluateQuestionResponse(
    questionData,
    results,
    response,
    updatedInstance.pointsMultiplier
  )
  const score = evaluation?.score || 0
  const xp = evaluation?.xp || 0
  let pointsAwarded
  let newPointsFrom
  let lastAwardedAt
  let lastXpAwardedAt
  let xpAwarded
  let newXpFrom
  const promises = []

  // if the user is logged in and the last response was not within the past 6 days
  // award points and update the response
  if (
    ctx.user?.sub &&
    !treatAnonymous &&
    ctx.user.role === UserRole.PARTICIPANT
  ) {
    const hasPreviousResponse = instance?.responses?.length > 0

    if (hasPreviousResponse) {
      const previousResponseOutsideTimeframe =
        !instance.responses[0].lastAwardedAt ||
        dayjs(instance.responses[0].lastAwardedAt).isBefore(
          dayjs().subtract(
            instance?.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
            'days'
          )
        )

      if (previousResponseOutsideTimeframe) {
        pointsAwarded = score
      } else {
        pointsAwarded = 0
      }

      const previousXpResponseOutsideTimeframe =
        !instance.responses[0].lastXpAwardedAt ||
        dayjs(instance.responses[0].lastXpAwardedAt).isBefore(
          dayjs().subtract(XP_AWARD_TIMEFRAME_DAYS, 'days')
        )

      if (previousXpResponseOutsideTimeframe) {
        xpAwarded = xp
      } else {
        xpAwarded = 0
      }

      lastAwardedAt = previousResponseOutsideTimeframe
        ? new Date()
        : instance.responses[0].lastAwardedAt
      lastXpAwardedAt = previousXpResponseOutsideTimeframe
        ? new Date()
        : instance.responses[0].lastXpAwardedAt
      newPointsFrom = dayjs(lastAwardedAt)
        .add(instance?.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS, 'days')
        .toDate()
      newXpFrom = dayjs(lastXpAwardedAt)
        .add(XP_AWARD_TIMEFRAME_DAYS, 'days')
        .toDate()
    } else {
      pointsAwarded = score
      xpAwarded = xp

      lastAwardedAt = new Date()
      lastXpAwardedAt = new Date()
      newPointsFrom = dayjs(lastAwardedAt)
        .add(instance?.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS, 'days')
        .toDate()
      newXpFrom = dayjs(lastAwardedAt)
        .add(XP_AWARD_TIMEFRAME_DAYS, 'days')
        .toDate()
    }

    // if the user is not participating in the leaderboard, do not award points
    if (ctx.user.sub && participation?.isActive === false) {
      pointsAwarded = null
      lastAwardedAt = undefined
    }

    promises.push(
      ctx.prisma.questionResponse.upsert({
        where: {
          participantId_questionInstanceId: {
            participantId: ctx.user.sub,
            questionInstanceId: id,
          },
        },
        create: {
          totalScore: score,
          totalPointsAwarded: pointsAwarded,
          totalXpAwarded: xpAwarded,
          trialsCount: 1,
          lastAwardedAt,
          lastXpAwardedAt,
          response: response as QuestionResponse,
          participant: {
            connect: { id: ctx.user.sub },
          },
          questionInstance: {
            connect: { id },
          },
          participation: {
            connect: {
              courseId_participantId: {
                courseId,
                participantId: ctx.user.sub,
              },
            },
          },
        },
        update: {
          response: response as QuestionResponse,
          lastAwardedAt,
          lastXpAwardedAt,
          trialsCount: {
            increment: 1,
          },
          totalScore: {
            increment: score,
          },
          totalPointsAwarded:
            typeof pointsAwarded === 'number'
              ? {
                  increment: pointsAwarded,
                }
              : null,
          totalXpAwarded: {
            increment: xpAwarded,
          },
        },
      }),
      ctx.prisma.questionResponseDetail.create({
        data: {
          score,
          pointsAwarded,
          xpAwarded,
          response: response as QuestionResponse,
          participant: {
            connect: { id: ctx.user.sub },
          },
          questionInstance: {
            connect: { id },
          },
          participation: {
            connect: {
              courseId_participantId: {
                courseId,
                participantId: ctx.user.sub,
              },
            },
          },
        },
      })
    )

    if (typeof xpAwarded === 'number' && xpAwarded > 0) {
      promises.push(
        ctx.prisma.participant.update({
          where: {
            id: ctx.user.sub,
          },
          data: {
            xp: {
              increment: xpAwarded,
            },
          },
        })
      )
    }

    if (typeof pointsAwarded === 'number') {
      promises.push(
        ctx.prisma.leaderboardEntry.upsert({
          where: {
            type_participantId_courseId: {
              type: 'COURSE',
              courseId,
              participantId: ctx.user.sub,
            },
          },
          create: {
            type: 'COURSE',
            score: pointsAwarded,
            participant: {
              connect: {
                id: ctx.user.sub,
              },
            },
            course: {
              connect: {
                id: courseId,
              },
            },
            participation: {
              connect: {
                courseId_participantId: {
                  courseId,
                  participantId: ctx.user.sub,
                },
              },
            },
          },
          update: {
            score: {
              increment: pointsAwarded,
            },
          },
        })
      )
    }
  }

  await ctx.prisma.$transaction(promises)

  return {
    ...updatedInstance,
    evaluation: evaluation
      ? {
          ...evaluation,
          pointsAwarded,
          newPointsFrom,
          xpAwarded,
          newXpFrom,
        }
      : undefined,
  }
}
