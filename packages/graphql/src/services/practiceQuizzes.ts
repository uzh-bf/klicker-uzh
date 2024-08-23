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
  ElementInstance,
  ElementInstanceType,
  ElementOrderType,
  ElementStackType,
  ElementType,
  PublicationStatus,
  ResponseCorrectness,
  UserRole,
  QuestionResponse as PrismaQuestionResponse,
  InstanceStatistics,
  Participation,
} from '@klicker-uzh/prisma'
import { PrismaClientKnownRequestError } from '@klicker-uzh/prisma/dist/runtime/library.js'
import {
  getInitialElementResults,
  getInitialInstanceStatistics,
  processElementData,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { round } from 'mathjs'
import { createHash } from 'node:crypto'
import * as R from 'ramda'
import { v4 as uuidv4 } from 'uuid'
import { Context, ContextWithUser } from '../lib/context.js'
import { orderStacks } from '../lib/util.js'
import {
  FreeTextQuestionOptions,
  NumericalQuestionOptions,
  QuestionResponse as QuestionResponseType,
  ResponseInput,
} from '../ops.js'
import { IInstanceEvaluation } from '../schema/question.js'
import {
  AllElementTypeData,
  ContentResults,
  ElementInstanceResults,
  ElementResultsChoices,
  ElementResultsOpen,
  FlashcardCorrectness,
  FlashcardResults,
  QuestionResponse,
  QuestionResponseChoices,
  StackFeedbackStatus,
  StackInput,
} from '../types/app.js'

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
          status: PublicationStatus.SCHEDULED,
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

  // if the quiz is scheduled, return the quiz without the stacks
  if (quiz.status === PublicationStatus.SCHEDULED) {
    return { ...quiz, stacks: [] }
  }

  if (ctx.user?.sub && ctx.user.role === UserRole.PARTICIPANT) {
    // TODO: add time decay as well
    // TODO: adapt the implementation to multiple instances per stack - resorting inside the stack does probably not make sense
    // const orderedStacks = quiz.stacks.toSorted((a, b) => { // TODO: use once nodejs 20 is used
    const orderedStacks = orderStacks(quiz.stacks)

    return {
      ...quiz,
      stacks: orderedStacks,
      numOfStacks: orderedStacks.length,
    }
  }

  return quiz
}

interface CombineCorrectnessParamsInput {
  correct: boolean
  partial: boolean
  incorrect: boolean
  existingResponse?: QuestionResponseType | null
}

function combineNewCorrectnessParams({
  correct,
  partial,
  incorrect,
}: CombineCorrectnessParamsInput) {
  return {
    // track last answer date
    lastAnsweredAt: new Date(),

    // CORRECT
    correctCount: correct ? 1 : 0,
    correctCountStreak: correct ? 1 : 0,
    lastCorrectAt: correct ? new Date() : undefined,

    // PARTIALLY CORRECT
    partialCorrectCount: partial ? 1 : 0,
    lastPartialCorrectAt: partial ? new Date() : undefined,

    // WRONG
    wrongCount: incorrect ? 1 : 0,
    lastWrongAt: incorrect ? new Date() : undefined,
  }
}

function combineCorrectnessParams({
  correct,
  partial,
  incorrect,
  existingResponse,
}: CombineCorrectnessParamsInput) {
  return {
    // track last answer date
    lastAnsweredAt: new Date(),

    // CORRECT
    correctCount: {
      increment: correct ? 1 : 0,
    },
    correctCountStreak: {
      increment: correct
        ? 1
        : existingResponse
          ? -existingResponse.correctCountStreak
          : 0,
    },
    lastCorrectAt: correct ? new Date() : undefined,

    // PARTIALLY CORRECT
    partialCorrectCount: {
      increment: partial ? 1 : 0,
    },
    lastPartialCorrectAt: partial ? new Date() : undefined,

    // INCORRECT
    wrongCount: {
      increment: incorrect ? 1 : 0,
    },
    lastWrongAt: incorrect ? new Date() : undefined,
  }
}

type SpacedRepetitionResult = {
  efactor: number
  interval: number
  nextDueAt: Date
}

function updateSpacedRepetition({
  eFactor,
  interval,
  streak,
  grade,
}: {
  eFactor: number
  interval: number
  streak: number
  grade: number
}): SpacedRepetitionResult {
  if (grade < 0 || grade > 1) {
    throw new Error('Grade must be between 0 and 1.')
  }

  // scale grade to 0-5 range (definition of algorithm)
  const scaledGrade = grade * 5

  // update efactor and interval
  let newEfactor = Math.max(
    1.3,
    eFactor + (0.1 - (5 - scaledGrade) * (0.08 + (5 - scaledGrade) * 0.02))
  )
  newEfactor = parseFloat(newEfactor.toFixed(2))

  let newInterval: number
  if (scaledGrade < 3) {
    newInterval = 1
  } else {
    if (streak === 1) {
      newInterval = 2
    } else if (streak === 2) {
      newInterval = 6
    } else {
      newInterval = Math.ceil(interval * newEfactor)
    }
  }

  // compute next due date to sort by (=> spaced repetition)
  const nextDueAt = dayjs().add(newInterval, 'day').toDate()

  return {
    efactor: newEfactor,
    interval: newInterval,
    nextDueAt: nextDueAt,
  }
}

function computeNewAverageTimes({
  existingInstance,
  existingResponse,
  answerTime,
}: {
  existingInstance: ElementInstance & {
    instanceStatistics: InstanceStatistics | null
  }
  existingResponse: PrismaQuestionResponse | null
  answerTime: number
}): { newAverageResponseTime: number; newAverageInstanceTime: number } {
  const existingParticipantCount =
    existingInstance.instanceStatistics!.uniqueParticipantCount
  const existingInstanceTime =
    existingInstance.instanceStatistics!.averageTimeSpent
  const newAverageResponseTime = existingResponse
    ? (existingResponse.averageTimeSpent * existingResponse.trialsCount +
        answerTime) /
      (existingResponse.trialsCount + 1)
    : answerTime
  const newAverageInstanceTime = existingResponse
    ? (existingInstanceTime! * existingParticipantCount -
        existingResponse.averageTimeSpent +
        answerTime) /
      existingParticipantCount
    : ((existingInstanceTime ?? 0) * existingParticipantCount + answerTime) /
      (existingParticipantCount + 1)

  return { newAverageResponseTime, newAverageInstanceTime }
}

function computeUpdatedInstanceStatistics({
  participation,
  existingResponse,
  newAverageInstanceTime,
  answerCorrect,
  answerPartial,
  answerIncorrect,
  instanceInPracticeQuiz,
}: {
  participation: Participation | null
  existingResponse: PrismaQuestionResponse | null
  newAverageInstanceTime?: number
  answerCorrect: boolean
  answerPartial: boolean
  answerIncorrect: boolean
  instanceInPracticeQuiz: boolean
}) {
  return participation
    ? {
        update: {
          uniqueParticipantCount: {
            increment: Number(!existingResponse),
          },
          averageTimeSpent: newAverageInstanceTime,
          correctCount: {
            increment: Number(answerCorrect),
          },
          partialCorrectCount: {
            increment: Number(answerPartial),
          },
          wrongCount: {
            increment: Number(answerIncorrect),
          },
          firstCorrectCount: {
            increment: Number(
              answerCorrect && !existingResponse && instanceInPracticeQuiz
            ),
          },
          firstPartialCorrectCount: {
            increment: Number(
              answerPartial && !existingResponse && instanceInPracticeQuiz
            ),
          },
          firstWrongCount: {
            increment: Number(
              answerIncorrect && !existingResponse && instanceInPracticeQuiz
            ),
          },
          lastCorrectCount: {
            increment: Number(answerCorrect && instanceInPracticeQuiz),
          },
          lastPartialCorrectCount: {
            increment: Number(answerPartial && instanceInPracticeQuiz),
          },
          lastWrongCount: {
            increment: Number(answerIncorrect && instanceInPracticeQuiz),
          },
        },
      }
    : {
        update: {
          anonymousCorrectCount: {
            increment: Number(answerCorrect),
          },
          anonymousPartialCorrectCount: {
            increment: Number(answerPartial),
          },
          anonymousWrongCount: {
            increment: Number(answerIncorrect),
          },
        },
      }
}

export function updateFlashcardResults({
  previousResults,
  response,
}: {
  previousResults: FlashcardResults
  response: FlashcardCorrectness
}): FlashcardResults {
  return {
    ...previousResults,
    [response]: (previousResults[response] ?? 0) + 1,
    total: previousResults.total + 1,
  }
}

interface RespondToFlashcardInput {
  id: number
  courseId: string
  response: FlashcardCorrectness
  answerTime: number
}

async function respondToFlashcard(
  { id, courseId, response, answerTime }: RespondToFlashcardInput,
  ctx: Context
) {
  const transactionResult = await ctx.prisma.$transaction(async (prisma) => {
    const existingInstance = await prisma.elementInstance.findUnique({
      where: {
        id,
      },
      include: {
        elementStack: true,
        instanceStatistics: true,
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

    const existingResponse = ctx.user?.sub
      ? await prisma.questionResponse.findUnique({
          where: {
            participantId_elementInstanceId: {
              participantId: ctx.user.sub,
              elementInstanceId: id,
            },
          },
        })
      : null

    // create result from flashcard response
    const flashcardResultMap: Record<
      FlashcardCorrectness,
      StackFeedbackStatus
    > = {
      [FlashcardCorrectness.INCORRECT]: StackFeedbackStatus.INCORRECT,
      [FlashcardCorrectness.PARTIAL]: StackFeedbackStatus.PARTIAL,
      [FlashcardCorrectness.CORRECT]: StackFeedbackStatus.CORRECT,
    }
    const result = {
      grading: flashcardResultMap[response],
      score: null,
    }

    // fetch the participation of the participant
    const participation = ctx.user?.sub
      ? await prisma.participation.findUnique({
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

    const newResults = updateFlashcardResults({
      previousResults: participation
        ? (existingInstance.results as FlashcardResults)
        : (existingInstance.anonymousResults as FlashcardResults),
      response,
    })

    // average answer time computations if participant is logged in
    const { newAverageResponseTime, newAverageInstanceTime } = participation
      ? computeNewAverageTimes({
          existingInstance,
          existingResponse,
          answerTime,
        })
      : { newAverageInstanceTime: undefined, newAverageResponseTime: undefined }

    // variable summaries for code readability
    const answerCorrect = response === FlashcardCorrectness.CORRECT
    const answerPartial = response === FlashcardCorrectness.PARTIAL
    const answerIncorrect = response === FlashcardCorrectness.INCORRECT
    const instanceInPracticeQuiz =
      !!existingInstance.elementStack.practiceQuizId

    // compute updated instance statistics
    const statisticsUpdate = computeUpdatedInstanceStatistics({
      participation,
      existingResponse,
      newAverageInstanceTime,
      answerCorrect,
      answerPartial,
      answerIncorrect,
      instanceInPracticeQuiz,
    })

    await prisma.elementInstance.update({
      where: {
        id,
      },
      data: {
        results: participation ? newResults : undefined,
        anonymousResults: participation ? undefined : newResults,
        instanceStatistics: statisticsUpdate,
      },
    })

    // if no user exists, return the grading for client display
    if (!ctx.user?.sub || !participation) {
      return result
    }

    // create question detail response
    await prisma.questionResponseDetail.create({
      data: {
        response: {
          correctness: response,
        },
        timeSpent: answerTime,
        participant: {
          connect: { id: ctx.user.sub },
        },
        elementInstance: {
          connect: { id },
        },
        practiceQuiz: existingInstance.elementStack.practiceQuizId
          ? {
              connect: {
                id: existingInstance.elementStack.practiceQuizId,
              },
            }
          : undefined,
        microLearning: existingInstance.elementStack.microLearningId
          ? {
              connect: {
                id: existingInstance.elementStack.microLearningId,
              },
            }
          : undefined,
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
    const aggregatedResponses =
      (existingResponse?.aggregatedResponses as FlashcardResults) ?? {
        [FlashcardCorrectness.INCORRECT]: 0,
        [FlashcardCorrectness.PARTIAL]: 0,
        [FlashcardCorrectness.CORRECT]: 0,
        total: 0,
      }

    const streakIncrement = response === FlashcardCorrectness.CORRECT ? 1 : 0
    const correctness =
      response === FlashcardCorrectness.CORRECT
        ? 1
        : response === FlashcardCorrectness.PARTIAL
          ? 0.5
          : 0
    const responseCorrectness =
      correctness === 1
        ? ResponseCorrectness.CORRECT
        : correctness === 0
          ? ResponseCorrectness.WRONG
          : ResponseCorrectness.PARTIAL
    const resultSpacedRepetition = updateSpacedRepetition({
      eFactor: existingResponse?.eFactor || 2.5,
      interval: existingResponse?.interval || 1,
      streak: (existingResponse?.correctCountStreak || 0) + streakIncrement,
      grade: correctness,
    })

    await prisma.questionResponse.upsert({
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
        averageTimeSpent: newAverageResponseTime,
        elementInstance: {
          connect: { id },
        },
        practiceQuiz: existingInstance.elementStack.practiceQuizId
          ? {
              connect: {
                id: existingInstance.elementStack.practiceQuizId,
              },
            }
          : undefined,
        microLearning: existingInstance.elementStack.microLearningId
          ? {
              connect: {
                id: existingInstance.elementStack.microLearningId,
              },
            }
          : undefined,
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
        // RESPONSE and aggregated response creation
        firstResponse: {
          correctness: response,
        },
        firstResponseCorrectness: responseCorrectness,
        lastResponse: {
          correctness: response,
        },
        lastResponseCorrectness: responseCorrectness,
        aggregatedResponses: {
          ...aggregatedResponses,
          total: 1,
          [response]: 1,
        },
        trialsCount: 1,

        ...combineNewCorrectnessParams({
          correct: response === FlashcardCorrectness.CORRECT,
          partial: response === FlashcardCorrectness.PARTIAL,
          incorrect: response === FlashcardCorrectness.INCORRECT,
        }),

        eFactor: resultSpacedRepetition.efactor,
        interval: resultSpacedRepetition.interval,
        nextDueAt: resultSpacedRepetition.nextDueAt,
      },
      update: {
        // RESPONSE
        lastResponse: {
          correctness: response,
        },
        lastResponseCorrectness: responseCorrectness,
        averageTimeSpent: newAverageResponseTime,
        aggregatedResponses: {
          ...aggregatedResponses,
          [response]: aggregatedResponses[response] + 1,
          total: aggregatedResponses.total + 1,
        },

        trialsCount: {
          increment: 1,
        },

        ...combineCorrectnessParams({
          correct: response === FlashcardCorrectness.CORRECT,
          partial: response === FlashcardCorrectness.PARTIAL,
          incorrect: response === FlashcardCorrectness.INCORRECT,
          existingResponse,
        }),

        eFactor: resultSpacedRepetition.efactor,
        interval: resultSpacedRepetition.interval,
        nextDueAt: resultSpacedRepetition.nextDueAt,
      },
    })
    return result
  })

  return transactionResult
}

interface RespondToContentInput {
  id: number
  courseId: string
  answerTime: number
}

async function respondToContent(
  { id, courseId, answerTime }: RespondToContentInput,
  ctx: Context
) {
  const transactionResult = await ctx.prisma.$transaction(async (prisma) => {
    const existingInstance = await ctx.prisma.elementInstance.findUnique({
      where: {
        id,
      },
      include: {
        elementStack: true,
        instanceStatistics: true,
      },
    })

    // check if the instance exists and the response is valid
    if (!existingInstance) {
      return null
    }

    const existingResponse = ctx.user?.sub
      ? await ctx.prisma.questionResponse.findUnique({
          where: {
            participantId_elementInstanceId: {
              participantId: ctx.user.sub,
              elementInstanceId: id,
            },
          },
        })
      : null

    // context elements can only be "read" when submitted
    const result = {
      grading: StackFeedbackStatus.CORRECT,
      score: null,
    }

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

    // average answer time computations if participant is logged in
    const { newAverageResponseTime, newAverageInstanceTime } = participation
      ? computeNewAverageTimes({
          existingInstance,
          existingResponse,
          answerTime,
        })
      : { newAverageInstanceTime: undefined, newAverageResponseTime: undefined }

    // compute updated instance statistics
    const instanceInPracticeQuiz =
      !!existingInstance.elementStack.practiceQuizId
    const statisticsUpdate = computeUpdatedInstanceStatistics({
      participation,
      existingResponse,
      newAverageInstanceTime,
      answerCorrect: true,
      answerPartial: false,
      answerIncorrect: false,
      instanceInPracticeQuiz,
    })

    await ctx.prisma.elementInstance.update({
      where: {
        id,
      },
      data: {
        results: participation
          ? { total: existingInstance.results.total + 1 }
          : undefined,
        anonymousResults: participation
          ? undefined
          : {
              total: existingInstance.anonymousResults.total + 1,
            },
        instanceStatistics: statisticsUpdate,
      },
    })

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
        timeSpent: answerTime,
        participant: {
          connect: { id: ctx.user.sub },
        },
        elementInstance: {
          connect: { id },
        },
        practiceQuiz: existingInstance.elementStack.practiceQuizId
          ? {
              connect: {
                id: existingInstance.elementStack.practiceQuizId,
              },
            }
          : undefined,
        microLearning: existingInstance.elementStack.microLearningId
          ? {
              connect: {
                id: existingInstance.elementStack.microLearningId,
              },
            }
          : undefined,
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

    const aggregatedResponses =
      (existingResponse?.aggregatedResponses as ContentResults) ?? {
        total: 0,
      }

    const resultSpacedRepetition = updateSpacedRepetition({
      eFactor: existingResponse?.eFactor || 2.5,
      interval: existingResponse?.interval || 1,
      streak: (existingResponse?.correctCountStreak || 0) + 1,
      grade: 1,
    })

    // create / update question response
    await ctx.prisma.questionResponse.upsert({
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
        averageTimeSpent: newAverageResponseTime,
        elementInstance: {
          connect: { id },
        },
        practiceQuiz: existingInstance.elementStack.practiceQuizId
          ? {
              connect: {
                id: existingInstance.elementStack.practiceQuizId,
              },
            }
          : undefined,
        microLearning: existingInstance.elementStack.microLearningId
          ? {
              connect: {
                id: existingInstance.elementStack.microLearningId,
              },
            }
          : undefined,
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
        // RESPONSE and aggregated response creation
        firstResponse: {
          viewed: true,
        },
        firstResponseCorrectness: ResponseCorrectness.CORRECT,
        lastResponse: {
          viewed: true,
        },
        lastResponseCorrectness: ResponseCorrectness.CORRECT,
        trialsCount: 1,

        // AGGREGATED RESPONSES
        aggregatedResponses: {
          total: 1,
        },

        // CORRECT
        correctCount: 1,
        correctCountStreak: 1,
        lastAnsweredAt: new Date(),
        lastCorrectAt: new Date(),

        // update spaced repetition parameters
        eFactor: resultSpacedRepetition.efactor,
        interval: resultSpacedRepetition.interval,
        nextDueAt: resultSpacedRepetition.nextDueAt,
      },
      update: {
        // RESPONSE
        averageTimeSpent: newAverageResponseTime,
        lastResponse: {
          viewed: true,
        },
        lastResponseCorrectness: ResponseCorrectness.CORRECT,
        trialsCount: {
          increment: 1,
        },

        // AGGREGATED RESPONSES
        aggregatedResponses: {
          total: aggregatedResponses.total + 1,
        },

        // CORRECT
        correctCount: {
          increment: 1,
        },
        correctCountStreak: {
          increment: 1,
        },
        lastAnsweredAt: new Date(),
        lastCorrectAt: new Date(),

        // update spaced repetition parameters
        eFactor: resultSpacedRepetition.efactor,
        interval: resultSpacedRepetition.interval,
        nextDueAt: resultSpacedRepetition.nextDueAt,
      },
    })
    return result
  })

  return transactionResult
}

interface EvaluateAnswerCorrectnessArgs {
  elementData: AllElementTypeData
  response: ResponseInput
}

export function evaluateAnswerCorrectness({
  elementData,
  response,
}: EvaluateAnswerCorrectnessArgs) {
  switch (elementData.type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM: {
      const elementOptions = elementData.options
      const solution = elementOptions.choices.reduce<number[]>(
        (acc, choice) => {
          if (choice.correct) return [...acc, choice.ix]
          return acc
        },
        []
      )

      if (elementData.type === ElementType.SC) {
        const correctness = gradeQuestionSC({
          responseCount: elementOptions.choices.length,
          response: (response as QuestionResponseChoices).choices,
          solution,
        })
        return correctness
      } else if (elementData.type === ElementType.MC) {
        const correctness = gradeQuestionMC({
          responseCount: elementOptions.choices.length,
          response: (response as QuestionResponseChoices).choices,
          solution,
        })
        return correctness
      } else {
        const correctness = gradeQuestionKPRIM({
          responseCount: elementOptions.choices.length,
          response: (response as QuestionResponseChoices).choices,
          solution,
        })
        return correctness
      }
    }

    case ElementType.NUMERICAL: {
      const solutionRanges = (elementData.options as NumericalQuestionOptions)
        .solutionRanges

      const correctness = gradeQuestionNumerical({
        response: parseFloat(String(response.value)),
        solutionRanges: solutionRanges ?? [],
      })
      return correctness
    }

    case ElementType.FREE_TEXT: {
      const solutions = (elementData.options as FreeTextQuestionOptions)
        .solutions

      const correctness = gradeQuestionFreeText({
        response: response.value ?? '',
        solutions: solutions ?? [],
      })
      return correctness
    }

    default:
      return null
  }
}

interface EvaluatedQuestionResponses {
  feedbacks: any[]
  numAnswers: number
  choices?: Record<string, number>
  answers?: Record<string, number>
  score: number
  xp: number
  percentile: number
  pointsMultiplier?: number
  explanation?: string | null
}

function evaluateElementResponse(
  elementData: AllElementTypeData,
  results: any,
  correctness: number | null,
  multiplier?: number
): EvaluatedQuestionResponses | null {
  switch (elementData.type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM: {
      // TODO: feedbacks only for selected options?
      // const feedbacks = elementData.options.choices.filter((choice) =>
      //   response.choices!.includes(choice.ix)
      // )

      const elementOptions = elementData.options
      const feedbacks = elementOptions.choices

      if (elementData.type === ElementType.SC) {
        return {
          feedbacks,
          numAnswers: results.total,
          choices: results.choices,
          score: computeSimpleAwardedPoints({
            points: POINTS_PER_INSTANCE,
            pointsPercentage: correctness,
            pointsMultiplier: multiplier,
          }),
          xp: computeAwardedXp({
            pointsPercentage: correctness,
          }),
          percentile: correctness ?? 0,
          pointsMultiplier: multiplier,
          explanation: elementData.explanation,
        }
      } else if (elementData.type === ElementType.MC) {
        return {
          feedbacks,
          numAnswers: results.total,
          choices: results.choices,
          score: computeSimpleAwardedPoints({
            points: POINTS_PER_INSTANCE,
            pointsPercentage: correctness,
            pointsMultiplier: multiplier,
          }),
          xp: computeAwardedXp({
            pointsPercentage: correctness,
          }),
          percentile: correctness ?? 0,
          pointsMultiplier: multiplier,
          explanation: elementData.explanation,
        }
      } else {
        return {
          feedbacks,
          numAnswers: results.total,
          choices: results.choices,
          score: computeSimpleAwardedPoints({
            points: POINTS_PER_INSTANCE,
            pointsPercentage: correctness,
            pointsMultiplier: multiplier,
          }),
          xp: computeAwardedXp({
            pointsPercentage: correctness,
          }),
          percentile: correctness ?? 0,
          pointsMultiplier: multiplier,
          explanation: elementData.explanation,
        }
      }
    }

    case ElementType.NUMERICAL: {
      // TODO: add feedbacks here once they are implemented for specified solution ranges
      return {
        feedbacks: [],
        numAnswers: results.total,
        answers: results?.responses ?? {},
        score: correctness ? correctness * 10 * (multiplier ?? 1) : 0,
        xp: computeAwardedXp({
          pointsPercentage: correctness,
        }),
        percentile: correctness ?? 0,
        pointsMultiplier: multiplier,
        explanation: elementData.explanation,
      }
    }

    case ElementType.FREE_TEXT: {
      return {
        feedbacks: [],
        numAnswers: results.total,
        answers: results.responses ?? {},
        score: correctness ? correctness * 10 * (multiplier ?? 1) : 0,
        xp: computeAwardedXp({
          pointsPercentage: correctness,
        }),
        percentile: correctness ?? 0,
        pointsMultiplier: multiplier,
        explanation: elementData.explanation,
      }
    }

    default:
      return null
  }
}

interface UpdateQuestionResultsInputs {
  previousResults: ElementInstanceResults
  elementData: AllElementTypeData
  response: ResponseInput
  correct?: boolean
}

export function updateQuestionResults({
  previousResults,
  elementData,
  response,
  correct,
}: UpdateQuestionResultsInputs) {
  const MD5 = createHash('md5')

  switch (elementData.type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM: {
      const results = previousResults as ElementResultsChoices
      let updatedResults: ElementResultsChoices = results

      updatedResults.choices = (
        response as QuestionResponseChoices
      ).choices.reduce(
        (acc, ix) => ({
          ...acc,
          [ix]: acc[ix]! + 1,
        }),
        results.choices
      )
      updatedResults.total = results.total + 1
      return { results: updatedResults, modified: true }
    }

    case ElementType.NUMERICAL: {
      const results = previousResults as ElementResultsOpen
      let updatedResults: ElementResultsOpen = results

      if (
        typeof response.value === 'undefined' ||
        response.value === null ||
        response.value === ''
      ) {
        return { results: results, modified: false }
      }

      const parsedValue = parseFloat(response.value)
      if (
        isNaN(parsedValue) ||
        (typeof elementData.options.restrictions?.min === 'number' &&
          parsedValue < elementData.options.restrictions.min) ||
        (typeof elementData.options.restrictions?.max === 'number' &&
          parsedValue > elementData.options.restrictions.max) ||
        parsedValue > 1e30 || // prevent overflow
        parsedValue < -1e30 // prevent underflow
      ) {
        return { results: results, modified: false }
      }

      const value = String(parsedValue)
      MD5.update(value)
      const hashedValue = MD5.digest('hex')

      if (Object.keys(results.responses).includes(value)) {
        updatedResults.responses = {
          ...results.responses,
          [hashedValue]: {
            ...results.responses[hashedValue]!,
            count: results.responses[hashedValue]!.count + 1,
          },
        }
      } else {
        updatedResults.responses = {
          ...results.responses,
          [hashedValue]: { value: value, count: 1, correct: correct },
        }
      }
      updatedResults.total = results.total + 1
      return { results: updatedResults, modified: true }
    }

    case ElementType.FREE_TEXT: {
      const results = previousResults as ElementResultsOpen
      let updatedResults: ElementResultsOpen = results

      if (
        typeof response.value === 'undefined' ||
        response.value === null ||
        response.value === '' ||
        (typeof elementData.options.restrictions?.maxLength === 'number' &&
          response.value.length > elementData.options.restrictions?.maxLength)
      ) {
        return { results: results, modified: false }
      }

      const value = R.toLower(R.trim(response.value))
      MD5.update(value)
      const hashedValue = MD5.digest('hex')

      if (Object.keys(results.responses).includes(hashedValue)) {
        updatedResults.responses = {
          ...results.responses,
          [hashedValue]: {
            ...results.responses[hashedValue]!,
            count: results.responses[hashedValue]!.count + 1,
          },
        }
      } else {
        updatedResults.responses = {
          ...results.responses,
          [hashedValue]: {
            value: value,
            count: 1,
            correct: correct,
          },
        }
      }
      updatedResults.total = results.total + 1
      return { results: updatedResults, modified: true }
    }

    default:
      return { results: null, modified: false }
  }
}

export async function respondToQuestion(
  {
    courseId,
    id,
    response,
    answerTime,
  }: {
    courseId: string
    id: number
    response: ResponseInput
    answerTime: number
  },
  ctx: Context
) {
  const MD5 = createHash('md5')
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

  const { instance, updatedInstance, correctness, validResponse } =
    await ctx.prisma.$transaction(async (prisma) => {
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
        return {
          instance: null,
          updatedInstance: null,
          correctness: null,
          validResponse: false,
        }
      }

      // if the participant had already responded, don't track the new response
      // keeps the evaluation more accurate, as repeated entries do not skew into the "correct direction"
      // const hasPreviousResponse = instance?.responses.length > 0
      // if (ctx.user?.sub && !treatAnonymous && hasPreviousResponse) {
      //   return {
      //     instance,
      //     updatedInstance: instance,
      //   }
      // }

      const elementData = instance?.elementData

      if (!elementData) {
        return {
          instance: null,
          updatedInstance: null,
          correctness: null,
          validResponse: false,
        }
      }

      // evaluate the correctness of the response
      const correctness = evaluateAnswerCorrectness({ elementData, response })

      const updatedResults = updateQuestionResults({
        previousResults:
          ctx.user?.sub && !treatAnonymous
            ? instance.results
            : instance.anonymousResults,
        elementData,
        response,
        correct: correctness === 1,
      })

      if (!updatedResults.results) {
        return {
          instance: null,
          updatedInstance: null,
          correctness: null,
          validResponse: false,
        }
      }

      const updatedInstance = await prisma.elementInstance.update({
        where: { id },
        data:
          ctx.user?.sub && !treatAnonymous
            ? {
                results: updatedResults.results,
              }
            : { anonymousResults: updatedResults.results },
        include: {
          elementStack: true,
        },
      })

      return {
        instance,
        updatedInstance,
        correctness,
        validResponse: true,
      }
    })

  const elementData = updatedInstance?.elementData
  const results = updatedInstance?.results

  if (
    !instance ||
    !updatedInstance ||
    !elementData ||
    !validResponse ||
    correctness === null
  )
    return null

  const evaluation = evaluateElementResponse(
    elementData,
    results,
    correctness,
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
        !instance.responses[0]!.lastAwardedAt ||
        dayjs(instance.responses[0]!.lastAwardedAt).isBefore(
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
        !instance.responses[0]!.lastXpAwardedAt ||
        dayjs(instance.responses[0]!.lastXpAwardedAt).isBefore(
          dayjs().subtract(XP_AWARD_TIMEFRAME_DAYS, 'days')
        )

      if (previousXpResponseOutsideTimeframe) {
        xpAwarded = xp
      } else {
        xpAwarded = 0
      }

      lastAwardedAt = previousResponseOutsideTimeframe
        ? new Date()
        : instance.responses[0]!.lastAwardedAt
      lastXpAwardedAt = previousXpResponseOutsideTimeframe
        ? new Date()
        : instance.responses[0]!.lastXpAwardedAt
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

    // update aggregated results for choices and open questions
    const existingResponse = await ctx.prisma.questionResponse.findUnique({
      where: {
        participantId_elementInstanceId: {
          participantId: ctx.user.sub,
          elementInstanceId: id,
        },
      },
    })

    let newAggResponses
    if (
      instance.elementType === ElementType.SC ||
      instance.elementType === ElementType.MC ||
      instance.elementType === ElementType.KPRIM
    ) {
      newAggResponses = (existingResponse?.aggregatedResponses ??
        getInitialElementResults({
          type: instance.elementType,
          options: instance.elementData.options,
        } as Element)) as ElementResultsChoices

      // update aggregated responses for choices
      newAggResponses.choices = (
        response as QuestionResponseChoices
      ).choices.reduce(
        (acc, ix) => ({
          ...acc,
          [ix]: acc[ix]! + 1,
        }),
        newAggResponses.choices
      )
      newAggResponses.total = newAggResponses.total + 1
    } else {
      newAggResponses = (existingResponse?.aggregatedResponses ??
        getInitialElementResults({
          type: instance.elementType,
        } as Element)) as ElementResultsOpen

      // update aggregated responses for open questions
      if (instance.elementType === ElementType.NUMERICAL) {
        const value = String(parseFloat(response.value!))
        MD5.update(value)
        const hashedValue = MD5.digest('hex')

        if (Object.keys(newAggResponses.responses).includes(value)) {
          newAggResponses.responses = {
            ...newAggResponses.responses,
            [hashedValue]: {
              ...newAggResponses.responses[hashedValue]!,
              count: newAggResponses.responses[hashedValue]!.count + 1,
            },
          }
        } else {
          newAggResponses.responses = {
            ...newAggResponses.responses,
            [hashedValue]: {
              value: value,
              count: 1,
              correct: correctness === 1,
            },
          }
        }
        newAggResponses.total = newAggResponses.total + 1
      } else {
        const value = R.toLower(R.trim(response.value!))
        MD5.update(value)
        const hashedValue = MD5.digest('hex')

        if (Object.keys(newAggResponses.responses).includes(value)) {
          newAggResponses.responses = {
            ...newAggResponses.responses,
            [hashedValue]: {
              ...newAggResponses.responses[hashedValue]!,
              count: newAggResponses.responses[hashedValue]!.count + 1,
            },
          }
        } else {
          newAggResponses.responses = {
            ...newAggResponses.responses,
            [hashedValue]: {
              value: value,
              count: 1,
              correct: correctness === 1,
            },
          }
        }
        newAggResponses.total = newAggResponses.total + 1
      }
    }

    const streakIncrement = correctness === 1 ? 1 : 0
    const resultSpacedRepetition = updateSpacedRepetition({
      eFactor: existingResponse?.eFactor || 2.5,
      interval: existingResponse?.interval || 1,
      streak: (existingResponse?.correctCountStreak || 0) + streakIncrement,
      grade: correctness,
    })

    const newAverageTime = existingResponse
      ? (existingResponse.averageTimeSpent * existingResponse.trialsCount +
          answerTime) /
        (existingResponse.trialsCount + 1)
      : answerTime

    const responseCorrectness =
      correctness === 1
        ? ResponseCorrectness.CORRECT
        : correctness === 0
          ? ResponseCorrectness.WRONG
          : ResponseCorrectness.PARTIAL

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
          averageTimeSpent: newAverageTime,
          lastAwardedAt,
          lastXpAwardedAt,
          firstResponse: response as QuestionResponse,
          firstResponseCorrectness: responseCorrectness,
          lastResponse: response as QuestionResponse,
          lastResponseCorrectness: responseCorrectness,
          aggregatedResponses: newAggResponses,
          participant: {
            connect: { id: ctx.user.sub },
          },
          elementInstance: {
            connect: { id },
          },
          practiceQuiz: updatedInstance.elementStack.practiceQuizId
            ? {
                connect: {
                  id: updatedInstance.elementStack.practiceQuizId,
                },
              }
            : undefined,
          microLearning: updatedInstance.elementStack.microLearningId
            ? {
                connect: {
                  id: updatedInstance.elementStack.microLearningId,
                },
              }
            : undefined,
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

          // compute and store new correctness parameters
          ...combineNewCorrectnessParams({
            correct: correctness === 1,
            partial: correctness > 0 && correctness < 1,
            incorrect: correctness === 0,
          }),

          eFactor: resultSpacedRepetition.efactor,
          nextDueAt: resultSpacedRepetition.nextDueAt,
          interval: resultSpacedRepetition.interval,
        },
        update: {
          lastResponse: response as QuestionResponse,
          lastResponseCorrectness: responseCorrectness,
          aggregatedResponses: newAggResponses,
          lastAwardedAt,
          lastXpAwardedAt,
          trialsCount: {
            increment: 1,
          },
          averageTimeSpent: newAverageTime,
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

          ...combineCorrectnessParams({
            correct: correctness === 1,
            partial: correctness > 0 && correctness < 1,
            incorrect: correctness === 0,
            existingResponse,
          }),

          eFactor: resultSpacedRepetition.efactor,
          nextDueAt: resultSpacedRepetition.nextDueAt,
          interval: resultSpacedRepetition.interval,
        },
      }),
      ctx.prisma.questionResponseDetail.create({
        data: {
          score,
          pointsAwarded,
          xpAwarded,
          timeSpent: answerTime,
          response: response as QuestionResponse,
          participant: {
            connect: { id: ctx.user.sub },
          },
          elementInstance: {
            connect: { id },
          },
          practiceQuiz: updatedInstance.elementStack.practiceQuizId
            ? {
                connect: {
                  id: updatedInstance.elementStack.practiceQuizId,
                },
              }
            : undefined,
          microLearning: updatedInstance.elementStack.microLearningId
            ? {
                connect: {
                  id: updatedInstance.elementStack.microLearningId,
                },
              }
            : undefined,
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
          solutions:
            elementData.type === 'FREE_TEXT'
              ? elementData.options.solutions
              : null,
          solutionRanges:
            elementData.type === 'NUMERICAL'
              ? elementData.options.solutionRanges
              : null,
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

export interface RespondToElementStackInput {
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
  stackAnswerTime: number
}

export async function respondToElementStack(
  { stackId, courseId, responses, stackAnswerTime }: RespondToElementStackInput,
  ctx: Context
) {
  let stackScore: number | undefined = undefined
  let stackFeedback = StackFeedbackStatus.UNANSWERED
  const evaluationsArr: IInstanceEvaluation[] = []

  // compute average answer time per element / question by dividing the
  // answer time for the entire stack through the number of responses
  const elementAnswerTime = round(stackAnswerTime / responses.length)

  // TODO: refactor this into a transaction and single combination of status and score for the stack
  for (const response of responses) {
    if (response.type === ElementType.FLASHCARD) {
      const result = await respondToFlashcard(
        {
          id: response.instanceId,
          courseId: courseId,
          response: response.flashcardResponse!,
          answerTime: elementAnswerTime,
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
          answerTime: elementAnswerTime,
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
          answerTime: elementAnswerTime,
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
          answerTime: elementAnswerTime,
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
          answerTime: elementAnswerTime,
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

interface ManipulatePracticeQuizArgs {
  id?: string
  name: string
  displayName: string
  description?: string | null
  stacks: StackInput[]
  courseId: string
  multiplier: number
  order: ElementOrderType
  availableFrom?: Date | null
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
    availableFrom,
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

  const availabilityTime =
    availableFrom && dayjs(availableFrom).isBefore(dayjs())
      ? null
      : (availableFrom ?? undefined)

  const createOrUpdateJSON = {
    name: name.trim(),
    displayName: displayName.trim(),
    description,
    pointsMultiplier: multiplier,
    orderType: order,
    availableFrom: availabilityTime,
    resetTimeDays: resetTimeDays,
    stacks: {
      create: stacks.map((stack) => {
        return {
          type: ElementStackType.PRACTICE_QUIZ,
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
                  resetTimeDays,
                },
                results: initialResults,
                anonymousResults: initialResults,
                instanceStatistics: {
                  create: getInitialInstanceStatistics(
                    ElementInstanceType.PRACTICE_QUIZ
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

interface UnpublishPracticeQuizArgs {
  id: string
}

export async function unpublishPracticeQuiz(
  { id }: UnpublishPracticeQuizArgs,
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.update({
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

  return practiceQuiz
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
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
  })

  if (!practiceQuiz) {
    return null
  }

  // if the practice quiz starts in the future, change its status to scheduled, otherwise publish it
  if (
    practiceQuiz.availableFrom &&
    dayjs(practiceQuiz.availableFrom).isAfter(dayjs())
  ) {
    // change the status of the practice quiz to scheduled for the cronjob to identify it and publish it at the given time
    const updatedQuiz = await ctx.prisma.practiceQuiz.update({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
      data: {
        status: PublicationStatus.SCHEDULED,
      },
    })

    ctx.emitter.emit('invalidate', {
      typename: 'PracticeQuiz',
      id,
    })

    return updatedQuiz
  } else {
    // publish practice quiz completely and link all stacks to the course
    const updatedQuiz = await ctx.prisma.practiceQuiz.update({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
      data: {
        status: PublicationStatus.PUBLISHED,
      },
      include: {
        stacks: true,
      },
    })

    // connect all elementStacks in the practice quiz to the course
    const courseId = updatedQuiz.courseId
    await ctx.prisma.course.update({
      where: {
        id: courseId,
      },
      data: {
        elementStacks: {
          connect: updatedQuiz.stacks.map((stack) => ({ id: stack.id })),
        },
      },
    })

    ctx.emitter.emit('invalidate', {
      typename: 'PracticeQuiz',
      id,
    })

    return updatedQuiz
  }
}

export async function publishScheduledPracticeQuizzes(ctx: Context) {
  const quizzesToPublish = await ctx.prisma.practiceQuiz.findMany({
    where: {
      status: PublicationStatus.SCHEDULED,
      availableFrom: {
        lte: new Date(),
      },
    },
  })

  const updatedQuizzes = await Promise.all(
    quizzesToPublish.map((quiz) =>
      ctx.prisma.practiceQuiz.update({
        where: {
          id: quiz.id,
        },
        data: {
          status: PublicationStatus.PUBLISHED,
        },
        include: {
          stacks: true,
        },
      })
    )
  )

  await Promise.all(
    updatedQuizzes.map((quiz) =>
      ctx.prisma.course.update({
        where: {
          id: quiz.courseId,
        },
        data: {
          elementStacks: {
            connect: quiz.stacks.map((stack) => ({ id: stack.id })),
          },
        },
      })
    )
  )

  updatedQuizzes.forEach((quiz) => {
    ctx.emitter.emit('invalidate', {
      typename: 'PracticeQuiz',
      id: quiz.id,
    })
  })

  return true
}
