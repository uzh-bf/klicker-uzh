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
  ElementInstanceType,
  ElementOrderType,
  ElementStackType,
  ElementType,
  PublicationStatus,
  UserRole,
} from '@klicker-uzh/prisma'
import { PrismaClientKnownRequestError } from '@klicker-uzh/prisma/dist/runtime/library'
import { getInitialElementResults, processElementData } from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import * as R from 'ramda'
import { v4 as uuidv4 } from 'uuid'
import { Context, ContextWithUser } from '../lib/context'
import { orderStacks } from '../lib/util'
import {
  ChoiceQuestionOptions,
  FreeTextQuestionOptions,
  NumericalQuestionOptions,
  ResponseInput,
} from '../ops'
import { IInstanceEvaluation } from '../schema/question'
import {
  AllElementTypeData,
  AllQuestionInstanceTypeData,
  ContentInstanceResults,
  FlashcardCorrectness,
  FlashcardInstanceResults,
  QuestionResponse,
  QuestionResponseChoices,
  StackFeedbackStatus,
} from '../types/app'

const POINTS_PER_INSTANCE = 10
const POINTS_AWARD_TIMEFRAME_DAYS = 6
const XP_AWARD_TIMEFRAME_DAYS = 1

export async function getPracticeQuizData(
  { id }: { id: string },
  ctx: Context
) {
  const quiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      OR: [
        {
          status: PublicationStatus.PUBLISHED,
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
            include:
              ctx.user?.sub && ctx.user.role === UserRole.PARTICIPANT
                ? {
                    responses: {
                      where: {
                        participantId: ctx.user.sub,
                      },
                    },
                  }
                : undefined,
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

  if (!quiz) return null

  if (ctx.user?.sub && ctx.user.role === UserRole.PARTICIPANT) {
    // TODO: add time decay as well
    // TODO: adapt the implementation to multiple instances per stack - resorting inside the stack does probably not make sense
    // const orderedStacks = quiz.stacks.toSorted((a, b) => { // TODO: use once nodejs 20 is used
    const orderedStacks = orderStacks(quiz.stacks)

    return {
      ...quiz,
      stacks: orderedStacks,
    }
  }

  return quiz
}

interface RespondToFlashcardInput {
  id: number
  courseId: string
  response: FlashcardCorrectness
}

async function respondToFlashcard(
  { id, courseId, response }: RespondToFlashcardInput,
  ctx: Context
) {
  const existingInstance = await ctx.prisma.elementInstance.findUnique({
    where: {
      id,
    },
  })

  // check if the instance exists and the response is valid
  if (
    !existingInstance ||
    ![
      FlashcardCorrectness.INCORRECT,
      FlashcardCorrectness.PARTIAL,
      FlashcardCorrectness.CORRECT,
    ].includes(response)
  ) {
    return null
  }

  // create result from flashcard response
  const flashcardResultMap: Record<FlashcardCorrectness, StackFeedbackStatus> =
    {
      [FlashcardCorrectness.INCORRECT]: StackFeedbackStatus.INCORRECT,
      [FlashcardCorrectness.PARTIAL]: StackFeedbackStatus.PARTIAL,
      [FlashcardCorrectness.CORRECT]: StackFeedbackStatus.CORRECT,
    }
  const result = {
    grading: flashcardResultMap[response],
    score: null,
  }

  // update the aggregated data on the element instance
  const existingResults = existingInstance.results as FlashcardInstanceResults
  await ctx.prisma.elementInstance.update({
    where: {
      id,
    },
    data: {
      results: {
        ...existingResults,
        [response]: (existingResults[response] ?? 0) + 1,
        total: existingResults.total + 1,
      },
    },
  })

  // fetch the participation of the participant
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

  // if no user exists, return the grading for client display
  if (!ctx.user?.sub || !participation) {
    return result
  }

  // create question detail response
  await ctx.prisma.questionResponseDetail.create({
    data: {
      response: {
        correctness: response,
      },
      participant: {
        connect: { id: ctx.user.sub },
      },
      elementInstance: {
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

  // find existing question response to this instance by this user and/or create/update it
  const existingResponse = await ctx.prisma.questionResponse.findUnique({
    where: {
      participantId_elementInstanceId: {
        participantId: ctx.user.sub,
        elementInstanceId: id,
      },
    },
  })
  const aggregatedResponses = existingResponse?.aggregatedResponses ?? {
    [FlashcardCorrectness.INCORRECT]: 0,
    [FlashcardCorrectness.PARTIAL]: 0,
    [FlashcardCorrectness.CORRECT]: 0,
    total: 0,
  }

  const questionResponse = await ctx.prisma.questionResponse.upsert({
    where: {
      participantId_elementInstanceId: {
        participantId: ctx.user.sub,
        elementInstanceId: id,
      },
    },
    create: {
      participant: {
        connect: { id: ctx.user.sub },
      },
      elementInstance: {
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
      // RESPONSE and aggregated response creation
      response: {
        correctness: response,
      },
      aggregatedResponses: {
        ...aggregatedResponses,
        total: 1,
        [response]: 1,
      },
      trialsCount: 1,

      // CORRECT
      correctCount: response === FlashcardCorrectness.CORRECT ? 1 : 0,
      correctCountStreak: response === FlashcardCorrectness.CORRECT ? 1 : 0,
      lastCorrectAt:
        response === FlashcardCorrectness.CORRECT ? new Date() : undefined,

      // PARTIALLY CORRECT
      partialCorrectCount: response === FlashcardCorrectness.PARTIAL ? 1 : 0,
      lastPartialCorrectAt:
        response === FlashcardCorrectness.PARTIAL ? new Date() : undefined,

      // WRONG
      wrongCount: response === FlashcardCorrectness.INCORRECT ? 1 : 0,
      lastWrongAt:
        response === FlashcardCorrectness.INCORRECT ? new Date() : undefined,
    },
    update: {
      // RESPONSE
      response: {
        correctness: response,
      },
      aggregatedResponses: {
        ...aggregatedResponses,
        [response]: aggregatedResponses[response] + 1,
        total: aggregatedResponses.total + 1,
      },

      trialsCount: {
        increment: 1,
      },

      // CORRECT
      correctCount: {
        increment: response === FlashcardCorrectness.CORRECT ? 1 : 0,
      },
      correctCountStreak: {
        increment:
          response === FlashcardCorrectness.CORRECT
            ? 1
            : existingResponse
            ? -existingResponse.correctCountStreak
            : 0,
      },
      lastCorrectAt:
        response === FlashcardCorrectness.CORRECT ? new Date() : undefined,

      // PARTIALLY CORRECT
      partialCorrectCount: {
        increment: response === FlashcardCorrectness.PARTIAL ? 1 : 0,
      },
      lastPartialCorrectAt:
        response === FlashcardCorrectness.PARTIAL ? new Date() : undefined,

      // INCORRECT
      wrongCount: {
        increment: response === FlashcardCorrectness.INCORRECT ? 1 : 0,
      },
      lastWrongAt:
        response === FlashcardCorrectness.INCORRECT ? new Date() : undefined,
    },
  })

  return result
}

interface RespondToContentInput {
  id: number
  courseId: string
}

async function respondToContent(
  { id, courseId }: RespondToContentInput,
  ctx: Context
) {
  // TODO: potentially use aggregated results here as well to count how often the content was viewed
  const existingInstance = await ctx.prisma.elementInstance.findUnique({
    where: {
      id,
    },
  })

  // check if the instance exists and the response is valid
  if (!existingInstance) {
    return null
  }

  // context elements can only be "read" when submitted
  const result = {
    grading: StackFeedbackStatus.CORRECT,
    score: null,
  }

  // update the aggregated data on the element instance
  const existingResults = existingInstance.results as ContentInstanceResults
  await ctx.prisma.elementInstance.update({
    where: {
      id,
    },
    data: {
      results: {
        total: existingResults.total + 1,
      },
    },
  })

  // fetch the participation of the participant
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

  // if no user exists, return the grading for client display
  if (!ctx.user?.sub || !participation) {
    return result
  }

  // create question detail response
  await ctx.prisma.questionResponseDetail.create({
    data: {
      response: {
        viewed: true,
      },
      participant: {
        connect: { id: ctx.user.sub },
      },
      elementInstance: {
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

  // create / update question response
  const questionResponse = await ctx.prisma.questionResponse.upsert({
    where: {
      participantId_elementInstanceId: {
        participantId: ctx.user.sub,
        elementInstanceId: id,
      },
    },
    create: {
      participant: {
        connect: { id: ctx.user.sub },
      },
      elementInstance: {
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
      // RESPONSE and aggregated response creation
      response: {
        viewed: true,
      },
      trialsCount: 1,

      // CORRECT
      correctCount: 1,
      correctCountStreak: 1,
      lastCorrectAt: new Date(),
    },
    update: {
      // RESPONSE
      response: {
        viewed: true,
      },
      trialsCount: {
        increment: 1,
      },

      // CORRECT
      correctCount: {
        increment: 1,
      },
      correctCountStreak: {
        increment: 1,
      },
      lastCorrectAt: new Date(),
    },
  })

  return result
}

function evaluateQuestionResponse(
  elementData: AllElementTypeData,
  results: any,
  response: ResponseInput,
  multiplier?: number
) {
  switch (elementData.type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM: {
      // TODO: feedbacks only for selected options?
      // const feedbacks = elementData.options.choices.filter((choice) =>
      //   response.choices!.includes(choice.ix)
      // )

      const elementOptions = elementData.options as ChoiceQuestionOptions
      const feedbacks = elementOptions.choices
      const solution = elementOptions.choices.reduce<number[]>(
        (acc, choice) => {
          if (choice.correct) return [...acc, choice.ix]
          return acc
        },
        []
      )

      if (elementData.type === ElementType.SC) {
        const pointsPercentage = gradeQuestionSC({
          responseCount: elementOptions.choices.length,
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
          pointsMultiplier: multiplier,
          explanation: elementData.explanation,
        }
      } else if (elementData.type === ElementType.MC) {
        const pointsPercentage = gradeQuestionMC({
          responseCount: elementOptions.choices.length,
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
          pointsMultiplier: multiplier,
          explanation: elementData.explanation,
        }
      } else {
        const pointsPercentage = gradeQuestionKPRIM({
          responseCount: elementOptions.choices.length,
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
          pointsMultiplier: multiplier,
          explanation: elementData.explanation,
        }
      }
    }

    case ElementType.NUMERICAL: {
      const solutionRanges = (elementData.options as NumericalQuestionOptions)
        .solutionRanges

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
        pointsMultiplier: multiplier,
        explanation: elementData.explanation,
      }
    }

    case ElementType.FREE_TEXT: {
      const solutions = (elementData.options as FreeTextQuestionOptions)
        .solutions

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
        pointsMultiplier: multiplier,
        explanation: elementData.explanation,
      }
    }

    default:
      return null
  }
}

export async function respondToQuestion(
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
      const instance = await prisma.elementInstance.findUnique({
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

      const elementData = instance?.elementData

      // FIXME: ensure the types of this allow assignment of the different element type results
      const results: AllQuestionInstanceTypeData['results'] = instance?.results

      if (!elementData) {
        return {}
      }

      let updatedResults:
        | {
            choices: Record<string, number>
            total: number
          }
        | Record<string, number> = {}

      switch (elementData.type) {
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
          updatedResults.total = results.total + 1
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
            (typeof elementData.options.restrictions?.min === 'number' &&
              parsedValue < elementData.options.restrictions.min) ||
            (typeof elementData.options.restrictions?.max === 'number' &&
              parsedValue > elementData.options.restrictions.max)
          ) {
            return {}
          }

          const value = String(parsedValue)

          if (Object.keys(results.responses).includes(value)) {
            updatedResults.responses = {
              ...results.responses,
              [value]: results.responses[value] + 1,
            }
          } else {
            updatedResults.responses = { ...results.responses, [value]: 1 }
          }
          updatedResults.total = results.total + 1
          break
        }

        case ElementType.FREE_TEXT: {
          if (
            typeof response.value === 'undefined' ||
            response.value === null ||
            response.value === '' ||
            (typeof elementData.options.restrictions?.maxLength === 'number' &&
              response.value.length >
                elementData.options.restrictions?.maxLength)
          ) {
            return {}
          }

          const value = R.toLower(R.trim(response.value))

          if (Object.keys(results.responses).includes(value)) {
            updatedResults.responses = {
              ...results.responses,
              [value]: results.responses[value] + 1,
            }
          } else {
            updatedResults.responses = { ...results.responses, [value]: 1 }
          }
          updatedResults.total = results.total + 1
          break
        }

        default:
          break
      }

      const updatedInstance = await prisma.elementInstance.update({
        where: { id },
        data: {
          results: updatedResults,
        },
      })

      return {
        instance,
        updatedInstance,
      }
    }
  )

  const elementData = updatedInstance?.elementData
  const results = updatedInstance?.results

  if (!instance || !updatedInstance || !elementData) return null

  const evaluation = evaluateQuestionResponse(
    elementData,
    results,
    response,
    updatedInstance.options.pointsMultiplier
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
            instance?.options.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
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
        .add(
          instance?.options.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
          'days'
        )
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
        .add(
          instance?.options.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
          'days'
        )
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
          participantId_elementInstanceId: {
            participantId: ctx.user.sub,
            elementInstanceId: id,
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
          elementInstance: {
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
          elementInstance: {
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

  // processing of percentile into status of instance
  const status =
    evaluation?.percentile === 0
      ? StackFeedbackStatus.INCORRECT
      : evaluation?.percentile === 1
      ? StackFeedbackStatus.CORRECT
      : StackFeedbackStatus.PARTIAL

  return {
    ...updatedInstance,
    evaluation: evaluation
      ? {
          ...evaluation,
          pointsAwarded,
          newPointsFrom,
          xpAwarded,
          newXpFrom,
          solutions: elementData.options.solutions,
          solutionRanges: elementData.options.solutionRanges,
        }
      : undefined,
    status: status,
  }
}

function combineStackStatus({
  prevStatus,
  newStatus,
}: {
  prevStatus: StackFeedbackStatus
  newStatus: StackFeedbackStatus
}) {
  // if the new status is not valid, return the previous one
  if (
    newStatus !== StackFeedbackStatus.INCORRECT &&
    newStatus !== StackFeedbackStatus.PARTIAL &&
    newStatus !== StackFeedbackStatus.CORRECT
  ) {
    return prevStatus
  }

  if (prevStatus === StackFeedbackStatus.UNANSWERED) {
    // if this is the first response to the stack, set the feedback to the result
    return newStatus
  } else if (prevStatus === StackFeedbackStatus.CORRECT) {
    // only keep the value at correct, if the answer was correct (partial otherwise)
    return newStatus === StackFeedbackStatus.CORRECT
      ? StackFeedbackStatus.CORRECT
      : StackFeedbackStatus.PARTIAL
  } else if (prevStatus === StackFeedbackStatus.INCORRECT) {
    // if the result is correct or partially correct, switch to partial
    return newStatus === StackFeedbackStatus.INCORRECT
      ? StackFeedbackStatus.INCORRECT
      : StackFeedbackStatus.PARTIAL
  }

  // if the state before was partial, keep it as partial (independent of the grading result)
  return prevStatus
}

interface RespondToPracticeQuizStackInput {
  stackId: number
  courseId: string
  responses: {
    instanceId: number
    type: ElementType
    flashcardResponse?: FlashcardCorrectness | null
    contentReponse?: boolean | null
    choicesResponse?: number[] | null
    numericalResponse?: number | null
    freeTextResponse?: string | null
  }[]
}

export async function respondToPracticeQuizStack(
  { stackId, courseId, responses }: RespondToPracticeQuizStackInput,
  ctx: Context
) {
  let stackScore: number | undefined = undefined
  let stackFeedback = StackFeedbackStatus.UNANSWERED
  const evaluationsArr: IInstanceEvaluation[] = []

  // TODO: refactor this into a transaction and single combination of status and score for the stack
  for (const response of responses) {
    if (response.type === ElementType.FLASHCARD) {
      const result = await respondToFlashcard(
        {
          id: response.instanceId,
          courseId: courseId,
          response: response.flashcardResponse!,
        },
        ctx
      )

      // only update status as no points are awarded for flashcards
      if (
        result !== null &&
        (result.grading === StackFeedbackStatus.CORRECT ||
          result.grading === StackFeedbackStatus.PARTIAL ||
          result.grading === StackFeedbackStatus.INCORRECT)
      ) {
        stackFeedback = combineStackStatus({
          prevStatus: stackFeedback,
          newStatus: result.grading,
        })
      }
    } else if (
      response.type === ElementType.CONTENT &&
      response.contentReponse === true
    ) {
      const result = await respondToContent(
        {
          id: response.instanceId,
          courseId: courseId,
        },
        ctx
      )

      // only update status as no points are awarded for content elements
      if (
        result !== null &&
        (result.grading === StackFeedbackStatus.CORRECT ||
          result.grading === StackFeedbackStatus.PARTIAL ||
          result.grading === StackFeedbackStatus.INCORRECT)
      ) {
        stackFeedback = combineStackStatus({
          prevStatus: stackFeedback,
          newStatus: result.grading,
        })
      }
    } else if (
      response.type === ElementType.SC ||
      response.type === ElementType.MC ||
      response.type === ElementType.KPRIM
    ) {
      const result = await respondToQuestion(
        {
          courseId: courseId,
          id: response.instanceId,
          response: { choices: response.choicesResponse },
        },
        ctx
      )

      if (result) {
        stackFeedback = combineStackStatus({
          prevStatus: stackFeedback,
          newStatus: result.status,
        })

        stackScore =
          typeof stackScore === 'undefined'
            ? result.evaluation?.score
            : stackScore + (result.evaluation?.score ?? 0)

        evaluationsArr.push({
          instanceId: response.instanceId,
          ...result.evaluation,
        } as IInstanceEvaluation)
      }
    } else if (response.type === ElementType.NUMERICAL) {
      const result = await respondToQuestion(
        {
          courseId: courseId,
          id: response.instanceId,
          response: { value: String(response.numericalResponse) },
        },
        ctx
      )

      if (result) {
        stackFeedback = combineStackStatus({
          prevStatus: stackFeedback,
          newStatus: result.status,
        })

        stackScore =
          typeof stackScore === 'undefined'
            ? result.evaluation?.score
            : stackScore + (result.evaluation?.score ?? 0)

        evaluationsArr.push({
          instanceId: response.instanceId,
          ...result.evaluation,
        } as IInstanceEvaluation)
      }
    } else if (response.type === ElementType.FREE_TEXT) {
      const result = await respondToQuestion(
        {
          courseId: courseId,
          id: response.instanceId,
          response: { value: response.freeTextResponse },
        },
        ctx
      )

      if (result) {
        stackFeedback = combineStackStatus({
          prevStatus: stackFeedback,
          newStatus: result.status,
        })

        stackScore =
          typeof stackScore === 'undefined'
            ? result.evaluation?.score
            : stackScore + (result.evaluation?.score ?? 0)

        evaluationsArr.push({
          instanceId: response.instanceId,
          ...result.evaluation,
        } as IInstanceEvaluation)
      }
    } else {
      throw new Error(
        'Submission of practice quiz stack answers not implemented for type ' +
          response.type
      )
    }
  }

  return {
    id: stackId,
    status: stackFeedback,
    score: stackScore,
    evaluations: evaluationsArr,
  }
}

interface PracticeQuizStackInput {
  displayName?: string | null
  description?: string | null
  order: number
  elements: {
    elementId: number
    order: number
  }[]
}

interface ManipulatePracticeQuizArgs {
  id?: string
  name: string
  displayName: string
  description?: string | null
  stacks: PracticeQuizStackInput[]
  courseId: string
  multiplier: number
  order: ElementOrderType
  resetTimeDays: number
}

export async function manipulatePracticeQuiz(
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
  }: ManipulatePracticeQuizArgs,
  ctx: ContextWithUser
) {
  if (id) {
    // find all instances belonging to the old session and delete them as the content of the questions might have changed
    const oldElement = await ctx.prisma.practiceQuiz.findUnique({
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
      throw new GraphQLError('Practice quiz not found')
    }
    if (oldElement.status === PublicationStatus.PUBLISHED) {
      throw new GraphQLError('Cannot edit a published practice quiz')
    }

    const oldInstances = oldElement.stacks.flatMap((stack) => stack.elements)

    await ctx.prisma.elementInstance.deleteMany({
      where: {
        id: { in: oldInstances.map(({ id }) => id) },
      },
    })

    await ctx.prisma.practiceQuiz.update({
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
      (stackElem) => stackElem !== null && typeof stackElem !== undefined
    ) as number[]

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
    name,
    displayName: displayName ?? name,
    description,
    pointsMultiplier: multiplier,
    orderType: order,
    resetTimeDays: resetTimeDays,
    stacks: {
      create: stacks.map((stack) => {
        return {
          type: ElementStackType.PRACTICE_QUIZ,
          order: stack.order,
          displayName: stack.displayName ?? '',
          description: stack.description ?? '',
          options: {},
          elements: {
            create: stack.elements.map((elem) => {
              const element = elementMap[elem.elementId]

              const processedElementData = processElementData(element)

              return {
                elementType: element.type,
                migrationId: uuidv4(),
                order: elem.order,
                type: ElementInstanceType.PRACTICE_QUIZ,
                elementData: processedElementData,
                options: {
                  pointsMultiplier: multiplier * element.pointsMultiplier,
                  resetTimeDays,
                },
                results: getInitialElementResults(processedElementData),
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

  const element = await ctx.prisma.practiceQuiz.upsert({
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
    typename: 'PracticeQuiz',
    id,
  })

  return element
}

interface GetBookmarksPracticeQuizArgs {
  quizId?: string | null
  courseId: string
}

export async function getBookmarksPracticeQuiz(
  { quizId, courseId }: GetBookmarksPracticeQuizArgs,
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
      bookmarkedElementStacks: {
        where: {
          practiceQuizId: quizId ?? undefined,
        },
      },
    },
  })

  return participation?.bookmarkedElementStacks.map((stack) => stack.id)
}

interface DeletePracticeQuizArgs {
  id: string
}

export async function deletePracticeQuiz(
  { id }: DeletePracticeQuizArgs,
  ctx: ContextWithUser
) {
  try {
    const deletedItem = await ctx.prisma.practiceQuiz.delete({
      where: {
        id,
        ownerId: ctx.user.sub,
        status: PublicationStatus.DRAFT,
      },
    })

    ctx.emitter.emit('invalidate', {
      typename: 'PracticeQuiz',
      id,
    })

    return deletedItem
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e?.code === 'P2025') {
      console.log(
        'The practice quiz is not in draft status and cannot be deleted.'
      )
      return null
    }

    throw e
  }
}

interface PublishPracticeQuizArgs {
  id: string
}

export async function publishPracticeQuiz(
  { id }: PublishPracticeQuizArgs,
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.update({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    data: {
      status: PublicationStatus.PUBLISHED,
    },
  })

  return practiceQuiz
}
