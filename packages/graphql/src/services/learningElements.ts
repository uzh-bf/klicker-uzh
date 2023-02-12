import {
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionSC,
} from '@klicker-uzh/grading'
import {
  Attachment,
  OrderType,
  Question,
  QuestionInstance,
  QuestionInstanceType,
  QuestionType,
} from '@klicker-uzh/prisma'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import * as R from 'ramda'
import { pick } from 'ramda'
import { Context, ContextWithUser } from '../lib/context'
import { shuffle } from '../util'
import { prepareInitialInstanceResults, processQuestionData } from './sessions'

const POINTS_AWARD_TIMEFRAME_DAYS = 6

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
        }
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
    instance: QuestionInstance | null
    updatedInstance: QuestionInstance
  } | null = await ctx.prisma.$transaction(async (prisma) => {
    const instance = await prisma.questionInstance.findUnique({
      where: { id },
      // if the participant is logged in, fetch the last response of the participant
      // the response will not be counted and will only yield points if not within the past week
      include: ctx.user?.sub
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
      return null
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

    if (!questionData) return null

    const updatedResults: {
      choices?: Record<string, number>
    } = {}

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
        break
      }

      case QuestionType.FREE_TEXT: {
        break
      }
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

  if (!questionData) return null

  const evaluation = evaluateQuestionResponse(
    questionData,
    results,
    response,
    updatedInstance.pointsMultiplier
  )
  const score = evaluation?.score || 0
  let pointsAwarded
  let newPointsFrom
  let lastAwardedAt
  const promises = []

  // if the user is logged in and the last response was not within the past 6 days
  // award points and update the response
  if (ctx.user?.sub) {
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

      lastAwardedAt = previousResponseOutsideTimeframe
        ? new Date()
        : instance.responses[0].lastAwardedAt
      newPointsFrom = dayjs(lastAwardedAt)
        .add(instance?.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS, 'days')
        .toDate()
    } else {
      pointsAwarded = score

      lastAwardedAt = new Date()
      newPointsFrom = dayjs(lastAwardedAt)
        .add(instance?.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS, 'days')
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
          trialsCount: 1,
          lastAwardedAt,
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
          trialsCount: {
            increment: 1,
          },
          totalScore: {
            increment: score,
          },
          totalPointsAwarded: {
            increment: pointsAwarded,
          },
        },
      }),
      ctx.prisma.questionResponseDetail.create({
        data: {
          score,
          pointsAwarded,
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
        }
      : null,
  }
}

export async function getLearningElementData(
  { id }: { id: string },
  ctx: Context
) {
  const element = await ctx.prisma.learningElement.findUnique({
    where: { id },
    include: {
      course: true,
      instances: {
        orderBy: {
          questionId: 'asc',
        },
        include: ctx.user?.sub
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
  })

  if (!element) return null

  const instancesWithoutSolution = element.instances.reduce<{
    instances: QuestionInstance[]
    previouslyAnswered: number
    previousScore: number
    previousPointsAwarded: number
    totalTrials: number
  }>(
    (acc, instance) => {
      const questionData =
        instance.questionData?.valueOf() as AllQuestionTypeData
      if (
        !questionData ||
        typeof questionData !== 'object' ||
        Array.isArray(questionData)
      )
        return {
          ...acc,
          instances: [...acc.instances, instance],
        }

      switch (questionData.type) {
        case QuestionType.SC:
        case QuestionType.MC:
        case QuestionType.KPRIM:
          const response = instance.responses?.[0]
          return {
            previouslyAnswered: acc.previouslyAnswered + Number(!!response),
            previousScore: acc.previousScore + (response?.totalScore ?? 0),
            previousPointsAwarded:
              acc.previousPointsAwarded + (response?.totalPointsAwarded ?? 0),
            totalTrials: acc.totalTrials + (response?.trialsCount ?? 0),
            instances: [
              ...acc.instances,
              {
                ...instance,
                lastResponse: response?.lastAwardedAt,
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
            ],
          }

        case QuestionType.FREE_TEXT:
        case QuestionType.NUMERICAL:
        default: {
          const response = instance.responses?.[0]
          return {
            previouslyAnswered: acc.previouslyAnswered + Number(!!response),
            previousScore: acc.previousScore + (response?.totalScore ?? 0),
            previousPointsAwarded:
              acc.previousPointsAwarded + (response?.totalPointsAwarded ?? 0),
            totalTrials: acc.totalTrials + (response?.trialsCount ?? 0),
            instances: [...acc.instances, instance],
          }
        }
      }
    },
    {
      instances: [],
      previouslyAnswered: 0,
      previousScore: 0,
      previousPointsAwarded: 0,
      totalTrials: 0,
    }
  )

  if (element.orderType === OrderType.LAST_RESPONSE) {
    const orderedInstances = R.sort(
      (a, b) => (a.lastResponse ?? 0) - (b.lastResponse ?? 0),
      shuffle(instancesWithoutSolution.instances)
    )

    return {
      ...element,
      ...instancesWithoutSolution,
      instances: orderedInstances,
    }
  }

  if (element.orderType === OrderType.SHUFFLED) {
    return {
      ...element,
      ...instancesWithoutSolution,
      instances: shuffle(instancesWithoutSolution.instances),
    }
  }

  return {
    ...element,
    ...instancesWithoutSolution,
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
      instances: {
        create: questions.map((questionId, ix) => {
          const question = questionMap[questionId]
          const processedQuestionData = processQuestionData(question)
          const questionAttachmentInstances = question.attachments.map(
            pick(['type', 'href', 'name', 'description', 'originalName'])
          )
          return {
            order: ix,
            type: QuestionInstanceType.LEARNING_ELEMENT,
            questionData: processedQuestionData,
            results: prepareInitialInstanceResults(processedQuestionData),
            question: {
              connect: { id: questionId },
            },
            owner: {
              connect: { id: ctx.user.sub },
            },
            attachments: {
              create: questionAttachmentInstances,
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

  ctx.emitter.emit('invalidate', {
    typename: 'LearningElement',
    id: element.id,
  })

  return element
}
