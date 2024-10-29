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
  type Element,
  type ElementInstance,
  type ElementStack,
  ElementStackType,
  ElementType,
  type InstanceStatistics,
  type Participant,
  type Participation,
  Prisma,
  PrismaClient,
  type QuestionResponse as PrismaQuestionResponse,
  ResponseCorrectness,
  UserRole,
} from '@klicker-uzh/prisma'
import type {
  AllElementTypeData,
  Choice,
  ChoicesElementData,
  ContentElementData,
  ElementInstanceResults,
  ElementOptionsChoices,
  ElementOptionsFreeText,
  ElementOptionsNumerical,
  ElementResultsChoices,
  ElementResultsContent,
  ElementResultsFlashcard,
  ElementResultsOpen,
  FlashcardElementData,
  FreeTextElementData,
  InstanceEvaluation,
  InstanceEvaluationChoices,
  InstanceEvaluationFreeText,
  InstanceEvaluationNumerical,
  NumericalElementData,
  SingleQuestionResponse,
  SingleQuestionResponseChoices,
  SingleQuestionResponseContent,
  SingleQuestionResponseFlashcard,
  SingleQuestionResponseValue,
} from '@klicker-uzh/types'
import { FlashcardCorrectness, StackFeedbackStatus } from '@klicker-uzh/types'
import { getInitialElementResults } from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { round } from 'mathjs'
import { createHash } from 'node:crypto'
import { toLowerCase } from 'remeda'
import type { Context } from '../lib/context.js'
import type { ResponseInput } from '../ops.js'

type PrismaTransactionClient = Omit<
  PrismaClient<Prisma.PrismaClientOptions, never>,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>
type ExistingInstanceType = ElementInstance & {
  elementStack: {
    practiceQuizId?: string | null
    microLearningId?: string | null
  }
}

const POINTS_PER_INSTANCE = 10
const POINTS_AWARD_TIMEFRAME_DAYS = 6
const XP_AWARD_TIMEFRAME_DAYS = 1

const flashcardResultMap: Record<FlashcardCorrectness, StackFeedbackStatus> = {
  [FlashcardCorrectness.INCORRECT]: StackFeedbackStatus.INCORRECT,
  [FlashcardCorrectness.PARTIAL]: StackFeedbackStatus.PARTIAL,
  [FlashcardCorrectness.CORRECT]: StackFeedbackStatus.CORRECT,
}

// ! Shared Helper Functions
// #region
interface CombineCorrectnessParamsInput {
  correct: boolean
  partial: boolean
  incorrect: boolean
  existingResponse?: PrismaQuestionResponse | null
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
            increment:
              Number(answerCorrect && instanceInPracticeQuiz) -
              Number(
                existingResponse?.lastResponseCorrectness ===
                  ResponseCorrectness.CORRECT
              ),
          },
          lastPartialCorrectCount: {
            increment:
              Number(answerPartial && instanceInPracticeQuiz) -
              Number(
                existingResponse?.lastResponseCorrectness ===
                  ResponseCorrectness.PARTIAL
              ),
          },
          lastWrongCount: {
            increment:
              Number(answerIncorrect && instanceInPracticeQuiz) -
              Number(
                existingResponse?.lastResponseCorrectness ===
                  ResponseCorrectness.WRONG
              ),
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

export function combineStackStatus({
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
// #endregion

// ! Flashcard Response Logic
// #region
async function getValidateFlashcardInstance({
  prisma,
  id,
  participantId,
  response,
}: {
  prisma: PrismaTransactionClient
  id: number
  participantId?: string
  response: FlashcardCorrectness
}) {
  const existingInstance = await prisma.elementInstance.findUnique({
    where: {
      id,
      elementType: ElementType.FLASHCARD,
    },
    include: {
      elementStack: true,
      instanceStatistics: true,
      responses: participantId
        ? {
            where: {
              participantId,
            },
          }
        : false,
    },
  })

  // check if the instance exists and the response is valid
  if (
    !existingInstance ||
    existingInstance.elementType !== ElementType.FLASHCARD ||
    ![
      FlashcardCorrectness.INCORRECT,
      FlashcardCorrectness.PARTIAL,
      FlashcardCorrectness.CORRECT,
    ].includes(response)
  ) {
    return null
  }

  return existingInstance
}

function updateFlashcardResults({
  previousResults,
  response,
}: {
  previousResults: ElementResultsFlashcard
  response: FlashcardCorrectness
}): ElementResultsFlashcard {
  return {
    ...previousResults,
    [response]: (previousResults[response] ?? 0) + 1,
    total: previousResults.total + 1,
  }
}

function computeFlashcardResponseContent({
  response,
  existingResponse,
}: {
  response: FlashcardCorrectness
  existingResponse: PrismaQuestionResponse | null
}): {
  responseCorrectness: ResponseCorrectness
  aggregatedResponses: ElementResultsFlashcard
  resultSpacedRepetition: SpacedRepetitionResult
} {
  const prevResponses = existingResponse?.aggregatedResponses
  const aggregatedResponses =
    prevResponses && FlashcardCorrectness.CORRECT in prevResponses
      ? prevResponses
      : {
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
    eFactor: existingResponse?.eFactor ?? 2.5,
    interval: existingResponse?.interval ?? 1,
    streak: (existingResponse?.correctCountStreak ?? 0) + streakIncrement,
    grade: correctness,
  })

  return {
    responseCorrectness,
    aggregatedResponses,
    resultSpacedRepetition,
  }
}

async function createFlashcardResponseDetail({
  prisma,
  id,
  response,
  courseId,
  answerTime,
  existingInstance,
  participantId,
}: {
  prisma: PrismaTransactionClient
  id: number
  response: FlashcardCorrectness
  courseId: string
  answerTime: number
  existingInstance: ExistingInstanceType
  participantId: string
}) {
  await prisma.questionResponseDetail.create({
    data: {
      response: {
        correctness: response,
      },
      timeSpent: answerTime,
      participant: {
        connect: { id: participantId },
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
            participantId: participantId,
          },
        },
      },
    },
  })
}

async function upsertFlashcardResponse({
  prisma,
  id,
  participantId,
  courseId,
  response,
  newAverageResponseTime,
  existingInstance,
  existingResponse,
  responseCorrectness,
  aggregatedResponses,
  resultSpacedRepetition,
}: {
  prisma: PrismaTransactionClient
  id: number
  participantId: string
  courseId: string
  response: FlashcardCorrectness
  newAverageResponseTime?: number
  existingInstance: ExistingInstanceType
  existingResponse: PrismaQuestionResponse | null
  responseCorrectness: ResponseCorrectness
  aggregatedResponses: ElementResultsFlashcard
  resultSpacedRepetition: SpacedRepetitionResult
}) {
  await prisma.questionResponse.upsert({
    where: {
      participantId_elementInstanceId: {
        participantId: participantId,
        elementInstanceId: id,
      },
    },
    create: {
      participant: {
        connect: { id: participantId },
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
            participantId: participantId,
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
}

async function respondToFlashcard(
  {
    id,
    courseId,
    response,
    answerTime,
    participation,
  }: {
    id: number
    courseId: string
    response: FlashcardCorrectness
    answerTime: number
    participation: (Participation & { participant: Participant }) | null
  },
  ctx: Context
) {
  // create result from flashcard response
  const result = {
    grading: flashcardResultMap[response],
    score: null,
  }

  // variable summaries for code readability
  const answerCorrect = response === FlashcardCorrectness.CORRECT
  const answerPartial = response === FlashcardCorrectness.PARTIAL
  const answerIncorrect = response === FlashcardCorrectness.INCORRECT

  const transactionResult = await ctx.prisma.$transaction(async (prisma) => {
    const existingInstance = await getValidateFlashcardInstance({
      prisma,
      id,
      participantId: ctx.user?.sub,
      response,
    })

    if (
      !existingInstance ||
      !(FlashcardCorrectness.CORRECT in existingInstance.results) ||
      !(FlashcardCorrectness.PARTIAL in existingInstance.anonymousResults)
    ) {
      return null
    }

    const existingResponse =
      existingInstance.responses &&
      existingInstance.responses.length > 0 &&
      existingInstance.responses[0]
        ? existingInstance.responses[0]
        : null

    // compute new aggregated results on element instance
    const newResults = updateFlashcardResults({
      previousResults: participation
        ? existingInstance.results
        : existingInstance.anonymousResults,
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

    // compute updated instance statistics
    const instanceInPracticeQuiz =
      !!existingInstance.elementStack.practiceQuizId
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

    // early return: anonymous submissions (no login or login without participation in this course)
    if (!ctx.user?.sub || !participation) {
      return result
    }

    // create question detail response
    createFlashcardResponseDetail({
      prisma,
      id,
      response,
      courseId,
      answerTime,
      existingInstance,
      participantId: ctx.user.sub,
    })

    // compute metrics for the aggregated user-specific response entry
    const { responseCorrectness, aggregatedResponses, resultSpacedRepetition } =
      computeFlashcardResponseContent({
        response,
        existingResponse,
      })

    // upsert the user-specific response entry
    await upsertFlashcardResponse({
      prisma,
      id,
      participantId: ctx.user.sub,
      courseId,
      response,
      newAverageResponseTime,
      existingInstance,
      existingResponse,
      responseCorrectness,
      aggregatedResponses,
      resultSpacedRepetition,
    })

    // return the results for evaluation illustration
    return result
  })

  return transactionResult
}
// #endregion

// ! Content Element Response Logic
// #region
async function getValidateContentInstance({
  prisma,
  id,
  participantId,
}: {
  prisma: PrismaTransactionClient
  id: number
  participantId?: string
}) {
  const existingInstance = await prisma.elementInstance.findUnique({
    where: {
      id,
      elementType: ElementType.CONTENT,
    },
    include: {
      elementStack: true,
      instanceStatistics: true,
      responses: participantId
        ? {
            where: {
              participantId,
            },
          }
        : false,
    },
  })

  return existingInstance
}

async function createContentResponseDetail({
  prisma,
  id,
  courseId,
  answerTime,
  existingInstance,
  participantId,
}: {
  prisma: PrismaTransactionClient
  id: number
  courseId: string
  answerTime: number
  existingInstance: ExistingInstanceType
  participantId: string
}) {
  await prisma.questionResponseDetail.create({
    data: {
      response: {
        viewed: true,
      },
      timeSpent: answerTime,
      participant: {
        connect: { id: participantId },
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
            participantId: participantId,
          },
        },
      },
    },
  })
}

async function upsertContentResponse({
  prisma,
  id,
  participantId,
  courseId,
  newAverageResponseTime,
  existingInstance,
  aggregatedResponses,
  resultSpacedRepetition,
}: {
  prisma: PrismaTransactionClient
  id: number
  participantId: string
  courseId: string
  newAverageResponseTime?: number
  existingInstance: ExistingInstanceType
  aggregatedResponses: ElementResultsContent
  resultSpacedRepetition: SpacedRepetitionResult
}) {
  await prisma.questionResponse.upsert({
    where: {
      participantId_elementInstanceId: {
        participantId,
        elementInstanceId: id,
      },
    },
    create: {
      participant: {
        connect: { id: participantId },
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
            participantId,
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
}

async function respondToContent(
  {
    id,
    courseId,
    answerTime,
    participation,
  }: {
    id: number
    courseId: string
    answerTime: number
    participation: (Participation & { participant: Participant }) | null
  },
  ctx: Context
) {
  // context elements can only be "read" when submitted
  const result = {
    grading: StackFeedbackStatus.CORRECT,
    score: null,
  }

  const transactionResult = await ctx.prisma.$transaction(async (prisma) => {
    const existingInstance = await getValidateContentInstance({
      prisma,
      id,
      participantId: ctx.user?.sub,
    })

    // check if the instance exists and the response is valid
    if (!existingInstance) {
      return null
    }

    const existingResponse =
      existingInstance.responses &&
      existingInstance.responses.length > 0 &&
      existingInstance.responses[0]
        ? existingInstance.responses[0]
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

    // update results on element instance
    const newResults = participation
      ? { total: existingInstance.results.total + 1 }
      : { total: existingInstance.anonymousResults.total + 1 }
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

    // early return: anonymous submissions (no login or login without participation in this course)
    if (!ctx.user?.sub || !participation) {
      return result
    }

    // create question detail response
    await createContentResponseDetail({
      prisma,
      id,
      courseId,
      answerTime,
      existingInstance,
      participantId: ctx.user.sub,
    })

    const aggregatedResponses = existingResponse?.aggregatedResponses ?? {
      total: 0,
    }

    const resultSpacedRepetition = updateSpacedRepetition({
      eFactor: existingResponse?.eFactor ?? 2.5,
      interval: existingResponse?.interval ?? 1,
      streak: (existingResponse?.correctCountStreak ?? 0) + 1,
      grade: 1,
    })

    // create / update question response
    await upsertContentResponse({
      prisma,
      id,
      participantId: ctx.user.sub,
      courseId,
      newAverageResponseTime,
      existingInstance,
      aggregatedResponses,
      resultSpacedRepetition,
    })

    return result
  })

  return transactionResult
}
// #endregion

// ! Question Response Logic
// #region
type SharedEvaluationProps =
  | 'elementType'
  | 'feedbacks'
  | 'numAnswers'
  | 'score'
  | 'xp'
  | 'percentile'
  | 'pointsMultiplier'
  | 'explanation'

type ChoicesEvaluationReturnType = Pick<
  InstanceEvaluationChoices,
  SharedEvaluationProps | 'choices'
>
type NumericalEvaluationReturnType = Pick<
  InstanceEvaluationNumerical,
  SharedEvaluationProps | 'solutionRanges' | 'responses'
>
type FreeTextEvaluationReturnType = Pick<
  InstanceEvaluationFreeText,
  SharedEvaluationProps | 'solutions' | 'answers'
>

async function getValidateQuestionInstance({
  prisma,
  id,
  participantId,
}: {
  prisma: PrismaTransactionClient
  id: number
  participantId?: string
}) {
  const existingInstance = await prisma.elementInstance.findUnique({
    where: {
      id,
    },
    include: {
      elementStack: true,
      instanceStatistics: true,
      responses: participantId
        ? {
            where: {
              participantId,
            },
          }
        : false,
    },
  })

  return existingInstance
}

function evaluateChoicesElementResponse({
  elementData,
  results,
  anonymousResults,
  correctness,
  multiplier,
}: {
  elementData: ChoicesElementData
  results: ElementResultsChoices
  anonymousResults: ElementResultsChoices
  correctness: number | null
  multiplier?: number
}): ChoicesEvaluationReturnType | null {
  const elementOptions = elementData.options
  const feedbacks = elementOptions.choices
  const combinedResults = combineChoicesResults({
    choices: elementData.options.choices,
    results: results.choices,
    anonymousResults: anonymousResults.choices,
  })
  const combinedChoices = combinedResults.reduce<Record<string, number>>(
    (acc, choice) => {
      acc[String(choice.ix)] = choice.count
      return acc
    },
    {}
  )

  return {
    elementType: elementData.type,
    feedbacks,
    numAnswers: results.total + anonymousResults.total,
    choices: combinedChoices,
    score: computeSimpleAwardedPoints({
      points: POINTS_PER_INSTANCE,
      pointsPercentage: correctness,
      pointsMultiplier: multiplier,
    }),
    xp: computeAwardedXp({
      pointsPercentage: correctness,
    }),
    percentile: correctness ?? 0,
    pointsMultiplier: multiplier ?? 1,
    explanation: elementData.explanation,
  }
}

function evaluateNumericalElementResponse({
  elementData,
  results,
  anonymousResults,
  correctness,
  multiplier,
}: {
  elementData: NumericalElementData
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
  correctness: number | null
  multiplier?: number
}): NumericalEvaluationReturnType | null {
  return {
    elementType: ElementType.NUMERICAL,
    feedbacks: [],
    numAnswers: results.total + anonymousResults.total,
    responses: combineNumericalResults({
      results,
      anonymousResults,
    }),
    score: correctness ? correctness * 10 * (multiplier ?? 1) : 0,
    xp: computeAwardedXp({
      pointsPercentage: correctness,
    }),
    percentile: correctness ?? 0,
    pointsMultiplier: multiplier ?? 1,
    explanation: elementData.explanation,
    solutionRanges: elementData.options.solutionRanges ?? [],
  }
}

function evaluateFreeTextElementResponse({
  elementData,
  results,
  anonymousResults,
  correctness,
  multiplier,
}: {
  elementData: FreeTextElementData
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
  correctness: number | null
  multiplier?: number
}): FreeTextEvaluationReturnType | null {
  return {
    elementType: ElementType.FREE_TEXT,
    feedbacks: [],
    numAnswers: results.total + anonymousResults.total,
    answers: combineFreeTextResults({
      results,
      anonymousResults,
    }),
    score: correctness ? correctness * 10 * (multiplier ?? 1) : 0,
    xp: computeAwardedXp({
      pointsPercentage: correctness,
    }),
    percentile: correctness ?? 0,
    pointsMultiplier: multiplier ?? 1,
    explanation: elementData.explanation,
    solutions: elementData.options.solutions ?? [],
  }
}

function computeQuestionEvaluation({
  elementData,
  results,
  anonymousResults,
  correctness,
  multiplier,
}: {
  elementData: AllElementTypeData
  results: ElementInstanceResults
  anonymousResults: ElementInstanceResults
  correctness: number | null
  multiplier?: number
}) {
  if (
    (elementData.type === ElementType.SC ||
      elementData.type === ElementType.MC ||
      elementData.type === ElementType.KPRIM) &&
    'choices' in results &&
    'choices' in anonymousResults
  ) {
    return evaluateChoicesElementResponse({
      elementData,
      results,
      anonymousResults,
      correctness,
      multiplier,
    })
  } else if (
    elementData.type === ElementType.NUMERICAL &&
    'responses' in results &&
    'responses' in anonymousResults
  ) {
    return evaluateNumericalElementResponse({
      elementData,
      results,
      anonymousResults,
      correctness,
      multiplier,
    })
  } else if (
    elementData.type === ElementType.FREE_TEXT &&
    'responses' in results &&
    'responses' in anonymousResults
  ) {
    return evaluateFreeTextElementResponse({
      elementData,
      results,
      anonymousResults,
      correctness,
      multiplier,
    })
  } else {
    return null
  }
}

function evaluateChoicesAnswerCorrectness({
  elementData,
  response,
}: {
  elementData: ChoicesElementData
  response: ResponseInput
}) {
  if (
    !('choices' in response) ||
    !response.choices ||
    response.choices.length === 0
  ) {
    return null
  }

  const elementOptions = elementData.options
  const solution = elementOptions.choices.reduce<number[]>((acc, choice) => {
    if (choice.correct) return [...acc, choice.ix]
    return acc
  }, [])

  if (elementData.type === ElementType.SC) {
    const correctness = gradeQuestionSC({
      responseCount: elementOptions.choices.length,
      response: response.choices,
      solution,
    })
    return correctness
  } else if (elementData.type === ElementType.MC) {
    const correctness = gradeQuestionMC({
      responseCount: elementOptions.choices.length,
      response: response.choices,
      solution,
    })
    return correctness
  } else {
    const correctness = gradeQuestionKPRIM({
      responseCount: elementOptions.choices.length,
      response: response.choices,
      solution,
    })
    return correctness
  }
}

function evaluateNumericalAnswerCorrectness({
  elementData,
  response,
}: {
  elementData: NumericalElementData
  response: ResponseInput
}) {
  if (
    !('value' in response) ||
    response.value === null ||
    typeof response.value === 'undefined'
  ) {
    return null
  }

  const correctness = gradeQuestionNumerical({
    response: parseFloat(String(response.value)),
    solutionRanges: elementData.options.solutionRanges ?? [],
  })
  return correctness
}

function evaluateFreeTextAnswerCorrectness({
  elementData,
  response,
}: {
  elementData: FreeTextElementData
  response: ResponseInput
}) {
  if (
    !('value' in response) ||
    response.value === null ||
    typeof response.value === 'undefined'
  ) {
    return null
  }

  const correctness = gradeQuestionFreeText({
    response: response.value,
    solutions: elementData.options.solutions ?? [],
  })
  return correctness
}

export function updateChoicesResults({
  previousResults,
  response,
}: {
  previousResults: ElementResultsChoices
  response: ResponseInput
}): { results: ElementResultsChoices; modified: boolean } {
  const results = previousResults
  let updatedResults = results

  if (
    !('choices' in response) ||
    !response.choices ||
    response.choices.length === 0
  ) {
    return { results: results, modified: false }
  }

  updatedResults.choices = (
    response as SingleQuestionResponseChoices
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

export function updateNumericalResults({
  previousResults,
  elementData,
  response,
  correct,
}: {
  previousResults: ElementResultsOpen
  elementData: AllElementTypeData
  response: ResponseInput
  correct?: boolean
}): { results: ElementResultsOpen; modified: boolean } {
  // verify the input types
  if (elementData.type !== ElementType.NUMERICAL) {
    return { results: previousResults, modified: false }
  }

  const MD5 = createHash('md5')
  const results = previousResults
  let updatedResults = results

  // validate format of response
  if (
    !('value' in response) ||
    typeof response.value === 'undefined' ||
    response.value === null ||
    response.value === ''
  ) {
    return { results: results, modified: false }
  }

  // make sure that restrictions are fulfilled
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
      [hashedValue]: { value: value, count: 1, correct: correct },
    }
  }
  updatedResults.total = results.total + 1
  return { results: updatedResults, modified: true }
}

export function updateFreeTextResults({
  previousResults,
  elementData,
  response,
  correct,
}: {
  previousResults: ElementResultsOpen
  elementData: AllElementTypeData
  response: ResponseInput
  correct?: boolean
}): { results: ElementResultsOpen; modified: boolean } {
  // verify the input types
  if (elementData.type !== ElementType.FREE_TEXT) {
    return { results: previousResults, modified: false }
  }

  const MD5 = createHash('md5')
  const results = previousResults
  let updatedResults = results

  // validate format of response and check that restrictions are fulfilled
  if (
    !('value' in response) ||
    typeof response.value === 'undefined' ||
    response.value === null ||
    response.value === '' ||
    (typeof elementData.options.restrictions?.maxLength === 'number' &&
      response.value.length > elementData.options.restrictions?.maxLength)
  ) {
    return { results: results, modified: false }
  }

  const value = toLowerCase(response.value.trim())
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

function updateQuestionResults({
  existingInstance,
  participation,
  response,
}: {
  existingInstance: ElementInstance
  participation: (Participation & { participant: Participant }) | null
  response: ResponseInput
}): {
  correctness: number | null
  results: ElementInstanceResults
  modified: boolean
} {
  let correctness: number | null
  const elementData = existingInstance.elementData
  const previousResults = participation
    ? existingInstance.results
    : existingInstance.anonymousResults

  if (
    (elementData.type === ElementType.SC ||
      elementData.type === ElementType.MC ||
      elementData.type === ElementType.KPRIM) &&
    'choices' in previousResults
  ) {
    correctness = elementData.options.hasSampleSolution
      ? evaluateChoicesAnswerCorrectness({ elementData, response })
      : 1

    const res = updateChoicesResults({
      previousResults: previousResults,
      response,
    })

    return {
      ...res,
      correctness,
    }
  } else if (
    elementData.type === ElementType.NUMERICAL &&
    'responses' in previousResults
  ) {
    correctness = elementData.options.hasSampleSolution
      ? evaluateNumericalAnswerCorrectness({ elementData, response })
      : 1

    const res = updateNumericalResults({
      previousResults: previousResults,
      elementData,
      response,
      correct: correctness === 1,
    })

    return {
      ...res,
      correctness,
    }
  } else if (
    elementData.type === ElementType.FREE_TEXT &&
    'responses' in previousResults
  ) {
    correctness = elementData.options.hasSampleSolution
      ? evaluateFreeTextAnswerCorrectness({ elementData, response })
      : 1

    const res = updateFreeTextResults({
      previousResults: previousResults,
      elementData,
      response,
      correct: correctness === 1,
    })

    return {
      ...res,
      correctness,
    }
  }

  return {
    correctness: null,
    results: previousResults,
    modified: true,
  }
}

function computeAwardedPointsAndXP({
  score,
  xp,
  existingResponse,
  participation,
  instance,
}: {
  score: number
  xp: number
  existingResponse: PrismaQuestionResponse | null
  participation: Participation | null
  instance: ElementInstance
}): {
  pointsAwarded: number | null
  newPointsFrom: Date | undefined
  lastAwardedAt: Date | undefined
  lastXpAwardedAt: Date
  xpAwarded: number
  newXpFrom: Date
} {
  const participationActive = participation?.isActive ?? false

  // award points and xp based on the previous response being outside the timeframe
  if (existingResponse) {
    // update points (only if participation is active)
    const pointsOutsideTimeframe =
      !existingResponse.lastAwardedAt ||
      dayjs(existingResponse.lastAwardedAt).isBefore(
        dayjs().subtract(
          instance?.options.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
          'days'
        )
      )

    let pointsAwarded: number | null
    let lastAwardedAt: Date | undefined
    let newPointsFrom: Date | undefined

    if (participationActive) {
      pointsAwarded = pointsOutsideTimeframe ? score : 0
      lastAwardedAt =
        pointsOutsideTimeframe || !existingResponse.lastAwardedAt
          ? new Date()
          : existingResponse.lastAwardedAt
      newPointsFrom = dayjs(lastAwardedAt)
        .add(
          instance?.options.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
          'days'
        )
        .toDate()
    } else {
      pointsAwarded = null
      lastAwardedAt = undefined
      newPointsFrom = undefined
    }

    // update experience points (independent of active participation -> stored directly on participant)
    const xpOutsideTimeframe =
      !existingResponse.lastXpAwardedAt ||
      dayjs(existingResponse.lastXpAwardedAt).isBefore(
        dayjs().subtract(XP_AWARD_TIMEFRAME_DAYS, 'days')
      )

    const xpAwarded = xpOutsideTimeframe ? xp : 0
    const lastXpAwardedAt =
      xpOutsideTimeframe || !existingResponse.lastXpAwardedAt
        ? new Date()
        : existingResponse.lastXpAwardedAt
    const newXpFrom = dayjs(lastXpAwardedAt)
      .add(XP_AWARD_TIMEFRAME_DAYS, 'days')
      .toDate()

    return {
      pointsAwarded,
      newPointsFrom,
      lastAwardedAt,
      xpAwarded,
      newXpFrom,
      lastXpAwardedAt,
    }
  }

  // no previous response exists -> award points and xp based on the current response and if participation is active
  const lastAwardedAt = participationActive ? new Date() : undefined
  const newPointsFrom = participationActive
    ? dayjs(lastAwardedAt)
        .add(
          instance?.options.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
          'days'
        )
        .toDate()
    : undefined
  const newXpFrom = dayjs(lastAwardedAt)
    .add(XP_AWARD_TIMEFRAME_DAYS, 'days')
    .toDate()

  return {
    pointsAwarded: participationActive ? score : null,
    newPointsFrom,
    lastAwardedAt,
    xpAwarded: xp,
    newXpFrom,
    lastXpAwardedAt: new Date(),
  }
}

function computeAggregatedResponsesChoices({
  instance,
  existingResponse,
  response,
}: {
  instance: ElementInstance
  existingResponse: PrismaQuestionResponse | null
  response: ResponseInput
}): ElementResultsChoices {
  let newAggResponses = (existingResponse?.aggregatedResponses ??
    getInitialElementResults({
      type: instance.elementType,
      options: instance.elementData.options,
    } as Element)) as ElementResultsChoices

  // update aggregated responses for choices
  newAggResponses.choices = (
    response as SingleQuestionResponseChoices
  ).choices.reduce(
    (acc, ix) => ({
      ...acc,
      [ix]: acc[ix]! + 1,
    }),
    newAggResponses.choices
  )
  newAggResponses.total = newAggResponses.total + 1

  return newAggResponses
}

function computeAggregatedResponsesOpen({
  instance,
  existingResponse,
  responseValue,
  correctness,
}: {
  instance: ElementInstance
  existingResponse: PrismaQuestionResponse | null
  responseValue: string
  correctness: number
}) {
  let newAggResponses = (existingResponse?.aggregatedResponses ??
    getInitialElementResults({
      type: instance.elementType,
    } as Element)) as ElementResultsOpen

  // update aggregated responses for open questions
  const MD5 = createHash('md5')
  MD5.update(responseValue)
  const hashedValue = MD5.digest('hex')

  if (Object.keys(newAggResponses.responses).includes(hashedValue)) {
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
        value: responseValue,
        count: 1,
        correct: correctness === 1,
      },
    }
  }
  newAggResponses.total = newAggResponses.total + 1

  return newAggResponses
}

function computeAggregatedResponsesQuestion({
  instance,
  existingResponse,
  response,
}: {
  instance: ElementInstance
  existingResponse: PrismaQuestionResponse | null
  response: ResponseInput
}): ElementInstanceResults | null {
  if (
    instance.elementType === ElementType.SC ||
    instance.elementType === ElementType.MC ||
    instance.elementType === ElementType.KPRIM
  ) {
    return computeAggregatedResponsesChoices({
      instance,
      existingResponse,
      response,
    })
  } else if (
    instance.elementType === ElementType.NUMERICAL ||
    instance.elementType === ElementType.FREE_TEXT
  ) {
    return computeAggregatedResponsesOpen({
      instance,
      existingResponse,
      responseValue:
        instance.elementType === ElementType.NUMERICAL
          ? String(parseFloat(response.value!))
          : toLowerCase(response.value!.trim()),
      correctness: 1,
    })
  }

  return null
}

async function upsertQuestionResponse({
  prisma,
  id,
  participantId,
  courseId,
  response,
  correctness,
  score,
  pointsAwarded,
  lastAwardedAt,
  xpAwarded,
  lastXpAwardedAt,
  newAverageResponseTime,
  existingResponse,
  newAggResponses,
  practiceQuizId,
  microLearningId,
  resultSpacedRepetition,
}: {
  prisma: PrismaTransactionClient
  id: number
  participantId: string
  courseId: string
  response: ResponseInput
  correctness: number
  score: number
  pointsAwarded: number | null
  lastAwardedAt: Date
  xpAwarded: number
  lastXpAwardedAt: Date
  newAverageResponseTime: number | undefined
  existingResponse: PrismaQuestionResponse | null
  newAggResponses: ElementInstanceResults
  practiceQuizId?: string
  microLearningId?: string
  resultSpacedRepetition: SpacedRepetitionResult
}) {
  const responseCorrectness =
    correctness === 1
      ? ResponseCorrectness.CORRECT
      : correctness === 0
        ? ResponseCorrectness.WRONG
        : ResponseCorrectness.PARTIAL

  await prisma.questionResponse.upsert({
    where: {
      participantId_elementInstanceId: {
        participantId,
        elementInstanceId: id,
      },
    },
    create: {
      totalScore: score,
      totalPointsAwarded: pointsAwarded,
      totalXpAwarded: xpAwarded,
      trialsCount: 1,
      averageTimeSpent: newAverageResponseTime,
      lastAwardedAt,
      lastXpAwardedAt,
      firstResponse: response as SingleQuestionResponse,
      firstResponseCorrectness: responseCorrectness,
      lastResponse: response as SingleQuestionResponse,
      lastResponseCorrectness: responseCorrectness,
      aggregatedResponses: newAggResponses,
      participant: {
        connect: { id: participantId },
      },
      elementInstance: {
        connect: { id },
      },
      practiceQuiz: practiceQuizId
        ? { connect: { id: practiceQuizId } }
        : undefined,
      microLearning: microLearningId
        ? { connect: { id: microLearningId } }
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
            participantId,
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
      lastResponse: response as SingleQuestionResponse,
      lastResponseCorrectness: responseCorrectness,
      aggregatedResponses: newAggResponses,
      lastAwardedAt,
      lastXpAwardedAt,
      trialsCount: {
        increment: 1,
      },
      averageTimeSpent: newAverageResponseTime,
      totalScore: {
        increment: score,
      },
      totalPointsAwarded:
        typeof pointsAwarded === 'number' ? { increment: pointsAwarded } : null,
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
  })
}

async function createQuestionResponseDetail({
  prisma,
  id,
  participantId,
  courseId,
  response,
  score,
  pointsAwarded,
  xpAwarded,
  answerTime,
  practiceQuizId,
  microLearningId,
}: {
  prisma: PrismaTransactionClient
  id: number
  participantId: string
  courseId: string
  response: ResponseInput
  score: number
  pointsAwarded: number | null
  xpAwarded: number
  answerTime: number
  practiceQuizId?: string
  microLearningId?: string
}) {
  await prisma.questionResponseDetail.create({
    data: {
      score,
      pointsAwarded,
      xpAwarded,
      timeSpent: answerTime,
      response: response as SingleQuestionResponse,
      participant: {
        connect: { id: participantId },
      },
      elementInstance: {
        connect: { id },
      },
      practiceQuiz: practiceQuizId
        ? { connect: { id: practiceQuizId } }
        : undefined,
      microLearning: microLearningId
        ? { connect: { id: microLearningId } }
        : undefined,
      participation: {
        connect: {
          courseId_participantId: {
            courseId,
            participantId,
          },
        },
      },
    },
  })
}

async function incrementParticipantXp({
  prisma,
  participantId,
  xpAwarded,
}: {
  prisma: PrismaTransactionClient
  participantId: string
  xpAwarded: number
}) {
  await prisma.participant.update({
    where: {
      id: participantId,
    },
    data: {
      xp: {
        increment: xpAwarded,
      },
    },
  })
}

async function updateLeaderboardOnQuestionResponse({
  prisma,
  participantId,
  courseId,
  pointsAwarded,
}: {
  prisma: PrismaTransactionClient
  participantId: string
  courseId: string
  pointsAwarded: number
}) {
  await prisma.leaderboardEntry.upsert({
    where: {
      type_participantId_courseId: {
        type: 'COURSE',
        courseId,
        participantId,
      },
    },
    create: {
      type: 'COURSE',
      score: pointsAwarded,
      participant: {
        connect: {
          id: participantId,
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
            participantId,
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
}

export async function respondToQuestion(
  {
    courseId,
    id,
    response,
    answerTime,
    participation,
  }: {
    courseId: string
    id: number
    response: ResponseInput
    answerTime: number
    participation: (Participation & { participant: Participant }) | null
  },
  ctx: Context
) {
  const result = await ctx.prisma.$transaction(async (prisma) => {
    const existingInstance = await getValidateQuestionInstance({
      prisma,
      id,
      participantId: ctx.user?.sub,
    })

    // if the instance does not exist or the elementData is not defined, return early
    if (!existingInstance || !existingInstance?.elementData) {
      return null
    }

    const existingResponse =
      existingInstance.responses &&
      existingInstance.responses.length > 0 &&
      existingInstance.responses[0]
        ? existingInstance.responses[0]
        : null

    // evaluate response correctness and compute updated instance results
    const { correctness, results, modified } = updateQuestionResults({
      existingInstance,
      participation,
      response,
    })

    if (!modified || results === null) {
      return null
    }

    // average answer time computations if participant is logged in
    const { newAverageResponseTime, newAverageInstanceTime } = participation
      ? computeNewAverageTimes({
          existingInstance,
          existingResponse,
          answerTime,
        })
      : {
          newAverageInstanceTime: undefined,
          newAverageResponseTime: undefined,
        }

    // compute updated instance statistics
    const instanceInPracticeQuiz =
      !!existingInstance.elementStack.practiceQuizId
    const statisticsUpdate = computeUpdatedInstanceStatistics({
      participation,
      existingResponse: existingResponse, // this is safe because we only use it inside the function if the participation is defined
      newAverageInstanceTime,
      answerCorrect: correctness === 1,
      answerPartial: (correctness ?? 0) < 1 && (correctness ?? 0) > 0,
      answerIncorrect: correctness === 0,
      instanceInPracticeQuiz,
    })

    // update the element instance
    const updatedInstance = await prisma.elementInstance.update({
      where: { id },
      data: {
        results: participation ? results : undefined,
        anonymousResults: participation ? undefined : results,
        instanceStatistics: statisticsUpdate,
      },
      include: {
        elementStack: true,
      },
    })

    // compute question evaluation
    // TODO: call computeChoicesEvaluation, computeNumericalEvaluation and computeFreeTextEvaluation for consistent feedback
    const questionEval = computeQuestionEvaluation({
      elementData: existingInstance.elementData,
      results: updatedInstance.results,
      anonymousResults: updatedInstance.anonymousResults,
      correctness,
      multiplier: updatedInstance.options.pointsMultiplier,
    })

    // processing of percentile into status of instance
    const percentile = questionEval?.percentile ?? 0
    const status =
      percentile === 0
        ? StackFeedbackStatus.INCORRECT
        : percentile === 1
          ? StackFeedbackStatus.CORRECT
          : StackFeedbackStatus.PARTIAL

    // if participant is not logged in, return early and return the evaluation
    if (
      !questionEval ||
      !participation ||
      !ctx.user?.sub ||
      ctx.user.role !== UserRole.PARTICIPANT
    ) {
      return {
        ...updatedInstance,
        evaluation: questionEval
          ? {
              ...questionEval,
              pointsAwarded: undefined,
              newPointsFrom: undefined,
              xpAwarded: undefined,
              newXpFrom: undefined,
            }
          : undefined,
        status,
      }
    }

    // compute the awarded points & XP and all associated dates
    const {
      pointsAwarded,
      newPointsFrom,
      lastAwardedAt,
      lastXpAwardedAt,
      xpAwarded,
      newXpFrom,
    } = computeAwardedPointsAndXP({
      score: questionEval.score ?? 0,
      xp: questionEval.xp ?? 0,
      existingResponse,
      participation,
      instance: updatedInstance,
    })

    // compute updated aggregated responses
    const newAggResponses = computeAggregatedResponsesQuestion({
      instance: updatedInstance,
      existingResponse,
      response,
    })

    if (!newAggResponses) {
      throw new Error(
        `Failed to compute aggregated responses for question type ${updatedInstance.elementType}`
      )
    }

    // update aggregated results for choices and open questions
    const streakIncrement = percentile === 1 ? 1 : 0
    const resultSpacedRepetition = updateSpacedRepetition({
      eFactor: existingResponse?.eFactor ?? 2.5,
      interval: existingResponse?.interval ?? 1,
      streak: (existingResponse?.correctCountStreak ?? 0) + streakIncrement,
      grade: percentile,
    })

    // create a question response detail
    await createQuestionResponseDetail({
      prisma,
      id,
      participantId: ctx.user.sub,
      courseId,
      response,
      score: questionEval.score ?? 0,
      pointsAwarded,
      xpAwarded,
      answerTime,
      practiceQuizId: updatedInstance.elementStack.practiceQuizId ?? undefined,
      microLearningId:
        updatedInstance.elementStack.microLearningId ?? undefined,
    })

    // upsert the question response
    await upsertQuestionResponse({
      prisma,
      id,
      participantId: ctx.user.sub,
      courseId,
      response,
      correctness: percentile,
      score: questionEval.score ?? 0,
      pointsAwarded,
      lastAwardedAt: lastAwardedAt ?? new Date(),
      xpAwarded,
      lastXpAwardedAt: lastXpAwardedAt ?? new Date(),
      newAverageResponseTime,
      existingResponse,
      newAggResponses,
      practiceQuizId: updatedInstance.elementStack.practiceQuizId ?? undefined,
      microLearningId:
        updatedInstance.elementStack.microLearningId ?? undefined,
      resultSpacedRepetition,
    })

    // increment participant xp
    if (xpAwarded > 0) {
      await incrementParticipantXp({
        prisma,
        participantId: ctx.user.sub,
        xpAwarded,
      })
    }

    // create or increment the leaderboard entry, if the participant has an active participation in the course
    // active participation has already been checked during computation of pointsAwarded
    if (typeof pointsAwarded === 'number' && pointsAwarded !== null) {
      await updateLeaderboardOnQuestionResponse({
        prisma,
        participantId: ctx.user.sub,
        courseId,
        pointsAwarded,
      })
    }

    return {
      ...updatedInstance,
      evaluation: {
        ...questionEval,
        pointsAwarded,
        newPointsFrom,
        xpAwarded,
        newXpFrom,
      },
      status,
    }
  })

  return result
}
// #endregion

// ! Element & Stack Response & Combination Logic
// #region

interface ElementResponseInput {
  instanceId: number
  type: ElementType
  flashcardResponse?: FlashcardCorrectness | null
  contentReponse?: boolean | null
  choicesResponse?: number[] | null
  numericalResponse?: number | null
  freeTextResponse?: string | null
}

async function respondToElement({
  ctx,
  response,
  courseId,
  answerTime,
}: {
  ctx: Context
  response: ElementResponseInput
  courseId: string
  answerTime: number
}): Promise<{
  grading: StackFeedbackStatus | null
  score: number | null
  evaluation: InstanceEvaluation | null
}> {
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

  if (response.type === ElementType.FLASHCARD) {
    const result = await respondToFlashcard(
      {
        id: response.instanceId,
        courseId: courseId,
        response: response.flashcardResponse!,
        answerTime,
        participation,
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
      return {
        grading: result.grading,
        score: null,
        evaluation: null,
      }
    } else {
      return {
        grading: null,
        score: null,
        evaluation: null,
      }
    }
  } else if (
    response.type === ElementType.CONTENT &&
    response.contentReponse === true
  ) {
    const result = await respondToContent(
      {
        id: response.instanceId,
        courseId: courseId,
        answerTime,
        participation,
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
      return {
        grading: result.grading,
        score: null,
        evaluation: null,
      }
    } else {
      return {
        grading: null,
        score: null,
        evaluation: null,
      }
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
        answerTime,
        participation,
      },
      ctx
    )

    if (result) {
      return {
        grading: result.status,
        score: result.evaluation?.score ?? 0,
        evaluation: {
          instanceId: response.instanceId,
          ...result.evaluation,
        } as InstanceEvaluation,
      }
    } else {
      return {
        grading: null,
        score: null,
        evaluation: null,
      }
    }
  } else if (response.type === ElementType.NUMERICAL) {
    const result = await respondToQuestion(
      {
        courseId: courseId,
        id: response.instanceId,
        response: { value: String(response.numericalResponse) },
        answerTime,
        participation,
      },
      ctx
    )

    if (result) {
      return {
        grading: result.status,
        score: result.evaluation?.score ?? 0,
        evaluation: {
          instanceId: response.instanceId,
          ...result.evaluation,
        } as InstanceEvaluation,
      }
    } else {
      return {
        grading: null,
        score: null,
        evaluation: null,
      }
    }
  } else if (response.type === ElementType.FREE_TEXT) {
    const result = await respondToQuestion(
      {
        courseId: courseId,
        id: response.instanceId,
        response: { value: response.freeTextResponse },
        answerTime,
        participation,
      },
      ctx
    )

    if (result) {
      return {
        grading: result.status,
        score: result.evaluation?.score ?? 0,
        evaluation: {
          instanceId: response.instanceId,
          ...result.evaluation,
        } as InstanceEvaluation,
      }
    } else {
      return {
        grading: null,
        score: null,
        evaluation: null,
      }
    }
  } else {
    throw new Error(
      'Submission of practice quiz stack answers not implemented for type ' +
        response.type
    )
  }
}

export interface RespondToElementStackInput {
  stackId: number
  courseId: string
  responses: ElementResponseInput[]
  stackAnswerTime: number
}

export async function respondToElementStack(
  { stackId, courseId, responses, stackAnswerTime }: RespondToElementStackInput,
  ctx: Context
) {
  // if the element stack is part of a microlearning and the student has already responses to it, ignore this submission
  if (ctx.user?.sub) {
    const stack = await ctx.prisma.elementStack.findUnique({
      where: { id: stackId },
      include: {
        microLearning: true,
        elements: {
          include: {
            responses: {
              where: {
                participantId: ctx.user.sub,
              },
            },
          },
        },
      },
    })

    if (
      stack?.microLearning &&
      (stack.elements.some((element) => element.responses.length > 0) ||
        dayjs().isAfter(dayjs(stack.microLearning.scheduledEndAt)))
    ) {
      return null
    }
  }

  let stackScore: number | undefined = undefined
  let stackFeedback = StackFeedbackStatus.UNANSWERED
  const evaluationsArr: InstanceEvaluation[] = []

  // compute average answer time per element / question by dividing the
  // answer time for the entire stack through the number of responses
  const elementAnswerTime = round(stackAnswerTime / responses.length)

  for (const response of responses) {
    const { grading, score, evaluation } = await respondToElement({
      ctx,
      response,
      courseId,
      answerTime: elementAnswerTime,
    })

    // update stack status
    if (grading) {
      stackFeedback = combineStackStatus({
        prevStatus: stackFeedback,
        newStatus: grading,
      })
    }

    // update stack score
    if (score !== null) {
      stackScore =
        typeof stackScore === 'undefined' ? score : stackScore + score
    }

    // add evaluation to the array
    if (evaluation) {
      evaluationsArr.push(evaluation)
    }
  }

  return {
    id: stackId,
    status: stackFeedback,
    score: stackScore,
    evaluations: evaluationsArr,
  }
}
// #endregion

// ! Functions for Evaluation Fetching & Computation
// #region
type CommonEvaluationProps = {
  id: number
  type: ElementType
  name: string
  content: string
  explanation: string | null
  hasSampleSolution: boolean
  hasAnswerFeedbacks: boolean
}

function combineChoicesResults({
  choices,
  results,
  anonymousResults,
}: {
  choices: Choice[]
  results: ElementResultsChoices['choices']
  anonymousResults: ElementResultsChoices['choices']
}) {
  return choices.map((choice) => ({
    ix: choice.ix,
    value: choice.value,
    count: (results[choice.ix] ?? 0) + (anonymousResults[choice.ix] ?? 0),
    correct: choice.correct,
    feedback: choice.feedback,
  }))
}

function combineNumericalResults({
  results,
  anonymousResults,
}: {
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
}) {
  return [
    ...Object.values(results.responses),
    ...Object.values(anonymousResults.responses),
  ].reduce<{ value: number; count: number; correct?: boolean | null }[]>(
    (acc, response) => {
      const responseValue = parseFloat(response.value)
      const ix = acc.findIndex(
        (r) => Math.abs(r.value - responseValue) < Number.EPSILON
      )
      if (ix === -1) {
        acc.push({
          value: responseValue,
          count: response.count,
          correct: response.correct,
        })
      } else {
        acc[ix] = {
          ...acc[ix]!,
          count: acc[ix]!.count + response.count,
        }
      }
      return acc
    },
    []
  )
}

function combineFreeTextResults({
  results,
  anonymousResults,
}: {
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
}) {
  return [
    ...Object.values(results.responses),
    ...Object.values(anonymousResults.responses),
  ].reduce<{ value: string; count: number; correct?: boolean | null }[]>(
    (acc, response) => {
      const ix = acc.findIndex((r) => r.value === response.value)
      if (ix === -1) {
        acc.push({
          value: response.value,
          count: response.count,
          correct: response.correct,
        })
      } else {
        acc[ix] = {
          ...acc[ix]!,
          count: acc[ix]!.count + response.count,
        }
      }
      return acc
    },
    []
  )
}

function computeChoicesEvaluation({
  options,
  results,
  anonymousResults,
  common,
}: {
  options: ElementOptionsChoices
  results: ElementResultsChoices
  anonymousResults: ElementResultsChoices
  common: CommonEvaluationProps
}) {
  // combine anonymous and participant results into new format
  const choices = combineChoicesResults({
    choices: options.choices,
    results: results.choices,
    anonymousResults: anonymousResults.choices,
  })

  return {
    ...common,
    results: {
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
      choices,
    },
  }
}

function computeNumericalEvaluation({
  options,
  results,
  anonymousResults,
  common,
}: {
  options: ElementOptionsNumerical
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
  common: CommonEvaluationProps
}) {
  return {
    ...common,
    results: {
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
      maxValue: options.restrictions?.max,
      minValue: options.restrictions?.min,
      solutionRanges: options.solutionRanges,
      responseValues: combineNumericalResults({
        results,
        anonymousResults,
      }),
      // TODO: extend with statistics
    },
  }
}

function computeFreeTextEvaluation({
  options,
  results,
  anonymousResults,
  common,
}: {
  options: ElementOptionsFreeText
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
  common: CommonEvaluationProps
}) {
  return {
    ...common,
    results: {
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
      maxLength: options.restrictions?.maxLength,
      solutions: options.solutions,
      responses: combineFreeTextResults({
        results,
        anonymousResults,
      }),
    },
  }
}

function computeFlashcardEvaluation({
  results,
  anonymousResults,
  common,
}: {
  results: ElementResultsFlashcard
  anonymousResults: ElementResultsFlashcard
  common: CommonEvaluationProps
}) {
  return {
    ...common,
    results: {
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
      correctCount:
        results[FlashcardCorrectness.CORRECT] +
        anonymousResults[FlashcardCorrectness.CORRECT],
      partialCount:
        results[FlashcardCorrectness.PARTIAL] +
        anonymousResults[FlashcardCorrectness.PARTIAL],
      incorrectCount:
        results[FlashcardCorrectness.INCORRECT] +
        anonymousResults[FlashcardCorrectness.INCORRECT],
    },
  }
}

function computeContentEvaluation({
  results,
  anonymousResults,
  common,
}: {
  results: ElementResultsContent
  anonymousResults: ElementResultsContent
  common: CommonEvaluationProps
}) {
  return {
    ...common,
    results: {
      totalAnswers: results.total + anonymousResults.total,
      anonymousAnswers: anonymousResults.total,
    },
  }
}

function computeInstanceEvaluation({
  instance,
}: {
  instance: ElementInstance
}) {
  const hasSampleSolution =
    'options' in instance.elementData &&
    'hasSampleSolution' in instance.elementData.options
      ? (instance.elementData.options.hasSampleSolution ?? false)
      : false
  const hasAnswerFeedbacks =
    'options' in instance.elementData &&
    'hasAnswerFeedbacks' in instance.elementData.options
      ? (instance.elementData.options.hasAnswerFeedbacks ?? false)
      : false

  const instanceType = instance.elementData.type
  const commonInstanceData = {
    id: instance.id,
    type: instanceType,
    name: instance.elementData.name,
    content: instance.elementData.content,
    explanation: instance.elementData.explanation,
    hasSampleSolution,
    hasAnswerFeedbacks,
  }

  if (
    (instanceType === ElementType.SC ||
      instanceType === ElementType.MC ||
      instanceType === ElementType.KPRIM) &&
    'choices' in instance.results &&
    'choices' in instance.anonymousResults
  ) {
    return computeChoicesEvaluation({
      options: instance.elementData.options,
      results: instance.results,
      anonymousResults: instance.anonymousResults,
      common: commonInstanceData,
    })
  } else if (
    instanceType === ElementType.NUMERICAL &&
    'responses' in instance.results &&
    'responses' in instance.anonymousResults
  ) {
    return computeNumericalEvaluation({
      options: instance.elementData.options,
      results: instance.results,
      anonymousResults: instance.anonymousResults,
      common: commonInstanceData,
    })
  } else if (
    instanceType === ElementType.FREE_TEXT &&
    'responses' in instance.results &&
    'responses' in instance.anonymousResults
  ) {
    return computeFreeTextEvaluation({
      options: instance.elementData.options,
      results: instance.results,
      anonymousResults: instance.anonymousResults,
      common: commonInstanceData,
    })
  } else if (
    instanceType === ElementType.FLASHCARD &&
    FlashcardCorrectness.CORRECT in instance.results &&
    FlashcardCorrectness.CORRECT in instance.anonymousResults
  ) {
    return computeFlashcardEvaluation({
      results: instance.results,
      anonymousResults: instance.anonymousResults,
      common: commonInstanceData,
    })
  } else if (instanceType === ElementType.CONTENT) {
    return computeContentEvaluation({
      results: instance.results,
      anonymousResults: instance.anonymousResults,
      common: commonInstanceData,
    })
  }

  return undefined
}

export function computeStackEvaluation(
  stacks: (ElementStack & { elements: ElementInstance[] })[]
) {
  return stacks.map((stack) => ({
    stackId: stack.id!,
    stackName: stack.displayName,
    stackDescription: stack.description,
    stackOrder: stack.order,

    instances: stack.elements
      .map((instance) => computeInstanceEvaluation({ instance }))
      .filter((instance) => typeof instance !== 'undefined'),
  }))
}

type EvaluationAggregationReturn = {
  evaluation: InstanceEvaluation | undefined
  newStatus: StackFeedbackStatus
  stackScore: number | undefined
}

function getPreviousEvaluationFlashcard({
  instanceId,
  elementData,
  lastResponse,
}: {
  instanceId: number
  elementData: FlashcardElementData
  lastResponse: SingleQuestionResponseFlashcard
}): EvaluationAggregationReturn {
  return {
    evaluation: {
      ...elementData,
      instanceId,
      elementType: ElementType.FLASHCARD,
      score: 0,
      correctness: null,
      lastResponse,
    },
    newStatus: flashcardResultMap[lastResponse.correctness],
    stackScore: undefined,
  }
}

function getPreviousEvaluationContent({
  instanceId,
  elementData,
  lastResponse,
}: {
  instanceId: number
  elementData: ContentElementData
  lastResponse: SingleQuestionResponseContent
}): EvaluationAggregationReturn {
  return {
    evaluation: {
      ...elementData,
      instanceId,
      elementType: ElementType.CONTENT,
      score: 0,
      correctness: 1,
      lastResponse,
    },
    newStatus: StackFeedbackStatus.CORRECT,
    stackScore: undefined,
  }
}

function getPreviousEvaluationChoices({
  instanceId,
  elementData,
  multiplier,
  results,
  anonymousResults,
  lastResponse,
}: {
  instanceId: number
  elementData: ChoicesElementData
  multiplier: number | undefined
  results: ElementResultsChoices
  anonymousResults: ElementResultsChoices
  lastResponse: SingleQuestionResponseChoices
}): EvaluationAggregationReturn {
  const correctness = evaluateChoicesAnswerCorrectness({
    elementData,
    response: lastResponse,
  })

  const instanceEvaluation = evaluateChoicesElementResponse({
    elementData,
    results,
    anonymousResults,
    correctness,
    multiplier,
  })

  // if evaluation cannot be computed, return early
  if (!instanceEvaluation) {
    return {
      evaluation: undefined,
      newStatus: StackFeedbackStatus.UNANSWERED,
      stackScore: undefined,
    }
  }

  return {
    evaluation: {
      ...instanceEvaluation,
      ...elementData,
      instanceId,
      pointsAwarded: instanceEvaluation.score,
      xpAwarded: instanceEvaluation.xp ?? undefined,
      correctness,
      lastResponse,
    },
    newStatus:
      correctness === 1
        ? StackFeedbackStatus.CORRECT
        : correctness === 0
          ? StackFeedbackStatus.INCORRECT
          : StackFeedbackStatus.PARTIAL,
    stackScore: instanceEvaluation.score,
  }
}

function getPreviousEvaluationNumerical({
  instanceId,
  elementData,
  multiplier,
  results,
  anonymousResults,
  lastResponse,
}: {
  instanceId: number
  elementData: NumericalElementData
  multiplier: number | undefined
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
  lastResponse: SingleQuestionResponseValue
}) {
  const correctness = evaluateNumericalAnswerCorrectness({
    elementData,
    response: lastResponse,
  })

  const instanceEvaluation = evaluateNumericalElementResponse({
    elementData,
    results,
    anonymousResults,
    correctness,
    multiplier,
  })

  // if evaluation cannot be computed, return early
  if (!instanceEvaluation) {
    return {
      evaluation: undefined,
      newStatus: StackFeedbackStatus.UNANSWERED,
      stackScore: undefined,
    }
  }

  return {
    evaluation: {
      ...instanceEvaluation,
      ...elementData,
      instanceId,
      pointsAwarded: instanceEvaluation.score,
      xpAwarded: instanceEvaluation.xp ?? undefined,
      solutionRanges:
        elementData.options.hasSampleSolution &&
        elementData.options.solutionRanges
          ? elementData.options.solutionRanges
          : [],
      correctness,
      lastResponse,
    },
    newStatus:
      correctness === 1
        ? StackFeedbackStatus.CORRECT
        : correctness === 0
          ? StackFeedbackStatus.INCORRECT
          : StackFeedbackStatus.PARTIAL,
    stackScore: instanceEvaluation.score,
  }
}

function getPreviousEvaluationFreeText({
  instanceId,
  elementData,
  multiplier,
  results,
  anonymousResults,
  lastResponse,
}: {
  instanceId: number
  elementData: FreeTextElementData
  multiplier: number | undefined
  results: ElementResultsOpen
  anonymousResults: ElementResultsOpen
  lastResponse: SingleQuestionResponseValue
}) {
  const correctness = evaluateFreeTextAnswerCorrectness({
    elementData,
    response: lastResponse,
  })

  const instanceEvaluation = evaluateFreeTextElementResponse({
    elementData,
    results,
    anonymousResults,
    correctness,
    multiplier,
  })

  // if evaluation cannot be computed, return early
  if (!instanceEvaluation) {
    return {
      evaluation: undefined,
      newStatus: StackFeedbackStatus.UNANSWERED,
      stackScore: undefined,
    }
  }

  return {
    evaluation: {
      ...instanceEvaluation,
      ...elementData,
      instanceId,
      pointsAwarded: instanceEvaluation.score,
      xpAwarded: instanceEvaluation.xp ?? undefined,
      solutions:
        elementData.options.hasSampleSolution && elementData.options.solutions
          ? elementData.options.solutions
          : [],
      correctness,
      lastResponse,
    },
    newStatus:
      correctness === 1
        ? StackFeedbackStatus.CORRECT
        : correctness === 0
          ? StackFeedbackStatus.INCORRECT
          : StackFeedbackStatus.PARTIAL,
    stackScore: instanceEvaluation.score,
  }
}

export async function getPreviousStackEvaluation(
  { stackId }: { stackId: number },
  ctx: Context
) {
  // previous results only exist for logged in users
  if (!ctx.user?.sub) {
    return null
  }

  const stack = await ctx.prisma.elementStack.findUnique({
    where: { id: stackId, type: ElementStackType.MICROLEARNING },
    include: {
      elements: {
        include: {
          responses: {
            where: {
              participantId: ctx.user.sub,
            },
          },
        },
      },
    },
  })

  // if no previous response exists, return null
  if (
    !stack ||
    !stack.elements ||
    !stack.elements[0] ||
    !stack.elements[0].responses
  ) {
    return null
  }

  // aggregate the evaluation content from the responses
  const { evaluations, stackScore, stackFeedback } = stack.elements.reduce<{
    evaluations: InstanceEvaluation[]
    stackScore: number | undefined
    stackFeedback: StackFeedbackStatus
  }>(
    (acc, element) => {
      if (
        !element.responses ||
        element.responses.length === 0 ||
        element.responses[0] === null ||
        typeof element.responses[0] === 'undefined'
      ) {
        return acc
      }

      if (element.elementData.type === ElementType.FLASHCARD) {
        const { evaluation, newStatus } = getPreviousEvaluationFlashcard({
          instanceId: element.id,
          elementData: element.elementData as FlashcardElementData,
          lastResponse: element.responses[0]
            .lastResponse as SingleQuestionResponseFlashcard,
        })

        if (typeof evaluation !== 'undefined') {
          acc.evaluations.push(evaluation)
          acc.stackFeedback = combineStackStatus({
            prevStatus: acc.stackFeedback,
            newStatus,
          })
        }
      } else if (element.elementData.type === ElementType.CONTENT) {
        const { evaluation, newStatus } = getPreviousEvaluationContent({
          instanceId: element.id,
          elementData: element.elementData,
          lastResponse: element.responses[0]
            .lastResponse as SingleQuestionResponseContent,
        })

        if (typeof evaluation !== 'undefined') {
          acc.evaluations.push(evaluation)
          acc.stackFeedback = combineStackStatus({
            prevStatus: acc.stackFeedback,
            newStatus,
          })
        }
      } else if (
        (element.elementData.type === ElementType.SC ||
          element.elementData.type === ElementType.MC ||
          element.elementData.type === ElementType.KPRIM) &&
        'choices' in element.results &&
        'choices' in element.anonymousResults
      ) {
        const { evaluation, newStatus, stackScore } =
          getPreviousEvaluationChoices({
            instanceId: element.id,
            elementData: element.elementData,
            multiplier: element.options.pointsMultiplier,
            results: element.results,
            anonymousResults: element.anonymousResults,
            lastResponse: element.responses[0]
              .lastResponse as SingleQuestionResponseChoices,
          })

        if (evaluation) {
          acc.evaluations.push(evaluation)
          acc.stackFeedback = combineStackStatus({
            prevStatus: acc.stackFeedback,
            newStatus,
          })
          acc.stackScore = (acc.stackScore ?? 0) + (stackScore ?? 0)
        }
      } else if (
        element.elementData.type === ElementType.NUMERICAL &&
        'responses' in element.results &&
        'responses' in element.anonymousResults
      ) {
        const { evaluation, newStatus, stackScore } =
          getPreviousEvaluationNumerical({
            instanceId: element.id,
            elementData: element.elementData,
            multiplier: element.options.pointsMultiplier,
            results: element.results,
            anonymousResults: element.anonymousResults,
            lastResponse: element.responses[0]
              .lastResponse as SingleQuestionResponseValue,
          })

        if (evaluation) {
          acc.evaluations.push(evaluation)
          acc.stackFeedback = combineStackStatus({
            prevStatus: acc.stackFeedback,
            newStatus,
          })
          acc.stackScore = (acc.stackScore ?? 0) + (stackScore ?? 0)
        }
      } else if (
        element.elementData.type === ElementType.FREE_TEXT &&
        'responses' in element.results &&
        'responses' in element.anonymousResults
      ) {
        const { evaluation, newStatus, stackScore } =
          getPreviousEvaluationFreeText({
            instanceId: element.id,
            elementData: element.elementData,
            multiplier: element.options.pointsMultiplier,
            results: element.results,
            anonymousResults: element.anonymousResults,
            lastResponse: element.responses[0]
              .lastResponse as SingleQuestionResponseValue,
          })

        if (evaluation) {
          acc.evaluations.push(evaluation)
          acc.stackFeedback = combineStackStatus({
            prevStatus: acc.stackFeedback,
            newStatus,
          })
          acc.stackScore = (acc.stackScore ?? 0) + (stackScore ?? 0)
        }
      } else {
        throw new Error(
          `Evaluation aggregation for element type ${element.elementData.type} not implemented`
        )
      }

      return acc
    },
    {
      evaluations: [],
      stackScore: undefined,
      stackFeedback: StackFeedbackStatus.UNANSWERED,
    }
  )

  return {
    id: stack.id,
    status: stackFeedback,
    score: stackScore,
    evaluations,
  }
}
// #endregion
