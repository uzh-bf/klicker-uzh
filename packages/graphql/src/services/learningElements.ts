import {
  computeAwardedXp,
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionNumerical,
  gradeQuestionSC,
} from '@klicker-uzh/grading'
import {
  Attachment,
  LearningElementStatus,
  OrderType,
  Question,
  QuestionInstance,
  QuestionInstanceType,
  QuestionResponse as PrismaQuestionResponse,
  QuestionStack,
  QuestionStackType,
  QuestionType,
  UserRole,
} from '@klicker-uzh/prisma'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import * as R from 'ramda'
import { Context, ContextWithUser } from '../lib/context'
import { prepareInitialInstanceResults, processQuestionData } from './sessions'

const POINTS_AWARD_TIMEFRAME_DAYS = 6
const XP_AWARD_TIMEFRAME_DAYS = 1

type QuestionResponse = {
  choices?: number[] | null
  value?: string | null
}

function round(value: number) {
  return Number(Math.round(Number(value) * 100) / 100)
}

function evaluateQuestionResponse(
  questionData: AllQuestionTypeData,
  results: any,
  response: QuestionResponse,
  multiplier?: number
) {
  switch (questionData.type) {
    case QuestionType.SC:
    case QuestionType.MC:
    case QuestionType.KPRIM: {
      const data = questionData as ChoicesQuestionData

      // TODO: feedbacks only for selected options?
      // const feedbacks = questionData.options.choices.filter((choice) =>
      //   response.choices!.includes(choice.ix)
      // )

      const feedbacks = data.options.choices
      const solution = data.options.choices.reduce<number[]>((acc, choice) => {
        if (choice.correct) return [...acc, choice.ix]
        return acc
      }, [])

      if (data.type === QuestionType.SC) {
        const pointsPercentage = gradeQuestionSC({
          responseCount: data.options.choices.length,
          response: response.choices!,
          solution,
        })
        return {
          feedbacks,
          choices: results.choices,
          score:
            pointsPercentage !== null
              ? round(pointsPercentage * 10 * (multiplier ?? 1))
              : -1,
          xp: computeAwardedXp({
            pointsPercentage,
            multiplier: multiplier ?? 1,
          }),
        }
      } else if (data.type === QuestionType.MC) {
        const pointsPercentage = gradeQuestionMC({
          responseCount: data.options.choices.length,
          response: response.choices!,
          solution,
        })
        return {
          feedbacks,
          choices: results.choices,
          score:
            pointsPercentage !== null
              ? round(pointsPercentage * 10 * (multiplier ?? 1))
              : -1,
          xp: computeAwardedXp({
            pointsPercentage,
            multiplier: multiplier ?? 1,
          }),
        }
      } else {
        const pointsPercentage = gradeQuestionKPRIM({
          responseCount: data.options.choices.length,
          response: response.choices!,
          solution,
        })
        return {
          feedbacks,
          choices: results.choices,
          score:
            pointsPercentage !== null
              ? round(pointsPercentage * 10 * (multiplier ?? 1))
              : -1,
          xp: computeAwardedXp({
            pointsPercentage,
            multiplier: multiplier ?? 1,
          }),
        }
      }
    }

    case QuestionType.NUMERICAL: {
      const data = questionData as NumericalQuestionData
      const solutionRanges = data.options.solutionRanges

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
          multiplier: multiplier ?? 1,
        }),
      }
    }

    case QuestionType.FREE_TEXT: {
      const data = questionData as FreeTextQuestionData
      const solutions = data.options.solutions

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
          multiplier: multiplier ?? 1,
        }),
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
  }: { courseId: string; id: number; response: QuestionResponse },
  ctx: Context
) {
  const {
    instance,
    updatedInstance,
  }: {
    instance?: QuestionInstance | null
    updatedInstance?: QuestionInstance
  } = await ctx.prisma.$transaction(async (prisma) => {
    const instance = await prisma.questionInstance.findUnique({
      where: { id },
      // if the participant is logged in, fetch the last response of the participant
      // the response will not be counted and will only yield points if not within the past week
      include:
        ctx.user?.sub && ctx.user.role === UserRole.PARTICIPANT
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
    if (ctx.user?.sub && hasPreviousResponse) {
      return {
        instance,
        updatedInstance: instance,
      }
    }

    const questionData =
      instance?.questionData?.valueOf() as AllQuestionTypeData
    const results = instance?.results?.valueOf() as AllQuestionResults

    if (!questionData) {
      return {}
    }

    let updatedResults:
      | {
          choices?: Record<string, number>
        }
      | Record<string, number> = {}

    switch (questionData.type) {
      case QuestionType.SC:
      case QuestionType.MC:
      case QuestionType.KPRIM: {
        updatedResults.choices = response.choices!.reduce(
          (acc, ix) => ({
            ...acc,
            [ix]: acc[ix] + 1,
          }),
          results.choices as Record<string, number>
        )
        break
      }

      case QuestionType.NUMERICAL: {
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
          (typeof questionData.options.restrictions!.min === 'number' &&
            parsedValue < questionData.options.restrictions!.min) ||
          (typeof questionData.options.restrictions!.max === 'number' &&
            parsedValue > questionData.options.restrictions!.max)
        ) {
          return {}
        }

        const value = String(parsedValue)

        if (Object.keys(results).includes(value)) {
          updatedResults = {
            ...results,
            [value]: (results as NumericalQuestionResults)[value] + 1,
          }
        } else {
          updatedResults = { ...results, [value]: 1 }
        }
        break
      }

      case QuestionType.FREE_TEXT: {
        if (
          typeof response.value === 'undefined' ||
          response.value === null ||
          response.value === '' ||
          (typeof questionData.options.restrictions!.maxLength === 'number' &&
            response.value.length >
              questionData.options.restrictions!.maxLength)
        ) {
          return {}
        }

        const value = R.toLower(R.trim(response.value))

        if (Object.keys(results).includes(value)) {
          updatedResults = {
            ...results,
            [value]: (results as FreeTextQuestionResults)[value] + 1,
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
        participants: {
          increment: 1,
        },
      },
    })

    return {
      instance,
      updatedInstance,
    }
  })

  const questionData =
    updatedInstance?.questionData?.valueOf() as AllQuestionTypeData
  const results = updatedInstance?.results?.valueOf() as AllQuestionResults

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
  if (ctx.user?.sub && ctx.user.role === UserRole.PARTICIPANT) {
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
        pointsAwarded = score / 2
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
          response,
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
          response,
          lastAwardedAt,
          lastXpAwardedAt,
          trialsCount: {
            increment: 1,
          },
          totalScore: {
            increment: score,
          },
          totalPointsAwarded: {
            increment: pointsAwarded,
          },
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
          response,
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

        const questionData =
          element.questionInstance.questionData?.valueOf() as AllQuestionTypeData

        switch (questionData?.type) {
          case QuestionType.SC:
          case QuestionType.MC:
          case QuestionType.KPRIM:
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

          case QuestionType.NUMERICAL:
          case QuestionType.FREE_TEXT:
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

interface CreateLearningElementArgs {
  name: string
  displayName: string
  description?: string | null
  questions: number[]
  courseId?: string | null
  multiplier: number
  order: OrderType
  resetTimeDays: number
}

export async function createLearningElement(
  {
    name,
    displayName,
    description,
    questions,
    courseId,
    multiplier,
    order,
    resetTimeDays,
  }: CreateLearningElementArgs,
  ctx: ContextWithUser
) {
  const dbQuestions = await ctx.prisma.question.findMany({
    where: {
      id: { in: questions },
      ownerId: ctx.user.sub,
    },
    include: {
      attachments: true,
    },
  })

  const uniqueQuestions = new Set(dbQuestions.map((q) => q.id))
  if (dbQuestions.length !== uniqueQuestions.size) {
    throw new GraphQLError('Not all questions could be found')
  }

  const questionMap = dbQuestions.reduce<
    Record<number, Question & { attachments: Attachment[] }>
  >((acc, question) => ({ ...acc, [question.id]: question }), {})

  const element = await ctx.prisma.learningElement.create({
    data: {
      name,
      displayName: displayName ?? name,
      description,
      pointsMultiplier: multiplier,
      orderType: order,
      resetTimeDays: resetTimeDays,
      stacks: {
        create: await Promise.all(
          questions.map(async (questionId, ix) => {
            const question = questionMap[questionId]
            const processedQuestionData = processQuestionData(question)
            const questionAttachmentInstances = question.attachments.map(
              R.pick(['type', 'href', 'name', 'description', 'originalName'])
            )

            return {
              type: QuestionStackType.LEARNING_ELEMENT,
              order: ix,
              elements: {
                create: [
                  {
                    order: 0,
                    questionInstance: {
                      create: {
                        order: ix,
                        type: QuestionInstanceType.LEARNING_ELEMENT,
                        questionData: processedQuestionData,
                        results: prepareInitialInstanceResults(
                          processedQuestionData
                        ),
                        question: {
                          connect: { id: questionId },
                        },
                        owner: {
                          connect: { id: ctx.user.sub },
                        },
                        attachments: {
                          create: questionAttachmentInstances,
                        },
                      },
                    },
                  },
                ],
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
    },
    include: {
      instances: true,
    },
  })

  ctx.emitter.emit('invalidate', {
    typename: 'LearningElement',
    id: element.id,
  })

  return element
}

interface GetBookMarksLearningElement {
  elementId: string
  courseId: string
}

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

interface PublishLearningElementArgs {
  id: string
}

export async function publishLearningElement(
  { id }: PublishLearningElementArgs,
  ctx: ContextWithUser
) {
  const learningElement = await ctx.prisma.learningElement.update({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    data: {
      status: LearningElementStatus.PUBLISHED,
    },
  })

  return learningElement
}

interface DeleteLearningElementArgs {
  id: string
}

export async function deleteLearningElement(
  { id }: DeleteLearningElementArgs,
  ctx: ContextWithUser
) {
  try {
    const deletedItem = await ctx.prisma.learningElement.delete({
      where: {
        id,
        ownerId: ctx.user.sub,
        status: LearningElementStatus.DRAFT,
      },
    })

    ctx.emitter.emit('invalidate', {
      typename: 'LearningElement',
      id,
    })

    return deletedItem
  } catch (e) {
    // TODO: resolve type issue by first testing for prisma error
    if (e?.code === 'P2025') {
      console.log(
        'The learning element is not in draft status and cannot be deleted.'
      )
      return null
    }

    throw e
  }
}
