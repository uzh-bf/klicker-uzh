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
  LearningElementStatus,
  OrderType,
  QuestionResponse as PrismaQuestionResponse,
  QuestionInstance,
  QuestionInstanceType,
  QuestionStack,
  QuestionStackType,
  UserRole,
} from '@klicker-uzh/prisma'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import * as R from 'ramda'
import { ResponseInput } from 'src/ops'
import { v4 as uuidv4 } from 'uuid'
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

// TODO: delete entire file, once learning elements have been replaced through practice quiz
const POINTS_PER_INSTANCE = 10
const POINTS_AWARD_TIMEFRAME_DAYS = 6
const XP_AWARD_TIMEFRAME_DAYS = 1

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

export async function getLearningElementData(
  { id }: { id: string },
  ctx: Context
) {
  const element = await ctx.prisma.learningElement.findUnique({
    where: {
      id,
      OR: [
        {
          status: LearningElementStatus.PUBLISHED,
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
            include: {
              questionInstance: {
                include:
                  ctx.user?.sub && ctx.user?.role === UserRole.PARTICIPANT
                    ? {
                        responses: {
                          where: {
                            participantId: ctx.user.sub,
                          },
                          orderBy: {
                            lastAwardedAt: 'asc',
                          },
                          take: 1,
                        },
                      }
                    : undefined,
              },
            },
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

  if (!element) return null

  const stacksWithStatistics = element.stacks.reduce<{
    stacks: QuestionStack[]
    previouslyAnswered: number
    previousScore: number
    previousPointsAwarded: number
    totalTrials: number
    stacksWithQuestions: number
    numOfQuestions: number
  }>(
    (acc, stack) => {
      const stackStatistics = stack.elements.reduce<{
        answered: boolean
        containsQuestions: boolean
        previousScore: number
        previousPointsAwarded: number
        totalTrials: number
        numOfInstances: number
      }>(
        (acc, stackElement) => {
          const questionInstance =
            stackElement.questionInstance?.valueOf() as QuestionInstance & {
              responses?: PrismaQuestionResponse[]
            }

          // if the stack only contains description elements, the statistics remain unchanged
          if (!questionInstance) return acc

          const lastResponse = questionInstance.responses?.[0]
          return {
            answered: !!lastResponse,
            containsQuestions: true,
            previousScore: acc.previousScore + (lastResponse?.totalScore ?? 0),
            previousPointsAwarded:
              acc.previousPointsAwarded +
              (lastResponse?.totalPointsAwarded ?? 0),
            totalTrials: lastResponse?.trialsCount ?? 0,
            numOfInstances: acc.numOfInstances + 1,
          }
        },
        {
          answered: false,
          containsQuestions: false,
          previousScore: 0,
          previousPointsAwarded: 0,
          totalTrials: 0,
          numOfInstances: 0,
        }
      )

      const stackInstancesWithoutSolution = stack.elements.map((element) => {
        if (!element.questionInstance) {
          return element
        }

        const questionData = element.questionInstance.questionData

        switch (questionData?.type) {
          case ElementType.SC:
          case ElementType.MC:
          case ElementType.KPRIM:
            return {
              ...element,
              questionInstance: {
                ...element.questionInstance,
                questionData: {
                  ...questionData,
                  options: {
                    ...questionData.options,
                    choices: questionData.options.choices.map(
                      R.pick(['ix', 'value'])
                    ),
                  },
                },
              },
            }

          case ElementType.NUMERICAL:
          case ElementType.FREE_TEXT:
            return {
              ...element,
              questionInstance: {
                ...element.questionInstance,
                questionData: {
                  ...questionData,
                  options: {
                    restrictions: questionData.options.restrictions,
                  },
                },
              },
            }

          default: {
            return element
          }
        }
      })

      return {
        stacks: [
          ...acc.stacks,
          { ...stack, questionInstances: stackInstancesWithoutSolution },
        ],
        previouslyAnswered:
          acc.previouslyAnswered + (stackStatistics.totalTrials > 0 ? 1 : 0),
        previousScore: acc.previousScore + stackStatistics.previousScore,
        previousPointsAwarded:
          acc.previousPointsAwarded + stackStatistics.previousPointsAwarded,
        totalTrials: stackStatistics.answered
          ? stackStatistics.totalTrials
          : acc.totalTrials,
        stacksWithQuestions:
          acc.stacksWithQuestions + (stackStatistics.containsQuestions ? 1 : 0),
        numOfQuestions: acc.numOfQuestions + stackStatistics.numOfInstances,
      }
    },
    {
      stacks: [],
      previouslyAnswered: 0,
      previousScore: 0,
      previousPointsAwarded: 0,
      totalTrials: 0,
      stacksWithQuestions: 0,
      numOfQuestions: 0,
    }
  )

  // TODO: reintroduce ordering
  // if (element.orderType === OrderType.LAST_RESPONSE) {
  //   const orderedInstances = R.sort(
  //     (a, b) => (a.lastResponse ?? 0) - (b.lastResponse ?? 0),
  //     shuffle(instancesWithoutSolution.instances)
  //   )

  //   return {
  //     ...element,
  //     ...instancesWithoutSolution,
  //     instances: orderedInstances,
  //   }
  // }

  // if (element.orderType === OrderType.SHUFFLED) {
  //   return {
  //     ...element,
  //     ...instancesWithoutSolution,
  //     instances: shuffle(instancesWithoutSolution.instances),
  //   }
  // }

  return {
    ...element,
    ...stacksWithStatistics,
  }
}

interface StackInput {
  // TODO: add missing stack input data (optional displayname and description)
  elements: {
    questionId?: number | null
    mdContent?: string | null
  }[]
}

interface ManipulateLearningElementArgs {
  id?: string
  name: string
  displayName: string
  description?: string | null
  stacks: StackInput[]
  courseId?: string | null
  multiplier: number
  order: OrderType
  resetTimeDays: number
}

export async function manipulateLearningElement(
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
  }: ManipulateLearningElementArgs,
  ctx: ContextWithUser
) {
  if (id) {
    // find all instances belonging to the old session and delete them as the content of the questions might have changed
    const oldElement = await ctx.prisma.learningElement.findUnique({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
      include: {
        stacks: {
          include: {
            elements: {
              include: {
                questionInstance: true,
              },
            },
          },
        },
      },
    })

    if (!oldElement) {
      throw new GraphQLError('Learning element not found')
    }
    if (oldElement.status === LearningElementStatus.PUBLISHED) {
      throw new GraphQLError('Cannot edit a published learning element')
    }

    const oldQuestionInstances = oldElement.stacks.reduce<QuestionInstance[]>(
      (acc, stack) => [
        ...acc,
        ...(stack.elements
          .map((element) => element.questionInstance)
          .filter((instance) => instance !== null) as QuestionInstance[]),
      ],
      []
    )

    await ctx.prisma.questionInstance.deleteMany({
      where: {
        id: { in: oldQuestionInstances.map(({ id }) => id) },
      },
    })
    await ctx.prisma.learningElement.update({
      where: { id },
      data: {
        stacks: {
          deleteMany: {},
        },
        course: {
          disconnect: true,
        },
      },
    })
  }

  const questions = stacks
    .flatMap((stack) => stack.elements)
    .map((stackElem) => stackElem.questionId)
    .filter(
      (stackElem) => stackElem !== null && typeof stackElem !== undefined
    ) as number[]

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

  const questionMap = dbQuestions.reduce<Record<number, Element>>(
    (acc, question) => ({ ...acc, [question.id]: question }),
    {}
  )

  const createOrUpdateJSON = {
    name,
    displayName: displayName ?? name,
    description,
    pointsMultiplier: multiplier,
    orderType: order,
    resetTimeDays: resetTimeDays,
    stacks: {
      create: await Promise.all(
        stacks.map(async (stack, ix) => {
          // TODO: add optional attributes on stack level next to elements
          return {
            type: QuestionStackType.LEARNING_ELEMENT,
            order: ix,
            elements: {
              create: await Promise.all(
                stack.elements.map(async (element, ixInner) => {
                  if (typeof element.mdContent === 'string') {
                    // create text stack element
                    return {
                      order: ixInner,
                      mdContent: element.mdContent,
                    }
                  } else if (typeof element.questionId === 'number') {
                    // create stack element with question instance
                    const question = questionMap[element.questionId]

                    const processedQuestionData = processQuestionData(question)

                    return {
                      order: ixInner,
                      questionInstance: {
                        create: {
                          order: ix,
                          type: QuestionInstanceType.LEARNING_ELEMENT,
                          pointsMultiplier:
                            multiplier * question.pointsMultiplier,
                          questionData: processedQuestionData,
                          results: prepareInitialInstanceResults(
                            processedQuestionData
                          ),
                          question: {
                            connect: { id: element.questionId },
                          },
                          owner: {
                            connect: { id: ctx.user.sub },
                          },
                        },
                      },
                    }
                  }
                })
              ),
            },
          }
        })
      ),
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

  const element = await ctx.prisma.learningElement.upsert({
    where: { id: id ?? uuidv4() },
    create: createOrUpdateJSON,
    update: createOrUpdateJSON,
    include: {
      course: true,
      stacks: {
        include: {
          elements: {
            include: {
              questionInstance: true,
            },
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
    typename: 'LearningElement',
    id,
  })

  return element
}

// TODO: remove this after migration to practice quiz
interface GetBookMarksLearningElement {
  elementId: string
  courseId: string
}

// TODO: remove this function after migration to practice quiz
export async function getBookmarksLearningElement(
  { elementId, courseId }: GetBookMarksLearningElement,
  ctx: Context
) {
  if (!ctx.user?.sub) {
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
      bookmarkedStacks: {
        where: {
          learningElementId: elementId,
        },
      },
    },
  })

  return participation?.bookmarkedStacks
}

interface GetQuestionStackArgs {
  id: number
}

export async function getQuestionStack(
  { id }: GetQuestionStackArgs,
  ctx: ContextWithUser
) {
  if (id === -1) {
    return null
  }

  const stack = await ctx.prisma.questionStack.findUnique({
    where: {
      id,
    },
    include: {
      elements: {
        include: {
          questionInstance: true,
        },
      },
    },
  })

  return stack
}
