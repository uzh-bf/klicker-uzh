import {
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionSC,
} from '@klicker-uzh/grading'
import { QuestionType } from '@klicker-uzh/prisma'
import dayjs from 'dayjs'
import { pick } from 'ramda'
import { ContextWithOptionalUser } from '../lib/context'

const POINTS_AWARD_TIMEFRAME_DAYS = 6

type QuestionResponse = {
  choices?: number[]
  value?: string
}

function evaluateQuestionResponse(
  questionData: AllQuestionTypeData,
  results: any,
  response: QuestionResponse
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
          score: pointsPercentage !== null ? pointsPercentage * 10 : -1,
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
          score: pointsPercentage !== null ? pointsPercentage * 10 : -1,
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
          score: pointsPercentage !== null ? pointsPercentage * 10 : -1,
        }
      }
    }

    default:
      return null
  }
}

interface RespondToQuestionInstanceArgs {
  courseId: string
  id: number
  response: QuestionResponse
}

export async function respondToQuestionInstance(
  { courseId, id, response }: RespondToQuestionInstanceArgs,
  ctx: ContextWithOptionalUser
) {
  const { instance, updatedInstance } = await ctx.prisma.$transaction(
    async (prisma) => {
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
    }
  )

  const questionData =
    updatedInstance?.questionData?.valueOf() as AllQuestionTypeData
  const results = updatedInstance?.results?.valueOf() as AllQuestionResults

  if (!questionData) return null

  const evaluation = evaluateQuestionResponse(questionData, results, response)
  const score = evaluation?.score || 0
  let pointsAwarded
  let newPointsFrom
  const promises = []

  // if the user is logged in and the last response was not within the past 6 days
  // award points and update the response
  if (ctx.user?.sub) {
    const hasPreviousResponse = instance?.responses?.length > 0

    if (hasPreviousResponse) {
      const previousResponseOutsideTimeframe =
        !instance.responses[0].lastAwardedAt ||
        dayjs(instance.responses[0].lastAwardedAt).isBefore(
          dayjs().subtract(POINTS_AWARD_TIMEFRAME_DAYS, 'days')
        )

      if (previousResponseOutsideTimeframe) {
        pointsAwarded = score / 2
      } else {
        pointsAwarded = 0
      }

      const lastAwardedAt = previousResponseOutsideTimeframe
        ? new Date()
        : instance.responses[0].lastAwardedAt
      newPointsFrom = dayjs(lastAwardedAt)
        .add(POINTS_AWARD_TIMEFRAME_DAYS, 'days')
        .toDate()

      promises.push(
        ctx.prisma.questionResponse.update({
          where: {
            participantId_questionInstanceId: {
              participantId: ctx.user.sub,
              questionInstanceId: id,
            },
          },
          data: {
            response,
            trialsCount: {
              increment: 1,
            },
            totalScore: {
              increment: score,
            },
            totalPointsAwarded: {
              increment: pointsAwarded,
            },
            lastAwardedAt,
          },
        })
      )
    } else {
      pointsAwarded = score

      const lastAwardedAt = new Date()
      newPointsFrom = dayjs(lastAwardedAt)
        .add(POINTS_AWARD_TIMEFRAME_DAYS, 'days')
        .toDate()
      console.warn(newPointsFrom)

      promises.push(
        ctx.prisma.questionResponse.create({
          data: {
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
            totalScore: score,
            totalPointsAwarded: pointsAwarded,
            trialsCount: 1,
            lastAwardedAt,
          },
        })
      )
    }

    if (typeof pointsAwarded === 'number' && pointsAwarded > 0) {
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

interface GetLearningElementDataArgs {
  id: string
}

export async function getLearningElementData(
  { id }: GetLearningElementDataArgs,
  ctx: ContextWithOptionalUser
) {
  const element = await ctx.prisma.learningElement.findUnique({
    where: { id },
    include: {
      course: true,
      instances: {
        orderBy: {
          questionId: 'asc',
        },
        // TODO: get previous responses of the participant (last three days)
        // TODO: ensure that previously answered are marked and shuffled to the end
        // include: {
        //   responses: {
        //     where: {
        //       updatedAt: {
        //         gt: dayjs()
        //           .subtract(POINTS_AWARD_TIMEFRAME_DAYS, 'days')
        //           .toDate(),
        //       },
        //     },
        //   },
        // },
      },
    },
  })

  if (!element) return null

  const instancesWithoutSolution = element.instances.map((instance) => {
    const questionData = instance.questionData?.valueOf() as AllQuestionTypeData
    if (
      !questionData ||
      typeof questionData !== 'object' ||
      Array.isArray(questionData)
    )
      return instance

    switch (questionData.type) {
      case QuestionType.SC:
      case QuestionType.MC:
      case QuestionType.KPRIM:
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

      case QuestionType.FREE_TEXT:
        return instance

      case QuestionType.NUMERICAL:
        return instance

      default:
        return instance
    }
  })

  return {
    ...element,
    instances: instancesWithoutSolution,
  }
}
